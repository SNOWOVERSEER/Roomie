import type { Metadata } from "next";
import { formatCents, getCatalogMap } from "@/lib/catalog";
import PolicyPage from "@/components/policy/PolicyPage";

export const metadata: Metadata = {
  title: "Care guide · RoomiePaw",
  description:
    "How to keep a Canvas Series piece looking gallery-fresh: canvas care, pine frame care, and what to do when a print is well and truly loved.",
};

export default async function CarePage() {
  const catalog = await getCatalogMap();
  const printPrice = formatCents(catalog.get("canvas-print")?.priceCents ?? 0);
  return (
    <PolicyPage
      eyebrow="Keep it lovely"
      title="Care guide"
      lede="The Canvas Series is built to be scratched, so care is less about protecting it from the cat and more about keeping it handsome while they work."
      updated="12 July 2026"
    >
      <h2>The canvas</h2>
      <ul>
        <li>
          Once a week, go over the weave with a lint roller or a vacuum on low.
          Loose fluff comes off, the loop pile stays plush.
        </li>
        <li>
          Spot-clean with warm water and a drop of mild soap. Dab, don't rub,
          then let it air dry flat. Skip the washing machine entirely; the
          weave won't forgive it.
        </li>
        <li>
          Bright rooms are fine, but months of harsh all-day sun will slowly
          soften the colours. If the frame lives in a sun trap, rotate prints
          now and then so they fade evenly, if at all.
        </li>
      </ul>

      <h2>The frame</h2>
      <ul>
        <li>
          Solid pine likes a dry or barely damp cloth. No polish, no spray
          cleaners.
        </li>
        <li>
          Keep it out of steamy bathrooms and away from heaters. Wood moves
          with moisture, and the frame prefers a stable room.
        </li>
        <li>
          The easel back is weighted for scratching physics. If it ever feels
          loose, check the two clips on the back rail before anything else.
        </li>
      </ul>

      <h2>Claws, and the art of wearing out</h2>
      <p>
        The loop pile is meant to fray slowly and with dignity. Regular claw
        trims keep the weave tidy for longer, but a well-shredded corner is a
        badge of honour, not a defect. When a print is well and truly loved,{" "}
        <a href="/scratcher#prints">swap in a fresh one for {printPrice}</a> and let
        the old one retire with honour.
      </p>

      <h2>The Canvas House</h2>
      <ul>
        <li>
          Both roof panels follow the same canvas care as the Scratcher.
        </li>
        <li>Wipe the pine frame and porthole edge with a dry cloth.</li>
        <li>
          The roof is rated for full-loaf lounging. No structural worries
          there.
        </li>
      </ul>

      <h2>Something we didn't cover?</h2>
      <p>
        Email <a href="mailto:hello@roomiepaw.com.au">hello@roomiepaw.com.au</a>{" "}
        with a photo and we'll figure it out together.
      </p>
    </PolicyPage>
  );
}
