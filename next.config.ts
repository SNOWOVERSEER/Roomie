import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 明确工作区根目录（用户主目录存在其他 lockfile，避免误判）
  outputFileTracingRoot: path.join(__dirname),
  // 本地验证构建用 BUILD_DIR=.next-build 与 dev 的 .next 隔离
  // （共用会把 dev 缓存覆盖坏：vendor-chunks ENOENT、样式崩，见 HANDOVER §9）；
  // Vercel 不设该变量，生产仍是默认 .next
  distDir: process.env.BUILD_DIR || ".next",
};

export default nextConfig;
