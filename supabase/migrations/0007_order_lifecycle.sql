-- Roomie · 订单生命周期全面化（admin 订单管理，2026-07-14）
-- spec：docs/superpowers/specs/2026-07-14-admin-order-management-design.md
--
-- 状态机：paid → shipped → delivered（原有）
--   + cancelled          仅未发货可取消（退款 + 可选回补库存）
--   + return_requested   退货中（shipped/delivered 起，可撤销回原状态）
--   + returned           退货收货完成（可选同时退款 + 回补库存）
--
-- 退款独立于状态：refunded_cents 永远存 Stripe 侧权威累计值
-- （charge.amount_refunded 绝对值赋值 → 天然幂等；部分退款不改状态，
-- 界面按 refunded_cents 与 amount_total 的关系叠加徽章）。

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (status in (
    'paid', 'shipped', 'delivered',
    'cancelled', 'return_requested', 'returned'
  ));

alter table public.orders
  add column if not exists refunded_cents integer not null default 0,
  add column if not exists cancelled_at timestamptz,
  add column if not exists return_requested_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists return_reason text,
  add column if not exists admin_note text;

-- 订单事件（时间线补充）。里程碑（下单/发货/送达/取消/退货各节点）由
-- orders 的时间戳列派生、不入表（防双写漂移）；这里只记列装不下的流水：
-- refund（多次部分退款）/ email（发过哪些信）/ restock（回补明细）/
-- return_cancelled（撤销退货）。
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null,
  message text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_idx
  on public.order_events (order_id, created_at);

-- 与 orders/waitlist 同策略：RLS 开、零策略 = 仅服务端 service key 可达
alter table public.order_events enable row level security;

-- 回补库存（取消/退货收货）：与 decrement_* 对偶，只影响跟踪中的行
-- （stock 为 null = 不限量，不需要也不应该被改动）。
create or replace function public.restock_item(p_id text, p_qty int)
returns void language sql as $$
  update public.stock_items
  set stock = stock + p_qty
  where id = p_id and stock is not null;
$$;

create or replace function public.restock_product(p_handle text, p_qty int)
returns void language sql as $$
  update public.products
  set stock = stock + p_qty
  where handle = p_handle and stock is not null;
$$;
