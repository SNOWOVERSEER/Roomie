import { cookies } from "next/headers";

/*
 * 口令层：复用生产已有的 ADMIN_SECRET（根 .env.local）。
 * cookie 值 = sha256("roomie-admin-session:" + secret)，无状态、重启不失效；
 * middleware（edge）与 server actions（node）用 Web Crypto 计算同一值。
 */
export async function sessionToken(): Promise<string> {
  const secret = process.env.ADMIN_SECRET ?? "";
  if (!secret) throw new Error("ADMIN_SECRET missing in root .env.local");
  const data = new TextEncoder().encode(`roomie-admin-session:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** server action 纵深防御：middleware 之外再验一次 cookie */
export async function assertAuth(): Promise<void> {
  const got = (await cookies()).get("admin_auth")?.value;
  if (!got || got !== (await sessionToken())) throw new Error("unauthorized");
}
