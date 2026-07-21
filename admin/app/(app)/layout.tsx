import { stripeMode } from "@/lib/stripe";
import { db } from "@/lib/db";
import NavLinks, { type NavItem } from "@/components/NavLinks";

/* 已认证区骨架：侧栏 + 内容。登录页在组外，不带导航。 */

/** 侧栏待办角标（head count 查询，毫秒级；挂了也不该挡后台） */
async function toShipCount(): Promise<number> {
  try {
    const { count } = await db()
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid");
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mode = stripeMode();
  const items: NavItem[] = [
    { href: "/", label: "Dashboard" },
    { href: "/orders", label: "Orders", count: await toShipCount() },
    { href: "/products", label: "Products" },
    { href: "/customers", label: "Customers" },
    { href: "/waitlist", label: "Waitlist" },
  ];
  return (
    <div className="frame">
      <aside className="side">
        <div className="brand">
          Roomie
          <span className="brandTag">admin</span>
        </div>
        <NavLinks items={items} />
        <div className="sideFoot">
          <span className={`modeChip ${mode === "live" ? "live" : ""}`}>
            <span className="modeDot" aria-hidden />
            Stripe {mode}
          </span>
          <a
            href="https://roomiepaw.com.au"
            target="_blank"
            rel="noreferrer"
          >
            Storefront ↗
          </a>
          <span className="hint">local only · 127.0.0.1:3100</span>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
