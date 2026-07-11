<div align="center">

# Roomie

**The art your cat can scratch.**

A landing page for Roomie — a premium pet-furniture brand where the things your
cat scratches, naps on, and eats from are made to hold their own next to the
sofa you saved up for. Pet furniture that feels like part of home.

Melbourne, AU · Next.js · TypeScript

</div>

---

## What makes it special

The hero is a self-contained **theatre**. A 10-second film plays on load — a cat
walks into a sunny living room, scratches a framed canvas leaning against the
wall, then sits and settles. The video **freezes on its final frame**, and the
interactive layer breathes in: the headline gathers, the CTA floats up, and a
set of spare prints appears on the floor beside the frame.

From that moment the framed canvas becomes **interactive**: tap a spare print
(or the painting itself) and the artwork inside the frame swaps — with matched
perspective, lighting, and canvas texture — while everything outside the frame
stays exactly as the film left it. The swap is pixel-seamless because the
replacement art is composited to sit precisely where the real canvas is.

This is the product story made literal: *it's a print on your wall, and it's
secretly a scratcher, and the print is swappable.*

## Tech stack

| | |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Styling | CSS Modules + CSS custom properties |
| Motion | Native `<video>` events + CSS transitions (no animation lib) |
| Fonts | Baloo 2 (display) · Nunito Sans (body) — via `next/font` |
| Commerce | Shopify Storefront API — currently mocked (see below) |
| Deploy target | Vercel |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

Node 18+ recommended.

## Project structure

```
app/
  layout.tsx            fonts, metadata, CartProvider
  page.tsx              assembles the sections
components/
  Hero/
    Hero.tsx            hero state machine (play → freeze → reveal)
    HeroCopy.tsx        headline / subhead / CTA, timed to the film
    ArtworkSwitcher.tsx frame overlay + spare-print rack + paper tag
    useVideoRect.ts     maps overlay coords into object-fit:cover video space
  sections/             ProductIntro · CollectionGrid · BrandStory · Conversion · Footer
  Nav · ProductCard · Reveal · CartContext · RoomieLogo
lib/
  heroConfig.ts         ★ all tunables: artworks, copy, timings
  frame-rect.json       frame geometry + tag pin, emitted by the pipeline
  shopify.ts            commerce interface layer (mock → real)
public/hero/            the film, poster/still frames, composited artworks, mask
public/story|collection editorial stills + brand-style illustrations
tools/                  offline asset pipeline (see below)
```

Everything a non-developer might want to tweak — artwork list, captions, copy,
and animation timings — lives in [`lib/heroConfig.ts`](lib/heroConfig.ts).

## The artwork pipeline

The seamless artwork swap is the technically interesting part. Each
`public/hero/art/art-0X.png` is **not** a flat painting — it's a full composite
of *the canvas region of the film's final frame*, with a replacement painting
warped into it. The pipeline ([`tools/make_artworks.py`](tools/make_artworks.py))
works like green-screen keying:

1. **Locate the canvas** in the final frame with shadow-robust colour keying
   (rough mask only).
2. **Snap the edges** with a gradient-magnetic pass — the seam between canvas
   and wooden frame is a steep dark→bright ramp that survives deep shadow where
   colour keying fails. Each edge is validated against a wood-coloured plateau,
   then fit to a straight line (a rigid frame projects to straight edges).
3. **Composite** the new painting via a perspective warp into the fitted quad,
   under a matte built from those four lines — so nothing ever bleeds onto the
   wooden frame.
4. **Match the scene** — overlay a lightmap lifted from the original (window
   light, frame shadow) plus canvas-weave grain, then colour-correct for the
   browser's video decode.
5. **Supersample 2×** so edges stay crisp on large / Retina displays.

The frame's on-screen rectangle and the paper tag's pin point are measured
automatically and written to `lib/frame-rect.json`, so **re-running the script
re-syncs everything — there are no hand-tuned coordinates.**

On the client, the frame overlay is hidden during playback (so it never covers
the cat) and masked with an exported alpha PNG so that **only the canvas is ever
drawn** — the wall, wood, and cat are always the live video, and there's no seam.

**Adding a print:** draw a new 700×1000 flat in `make_artworks.py`, run
`python3 tools/make_artworks.py` and `make_flats.py`, then add one entry to
`ARTWORKS` in `lib/heroConfig.ts`.

## Motion language

Everything moves slow, soft, and with a little weight — ease-out with a touch of
overshoot, never linear, never a hard spring. After the freeze, interactive
elements arrive **staggered** (headline settles → beat → CTA → beat → prints),
so it feels like the cat is inviting you in rather than a UI popping open. A
barely-there light breathes across the frozen frame so the still never looks
stuck. All of it collapses to simple fades — with full functionality intact —
under `prefers-reduced-motion`. On mobile the hero degrades to the still frame
plus the full swap interaction (no autoplay video).

## Shopify integration

Commerce is abstracted behind [`lib/shopify.ts`](lib/shopify.ts) and currently
runs on **mock data** so the full UI and add-to-cart flow work end to end. When
the store is ready:

1. Fill `.env.local`:
   ```
   NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
   NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=your-token
   ```
2. `npm i @shopify/hydrogen-react`, wrap the root layout in
   `<ShopifyProvider>` + `<CartProvider>`.
3. Swap the mock functions in `lib/shopify.ts` for real Storefront API calls.
   Checkout hands off to Shopify's hosted checkout. **The UI doesn't change.**

## Deployment

Deploy on Vercel (zero-config for Next.js). Point a subdomain (e.g.
`hello.roomiepaw.com.au`) at the project and set the two Shopify env vars in the
Vercel dashboard when the store goes live.

## Roadmap

- [ ] Connect the live Shopify store (currently mocked)
- [ ] Final pricing & CTA copy (placeholders marked `TODO` in `heroConfig.ts`)
- [ ] Official logo file (currently an SVG rebuild in `RoomieLogo.tsx`)
- [ ] Portrait hero video for mobile (currently the still-frame fallback)

---

<div align="center">
<sub>Roomie · Melbourne · Pet things, part of home.</sub>
</div>
