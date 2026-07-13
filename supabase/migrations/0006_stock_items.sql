-- Roomie · 组件库存 + sellable（admin-platform R1，2026-07-13）。
-- 用户验收反馈：备货单位是「画框 ×1 + 画芯 ×6」，不是整件商品——
-- SKU 按组件建模；画作另有「退役」语义（seasonal drops），与售罄不同。
--
-- stock_items.stock：NULL = 不限量/不跟踪；数字 = 严格跟踪；0 = 售罄。
-- stock_items.available：false = 退役（购买动线里彻底消失；hero 艺术层不受影响）。
-- 可售判定（代码 lib/inventory.ts）：
--   Frame+print·画X = frame 可买 ∧ 画X 可买；Print only·画X = 画X 可买。

create table if not exists public.stock_items (
  id         text primary key,
  label      text not null,
  stock      integer,
  available  boolean not null default true,
  sort       integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists stock_items_updated_at on public.stock_items;
create trigger stock_items_updated_at
  before update on public.stock_items
  for each row execute function public.set_updated_at();

alter table public.stock_items enable row level security;

create or replace function public.decrement_stock_item(p_id text, p_qty int)
returns void language sql as $$
  update public.stock_items
  set stock = stock - p_qty
  where id = p_id and stock is not null;
$$;

-- 7 个库存单元：画框 + 六幅画（id 序与 lib/heroConfig.ts ARTWORKS 对齐）
insert into public.stock_items (id, label, stock, available, sort) values
  ('frame',    'Pine frame + easel', null, true, 10),
  ('print-01', 'Sunny Field',        null, true, 21),
  ('print-02', 'Wave Light',         null, true, 22),
  ('print-03', 'Leaf Boat',          null, true, 23),
  ('print-04', 'Forest Light',       null, true, 24),
  ('print-05', 'Window Glow',        null, true, 25),
  ('print-06', 'Red Fruit',          null, true, 26)
on conflict (id) do nothing;

-- sellable：有完整购买流程（详情页 + 购买面板）的商品才可被上架。
-- 猫屋是 false：页面存在但购买面板未实现（waitlist 模式），误上架会让
-- 候补接口反过来拒绝它（available=true 被 waitlist 校验拒）——地雷拆除。
alter table public.products
  add column if not exists sellable boolean not null default false;

update public.products set sellable = true
where handle in ('canvas-scratcher', 'canvas-print');

-- BOM 商品的商品级库存弃用（库存由组件决定），防止双重记账
update public.products set stock = null
where handle in ('canvas-scratcher', 'canvas-print');
