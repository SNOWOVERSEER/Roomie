"use client";

import { useState } from "react";
import type { CartLine } from "@/components/CartContext";

/* 结算入口（抽屉与 /cart 页共用）：POST /api/checkout → 跳 Stripe 托管页 */
export function useCheckout(lines: CartLine[]) {
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
          })),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "no url");
      window.location.assign(data.url);
    } catch {
      setErr("Couldn't open the checkout. Give it another go in a moment.");
      setBusy(false);
    }
  };

  return { busy, err, checkout };
}
