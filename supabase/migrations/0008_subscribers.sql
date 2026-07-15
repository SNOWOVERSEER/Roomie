-- Roomie · subscribers 表：营销邮件订阅（The Roomie letter）。
-- 每邮箱一行；promo_code 是发给该订阅者的一次性 10% 码（Stripe promotion code 的码面）。
-- 行先落、码后补（self-healing：任一步失败下次订阅补齐），所以 promo 列可空。
-- RLS 开且无策略 = 仅服务端 secret key 可达（与 waitlist 同姿态）。

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  promo_code text,
  stripe_promotion_code_id text,
  source text not null default 'promo-bar',
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;
