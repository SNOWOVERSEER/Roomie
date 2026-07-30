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
import DegradedRetry from "./DegradedRetry";
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

/**
 * 服务端 → 客户端的购物车契约（服务端产出见 lib/inventory.ts getCartSnapshot）。
 * layout 传的是**未 await 的 promise**：await 会挡住整棵树，冷进入就是几秒白屏。
 */
export interface CartSnapshot {
  catalog: ClientCatalogItem[];
  /** 目录缺失（DB 不可达）。true = 金额不可信，只读不写、不显示金额 */
  catalogUnknown: boolean;
  /** 本轮任一读取降级 → 需要客户端稍后补价 */
  degraded: boolean;
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
  /** 目录快照缺失（DB 短暂不可达）。true 时金额一律不可信，别显示、别结算 */
  catalogUnknown: boolean;
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
  catalogUnknown: false,
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
  /* true = 目录快照缺失（DB 短暂不可达，见 lib/degrade.ts）。此时**绝不能**
     拿空目录去筛购物车行——那会把用户的购物车整个清空并写回 localStorage，
     比原来的错误页伤害更大。未知就原样留着，等下次渲染拿到目录再筛。 */
  catalogUnknown = false,
): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is CartLine =>
        !!l &&
        typeof l === "object" &&
        typeof (l as CartLine).handle === "string" &&
        (catalogUnknown || (l as CartLine).handle in catalog) &&
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
  snapshot,
  children,
}: {
  /** 未 await 的服务端 promise —— 解开它绝不能挡住 children 的渲染 */
  snapshot: Promise<CartSnapshot>;
  children: React.ReactNode;
}) {
  /* 刻意用 effect 而不是 use()：use() 会让本组件挂起，children 跟着一起
     挂起，等于白等回来了。这里让 shell 先渲染，快照到了再补。 */
  const [snap, setSnap] = useState<CartSnapshot | null>(null);
  useEffect(() => {
    let alive = true;
    snapshot.then(
      (s) => {
        if (alive) setSnap(s);
      },
      () => {
        /* 服务端已在 lib/degrade.ts 兜过，这里不该有异常；真有也保持未知 */
      },
    );
    return () => {
      alive = false;
    };
  }, [snapshot]);

  /* 快照未到 == 目录未知，与 DB 不可达同等对待（只读不写、不显示金额）。
     这个窗口极短——RSC 流通常在水合前就把快照送到了。 */
  const catalogUnknown = snap === null || snap.catalogUnknown;
  const catalog = useMemo(
    () => Object.fromEntries((snap?.catalog ?? []).map((i) => [i.handle, i])),
    [snap],
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

  /* 存储只读一次。**不能**把 catalog 放进依赖里重跑：快照到达会让它重跑，
     那样用户在这一秒内加的行会被存储里的旧值覆盖掉。读的时候一律按
     「目录未知」处理（不筛），筛的动作交给下面那个 effect。 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(sanitize(JSON.parse(raw), {}, true));
    } catch {
      /* 损坏的存储直接放弃 */
    }
    setHydrated(true);
  }, []);

  /* 目录到达后补筛一次，剔掉已不在售的行（对应原来 sanitize 的目录校验）。
     内容没变就返回原数组，避免白白多一次渲染。 */
  useEffect(() => {
    if (!hydrated || catalogUnknown) return;
    setLines((prev) => {
      const next = prev.filter((l) => l.handle in catalog);
      return next.length === prev.length ? prev : next;
    });
  }, [hydrated, catalogUnknown, catalog]);

  useEffect(() => {
    if (!hydrated) return;
    // 目录未知时只读不写：这一轮没有权威目录，不能让降级渲染改写存储
    if (catalogUnknown) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* 隐私模式等写失败可忽略 */
    }
  }, [lines, hydrated, catalogUnknown]);

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
        catalogUnknown,
        add,
        setQty,
        remove,
        clear,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
      {/* 本轮降级了 → 后台重跑服务端渲染把价格补回来；补上后 degraded
          变 false，本组件卸载、定时器自动清理（见 DegradedRetry 顶部） */}
      {snap?.degraded && <DegradedRetry />}
      <CartDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        lines={lines}
        count={count}
        subtotalCents={subtotalCents}
        catalog={catalog}
        catalogUnknown={catalogUnknown}
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
