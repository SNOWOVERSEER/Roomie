"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { addToCartMock } from "@/lib/shopify";
import styles from "./CartContext.module.css";

interface CartState {
  count: number;
  bump: number; // 计数动画触发器
  add: (handle: string, title: string) => Promise<void>;
}

const Ctx = createContext<CartState>({
  count: 0,
  bump: 0,
  add: async () => {},
});

export const useCart = () => useContext(Ctx);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [bump, setBump] = useState(0);
  const [toast, setToast] = useState<{ title: string; key: number } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const add = useCallback(async (handle: string, title: string) => {
    await addToCartMock(handle);
    setCount((c) => c + 1);
    setBump((b) => b + 1);
    setToast({ title, key: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Ctx.Provider value={{ count, bump, add }}>
      {children}
      <div aria-live="polite">
        {toast && (
          <div className={styles.toast} key={toast.key}>
            <span className={styles.check} aria-hidden>
              ✓
            </span>
            <div>
              <strong>{toast.title}</strong> is in your basket
              <span className={styles.note}>
                checkout opens with our Shopify store — soon
              </span>
            </div>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
