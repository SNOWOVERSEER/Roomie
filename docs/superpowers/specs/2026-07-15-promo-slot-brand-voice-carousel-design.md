# Design: promo slot + subscribe coupon, pet-wide brand voice, carousel & loading polish

Date: 2026-07-15 · Status: approved by owner via full delegation ("全权去想办法，设计，实现") · Author: Claude

Owner asks, verbatim scope:

1. Brand is a **pet** home-goods store, not cat-only (dogs are coming). Cat wording leaked into places that are not product-specific. Fix the voice.
2. Landing carousels switch too abruptly and lack interaction.
3. Slow media loads must never show blank space; add loading UX.
4. New feature: a **campaign slot** (sales, offers), first campaign = email signup rewards a 10% off code. Placement, timing, interaction cost all delegated.

## 1 · Brand voice rule (new copy red-line)

**Rule:** brand-level copy speaks for pets; product-level copy may say cat because the Canvas Series is a cat product line. Factual photo alt text describing a cat in frame stays.

Brand-level surfaces to change:

| Surface | Now | Becomes |
| --- | --- | --- |
| `app/layout.tsx` metadata title/OG | "the art your cat can scratch" | "pet furniture that feels like home" framing; flagship product mentioned factually |
| `Footer` | "Made for cats, chosen for living rooms." | "Made for pets, chosen for living rooms." |
| `BrandStory` | "Your cat lives in the living room" | "Your pets live in the living room" (+ plural agreement) |
| `TheShelf` lede | "everything a cat needs" | "everything a pet needs" |
| `app/privacy` lede | "buying cat furniture" | "buying pet furniture" |
| `lib/email.ts` shell footer | "furniture you share with the cat" | "furniture you share with your pets" |
| `app/care` lede | "protecting it from the cat" | "protecting it from claws" (species-neutral, keeps the joke) |

Not changed (product-level): hero headline "The art your cat can scratch" (it demos the scratcher), Canvas Series masthead lede, /scratcher & /house copy, photo captions/alt describing actual cats.

## 2 · Campaign slot ("the promo bar")

### Placement & mechanics

- A slim strip (~34px) rendered **above the nav row inside the existing fixed header stack**. The nav already floats over content on every page, so joining its stack adds zero layout shift by construction.
- **Scroll behaviour reuses the nav's existing `solid` threshold:** bar is visible at page top, tucks up (translateY) as soon as the user scrolls, returns at top. Chrome stays light; content never fights a permanent banner.
- **Dismissal:** an X sets cookie `rp_promo_dismissed=<campaignId>` (7 days). Layout reads cookies server-side (site is already force-dynamic), so SSR renders the correct state: no flash, no CLS. A new campaign id shows again.
- Inner-page top paddings audited against the taller stack; `pdp` top padding bumped one step so the crumb clears the bar at scrollY=0.
- Hidden on `/cart` and `/checkout/*` (no distractions near payment).

### Campaign model

`lib/promos.ts`: typed list, no DB round-trip (owner edits file, push deploys; DB/admin editing is a noted follow-up, not v1):

```ts
type Campaign = {
  id: string;            // cookie scoping + analytics
  message: string;       // bar line, one sentence, English only, no long dash
  cta: string;           // chip label
  kind: "subscribe" | "link";
  href?: string;         // kind=link
  start?: string; end?: string; // ISO, AU dates; omitted = evergreen
};
```

Active campaign = first whose window contains now. v1 ships one evergreen campaign: `letter-10` ("Get 10% off your first piece · join the Roomie letter"). A future sale entry (dated) automatically outranks it by being listed first while its window is open — bar copy swaps, dismiss cookie is per-campaign.

### Subscribe flow (campaign `letter-10`)

