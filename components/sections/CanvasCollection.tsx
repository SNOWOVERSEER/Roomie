import Link from "next/link";
import Reveal from "@/components/Reveal";
import Filmstrip, { type Slide } from "./Filmstrip";
import PortalCard from "./PortalCard";
import styles from "./CanvasCollection.module.css";

/*
 * № 01 系列刊头 —— landing 只负责勾兴趣：氛围（胶片）+ 两张门户卡。
 * 深挖内容（卖点/工艺/换画/购买）都在 /scratcher 与 /house 详情页。
 * 供应商（GlugGlug，合作制造方，logo 可露出）素材已去中文，见 /public/c01。
 */

const SLIDES: Slide[] = [
  {
    src: "/c01/gallery-swap.webp",
    alt: "A framed red-fruit canvas leaning on a sofa, two spare canvases lying flat on the rug",
    caption: "Spare canvases live by the wall — swap one in, the frame stays.",
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
    alt: "A white cat inspecting the Wave Light print — a tiny boat on a deep blue sea",
    caption: "Wave Light, under close supervision.",
    w: 1104,
    h: 1176,
  },
  {
    src: "/c01/gallery-redfruit.webp",
    alt: "A grey cat lying beside the Red Fruit canvas",
    caption: "Red Fruit — a print from the next seasonal drop.",
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

export default function CanvasCollection() {
  return (
    <section className={styles.section} id="collection-01">
      {/* ——— 系列刊头 + 目录卡 ——— */}
      <div className={`shell ${styles.masthead}`}>
        <Reveal className={styles.mastText}>
          <p className={styles.eyebrow}>
            Collection № 01 · made with GlugGlug
          </p>
          <h2 className={styles.heading}>The Canvas Series</h2>
          <p className={styles.lede}>
            One idea, two pieces of furniture: a framed print that leans on
            your wall, and a little house that hides your cat. Both wear the
            same swap-able scratch-canvas — art on the outside, territory
            underneath.
          </p>
        </Reveal>

        <Reveal as="div" className={styles.indexCard} delay={110}>
          <p className={styles.indexTitle}>In this collection</p>
          <ol className={styles.indexList}>
            <li>
              <Link href="/scratcher">
                <span className={styles.indexNo}>01-A</span>
                <span className={styles.indexName}>The Canvas Scratcher</span>
                <span className={styles.indexMeta}>AU$89 · shipping now</span>
              </Link>
            </li>
            <li>
              <Link href="/house">
                <span className={styles.indexNo}>01-B</span>
                <span className={styles.indexName}>The Canvas House</span>
                <span className={`${styles.indexMeta} ${styles.indexNew}`}>
                  new · first run of 10
                </span>
              </Link>
            </li>
            <li>
              <Link href="/scratcher#prints">
                <span className={styles.indexNo}>+</span>
                <span className={styles.indexName}>Swap-in prints</span>
                <span className={styles.indexMeta}>
                  four at launch · seasonal drops
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
          ariaLabel="Photos of the Canvas Series at home, shot by the GlugGlug studio"
        />
      </Reveal>

      {/* ——— 两张门户卡：从这里进详情页 ——— */}
      <div className={`shell ${styles.portals}`}>
        <Reveal delay={60}>
          <PortalCard
            href="/scratcher"
            kicker="№ 01-A · AU$89 · four prints"
            title="The Canvas Scratcher"
            blurb="A framed print your cat is allowed to ruin — slowly, and with great ceremony."
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
            kicker="№ 01-B · AU$189 · pre-release"
            title="The Canvas House"
            blurb="The canvas folded into a den — two scratch walls, a porthole door, ten numbered pieces."
            cta="Meet the House"
            tag="First run of 10"
            media={{
              kind: "video",
              src: "/c01/house-loop.mp4",
              poster: "/c01/house-poster.jpg",
              alt: "The Canvas House film — a cat slips through the porthole and lounges on top",
            }}
          />
        </Reveal>
      </div>
    </section>
  );
}
