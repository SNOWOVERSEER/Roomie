import type { Metadata } from "next";
import { formatCents, getCatalogMap, isSoldOut } from "@/lib/catalog";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/Reveal";
import Filmstrip, { type Slide } from "@/components/sections/Filmstrip";
import Crumb from "@/components/pdp/Crumb";
import CrossSell from "@/components/pdp/CrossSell";
import ScratcherShop from "@/components/pdp/ScratcherShop";
import SpecDrawing from "@/components/pdp/SpecDrawing";
import pdp from "@/components/pdp/pdp.module.css";

export const metadata: Metadata = {
  title: "The Canvas Scratcher · RoomiePaw",
  description:
    "A framed loop-pile canvas that leans on your wall like art and scratches like a post. Solid pine, six swap-able prints, free AU shipping over AU$188.",
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
    body: "Tight loop-pile weave that satisfies the daily shred, minus the confetti of cardboard crumbs.",
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
    alt: "Macro of the mitred pine frame corner",
    title: "Solid pine, hand-sanded",
    body: "Mitred corners, smooth to the touch, kind to claws.",
  },
  {
    src: "/c01/craft-easel.webp",
    alt: "Three pine easel backs standing in a row",
    title: "An engineered lean",
    body: "The easel is weighted for mid-scratch physics.",
  },
];

/* 蓝图区：结构卖点（供应商物料转译）+ 热点图例。位置 % 基于 build-profile.webp */
const BLUEPRINT = [
  {
    n: "01",
    x: "78.5%",
    y: "10%",
    title: "35 mm solid pine",
    body: "Rails with real section to them. From the doorway it reads as furniture, never as packaging.",
  },
  {
    n: "02",
    x: "44%",
    y: "39%",
    title: "Reads like art",
    body: "The face sits at sofa eye level, so the print lands as a picture first. The scratching is a private matter.",
  },
  {
    n: "03",
    x: "78.5%",
    y: "89%",
    title: "Skirting-board clearance",
    body: "The frame's top edge kisses the wall while the wedge's back corner sits just shy of it, leaving room for a skirting board.",
  },
  {
    n: "04",
    x: "24.5%",
    y: "91%",
    title: "The 70° lean",
    body: "Tilted and re-tested on working cats: steep enough for a full stretch, planted enough for a hard shred.",
  },
];

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

export default async function ScratcherPage() {
  const catalog = await getCatalogMap();
  const scratcher = catalog.get("canvas-scratcher")!;
  const print = catalog.get("canvas-print")!;
  return (
    <>
      <Nav />
      <main className={pdp.page}>
        <Crumb piece="The Scratcher" />
        <ScratcherShop
          full={{ priceCents: scratcher.priceCents, soldOut: isSoldOut(scratcher) }}
          print={{ priceCents: print.priceCents, soldOut: isSoldOut(print) }}
        />

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

        {/* 蓝图：结构与尺寸（供应商物料转译 + 自绘规格线稿） */}
        <section className={pdp.section}>
          <div className="shell">
            <Reveal>
              <p className={pdp.kicker}>The blueprint</p>
              <h2 className={pdp.sectionHeading}>Measured for the lean.</h2>
            </Reveal>
            <div className={pdp.bpGrid}>
              <Reveal className={pdp.bpFigure}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/c01/build-profile.webp"
                  alt="Side profile of the scratcher: a thick pine rail leaning on its wedge base at 70 degrees"
                  loading="lazy"
                />
                {BLUEPRINT.map((b) => (
                  <span
                    key={b.n}
                    className={pdp.bpDot}
                    style={{ left: b.x, top: b.y }}
                    aria-hidden
                  >
                    {b.n}
                  </span>
                ))}
              </Reveal>
              <div>
                <ol className={pdp.bpLegend}>
                  {BLUEPRINT.map((b, i) => (
                    <Reveal as="li" key={b.n} delay={i * 90}>
                      <span className={pdp.pointNum}>{b.n}</span>
                      <div>
                        <h3>{b.title}</h3>
                        <p>{b.body}</p>
                      </div>
                    </Reveal>
                  ))}
                </ol>
                <Reveal as="div" className={pdp.bpSpec} delay={300}>
                  <SpecDrawing className={pdp.bpSpecSvg} />
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* 换画步骤（结构细节实拍配图） */}
        <section className={`${pdp.section} ${pdp.sectionWarm}`}>
          <div className="shell">
            <Reveal>
              <p className={pdp.kicker}>The swap</p>
              <h2 className={pdp.sectionHeading}>
                New art in about a minute.
              </h2>
            </Reveal>
            <ol className={`${pdp.steps} ${pdp.stepsPhoto}`}>
              <Reveal as="li">
                <div className={pdp.stepMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/c01/build-clip.webp"
                    alt="The metal clip on the back rail of the pine frame"
                    loading="lazy"
                  />
                </div>
                <h3>Unclip the back rail</h3>
                <p>The frame opens without tools. Two clips, done.</p>
              </Reveal>
              <Reveal as="li" delay={90}>
                <div className={pdp.stepMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/c01/build-rail.webp"
                    alt="The canvas edge riding the smooth timber slide rail"
                    loading="lazy"
                  />
                </div>
                <h3>Slide the canvas out</h3>
                <p>
                  The print rides a smooth timber rail. Retire the well-loved
                  one, glide the fresh one in.
                </p>
              </Reveal>
              <Reveal as="li" delay={180}>
                <div className={pdp.stepMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/c01/gallery-swap.webp"
                    alt="Spare canvases lying flat beside the leaning frame"
                    loading="lazy"
                  />
                </div>
                <h3>Lean it back</h3>
                <p>Same frame, new art. New territory for them.</p>
              </Reveal>
            </ol>
            <Reveal as="p" className={pdp.sectionCta} delay={240}>
              Spare prints are {formatCents(print.priceCents)} each, sold on
              their own. <a href="#prints">Pick a fresh one</a>.
            </Reveal>
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
                ariaLabel="Photos of the Canvas Scratcher at home"
              />
            </div>
          </Reveal>
        </section>

        <CrossSell
          href="/house"
          kicker="Completes the set · waitlist open"
          title="The Canvas House"
          blurb="The same canvas, folded into a den: two scratch walls and a porthole door."
          image="/c01/house-ontop.webp"
          imageAlt="A cat lounging on top of the Canvas House"
          cta="Meet the House"
        />
      </main>
      <Footer />
    </>
  );
}
