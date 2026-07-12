import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/Reveal";
import Crumb from "@/components/pdp/Crumb";
import CrossSell from "@/components/pdp/CrossSell";
import HouseShop from "@/components/pdp/HouseShop";
import pdp from "@/components/pdp/pdp.module.css";
import shop from "@/components/pdp/HouseShop.module.css";

export const metadata: Metadata = {
  title: "The Canvas House — Roomie",
  description:
    "An A-frame cat den wearing two full scratch-paintings, with a porthole door. First run of ten numbered pieces — join the waitlist for first pick.",
};

/* 猫屋详情页：夜幕舞台（候补）+ 剧照 + 首批流程说明。 */

const STILLS = [
  {
    src: "/c01/house-ontop.webp",
    alt: "A fluffy cat lounging on top of the Canvas House apex",
    title: "The roof is a lookout",
    body: "Rated for full-loaf lounging, obviously.",
  },
  {
    src: "/c01/house-night.webp",
    alt: "The wave canvas panel of the house at night, a cat tail in the foreground",
    title: "Wave Light, after dark",
    body: "The panels are the same swap-able prints as the scratcher.",
  },
  {
    src: "/c01/house-paw.webp",
    alt: "A tabby paw resting on the deep blue boat canvas",
    title: "Two walls, claw-rated",
    body: "Both faces are full scratch-canvases — shred away.",
  },
];

export default function HousePage() {
  return (
    <>
      <Nav />
      <main className={pdp.page}>
        <Crumb piece="The House" />
        <HouseShop />

        {/* 剧照三联 */}
        <section className={pdp.section}>
          <div className="shell">
            <Reveal>
              <p className={pdp.kicker}>Off the set</p>
              <h2 className={pdp.sectionHeading}>
                A den, a lookout, a gallery wall.
              </h2>
            </Reveal>
            <div className={shop.stills}>
              {STILLS.map((s, i) => (
                <Reveal key={s.src} as="figure" delay={i * 100}>
                  <div className={shop.stillMedia}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.src} alt={s.alt} loading="lazy" />
                  </div>
                  <figcaption>
                    <strong>{s.title}</strong>
                    <span>{s.body}</span>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 预订流程 */}
        <section className={`${pdp.section} ${pdp.sectionWarm}`}>
          <div className="shell">
            <Reveal>
              <p className={pdp.kicker}>How the run works</p>
              <h2 className={pdp.sectionHeading}>
                Ten pieces, built in order.
              </h2>
            </Reveal>
            <ol className={pdp.steps}>
              <Reveal as="li">
                <h3>Join the waitlist</h3>
                <p>Leave your email — no charge, no commitment.</p>
              </Reveal>
              <Reveal as="li" delay={90}>
                <h3>We build in order</h3>
                <p>№ 01 leaves the bench first — ten houses, one at a time.</p>
              </Reveal>
              <Reveal as="li" delay={180}>
                <h3>First pick, first served</h3>
                <p>The waitlist hears first and chooses their number first.</p>
              </Reveal>
            </ol>
          </div>
        </section>

        <CrossSell
          href="/scratcher"
          kicker="The original · shipping now"
          title="The Canvas Scratcher"
          blurb="The original leaning print — same canvases, same pine, AU$89."
          image="/c01/scratcher-solo.webp"
          imageAlt="The Canvas Scratcher leaning against a wall"
          cta="Meet the Scratcher"
          tone="day"
        />
      </main>
      <Footer />
    </>
  );
}
