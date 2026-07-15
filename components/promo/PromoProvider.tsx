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
import { usePathname } from "next/navigation";
import { PROMO_DISMISS_COOKIE, type Campaign } from "@/lib/promos";
import SubscribeDialog from "./SubscribeDialog";

/*
 * 活动栏位状态中枢。layout 在服务端读 cookie 算好初始可见性传进来，
 * SSR 首帧即正确：已关掉/已订阅的访客不会看到栏位闪一下再消失。
 * 这里管三件事：
 *  - dismiss：栏位收起 + 按活动 id 记 7 天 cookie（换新活动自动复活）
 *  - 订阅弹层开合（栏位 CTA 与站内其它入口都走 openSubscribe）
 *  - landing 的一次性自动邀请：滚过首屏且逛了几秒才出现，一生一次
 *    （localStorage 记档），已订阅/已关栏位的人永远不打扰
 */

type PromoCtx = {
  campaign: Campaign | null;
  dismiss: () => void;
  openSubscribe: (source?: string) => void;
  subscribed: boolean;
};

const Ctx = createContext<PromoCtx>({
  campaign: null,
  dismiss: () => {},
  openSubscribe: () => {},
  subscribed: false,
});

export const usePromo = () => useContext(Ctx);

/** 自动邀请只弹一次的档案键（手动打开过也算见过） */
const PROMPTED_KEY = "rp_letter_prompted";

export default function PromoProvider({
  campaign: initialCampaign,
  subscribed: initialSubscribed,
  children,
}: {
  campaign: Campaign | null;
  subscribed: boolean;
  children: React.ReactNode;
}) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [source, setSource] = useState("promo-bar");
  const pathname = usePathname();

  const dismiss = useCallback(() => {
    setCampaign((c) => {
      if (c) {
        document.cookie = `${PROMO_DISMISS_COOKIE}=${encodeURIComponent(c.id)}; max-age=${7 * 24 * 3600}; path=/; SameSite=Lax`;
      }
      return null;
    });
  }, []);

  const openSubscribe = useCallback((src: string = "promo-bar") => {
    setSource(src);
    setDialogOpen(true);
    try {
      localStorage.setItem(PROMPTED_KEY, "1");
    } catch {
      /* 隐私模式等拿不到 storage：只影响“只弹一次”，不影响功能 */
    }
  }, []);

  // 订阅成功：letter 活动位退休；将来别的活动（sale 等）不受影响
  const onSubscribed = useCallback(() => {
    setSubscribed(true);
    setCampaign((c) => (c && c.kind === "subscribe" ? null : c));
  }, []);

  const autoArmed = useRef(false);
  useEffect(() => {
    if (autoArmed.current) return;
    if (pathname !== "/") return;
    if (!campaign || campaign.kind !== "subscribe" || subscribed) return;
    try {
      if (localStorage.getItem(PROMPTED_KEY)) return;
    } catch {
      return;
    }
    autoArmed.current = true;
    const t0 = Date.now();
    const onScroll = () => {
      // 滚过 ~0.6 屏且到站超过 6 秒：确认是在逛，不是刚进门就被拦
      if (
        window.scrollY > window.innerHeight * 0.6 &&
        Date.now() - t0 > 6000
      ) {
        window.removeEventListener("scroll", onScroll);
        openSubscribe("auto-invite");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname, campaign, subscribed, openSubscribe]);

  const value = useMemo(
    () => ({ campaign, dismiss, openSubscribe, subscribed }),
    [campaign, dismiss, openSubscribe, subscribed],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <SubscribeDialog
        open={dialogOpen}
        source={source}
        onClose={() => setDialogOpen(false)}
        onSubscribed={onSubscribed}
      />
    </Ctx.Provider>
  );
}
