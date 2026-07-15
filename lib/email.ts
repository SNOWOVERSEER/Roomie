import { Resend } from "resend";
import { env, PROD_ORIGIN } from "./env";
import { formatCents, getCatalogMap, type CatalogItem } from "./catalog";
import { ARTWORKS } from "./heroConfig";
import type { OrderItem, OrderRow } from "./supabase-admin";

/*
 * 交易邮件（Resend）。设计与站点 design system 同源：
 * cream 底 / paper 圆角卡 / 橙 kicker / 深蓝标题 / 虚线分隔 / 橙胶囊按钮，
 * 字体栈 Baloo 2 渐进增强（Apple Mail 等支持 webfont 的客户端生效，
 * 其余回落 Trebuchet MS）。logo 用 public/brand/email-logo.png（站点字标渲染）。
 *
 * 无 RESEND_API_KEY 时静默降级：只记日志不发送，主流程不受影响。
 * TODO(上线)：Resend 验证 roomiepaw.com.au 后把 RESEND_FROM 换正式发件人；
 * 验证前 onboarding@resend.dev 只能发给账户本人邮箱。
 */

const C = {
  orange: "#e8863c",
  orangeDeep: "#d4702a",
  blue: "#3a5bc7",
  blueDeep: "#2b4497",
  navy: "#12275e",
  cream: "#edeae3",
  creamWarm: "#f6f2e9",
  paper: "#f8f6f0",
  ink: "#2e2e33",
  inkSoft: "#5c5a55",
};

const DISPLAY = `'Baloo 2','Trebuchet MS','Segoe UI',Verdana,sans-serif`;
const BODY = `'Nunito Sans','Trebuchet MS','Segoe UI',Verdana,sans-serif`;

/* 邮件里的图片必须公网可达 —— 本地开发 NEXT_PUBLIC_URL 是 localhost，
   收件端会全部断链（踩过），所以非 https 一律回退生产域名 */
const base = () => {
  const u = env.publicUrl;
  return u && u.startsWith("https://") ? u : PROD_ORIGIN;
};

/* 所有进 HTML 的动态文本一律转义：variant/姓名/地址来自客户输入
   （checkout 白名单是第一道，这里是纵深防御的第二道） */
const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** 行缩略图（绝对 URL）：画芯 variant 对应画作平面稿，其余用商品图（products 表） */
function itemThumb(
  it: OrderItem,
  catalog: Map<string, CatalogItem>,
): string | null {
  const i = ARTWORKS.findIndex((a) => a.title === it.variant);
  if (i >= 0) return `${base()}/hero/art/flat-0${i + 1}.png`;
  const cat = catalog.get(it.handle);
  return cat?.image ? `${base()}${cat.image}` : null;
}

function shell(preheader: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito+Sans:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};padding:36px 14px 30px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:0 10px 20px;">
    <img src="${base()}/brand/email-logo.png" alt="RoomiePaw" height="40" style="height:40px;width:auto;border:0;display:block;">
  </td></tr>
  <tr><td style="background:${C.paper};border-radius:22px;padding:38px 36px 34px;">
    ${body}
  </td></tr>
  <tr><td style="padding:20px 10px 0;font:400 12.5px/1.7 ${BODY};color:${C.inkSoft};">
    <span style="color:${C.orange};font-weight:700;">RoomiePaw</span> · Melbourne, AU · furniture you share with your pets<br>
    Questions about your order? Just reply to this email.
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const kicker = (text: string) =>
  `<p style="margin:0;font:800 12px/1 ${DISPLAY};color:${C.orangeDeep};letter-spacing:.16em;text-transform:uppercase;">${text}</p>`;

const heading = (text: string) =>
  `<h1 style="margin:12px 0 0;font:800 30px/1.12 ${DISPLAY};color:${C.blueDeep};">${text}</h1>`;

const para = (text: string) =>
  `<p style="margin:14px 0 0;font:400 14.5px/1.65 ${BODY};color:${C.inkSoft};">${text}</p>`;

