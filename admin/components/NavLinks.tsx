"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* 侧边导航：active 态 = paper 底 + 橙点标记（沿用主站圆点列表语汇） */

export interface NavItem {
  href: string;
  label: string;
  /** 待办角标（如 Orders 的待发货数），0/undefined 不显示 */
  count?: number;
}

export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <ul className="sideNav">
      {items.map((it) => (
        <li key={it.href}>
          <Link
            href={it.href}
            className={isActive(it.href) ? "on" : undefined}
            aria-current={isActive(it.href) ? "page" : undefined}
          >
            {it.label}
            {it.count ? <span className="navCount">{it.count}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
