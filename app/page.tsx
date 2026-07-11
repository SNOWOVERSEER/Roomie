import Nav from "@/components/Nav";
import Hero from "@/components/Hero/Hero";
import CanvasCollection from "@/components/sections/CanvasCollection";
import TheShelf from "@/components/sections/TheShelf";
import BrandStory from "@/components/sections/BrandStory";
import FinalCta from "@/components/sections/FinalCta";
import Footer from "@/components/sections/Footer";

/*
 * 页面骨架 v3（landing 只负责「勾」，讲透与下单在详情页）：
 *   Hero             —— 主推系列剧场（未来多系列横向滑动，见 Hero.tsx 顶部备忘）
 *   CanvasCollection —— № 01 刊头 + 实拍胶片 + 两张门户卡 → /scratcher /house
 *   TheShelf         —— 货架：在展系列 + 未来系列占位（集合店结构核心）
 *   BrandStory       —— 选品店理念 + 制造方铭牌
 *   FinalCta         —— 夜色收束，双 CTA 最后递一次
 * 详情页：/scratcher（01-A 购买配置）、/house（01-B 编号预订）
 */
export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <CanvasCollection />
        <TheShelf />
        <BrandStory />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
