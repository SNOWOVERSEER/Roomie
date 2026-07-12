-- Roomie · waitlist 表：未上市产品（含猫屋首批）的邮箱候补。
-- 同一邮箱同一产品只记一次；RLS 开且无策略 = 仅服务端 secret key 可达。

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product_handle text not null,
  created_at timestamptz not null default now(),
  unique (email, product_handle)
);

create index if not exists waitlist_handle_idx on public.waitlist (product_handle);

alter table public.waitlist enable row level security;
