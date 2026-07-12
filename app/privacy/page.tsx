import type { Metadata } from "next";
import PolicyPage from "@/components/policy/PolicyPage";

export const metadata: Metadata = {
  title: "Privacy policy · RoomiePaw",
  description:
    "What RoomiePaw collects, what we never see, and who processes it. Plain English, no tracking cookies.",
  robots: { index: false },
};

/* TODO(用户复核)：平实英语版隐私政策，正式上线前建议过一遍法务/模板核对 */

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="The fine print"
      title="Privacy policy"
      lede="Plain English, because you're buying cat furniture, not signing a lease."
      updated="12 July 2026"
    >
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>When you order:</strong> your name, email, and shipping
          address, passed to us by Stripe after checkout, plus what you bought.
        </li>
        <li>
          <strong>When you join a waitlist:</strong> your email and which
          piece you're waiting for.
        </li>
        <li>
          <strong>In your browser:</strong> your basket lives in your own
          browser's storage. It never leaves your device until you check out.
        </li>
      </ul>

      <h2>What we never see</h2>
      <p>
        Your card details. Payment happens entirely on Stripe's secure
        checkout; card numbers never touch our servers. We also run no ad
        trackers and no analytics cookies.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li>
          <strong>Stripe</strong> handles payment and fraud checks.
        </li>
        <li>
          <strong>Supabase</strong> stores orders and waitlists, hosted in
          Sydney, Australia.
        </li>
        <li>
          <strong>Resend</strong> sends your order and shipping emails.
        </li>
        <li>
          <strong>Vercel</strong> hosts this site.
        </li>
      </ul>

      <h2>What we use it for</h2>
      <p>
        Fulfilling your order, emailing you about it, and letting you know
        when a waitlisted piece opens. That's the list. We don't sell your
        data, and we won't send marketing you didn't ask for.
      </p>

      <h2>Your choices</h2>
      <p>
        Want a copy of your data, or want it deleted? Email{" "}
        <a href="mailto:hello@roomiepaw.com.au">hello@roomiepaw.com.au</a> and
        we'll take care of it. We handle personal information in line with the
        Australian Privacy Principles.
      </p>
    </PolicyPage>
  );
}
