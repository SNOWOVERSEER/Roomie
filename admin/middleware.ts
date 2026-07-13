import { NextRequest, NextResponse } from "next/server";

/*
 * 两层网关（edge）：
 * 1. Host 白名单：防 DNS rebinding（恶意网页把自己的域名解析到 127.0.0.1，
 *    绕过浏览器同源限制打本地服务）。只认本机两种写法。
 * 2. 认证 cookie：无有效 admin_auth 一律去 /login。
 */
const ALLOWED_HOSTS = new Set(["127.0.0.1:3100", "localhost:3100"]);

async function expectedToken(): Promise<string | null> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  const data = new TextEncoder().encode(`roomie-admin-session:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (!ALLOWED_HOSTS.has(host)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  if (req.nextUrl.pathname.startsWith("/login")) return NextResponse.next();

  const want = await expectedToken();
  const got = req.cookies.get("admin_auth")?.value;
  if (!want || got !== want) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
