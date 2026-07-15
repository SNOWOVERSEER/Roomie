/*
 * 活动栏位（promo bar）配置 —— 唯一事实源。
 * 上/换活动 = 改这个数组 + push（站点 force-dynamic，部署即生效）。
 * 文案红线：英文、不用长破折号（分隔用 ·）、不出现供应商。
 *
 * 取用规则：取数组里第一个「当前在窗口内」的活动 —— 限时活动放在
 * 常青位前面，到点自动顶上/让位。dismiss cookie 按活动 id 记 7 天，
 * 换了新活动自然会重新出现。
 */

export type Campaign = {
  /** cookie 作用域 + 埋点用，换活动必须换 id */
  id: string;
  /** 栏位一句话（英文，无长破折号） */
  message: string;
  /** 右侧按钮字 */
  cta: string;
  /** subscribe = 打开订阅弹层；link = 跳转 href */
  kind: "subscribe" | "link";
  href?: string;
  /** ISO 日期（含当天）；缺省 = 常青。按墨尔本时间粗算（+10，夏令时差一小时可忽略） */
  start?: string;
  end?: string;
};

export const CAMPAIGNS: Campaign[] = [
  // 限时活动示例（放在 letter-10 前面即可在窗口期内顶掉它）：
  // {
  //   id: "spring-sale-2026",
  //   message: "Spring week · 15% off swap-in prints",
  //   cta: "Shop prints",
  //   kind: "link",
  //   href: "/scratcher#prints",
  //   start: "2026-09-01",
  //   end: "2026-09-08",
  // },
  {
    id: "letter-10",
    message: "New pieces first, plus 10% off your first order",
    cta: "Claim 10% off",
    kind: "subscribe",
  },
];

export function activeCampaign(now: Date = new Date()): Campaign | null {
  for (const c of CAMPAIGNS) {
    const startOk = !c.start || now >= new Date(`${c.start}T00:00:00+10:00`);
    const endOk = !c.end || now <= new Date(`${c.end}T23:59:59+10:00`);
    if (startOk && endOk) return c;
  }
  return null;
}

/** 订阅欢迎码统一挂这枚 10% coupon（lazy 幂等创建；test/live 模式各自成立一次） */
export const WELCOME_COUPON_ID = "ROOMIE10";
export const WELCOME_PERCENT = 10;

/* cookie 名集中定义（layout 服务端读、客户端写共用） */
export const PROMO_DISMISS_COOKIE = "rp_promo_dismissed";
export const SUBSCRIBED_COOKIE = "rp_subscribed";
