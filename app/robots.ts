import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/env";

/* 正式域名后的 SEO 基建：API 与结算流程不进索引。
 *
 * 2026-07-27 起追加 SEO 工具爬虫黑名单：这批爬虫守 robots.txt、日常爬量
 * 远超搜索引擎、对我们零价值（它们的数据卖给买家，不带来客流）——全站谢客。
 * Google/Bing 等搜索爬虫走通配规则维持全站放行，SEO 不受影响。
 * 注意本文件只管"守规矩"的爬虫；恶意 bot 的防线在 Vercel Firewall
 * （Bot Protection Challenge + AI Bots + /api/ bypass，步骤见 runbook）。
 * AI 爬虫（GPTBot 等）刻意不写进这里：放行/拒绝由 Firewall 的 AI Bots
 * 规则集统一决定，避免两处口径打架。 */

const SEO_TOOL_BOTS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "PetalBot",
  "DataForSeoBot",
  "serpstatbot",
  "ZoominfoBot",
];

export default function robots(): MetadataRoute.Robots {
  const base = publicOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/cart", "/checkout/"],
      },
      ...SEO_TOOL_BOTS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
