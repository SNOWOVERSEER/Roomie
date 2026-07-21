import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/env";

/* 正式域名后的 SEO 基建：API 与结算流程不进索引 */
export default function robots(): MetadataRoute.Robots {
  const base = publicOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/cart", "/checkout/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
