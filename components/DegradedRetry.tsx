"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/*
 * 降级渲染后的自动补价。
 *
 * 由来（2026-07-27 11:49 生产事故）：Supabase 的 "JWT issued at future"
 * 窗口实测能超过 3.4 秒，服务端退避等不出来（见 lib/supabase-admin.ts）。
 * 所以退避改成短打快撤，页面先降级吐出去，由这里在后台把价格补回来。
 *
 * 手法是重跑**服务端**渲染（router.refresh），而不是自己拉一份价格再
 * 塞进各个组件：价格散落在 Hero/CanvasCollection/FinalCta/TheShelf/购物车
 * 五处 server component 里，穿参数进去既啰嗦又容易漏。refresh 让服务端
 * 按原逻辑重画一遍，客户端状态（购物车、滚动位置、抽屉开合）全部保留，
 * 用户看到的就是价格自己浮现，不用刷新。
 *
 * 停止条件：拿到数据后 layout 就不再渲染本组件 → 卸载 → cleanup 清掉
 * 待触发的定时器，自然收敛。仍失败则最多试 3 次（2s / 7s / 19s）后放弃，
 * 不无限刷。
 */

const DELAYS_MS = [2000, 5000, 12000];

export default function DegradedRetry() {
  const router = useRouter();

  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      router.refresh();
      i += 1;
      if (i < DELAYS_MS.length) timer = setTimeout(tick, DELAYS_MS[i]);
    };
    timer = setTimeout(tick, DELAYS_MS[0]);
    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