- Bar CTA (or auto-open, below) opens a **dialog**: paper card on desktop, bottom sheet on mobile, brand tokens throughout, focus-trapped, Esc/backdrop closes.
- Form: email only. Success swaps in a **hang-tag styled ticket** with the personal code (dashed border, slight rotation — same paper-tag motif as the hero), a copy button, and "It's in your inbox too. Paste it in the promo box at checkout."
- **Auto-open policy (landing only):** once per browser ever (`localStorage rp_letter_prompted`), triggered by real engagement — scroll depth past the hero — never in the first seconds, never if: already subscribed (`rp_subscribed` cookie), bar dismissed, cart drawer open, reduced-motion users get a fade not a slide. Manual entry points (bar CTA) work on every page, every time.
- Already-subscribed emails get their existing code back (idempotent), copy switches to "Welcome back".

### Backend

- Migration `0008_subscribers.sql`: `subscribers(id, email unique, promo_code, stripe_promotion_code_id, source, emailed_at, created_at)`, RLS on / no policies (service key only), same posture as `waitlist`.
- `POST /api/subscribe {email, source}`:
  1. validate + normalise email (waitlist regex, ≤254);
  2. existing row → return its code (`already: true`);
  3. claim row first (insert email, null code), then ensure Stripe coupon `ROOMIE10` (10% once, lazy idempotent create), then create **unique promotion code** `ROOMIE10-XXXX` (`max_redemptions: 1`, metadata.email), update row. Any step failing leaves a self-healing row (next attempt fills the gap). Unique-violation race returns the winner's code.
  4. best-effort Resend welcome email (new `welcomeCouponEmail` on the existing shell), stamp `emailed_at`; email failure never fails the request — the code is already on screen.
- Checkout already sets `allow_promotion_codes: true`, so codes work on the hosted page with zero checkout changes. `duration: "once"` + one redemption per code bounds discount exposure. Stripe runs in test mode today; the coupon lazy-creates itself again after the live switch.
- Admin: subscribers listed on the existing Waitlist page (separate card + CSV), service-key read like waitlist.

## 3 · Carousel polish (landing)

**PortalCard cycle** (scratcher card, 3 photos):

- Crossfade slows into the house style: incoming frame eases in over ~900ms while every visible frame carries a continuous slow drift (scale 1.0→1.05 across the dwell) so the switch reads as one breath, not a swap.
- Interaction: hover pauses the cycle (desktop), horizontal swipe advances (touch) with the same moved-threshold click-guard the Filmstrip uses; dots become tappable and grow into a **timing pill** on the active slide that fills over the dwell — the affordance says "this rotates, and you can drive it" without generic arrows.
- Timer resets after manual navigation; `prefers-reduced-motion` keeps the static first frame (existing behaviour).

**Filmstrip:**

- Mouse drag currently dead-stops; add release **momentum glide that settles on the nearest snap point**, so dragging feels like flicking a real strip.
- Keyboard: track focusable, arrow keys move one slide (carousel a11y).
- Slides get the shared loading treatment (below).

Hero artwork switcher is untouched (owner-approved bespoke interaction).

## 4 · Loading UX for slow media

- New `components/SmartImg.tsx` (client): wraps the repo's plain `<img>` idiom with a **brand shimmer** (cream-warm sweep) behind the image and a fade/settle-in on decode; cached images skip the animation (no flicker on back-nav). Layout is always reserved via aspect-ratio/height, so nothing jumps.
- Applied to landing media: Filmstrip slides, PortalCard cycle frames, TheShelf cards, BrandStory room swap. Video cards keep poster + gain the shimmer behind the poster while it decodes.
- Hero pipeline untouched (its opacity gating is a documented contract).

## 5 · Non-goals / notes

- No DB-driven campaign editing in v1 (file-config; documented follow-up).
- No exit-intent popups, no interstitials that block reading; one lifetime auto-open.
- Site copy rules hold: English only, no long dash, no supplier marks.
- Resend domain still unverified → welcome emails deliver only to the account owner's address until the domain is verified; UI reveals the code inline regardless, so the flow is not blocked (documented in HANDOVER).

## 6 · Verification plan

`tsc` + `next build` clean (dev server stopped first — shared `.next`). Playwright pass: bar SSR state with/without cookies, dismiss persists, subscribe issues a real test-mode promotion code (asserted via Stripe API), duplicate email returns same code, carousel pause/swipe/dots, shimmer visible on throttled network, no CLS on load. Screenshots for the owner.
