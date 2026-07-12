/*
 * Supabase 迁移执行器：按序跑 supabase/migrations/*.sql，
 * 已执行的记录在 public.schema_migrations，重复跑安全。
 *
 * 连接策略：Supabase 直连主机（db.<ref>.supabase.co）是 IPv6-only，
 * 本机没有 IPv6 时自动退到 IPv4 的 Supavisor session pooler。
 *
 * 用法：npm run db:migrate（读取 .env.local 的 SUPABASE_URL / SUPABASE_DB_PASSWORD）
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 轻量 .env.local 解析（不引依赖；只在本地脚本用）
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const url = process.env.SUPABASE_URL ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref || !password) {
  console.error("需要 .env.local 里的 SUPABASE_URL 与 SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const candidates = [
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  // 悉尼区 pooler（本项目 Region）；跨区项目按需追加
  { host: "aws-0-ap-southeast-2.pooler.supabase.com", port: 5432, user: `postgres.${ref}` },
  { host: "aws-1-ap-southeast-2.pooler.supabase.com", port: 5432, user: `postgres.${ref}` },
];

async function connect() {
  for (const c of candidates) {
    const client = new pg.Client({
      ...c,
      database: "postgres",
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      console.log(`connected via ${c.host}`);
      return client;
    } catch (e) {
      console.log(`  ${c.host}: ${e.code ?? e.message}`);
    }
  }
  throw new Error("所有连接候选均失败 — 检查网络或在 Dashboard→Connect 里确认 pooler 主机");
}

const client = await connect();
try {
  await client.query(
    `create table if not exists public.schema_migrations (
       name text primary key, applied_at timestamptz not null default now())`,
  );
  const dir = path.join(root, "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query("select name from public.schema_migrations");
  const done = new Set(rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) {
      console.log(`skip  ${f} (applied)`);
      continue;
    }
    const sql = readFileSync(path.join(dir, f), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.schema_migrations (name) values ($1)", [f]);
      await client.query("commit");
      console.log(`apply ${f} ✓`);
    } catch (e) {
      await client.query("rollback");
      throw new Error(`${f}: ${e.message}`);
    }
  }
  console.log("migrations up to date");
} finally {
  await client.end();
}
