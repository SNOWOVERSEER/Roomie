import { formatCents, getCatalogMap } from "@/lib/catalog";
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
export default async function Page() {
  const catalog = await getCatalogMap();
  const scratcherPrice = formatCents(
    catalog.get("canvas-scratcher")?.priceCents ?? 0,
  );
  return (
    <>
      <Nav />
      <main>
        <Hero priceText={scratcherPrice} />
        <CanvasCollection />
        <TheShelf />
        <BrandStory />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
