-- 订单号改造 + 运费字段（2026-07-13）
--
-- order_ref：客户可见订单号（如 RP-48291）。研究结论：顺序号（Shopify 式
-- #1001 起）会暴露销量与增速；小店通行做法是给客户看「前缀 + 非顺序引用号」，
-- 内部保留自增 id 做排序/对账。生成逻辑在 webhook（随机 5 位，唯一冲突重试）。
--
-- shipping_cents：本单运费（分）。规则：澳洲境内统一 2600，
-- 商品小计 ≥ 18800 免运（常量见 lib/catalog.ts SHIPPING）。

alter table public.orders
  add column if not exists order_ref text unique,
  add column if not exists shipping_cents integer not null default 0;

-- 回填历史测试单（№1001 一行）
update public.orders
set order_ref = 'RP-' || (10000 + floor(random() * 90000))::int
where order_ref is null;
