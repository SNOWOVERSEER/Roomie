import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import CartView from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Your basket · RoomiePaw",
  description:
    "Review your Canvas Series pieces and check out securely with Stripe. Ships Australia-wide, free over AU$188.",
};

export default function CartPage() {
  return (
    <>
      <Nav />
      <main>
        <CartView />
      </main>
      <Footer />
    </>
  );
}
