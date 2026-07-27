import { NextRequest, NextResponse } from "next/server";
import { Resend, type WebhookEventPayload } from "resend";
import { env } from "@/lib/env";

/*
 * POST /api/inbound —— Resend 收件事件入口（email.received）。
 * 职责：把发到 hello@roomiepaw.com.au 的来信转进店主邮箱（INBOUND_FORWARD_TO）。
 *
 * 转发不用 receiving.forward：passthrough 会把 From 换成我们自己、不带
 * Reply-To，Gmail 里点回复会回到自己头上（2026-07-27 实测）。改为读原文重发：
 *   From     = 「客户显示名 via RoomiePaw <inbox@域>」（发件域必须是已验证域）
 *   To       = hello@（Gmail「从接收地址回复」据此自动选中 hello@ 发信身份）
 *   Bcc      = 店主邮箱（实际送达）
 *   Reply-To = 客户原地址（点回复即回给客户）
 *   Subject  = 原样不加前缀（客户侧回信按主题聚合线程）
 * 代价：To=hello@ 让转发副本回流 receiving 多存一份，由下面的自域守卫挡住
 * 二次转发，不会循环。
 *
 * 守卫链：验签（Standard Webhooks/svix）→ 只认 email.received → 自域来信
 * 不转（转发副本/自测/自家系统信）→ 退信机器人不转 → 只转 hello@ 的信 →
 * Auto-Submitted 自动信不转（RFC 3834 防循环）。
 * 失败语义：拿信/发信失败 → 500（svix 按退避重试，最终不丢信）；未配置 →
 * 503（与 Stripe webhook 同款「探针可区分缺密钥/坏签名」语义）。
 */

export const maxDuration = 30;

const FORWARD_FOR = "hello@roomiepaw.com.au";
const FORWARD_FROM_ADDR = "inbox@roomiepaw.com.au";

let client: Resend | null = null;
function getResend(): Resend {
  client ??= new Resend(env.resendApiKey);
  return client;
}

/** "Name <a@b>" | "a@b" → 纯地址（小写） */
function bareAddr(s: string): string {
  return (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();
}

/** 转发 From 的显示名：沿用客户显示名，剥掉会破坏邮件头的字符 */
function displayName(rawFrom: string): string {
  const name = rawFrom.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] ?? bareAddr(rawFrom);
  return name.replace(/[\r\n"<>;,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

const skip = (reason: string) => NextResponse.json({ ok: true, skipped: reason });

export async function POST(req: NextRequest) {
  if (!env.resendWebhookSecret || !env.inboundForwardTo || !env.resendApiKey) {
    return NextResponse.json({ error: "inbound not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const h = req.headers;
  let event: WebhookEventPayload;
  try {
    event = getResend().webhooks.verify({
      payload,
      webhookSecret: env.resendWebhookSecret,
      headers: {
        id: h.get("svix-id") ?? h.get("webhook-id") ?? "",
        timestamp: h.get("svix-timestamp") ?? h.get("webhook-timestamp") ?? "",
        signature: h.get("svix-signature") ?? h.get("webhook-signature") ?? "",
      },
    });
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  if (event.type !== "email.received") return skip("event");
  const meta = event.data;

  const sender = bareAddr(meta.from ?? "");
  if (sender.endsWith("@roomiepaw.com.au")) return skip("own-domain");
  if (/^(mailer-daemon|postmaster)@/.test(sender)) return skip("bounce-bot");
  const rcpts = [
    ...(meta.received_for ?? []),
    ...(meta.to ?? []),
    ...(meta.cc ?? []),
  ].map(bareAddr);
  if (!rcpts.includes(FORWARD_FOR)) return skip("not-for-hello");

  const resend = getResend();
  const got = await resend.emails.receiving.get(meta.email_id, {
    html_format: "data_uri",
  });
  if (got.error || !got.data) {
    return NextResponse.json({ error: "fetch email failed" }, { status: 500 });
  }
  const m = got.data;

  const headerOf = (name: string) =>
    Object.entries(m.headers ?? {}).find(
      ([k]) => k.toLowerCase() === name,
    )?.[1];
  const autoSubmitted = headerOf("auto-submitted");
  if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") {
    return skip("auto-submitted");
  }

  // 附件：内联图已折进 html 的 data URI，这里只带真附件（path 是 Resend
  // 托管的临时下载地址，send 时由 Resend 服务端取回）
  let files: { filename: string; path: string }[] = [];
  try {
    const att = await resend.emails.receiving.attachments.list({
      emailId: meta.email_id,
    });
    files = (att.data?.data ?? [])
      .filter((a) => a.content_disposition === "attachment")
      .map((a) => ({ filename: a.filename ?? "attachment", path: a.download_url }));
  } catch {
    // 附件清单拿不到不挡正文转发
  }

  const rawFrom = headerOf("from") ?? m.from;
  const base = {
    from: `${displayName(rawFrom)} via RoomiePaw <${FORWARD_FROM_ADDR}>`,
    to: [FORWARD_FOR],
    bcc: [env.inboundForwardTo],
    replyTo: rawFrom,
    subject: m.subject || "(no subject)",
  };

  // CreateEmailOptions 是判别联合：html/text 必须实际在场，不能 undefined 占位
  const content = m.html
    ? { html: m.html, ...(m.text ? { text: m.text } : {}) }
    : { text: m.text ?? "(empty message)" };

  let sent = await resend.emails.send({
    ...base,
    ...content,
    ...(files.length ? { attachments: files } : {}),
  });
  if (sent.error && files.length) {
    // 附件超限等场景：退化为无附件转发（信不能丢），正文补一行提示
    const note = `[${files.length} attachment(s) not forwarded, view them in the Resend dashboard]`;
    const degraded = m.html
      ? { html: `${m.html}<p><i>${note}</i></p>` }
      : { text: `${m.text ?? ""}\n\n${note}`.trim() };
    sent = await resend.emails.send({ ...base, ...degraded });
  }
  if (sent.error) {
    return NextResponse.json({ error: sent.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, forwarded: sent.data?.id });
}
