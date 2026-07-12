import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import SuccessView from "@/components/checkout/SuccessView";

export const metadata: Metadata = {
  title: "Order confirmed — Roomie",
  description: "Payment received — the room is being prepared.",
  robots: { index: false },
};

export default function SuccessPage() {
  return (
    <>
      <Nav />
      <main>
        {/* useSearchParams 需要 Suspense 边界 */}
        <Suspense fallback={null}>
          <SuccessView />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
