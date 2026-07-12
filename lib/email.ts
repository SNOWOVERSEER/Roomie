import { Resend } from "resend";
import { env } from "./env";
import { formatCents } from "./catalog";
import type { OrderRow } from "./supabase-admin";

/*
 * 交易邮件（Resend）。无 RESEND_API_KEY 时静默降级：只记日志不发送，
 * 下单/发货主流程不受影响 —— key 补上即自动生效。
 *
 * TODO(上线)：在 Resend 验证 roomiepaw.com.au 后把 RESEND_FROM 换成
 * 正式发件人；域名验证前 onboarding@resend.dev 只能发给账户本人邮箱。
 */

const BRAND = {
  orange: "#E8863C",
  navy: "#12275e",
  blue: "#3A5BC7",
  cream: "#EDEAE3",
  paper: "#FBF9F4",
  ink: "#2b2620",
  inkSoft: "#6f6a61",
};

function shell(title: string, body: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${BRAND.cream};">
<div style="display:none;max-height:0;overflow:hidden;">${title}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="padding:0 8px 18px;">
    <span style="font:800 22px/1 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.orange};letter-spacing:.5px;">Roomie</span>
    <span style="font:700 11px/1 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.inkSoft};letter-spacing:.14em;text-transform:uppercase;">&nbsp;&nbsp;pet things that feel like home</span>
  </td></tr>
  <tr><td style="background:${BRAND.paper};border-radius:18px;padding:32px 30px;box-shadow:0 10px 30px rgba(18,39,94,.08);">
    ${body}
  </td></tr>
  <tr><td style="padding:16px 8px 0;font:400 12px/1.6 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.inkSoft};">
    Roomie · Melbourne · furniture you share with the cat<br>
    Questions? Just reply to this email.
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function itemRows(order: OrderRow): string {
  return order.items
    .map(
      (it) => `
  <tr>
    <td style="padding:10px 0;font:600 14px/1.4 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.ink};border-bottom:1px dashed #d9d4c9;">
      ${it.title}${it.variant ? `<span style="color:${BRAND.inkSoft};font-weight:400;"> · ${it.variant}</span>` : ""}
      <span style="color:${BRAND.inkSoft};font-weight:400;">× ${it.qty}</span>
    </td>
    <td align="right" style="padding:10px 0;font:600 14px/1.4 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.ink};border-bottom:1px dashed #d9d4c9;white-space:nowrap;">
      ${formatCents(it.unit_cents * it.qty)}
    </td>
  </tr>`,
    )
    .join("");
}

function addressBlock(order: OrderRow): string {
  const a = (order.shipping_address ?? {}) as {
    line1?: string; line2?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
  };
  const lines = [a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(" "), a.country]
    .filter(Boolean)
    .join("<br>");
  if (!lines) return "";
  return `
  <p style="margin:22px 0 0;font:700 11px/1 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.inkSoft};letter-spacing:.14em;text-transform:uppercase;">Shipping to</p>
  <p style="margin:6px 0 0;font:400 14px/1.6 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.ink};">${lines}</p>`;
}

const houseNote = (order: OrderRow) =>
  order.items.some((it) => it.handle === "canvas-house")
    ? `<p style="margin:18px 0 0;padding:12px 14px;background:${BRAND.cream};border-radius:12px;font:400 13px/1.6 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.ink};">
        Your Canvas House number is stamped on the frame — we build the run in order and email you the moment yours is on the bench.
      </p>`
    : "";

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
    // 邮件失败不应让订单流程失败 —— 记日志由人工补发
    console.error(`[email] 发送失败「${subject}」→ ${to}:`, error.message);
    return { skipped: false as const, error: error.message };
  }
  return { skipped: false as const, id: data?.id };
}

export function orderConfirmationEmail(order: OrderRow) {
  const subject = `Order № ${order.order_number} confirmed — it's yours`;
  const body = `
    <p style="margin:0;font:700 12px/1 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.orange};letter-spacing:.16em;text-transform:uppercase;">Order № ${order.order_number} · confirmed</p>
    <h1 style="margin:10px 0 0;font:800 26px/1.15 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.blue};">It's yours${order.customer_name ? `, ${order.customer_name.split(" ")[0]}` : ""}.</h1>
    <p style="margin:12px 0 0;font:400 14px/1.6 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.inkSoft};">
      Payment received — the room is being prepared. We'll email again the moment it ships, tracking included.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      ${itemRows(order)}
      <tr>
        <td style="padding:12px 0 0;font:800 15px/1 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.ink};">Total · free AU shipping</td>
        <td align="right" style="padding:12px 0 0;font:800 15px/1 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.ink};white-space:nowrap;">${formatCents(order.amount_total)}</td>
      </tr>
    </table>
    ${houseNote(order)}
    ${addressBlock(order)}`;
  return { subject, html: shell(subject, body) };
}

export function shippingNoticeEmail(order: OrderRow) {
  const subject = `Order № ${order.order_number} is on the way`;
  const trackBtn = order.tracking_url
    ? `<a href="${order.tracking_url}" style="display:inline-block;margin-top:18px;background:${BRAND.orange};color:#fff8ee;font:700 15px/1 'Trebuchet MS',Verdana,sans-serif;text-decoration:none;border-radius:999px;padding:13px 26px;">Track the parcel →</a>`
    : "";
  const body = `
    <p style="margin:0;font:700 12px/1 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.orange};letter-spacing:.16em;text-transform:uppercase;">Order № ${order.order_number} · shipped</p>
    <h1 style="margin:10px 0 0;font:800 26px/1.15 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.blue};">It's on the way.</h1>
    <p style="margin:12px 0 0;font:400 14px/1.6 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.inkSoft};">
      ${order.carrier ? `${order.carrier} has it now.` : "The parcel is with the carrier."}
      ${order.tracking_number ? `Tracking number: <strong style="color:${BRAND.ink};">${order.tracking_number}</strong>` : ""}
    </p>
    ${trackBtn}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      ${itemRows(order)}
    </table>
    ${addressBlock(order)}
    <p style="margin:18px 0 0;font:400 13px/1.6 'Trebuchet MS',Verdana,sans-serif;color:${BRAND.inkSoft};">
      Clear a patch of wall — someone's about to claim it.
    </p>`;
  return { subject, html: shell(subject, body) };
}

export async function sendOrderConfirmation(order: OrderRow) {
  const { subject, html } = orderConfirmationEmail(order);
  return deliver(order.email, subject, html);
}

export async function sendShippingNotice(order: OrderRow) {
  const { subject, html } = shippingNoticeEmail(order);
  return deliver(order.email, subject, html);
}
