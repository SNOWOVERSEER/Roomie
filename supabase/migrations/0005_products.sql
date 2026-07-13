-- Roomie · products 表：商品唯一事实源从代码常量迁入 DB（admin-platform，2026-07-13）。
-- 设计见 docs/superpowers/specs/2026-07-13-local-admin-design.md。
-- stock 语义：NULL = 不限量/不跟踪（迁移前行为）；数字 = 严格跟踪；0 = 售罄。
-- RLS 开且无策略 = 仅服务端 secret key 可达（同 orders/waitlist 先例）。

create table if not exists public.products (
  handle            text primary key,
  title             text not null,
  tagline           text not null default '',
  price_cents       integer not null check (price_cents >= 0),
  image             text not null default '',
  stripe_product_id text,
  stripe_price_id   text,
  stock             integer,
  available         boolean not null default false,
  numbered          boolean not null default false,
  sort              integer not null default 100,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- webhook 原子扣库存（PostgREST 的 update 只能 set 常量，表达式必须走函数）。
-- 只扣跟踪中的商品；允许出现瞬时负数（并发竞态），admin 界面红色警报提示。
create or replace function public.decrement_stock(p_handle text, p_qty int)
returns void language sql as $$
  update public.products
  set stock = stock - p_qty
  where handle = p_handle and stock is not null;
$$;

-- Seed：现有 lib/catalog.ts CATALOG + lib/shopify.ts MOCK_PRODUCTS 原样搬入。
-- stock 全 NULL = 不限量，保证迁移当天站点行为零变化。
-- canvas-house 的 Stripe price 已存在（AU$189 占位）但保持 waitlist（available=false）。
insert into public.products
  (handle, title, tagline, price_cents, image, stripe_product_id, stripe_price_id, stock, available, numbered, sort)
values
  ('canvas-scratcher', 'The Canvas Scratcher',
   'A framed print your cat is allowed to ruin. Slowly.',
   8900, '/c01/print-01.webp', null, 'price_1TsHxoDzmUuzRpRKdgcL52kJ', null, true, false, 10),
  ('canvas-print', 'Swap-in Print',
   'A fresh canvas for the frame you already have.',
   3500, '/c01/print-02.webp', null, 'price_1TsHxpDzmUuzRpRKRnGBcpHp', null, true, false, 20),
  ('canvas-house', 'The Canvas House',
   'The canvas, folded into a den.',
   18900, '/c01/house-poster.jpg', null, 'price_1TsHxqDzmUuzRpRKebu6oZDS', null, false, false, 30),
  ('nook-house', 'The Nook',
   'Side table outside. Cat cave inside.',
   14900, '/collection/nook.svg', null, null, null, false, false, 40),
  ('cloud-perch', 'Cloud Perch',
   'A window seat for professional sunbeam inspectors.',
   11900, '/collection/perch.svg', null, null, null, false, false, 50),
  ('wave-bowls', 'Wave Bowls',
   'Ceramic dinnerware that can stay on the table.',
   5900, '/collection/bowls.svg', null, null, null, false, false, 60)
on conflict (handle) do nothing;
