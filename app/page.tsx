import { Suspense } from "react";
import { formatCents, getCatalogMapSafe } from "@/lib/catalog";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero/Hero";
import CanvasCollection from "@/components/sections/CanvasCollection";
import TheShelf from "@/components/sections/TheShelf";
import BrandStory from "@/components/sections/BrandStory";
import FinalCta from "@/components/sections/FinalCta";
import Footer from "@/components/sections/Footer";

/*
 * 页面骨架 v4（宠物家居店定位；landing 只负责「勾」，讲透与下单在详情页）：
 *   Hero             —— 主打产品线剧场（未来多线横向滑动，见 Hero.tsx 顶部备忘）
 *   CanvasCollection —— Canvas 系列刊头 + 实拍胶片 + 两张门户卡 → /scratcher /house
 *   TheShelf         —— What's next：工作坊在做的下一批（手绘占位 + waitlist）
 *   BrandStory       —— 品牌理念（自有小工作室叙事）
 *   FinalCta         —— 夜色收束，双 CTA 最后递一次
 * 详情页：/scratcher（购买配置）、/house（编号预订）
 * 红线：站点任何位置不出现供应商品牌/logo/中文。
 */
/*
 * 价格是一片**独立的流式叶子**，不是页面级的 await。
 *
 * 从前这里 `await getCatalogMapSafe()` 挡在所有 JSX 前面，于是 Nav/Hero/
 * Footer 这些完全不需要数据库的东西，也得等 Supabase 回来才能渲染 ——
 * 冷进入时表现为几秒纯白屏（实测 HTML 主体流了 2379ms 才结束）。
 * 现在 Hero 骨架立刻出，价格随后填进 ctaNote；读不到就一直缺席，
 * 绝不退化成 AU$0（见 lib/degrade.ts）。
 */
async function ScratcherPriceNote() {
  const catalog = await getCatalogMapSafe();
  const scr = catalog?.get("canvas-scratcher");
  return scr ? <>{formatCents(scr.priceCents)} · </> : null;
}

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero
          priceText={
            <Suspense fallback={null}>
              <ScratcherPriceNote />
            </Suspense>
          }
        />
        {/* 以下三段各自取数（cache() 去重后共用同两次查询）。各自包边界，
            谁先好谁先出，都不再拖住首屏。BrandStory/Footer 不碰 DB。 */}
        <Suspense fallback={null}>
          <CanvasCollection />
        </Suspense>
        <Suspense fallback={null}>
          <TheShelf />
        </Suspense>
        <BrandStory />
        <Suspense fallback={null}>
          <FinalCta />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
