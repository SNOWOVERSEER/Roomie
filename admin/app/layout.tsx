import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { stripeMode } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Roomie Admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mode = stripeMode();
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <strong style={{ color: "var(--orange-deep)" }}>Roomie Admin</strong>
          <Link href="/">Products</Link>
          <Link href="/orders">Orders</Link>
          <Link href="/waitlist">Waitlist</Link>
          <span className="mode">
            Stripe: <b className={mode === "live" ? "warn" : undefined}>{mode}</b>
            {" "}· local only (127.0.0.1:3100)
          </span>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
