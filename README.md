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
| Payments | Stripe Checkout (hosted) — cards, Afterpay, promo codes, GST |
| Orders | Supabase (PostgreSQL) — written by the Stripe webhook |
| Email | Resend — order confirmation + shipping notice |
| Deploy target | Vercel (region `syd1`), GitHub CI/CD |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys (see docs/phase2-runbook.md)
npm run db:migrate           # apply supabase/migrations/*.sql
npm run stripe:setup         # idempotent: Stripe products/prices/webhook
npm run dev                  # http://localhost:3000
npm run build                # production build
```

To exercise the full purchase flow locally, forward Stripe webhooks:

```bash
stripe listen --api-key $STRIPE_SECRET_KEY --forward-to localhost:3000/api/webhook
# put the printed whsec_… into .env.local as STRIPE_WEBHOOK_SECRET
```

Node 18+ recommended.

## Project structure

```
app/
  layout.tsx            fonts, metadata, CartProvider
  page.tsx              landing (hero + Canvas Series + What's next + story)
  scratcher/ house/     product detail pages
  cart/                 basket page
  checkout/success/     post-payment page (polls /api/order)
  api/
    checkout/           creates the Stripe Checkout Session
    webhook/            Stripe events → Supabase order + confirmation email
    shipping/           internal fulfilment endpoint (Bearer ADMIN_SECRET)
    order/              order summary for the success page
    house-run/          claimed house numbers, aggregated from real orders
components/
  Hero/                 hero state machine, artwork switcher, video-rect math
  pdp/                  product-page stage: gallery, buy panels, cross-sell
  cart/ checkout/       basket page + success view
  sections/             landing sections · Nav · Reveal · CartContext
lib/
  heroConfig.ts         ★ hero tunables: artworks, copy, timings
  catalog.ts            ★ purchasable SKUs (prices, Stripe Price IDs)
  stripe.ts supabase-admin.ts email.ts orders.ts env.ts
  shopify.ts            display-only leftovers (What's-next placeholders)
scripts/                db-migrate.mjs · stripe-setup.mjs
supabase/migrations/    orders table DDL
public/hero|c01|story   film, composited artworks, de-branded product shots
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

**Adding a print:** drop the supplier mockup into the source folder, extend
`tools/extract_flats.py` (it cuts the flat artwork out of the mockup), run it
plus `tools/make_artworks.py`, then add one entry to `ARTWORKS` in
`lib/heroConfig.ts`.

## Motion language

Everything moves slow, soft, and with a little weight — ease-out with a touch of
overshoot, never linear, never a hard spring. After the freeze, interactive
elements arrive **staggered** (headline settles → beat → CTA → beat → prints),
so it feels like the cat is inviting you in rather than a UI popping open. A
barely-there light breathes across the frozen frame so the still never looks
stuck. All of it collapses to simple fades — with full functionality intact —
under `prefers-reduced-motion`. On mobile the hero degrades to the still frame
plus the full swap interaction (no autoplay video).

## Commerce backend

Architecture spec: [`Roomie_第二阶段技术架构规格.md`](Roomie_第二阶段技术架构规格.md) ·
Ops manual: [`docs/phase2-runbook.md`](docs/phase2-runbook.md)

```
basket (localStorage) → POST /api/checkout → Stripe hosted checkout
        → Stripe webhook → /api/webhook → Supabase `orders` + Resend email
manual fulfilment      → POST /api/shipping (Bearer ADMIN_SECRET)
        → status paid → shipped → delivered + tracking email
```

Design decisions worth knowing:

- **Prices live in [`lib/catalog.ts`](lib/catalog.ts)** — the server re-derives
  every checkout from it; the client is only trusted about *what* and *how many*.
- **Webhook is idempotent** — `orders.stripe_session_id` is unique; Stripe
  retries never double-write or double-email. DB failure → 500 (Stripe retries);
  email failure → logged, never blocks the order.
- **The `orders` table has RLS on with no policies** — only the server-side
  secret key can touch it.
- **House numbers are real**: `/api/house-run` aggregates claimed numbers from
  actual orders, so a sold № greys out on the product page.
- Missing env keys degrade gracefully (emails skip with a log; checkout 502s
  with a friendly client message) so preview deploys never crash.

## Deployment

`main` auto-deploys to production via GitHub → Vercel
([roomiepaw.vercel.app](https://roomiepaw.vercel.app)); other branches get
Preview URLs. Function region is pinned to `syd1` in `vercel.json`. Set the
environment variables from `.env.example` in the Vercel dashboard (Production
scope) — the go-live checklist in `docs/phase2-runbook.md` covers Stripe Tax,
Afterpay, Resend domain verification, and swapping to live keys.

## Roadmap

- [ ] Prices are placeholders (`TODO` in `lib/catalog.ts`): print AU$35, house AU$189
- [ ] Enable Stripe Tax + Afterpay in the Stripe Dashboard, then set `STRIPE_TAX_ENABLED=1`
- [ ] Verify `roomiepaw.com.au` in Resend and switch `RESEND_FROM`
- [ ] Customer order-lookup page & Australia Post callbacks (explicitly out of MVP scope)
- [ ] Official logo file (currently an SVG rebuild in `RoomieLogo.tsx`)
- [ ] Portrait hero video for mobile (currently the still-frame fallback)

---

<div align="center">
<sub>Roomie · Melbourne · Pet things, part of home.</sub>
</div>
