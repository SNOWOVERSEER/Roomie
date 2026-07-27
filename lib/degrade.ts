/*
 * 渲染路径专用的降级读取。
 *
 * 由来（2026-07-27，第二次真实流量事故）：Supabase 侧偶发 ~1s 的
 * "JWT issued at future" 窗口（成因见 lib/supabase-admin.ts 顶部），
 * 窗口内所有查询一起失败。root layout 一抛错整站 500 —— 店主从
 * Instagram 点进来直接吃错误页。退避重试（同文件）能扛住实测的
 * 769ms 窗口，但扛不住更长的；这一层是最后兜底：**渲染路径宁可少显示
 * 一点信息，也绝不给错误页**。
 *
 * 边界：只给渲染路径用。结算、webhook、admin 一律保持抛错 ——
 * 金额和库存的正确性不接受降级（结算金额本来也在服务端 re-derive）。
 *
 * 返回 null = 「不知道」，**不等于「空」**。调用方必须把 null 当未知处理
 * （别显示 AU$0，别说售罄），否则降级反而比错误页更伤转化。
 */

/** 进程内最后一次成功的快照。Vercel 实例温着时能兜住；冷实例没有。 */
const lastGood = new Map<string, unknown>();

export async function readOrDegrade<T>(
  label: string,
  read: () => Promise<T>,
): Promise<T | null> {
  try {
    const value = await read();
    lastGood.set(label, value);
    return value;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const cached = lastGood.get(label) as T | undefined;
    /* 告警：用 error 级别 + 固定前缀，方便在 Vercel 日志里检索
       「今天降级了几次」，从而判断 Supabase 抖动的真实频率。 */
    console.error(
      `[degraded] ${label}: ${cached !== undefined ? "回落到上次成功快照" : "无快照可用，按未知渲染"} — ${msg}`,
    );
    return cached ?? null;
  }
}