function itemsTable(order: OrderRow, catalog: Map<string, CatalogItem>): string {
  const rows = order.items
    .map((it) => {
      const thumb = itemThumb(it, catalog);
      return `
  <tr>
    <td width="56" style="padding:12px 14px 12px 0;">
      ${thumb ? `<img src="${thumb}" alt="" width="48" style="width:48px;height:64px;object-fit:cover;border-radius:9px;border:0;display:block;background:${C.cream};">` : ""}
    </td>
    <td style="padding:12px 10px 12px 0;">
      <span style="font:700 14.5px/1.3 ${DISPLAY};color:${C.ink};">${esc(it.title)}</span><br>
      <span style="font:400 13px/1.5 ${BODY};color:${C.inkSoft};">${it.variant ? `${esc(it.variant)} · ` : ""}qty ${it.qty}</span>
    </td>
    <td align="right" style="padding:12px 0;font:700 14.5px/1.3 ${DISPLAY};color:${C.ink};white-space:nowrap;">
      ${formatCents(it.unit_cents * it.qty)}
    </td>
  </tr>
  <tr><td colspan="3" style="border-bottom:1.5px dashed #d9d4c9;font-size:0;line-height:0;">&nbsp;</td></tr>`;
    })
    .join("");

  const shipLabel =
    order.shipping_cents === 0 ? "Free" : formatCents(order.shipping_cents);

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
  ${rows}
  <tr>
    <td colspan="2" style="padding:14px 0 0;font:400 13.5px/1.4 ${BODY};color:${C.inkSoft};">Shipping · Australia-wide</td>
    <td align="right" style="padding:14px 0 0;font:700 13.5px/1.4 ${DISPLAY};color:${C.ink};white-space:nowrap;">${shipLabel}</td>
  </tr>
  <tr>
    <td colspan="2" style="padding:10px 0 0;font:800 16px/1.3 ${DISPLAY};color:${C.ink};">Total · GST included</td>
    <td align="right" style="padding:10px 0 0;font:800 16px/1.3 ${DISPLAY};color:${C.ink};white-space:nowrap;">${formatCents(order.amount_total)}</td>
  </tr>
</table>`;
}

function addressBlock(order: OrderRow): string {
  const a = (order.shipping_address ?? {}) as {
    name?: string; line1?: string; line2?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
  };
  const lines = [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(" "),
    a.country,
  ]
    .filter((s): s is string => !!s)
    .map(esc)
    .join("<br>");
  if (!lines) return "";
  return `
  <p style="margin:26px 0 0;font:800 11px/1 ${DISPLAY};color:${C.inkSoft};letter-spacing:.16em;text-transform:uppercase;">Shipping to</p>
  <p style="margin:8px 0 0;font:400 14px/1.65 ${BODY};color:${C.ink};">${lines}</p>`;
}

const houseNote = (order: OrderRow) =>
  order.items.some((it) => it.handle === "canvas-house")
    ? `<p style="margin:20px 0 0;padding:13px 16px;background:${C.creamWarm};border-radius:14px;font:400 13.5px/1.6 ${BODY};color:${C.ink};">
        Your Canvas House number is stamped on the frame. We build the run in order and will email you the moment yours is on the bench.
      </p>`
    : "";

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;margin-top:22px;background:${C.orange};color:#fff8ee;font:700 15px/1 ${DISPLAY};text-decoration:none;border-radius:999px;padding:14px 28px;">${label}</a>`;

/** 暖底提示盒（houseNote 同款视觉），内容需已转义 */
const noteBox = (html: string) =>
  `<p style="margin:20px 0 0;padding:13px 16px;background:${C.creamWarm};border-radius:14px;font:400 13.5px/1.6 ${BODY};color:${C.ink};">${html}</p>`;

async function deliver(to: string, subject: string, html: string) {
  if (!env.resendApiKey) {
    console.log(`[email] RESEND_API_KEY 未配置，跳过发送：「${subject}」→ ${to}`);
    return { skipped: true as const };
  }
  const resend = new Resend(env.resendApiKey);
  const { data, error } = await resend.emails.send({
    from: env.resendFrom,
    to,
    subject,
    html,
  });
  if (error) {
    // 邮件失败不让订单流程失败，记日志由人工补发
    console.error(`[email] 发送失败「${subject}」→ ${to}:`, error.message);
    return { skipped: false as const, error: error.message };
  }
  return { skipped: false as const, id: data?.id };
}

export async function orderConfirmationEmail(order: OrderRow) {
  const catalog = await getCatalogMap();
  const subject = `Order ${order.order_ref} confirmed. It's theirs now.`;
  const first = order.customer_name?.split(" ")[0];
  const body = `
    ${kicker(`Order ${order.order_ref} · confirmed`)}
    ${heading(`It's theirs now${first ? `, ${esc(first)}` : ""}.`)}
    ${para(
      "Payment received, and the room is being prepared. We'll email again the day it ships, tracking included.",
    )}
    ${itemsTable(order, catalog)}
    ${houseNote(order)}
    ${addressBlock(order)}`;
  return {
    subject,
    html: shell("Payment received. The room is being prepared.", body),
  };
}

export async function shippingNoticeEmail(order: OrderRow) {
  const catalog = await getCatalogMap();
  const subject = `Order ${order.order_ref} is on the way`;
  const carrierLine = order.carrier
    ? `${order.carrier === "auspost" ? "Australia Post" : order.carrier === "sendle" ? "Sendle" : order.carrier} has it now.`
    : "The parcel is with the carrier.";
  const body = `
    ${kicker(`Order ${order.order_ref} · shipped`)}
    ${heading("It's on the way.")}
    ${para(
      `${carrierLine}${order.tracking_number ? ` Tracking number: <strong style="color:${C.ink};">${esc(order.tracking_number)}</strong>` : ""}`,
    )}
    ${order.tracking_url ? button(order.tracking_url, "Track the parcel") : ""}
    ${itemsTable(order, catalog)}
    ${addressBlock(order)}
    ${para("Clear a patch of wall. Somebody is about to claim it.")}`;
  return { subject, html: shell("Tracking inside. Claws at the ready.", body) };
}

/* ―― 订单生命周期邮件（admin 触发；文案约定：英文、无长破折号）―― */

const REFUND_ETA = "It usually lands within 5 to 10 business days.";

export async function cancellationEmail(order: OrderRow, refundCents: number) {
  const catalog = await getCatalogMap();
  const subject =
    refundCents > 0
      ? `Order ${order.order_ref} cancelled · refund on the way`
      : `Order ${order.order_ref} cancelled`;
  // refundCents = 0 只发生在「此前已全额退款、随后补取消」：paid 订单必然收过钱
  const refundLine =
    refundCents > 0
      ? `<strong style="color:${C.ink};">${formatCents(refundCents)}</strong> is heading back to your original payment method. ${REFUND_ETA}`
      : "Your payment for this order has already been refunded in full.";
  const body = `
    ${kicker(`Order ${order.order_ref} · cancelled`)}
    ${heading("Your order is cancelled.")}
    ${para(`We've cancelled order ${order.order_ref} in full. ${refundLine}`)}
    ${itemsTable(order, catalog)}
    ${para("The wall stays bare for now. If you change your mind, we'll be here.")}`;
  return { subject, html: shell("Order cancelled. Refund on its way.", body) };
}

export async function refundNoticeEmail(order: OrderRow, refundCents: number) {
  const catalog = await getCatalogMap();
  const subject = `A refund for order ${order.order_ref} is on the way`;
  // 调用方在 DB 更新后传入最新 order —— 用累计值判断是否部分退款
  const partial = order.refunded_cents < order.amount_total;
  const body = `
    ${kicker(`Order ${order.order_ref} · refund`)}
    ${heading("Money heading back your way.")}
    ${para(
      `We've refunded <strong style="color:${C.ink};">${formatCents(refundCents)}</strong> to your original payment method. ${REFUND_ETA}`,
    )}
    ${partial ? para("This is a partial refund. The rest of your order stands as placed.") : ""}
    ${itemsTable(order, catalog)}`;
  return { subject, html: shell("Your refund is on its way.", body) };
}

export async function returnInstructionsEmail(order: OrderRow, note?: string) {
  const catalog = await getCatalogMap();
  const subject = `Return for order ${order.order_ref} · next steps`;
  const body = `
    ${kicker(`Order ${order.order_ref} · return`)}
    ${heading("Let's bring it home.")}
    ${para(
      "We've started a return for your order. Reply to this email and we'll sort out the details together, return address included.",
    )}
    ${note?.trim() ? noteBox(esc(note.trim()).replaceAll("\n", "<br>")) : ""}
    ${para(
      `The full policy lives at <a href="${base()}/shipping-returns" style="color:${C.blueDeep};">roomiepaw · shipping &amp; returns</a>. Thirty days, original condition, original packaging if you still have it.`,
    )}
    ${itemsTable(order, catalog)}
    ${para("Pack it snugly. Couriers are not gentle people.")}`;
  return { subject, html: shell("Return started. Reply and we'll sort it.", body) };
}

export function customerNoteEmail(
  order: OrderRow,
  subject: string,
  message: string,
) {
  // 自由撰写：主题即标题；正文按空行分段，段内换行保留
  const paras = message
    .trim()
    .split(/\n{2,}/)
    .map((p) => para(esc(p).replaceAll("\n", "<br>")))
    .join("");
  const body = `
    ${kicker(`Order ${order.order_ref} · RoomiePaw`)}
    ${heading(esc(subject))}
    ${paras}`;
  return { subject, html: shell("A note about your order.", body) };
}

export async function sendOrderConfirmation(order: OrderRow) {
  const { subject, html } = await orderConfirmationEmail(order);
  return deliver(order.email, subject, html);
}

export async function sendShippingNotice(order: OrderRow) {
  const { subject, html } = await shippingNoticeEmail(order);
  return deliver(order.email, subject, html);
}

export async function sendCancellation(order: OrderRow, refundCents: number) {
  const { subject, html } = await cancellationEmail(order, refundCents);
  return deliver(order.email, subject, html);
}

export async function sendRefundNotice(order: OrderRow, refundCents: number) {
  const { subject, html } = await refundNoticeEmail(order, refundCents);
  return deliver(order.email, subject, html);
}

export async function sendReturnInstructions(order: OrderRow, note?: string) {
  const { subject, html } = await returnInstructionsEmail(order, note);
  return deliver(order.email, subject, html);
}

export async function sendCustomerNote(
  order: OrderRow,
  subject: string,
  message: string,
) {
  const { html } = customerNoteEmail(order, subject, message);
  return deliver(order.email, subject, html);
}
