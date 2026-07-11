import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/Reveal";
import Filmstrip, { type Slide } from "@/components/sections/Filmstrip";
import Crumb from "@/components/pdp/Crumb";
import CrossSell from "@/components/pdp/CrossSell";
import ScratcherShop from "@/components/pdp/ScratcherShop";
import pdp from "@/components/pdp/pdp.module.css";

export const metadata: Metadata = {
  title: "The Canvas Scratcher — Roomie",
  description:
    "A framed loop-pile canvas that leans on your wall like art and scratches like a post. Four swap-able prints. Collection № 01, made with GlugGlug.",
};

/*
 * № 01-A 详情页。Landing 只负责勾兴趣；讲透与下单都在这里。
 * 深挖内容（卖点/工艺/换画/实拍胶片）自 landing v2 迁入。
 */

const POINTS = [
  {
    n: "01",
    title: "A print on the outside",
    body: "Solid pine frame, gallery-tight canvas. Lean it on a wall like art you actually chose.",
  },
  {
    n: "02",
    title: "A scratcher underneath",
    body: "Tight loop-pile weave that satisfies the daily shred — without the confetti of cardboard crumbs.",
  },
  {
    n: "03",
    title: "Leans steady, scratches hard",
    body: "A weighted easel keeps the frame planted mid-scratch. No wobble, no crash, no startled cat.",
  },
  {
    n: "04",
    title: "Swap the print, keep the frame",
    body: "When a canvas is well and truly loved, slide in a fresh print. New art for you, new territory for them.",
  },
];

const CRAFT = [
  {
    src: "/c01/craft-weave.webp",
    alt: "Macro of the orange loop-pile weave",
    title: "Loop-pile canvas",
    body: "Dense enough to grip claws, tight enough to drop nothing.",
  },
  {
    src: "/c01/craft-frame.webp",
    alt: "Macro of the pine frame with an embossed maker's mark",
    title: "Solid pine, hand-sanded",
    body: "The maker's mark is embossed, not stickered.",
  },
  {
    src: "/c01/craft-easel.webp",
    alt: "Three pine easel backs standing in a row",
    title: "An engineered lean",
    body: "The easel is weighted for mid-scratch physics.",
  },
];

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

export default function ScratcherPage() {
  return (
    <>
      <Nav />
      <main className={pdp.page}>
        <Crumb piece="01-A The Canvas Scratcher" />
        <ScratcherShop />

        {/* 为什么好用 */}
        <section className={`${pdp.section} ${pdp.sectionWarm}`}>
          <div className="shell">
            <Reveal>
              <p className={pdp.kicker}>Why it works</p>
              <h2 className={pdp.sectionHeading}>
                Made for the wall, rated for claws.
              </h2>
            </Reveal>
            <ol className={pdp.points}>
              {POINTS.map((p, i) => (
                <Reveal key={p.n} as="li" delay={i * 90}>
                  <span className={pdp.pointNum}>{p.n}</span>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 工艺 */}
        <section className={pdp.section}>
          <div className="shell">
            <Reveal>
              <p className={pdp.kicker}>Up close</p>
              <h2 className={pdp.sectionHeading}>Built like furniture.</h2>
            </Reveal>
            <div className={pdp.craftGrid}>
              {CRAFT.map((c, i) => (
                <Reveal key={c.src} as="figure" delay={i * 100}>
                  <div className={pdp.craftMedia}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.src} alt={c.alt} loading="lazy" />
                  </div>
                  <figcaption>
                    <strong>{c.title}</strong>
                    <span>{c.body}</span>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 换画步骤 */}
        <section className={`${pdp.section} ${pdp.sectionWarm}`}>
          <div className="shell">
            <Reveal>
              <p className={pdp.kicker}>The swap</p>
              <h2 className={pdp.sectionHeading}>
                New art in about a minute.
              </h2>
            </Reveal>
            {/* TODO 文案：换画细节待与供应商核对（现按宣传视频概括） */}
            <ol className={pdp.steps}>
              <Reveal as="li">
                <h3>Unclip the back rail</h3>
                <p>The frame opens without tools — two clips, done.</p>
              </Reveal>
              <Reveal as="li" delay={90}>
                <h3>Slide the canvas out</h3>
                <p>Retire the well-loved print, slide the fresh one in.</p>
              </Reveal>
              <Reveal as="li" delay={180}>
                <h3>Lean it back</h3>
                <p>Same frame, new art — new territory for them.</p>
              </Reveal>
            </ol>
          </div>
        </section>

        {/* 实拍胶片 */}
        <section className={pdp.section}>
          <Reveal>
            <div className="shell">
              <p className={pdp.kicker}>Shot at home</p>
              <h2 className={pdp.sectionHeading}>
                Real rooms, real cats, real Tuesdays.
              </h2>
            </div>
            <div style={{ marginTop: "2rem" }}>
              <Filmstrip
                slides={SLIDES}
                ariaLabel="Photos of the Canvas Scratcher at home, shot by the GlugGlug studio"
              />
            </div>
          </Reveal>
        </section>

        <CrossSell
          href="/house"
          kicker="Also in № 01 · first run of 10"
          title="The Canvas House"
          blurb="The same canvas, folded into a den — two scratch walls and a porthole door."
          image="/c01/house-ontop.webp"
          imageAlt="A cat lounging on top of the Canvas House"
          cta="Meet the House"
        />
      </main>
      <Footer />
    </>
  );
}
