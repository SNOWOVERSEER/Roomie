import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicOrigin();
  const page = (
    path: string,
    priority: number,
    changeFrequency: "weekly" | "monthly",
  ) => ({ url: `${base}${path}`, priority, changeFrequency });
  return [
    page("", 1, "weekly"),
    page("/scratcher", 0.9, "weekly"),
    page("/house", 0.9, "weekly"),
    page("/care", 0.4, "monthly"),
    page("/shipping-returns", 0.4, "monthly"),
    page("/privacy", 0.2, "monthly"),
    page("/terms", 0.2, "monthly"),
  ];
}
