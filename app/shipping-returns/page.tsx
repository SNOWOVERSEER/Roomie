import type { Metadata } from "next";
import PolicyPage from "@/components/policy/PolicyPage";
import styles from "@/components/policy/PolicyPage.module.css";

export const metadata: Metadata = {
  title: "Shipping & returns · RoomiePaw",
  description:
    "Australia-wide shipping: AU$26 flat, free over AU$188. Thirty-day returns, and Australian Consumer Law guarantees always apply.",
};

/* TODO(用户复核)：发货时效与退货窗口为合理默认值，正式上线前请店主确认 */

export default function ShippingReturnsPage() {
  return (
    <PolicyPage
      eyebrow="The practical bit"
      title="Shipping & returns"
      lede="Short version: we ship Australia-wide, shipping is free once your order passes AU$188, and if something isn't right we'll sort it."
      updated="12 July 2026"
    >
      <h2>Shipping</h2>
      <p className={styles.callout}>
        Australia only · AU$26 flat per order · free over AU$188
      </p>
      <p>
        Every order ships from our Melbourne studio, tracked with Australia
        Post or Sendle. We only ship within Australia for now. International
        friends: join a waitlist and tell us where you are, it genuinely helps
        us plan.
      </p>
      <ul>
        <li>
          <strong>Dispatch:</strong> within 2 business days of your order.
          You'll get a tracking email the day it leaves.
        </li>
        <li>
          <strong>Delivery:</strong> usually 2 to 5 business days for metro
          areas, and up to 8 for regional addresses, WA and NT. These are
          carrier estimates rather than promises.
        </li>
        <li>
          <strong>Packaging:</strong> frames and prints travel flat, corners
          protected. The box is deliberately boring; the thing inside is not.
        </li>
      </ul>
      <p>
        Need to change an address or fix a typo? Reply to your confirmation
        email before dispatch and we'll catch it.
      </p>

      <h2>Returns</h2>
      <h3>Changed your mind</h3>
      <p>
        You have <strong>30 days</strong> from delivery. The piece needs to be
        unused, in its original packaging, and un-scratched. Once claws have
        met canvas, that print is officially theirs and can't come back. You
        cover the return postage; we refund the full item price to your
        original payment method once it's back and checked, usually within a
        few days.
      </p>
      <h3>Faulty or damaged</h3>
      <p>
        If something arrives damaged or develops a fault, email{" "}
        <a href="mailto:hello@roomiepaw.com.au">hello@roomiepaw.com.au</a>{" "}
        with a photo within 7 days of delivery. We'll replace it or refund you
        in full, postage included. No forms, no fuss.
      </p>
      <h3>Your rights</h3>
      <p>
        Our goods come with guarantees that cannot be excluded under the
        Australian Consumer Law. Nothing on this page limits those rights.
      </p>

      <h2>Starting a return</h2>
      <p>
        Email <a href="mailto:hello@roomiepaw.com.au">hello@roomiepaw.com.au</a>{" "}
        with your order number (it looks like RP-48291, and it's in your
        confirmation email). We'll reply with the return address and next
        steps.
      </p>
    </PolicyPage>
  );
}
