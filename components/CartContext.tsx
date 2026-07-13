"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CartDrawer from "./cart/CartDrawer";
import styles from "./CartContext.module.css";

/*
 * 购物车（P2：真实行项目，localStorage 持久化）。
 * 价格/标题/图片来自服务端注入的 catalog 快照（layout 查 products 表），
 * 存储里只有 handle+variant+qty —— 改价不会留下旧快照；
 * 服务端结算时还会再按 products 表 re-derive 一次。
 * 编号件一号一行、qty 恒 1、重复加购只弹提示。
 */

const STORAGE_KEY = "roomie-cart-v1";

/** layout（服务端）注入的商品快照：仅上架商品，含售罄标记 */
export interface ClientCatalogItem {
  handle: string;
  title: string;
  priceCents: number;
  image: string;
  numbered: boolean;
  soldOut: boolean;
}

export interface CartLine {
  key: string; // `${handle}::${variant ?? ""}`
  handle: string;
  variant?: string; // "Wave Light" / "№ 03"
  qty: number;
}

/** toast 文案可按动作定制（如猫屋预订不是「加入购物篮」语义） */
interface AddOptions {
  line?: string; // 标题后的短句，默认 "is in your basket"
  note?: string; // 次行说明
  toastTitle?: string;
}

interface CartState {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  bump: number; // 计数动画触发器
  /** handle → 商品快照（价格/标题/图/售罄），展示层唯一数据源 */
  catalog: Record<string, ClientCatalogItem>;
  add: (handle: string, variant?: string, opts?: AddOptions) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** 侧滑抽屉（Nav 篮子入口；/cart 整页仍保留作深链） */
  openDrawer: () => void;
  closeDrawer: () => void;
}

const Ctx = createContext<CartState>({
  lines: [],
  count: 0,
  subtotalCents: 0,
  bump: 0,
  catalog: {},
  add: () => {},
  setQty: () => {},
  remove: () => {},
  clear: () => {},
  openDrawer: () => {},
  closeDrawer: () => {},
});

export const useCart = () => useContext(Ctx);

const keyOf = (handle: string, variant?: string) =>
  `${handle}::${variant ?? ""}`;

function sanitize(
  raw: unknown,
  catalog: Record<string, ClientCatalogItem>,
): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is CartLine =>
        !!l &&
        typeof l === "object" &&
        typeof (l as CartLine).handle === "string" &&
        (l as CartLine).handle in catalog &&
        typeof (l as CartLine).qty === "number",
    )
    .map((l) => ({
      key: keyOf(l.handle, l.variant),
      handle: l.handle,
      variant: l.variant,
      qty: Math.min(9, Math.max(1, Math.round(l.qty))),
    }));
}

export function CartProvider({
  catalog: catalogList,
  children,
}: {
  catalog: ClientCatalogItem[];
  children: React.ReactNode;
}) {
  const catalog = useMemo(
    () => Object.fromEntries(catalogList.map((i) => [i.handle, i])),
    [catalogList],
  );
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [bump, setBump] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    line: string;
    note: string;
    key: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(sanitize(JSON.parse(raw), catalog));
    } catch {
      /* 损坏的存储直接放弃 */
    }
    setHydrated(true);
  }, [catalog]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* 隐私模式等写失败可忽略 */
    }
  }, [lines, hydrated]);

  const showToast = useCallback((title: string, line: string, note: string) => {
    setToast({ title, line, note, key: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  const add = useCallback<CartState["add"]>(
    (handle, variant, opts) => {
      const item = catalog[handle];
      if (!item) return;
      if (item.soldOut) {
        showToast(
          item.title,
          "is sold out right now",
          "check back soon, small batches move fast",
        );
        return;
      }
      const key = keyOf(handle, variant);
      const hit = lines.find((l) => l.key === key);
      const title =
        opts?.toastTitle ?? `${item.title}${variant ? ` · ${variant}` : ""}`;

      if (hit && item.numbered) {
        showToast(
          title,
          "is already held for you",
          "each number can only be claimed once",
        );
        return;
      }

      setLines((prev) =>
        prev.some((l) => l.key === key)
          ? prev.map((l) =>
              l.key === key ? { ...l, qty: Math.min(9, l.qty + 1) } : l,
            )
          : [...prev, { key, handle, variant, qty: 1 }],
      );
      setBump((b) => b + 1);
      showToast(
        title,
        opts?.line ?? "is in your basket",
        opts?.note ?? "checkout when you're ready. Payments by Stripe",
      );
    },
    [lines, catalog, showToast],
  );

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) =>
            l.key === key ? { ...l, qty: Math.min(9, qty) } : l,
          ),
    );
  }, []);

  const remove = useCallback(
    (key: string) => setLines((prev) => prev.filter((l) => l.key !== key)),
    [],
  );

  const clear = useCallback(() => setLines([]), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotalCents = lines.reduce(
    (s, l) => s + (catalog[l.handle]?.priceCents ?? 0) * l.qty,
    0,
  );

  return (
    <Ctx.Provider
      value={{
        lines,
        count,
        subtotalCents,
        bump,
        catalog,
        add,
        setQty,
        remove,
        clear,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
      <CartDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        lines={lines}
        count={count}
        subtotalCents={subtotalCents}
        catalog={catalog}
        setQty={setQty}
        remove={remove}
      />
      <div aria-live="polite">
        {toast && (
          <div className={styles.toast} key={toast.key}>
            <span className={styles.check} aria-hidden>
              ✓
            </span>
            <div>
              <strong>{toast.title}</strong> {toast.line}
              <span className={styles.note}>{toast.note}</span>
            </div>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
