-- 订单号改 6 位纯数字（2026-07-13 用户反馈：RP- 前缀不好，纯数字更好）。
-- 新单由 webhook 生成 6 位随机数字；历史测试单去掉前缀即可（仍唯一）。

update public.orders
set order_ref = replace(order_ref, 'RP-', '')
where order_ref like 'RP-%';
