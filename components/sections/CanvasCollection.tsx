import Link from "next/link";
import { formatCents, getCatalogMap } from "@/lib/catalog";
import Reveal from "@/components/Reveal";
import Filmstrip, { type Slide } from "./Filmstrip";
import PortalCard from "./PortalCard";
import styles from "./CanvasCollection.module.css";

/*
 * Canvas 系列刊头 —— landing 只负责勾兴趣：氛围（胶片）+ 两张门户卡。
 * 深挖内容（卖点/工艺/换画/购买）都在 /scratcher 与 /house 详情页。
 * 红线：站点绝不露出供应商品牌；/public/c01 素材已去中文并抹除全部 logo
 * （LaMa inpaint 管线，2026-07-11）。
 */

const SLIDES: Slide[] = [
  {
    src: "/c01/gallery-swap.webp",
    alt: "A framed red-fruit canvas leaning on a sofa, two spare canvases lying flat on the rug",
    caption: "Spare canvases live by the wall. Swap one in, the frame stays.",
    w: 1080,
    h: 1296,
  },
  {
    src: "/c01/gallery-scratch.webp",
    alt: "An orange cat stretched tall, scratching a framed canvas",
    caption: "The daily shred, honoured in full.",
    w: 1167,
    h: 1400,
  },
  {
    src: "/c01/gallery-hallway.webp",
    alt: "The Sunny Field canvas leaning in a bright hallway between bedrooms",
    caption: "Holds the hallway better than most furniture does.",
    w: 1167,
    h: 1400,
  },
  {
    src: "/c01/gallery-window.webp",
    alt: "A person walks past a window, a cat rests beside the leaning canvas",
    caption: "Morning patrol, art included.",
    w: 1167,
    h: 1400,
  },
  {
    src: "/c01/gallery-moonlit.webp",
    alt: "A white cat inspecting the Wave Light print, a tiny boat on a deep blue sea",
    caption: "Wave Light, under close supervision.",
    w: 1104,
    h: 1176,
  },
  {
    src: "/c01/gallery-redfruit.webp",
    alt: "A grey cat lying beside the Red Fruit canvas",
    caption: "Red Fruit, new to the lineup this season.",
    w: 1167,
    h: 1400,
  },
  {
    src: "/c01/gallery-kitchen.webp",
    alt: "A couple cooking at home, the canvas leaning by the kitchen bench",
    caption: "Survives real kitchens, real cats, real Tuesdays.",
    w: 961,
    h: 1137,
  },
];

export default async function CanvasCollection() {
  const catalog = await getCatalogMap();
  const price = (h: string) => formatCents(catalog.get(h)?.priceCents ?? 0);
  return (
    <section className={styles.section} id="canvas">
      {/* ——— 产品线刊头 + 清单卡 ——— */}
      <div className={`shell ${styles.masthead}`}>
        <Reveal className={styles.mastText}>
          <p className={styles.eyebrow}>The Canvas Series</p>
          <h2 className={styles.heading}>One canvas, two pieces.</h2>
          <p className={styles.lede}>
            Our signature scratch-canvas is a loop-pile painting cats are meant
            to ruin. It comes two ways: a framed print that leans on your wall,
            and a little house that hides your cat. Art on the outside,
            territory underneath.
          </p>
        </Reveal>

        <Reveal as="div" className={styles.indexCard} delay={110}>
          <p className={styles.indexTitle}>The lineup</p>
          <ol className={styles.indexList}>
            <li>
              <Link href="/scratcher">
                <span className={styles.indexNo}>A</span>
                <span className={styles.indexName}>The Canvas Scratcher</span>
                <span className={styles.indexMeta}>
                  {price("canvas-scratcher")} · shipping now
                </span>
              </Link>
            </li>
            <li>
              <Link href="/house">
                <span className={styles.indexNo}>B</span>
                <span className={styles.indexName}>The Canvas House</span>
                <span className={`${styles.indexMeta} ${styles.indexNew}`}>
                  coming soon · waitlist open
                </span>
              </Link>
            </li>
            <li>
              <Link href="/scratcher#prints">
                <span className={styles.indexNo}>+</span>
                <span className={styles.indexName}>Swap-in prints</span>
                <span className={styles.indexMeta}>
                  {price("canvas-print")} each · seasonal drops
                </span>
              </Link>
            </li>
          </ol>
        </Reveal>
      </div>

      {/* ——— 实拍胶片：氛围与可信度 ——— */}
      <Reveal className={styles.stripBlock} delay={80}>
        <Filmstrip
          slides={SLIDES}
          ariaLabel="Photos of the Canvas Series at home"
        />
      </Reveal>

      {/* ——— 两张门户卡：从这里进详情页 ——— */}
      <div className={`shell ${styles.portals}`}>
        <Reveal delay={60}>
          <PortalCard
            href="/scratcher"
            kicker={`${price("canvas-scratcher")} · six prints`}
            title="The Canvas Scratcher"
            blurb="A framed print your cat is allowed to ruin. Slowly, and with great ceremony."
            cta="See it properly"
            media={{
              kind: "cycle",
              images: [
                {
                  src: "/c01/scratcher-solo.webp",
                  alt: "The Canvas Scratcher leaning against a wall",
                },
                {
                  src: "/c01/gallery-scratch.webp",
                  alt: "An orange cat scratching the framed canvas",
                },
                {
                  src: "/c01/gallery-swap.webp",
                  alt: "Spare canvases lying on the rug beside the frame",
                },
              ],
            }}
          />
        </Reveal>
        <Reveal delay={160}>
          <PortalCard
            href="/house"
            kicker="Coming soon · run of ten"
            title="The Canvas House"
            blurb="The canvas folded into a den: two scratch walls, a porthole door, ten numbered pieces."
            cta="Meet the House"
            tag="Waitlist open"
            media={{
              kind: "video",
              src: "/c01/house-loop.mp4",
              poster: "/c01/house-poster.jpg",
              alt: "The Canvas House film: a cat slips through the porthole and lounges on top",
            }}
          />
        </Reveal>
      </div>
    </section>
  );
}
