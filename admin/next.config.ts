import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/*
 * admin 永不部署，只在店主本机跑（127.0.0.1:3100）。
 * 密钥从仓库根 .env.local 读，不复制、不新增文件。
 */
const envPath = path.join(__dirname, "..", ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  console.warn("[admin] ../.env.local 不存在，密钥缺失时运行期会报错");
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
};
export default nextConfig;
