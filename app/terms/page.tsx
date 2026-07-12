import type { Metadata } from "next";
import PolicyPage from "@/components/policy/PolicyPage";

export const metadata: Metadata = {
  title: "Terms of sale · RoomiePaw",
  description:
    "The terms for buying from RoomiePaw: AUD pricing with GST included, shipping and returns, and your Australian Consumer Law rights.",
  robots: { index: false },
};

/* TODO(用户复核)：平实英语版销售条款，正式上线前建议法务核对 */

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="The fine print"
      title="Terms of sale"
      lede="The unexciting but honest bit about buying from a small Melbourne studio."
      updated="12 July 2026"
    >
      <h2>Who you're buying from</h2>
      <p>
        RoomiePaw, a pet-furniture studio based in Melbourne, Australia. When
        you place an order on this site, these terms apply.
      </p>

      <h2>Prices and payment</h2>
      <ul>
        <li>All prices are in Australian dollars and include GST.</li>
        <li>
          Payment is processed by Stripe at checkout. Your order is confirmed
          once payment succeeds, and you'll receive an email with an order
          number.
        </li>
        <li>
          Prices can change over time, but never for an order you've already
          placed.
        </li>
        <li>
          In the rare case of a stock or pricing error we may cancel and
          refund an order in full before dispatch. We'll tell you why.
        </li>
      </ul>

      <h2>Shipping, returns and faults</h2>
      <p>
        Covered in detail on the{" "}
        <a href="/shipping-returns">Shipping &amp; returns</a> page: Australia
        only, AU$26 flat, free over AU$188, 30-day change of mind, and full
        remedies for faulty items. Our goods come with guarantees that cannot
        be excluded under the Australian Consumer Law, and nothing in these
        terms limits them.
      </p>

      <h2>Handmade honesty</h2>
      <p>
        Loop-pile weave and pine grain vary a little from piece to piece, and
        screens render colour differently. Small variations are character, not
        defects. Actual defects are on us, see above.
      </p>

      <h2>Our content</h2>
      <p>
        The photos, films, artwork and words on this site belong to RoomiePaw.
        Enjoy them, share them with credit, but please don't reuse them
        commercially without asking.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, our liability for any claim connected to
        an order is limited to the amount you paid for it. Your Australian
        Consumer Law rights are never affected by this clause.
      </p>

      <h2>The boring coordinates</h2>
      <p>
        These terms are governed by the laws of Victoria, Australia. Questions
        go to{" "}
        <a href="mailto:hello@roomiepaw.com.au">hello@roomiepaw.com.au</a>.
      </p>
    </PolicyPage>
  );
}
