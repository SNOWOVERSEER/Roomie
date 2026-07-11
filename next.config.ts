import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 明确工作区根目录（用户主目录存在其他 lockfile，避免误判）
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
