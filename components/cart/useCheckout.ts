"use client";

import { useState } from "react";
import type { CartLine } from "@/components/CartContext";

/*
 * 结算入口（抽屉与 /cart 页共用）：POST /api/checkout → 跳 Stripe 托管页。
 *
 * 每行一并带上**页面上显示的单价**。渲染路径带缓存，店主改完价的头几
 * 分钟里客人看到的可能是旧价；服务端拿真值逐行一对，不一致就退回来让
 * 客人刷新，而不是闷声按新价扣款（闸门在 app/api/checkout/route.ts）。
 * 传单价不传小计：服务端会归一化 qty，拿小计对账会误报。
 */
export function useCheckout(
  lines: CartLine[],
  catalog: Record<string, { priceCents: number }>,
) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const checkout = async () => {
    if (lines.length === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            handle: l.handle,
            variant: l.variant,
            qty: l.qty,
            unit_cents: catalog[l.handle]?.priceCents,
          })),
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        title?: string;
      };
      if (res.status === 409 && data.error === "price_changed") {
        setErr("Our prices just changed. Refresh the page to see the new total.");
        setBusy(false);
        return;
      }
      if (res.status === 409 && data.title) {
        setErr(
          `${data.title} just sold out. Remove it from the basket to continue.`,
        );
        setBusy(false);
        return;
      }
      if (!res.ok || !data.url) throw new Error(data.error ?? "no url");
      window.location.assign(data.url);
    } catch {
      setErr("Couldn't open the checkout. Give it another go in a moment.");
      setBusy(false);
    }
  };

  return { busy, err, checkout };
}
