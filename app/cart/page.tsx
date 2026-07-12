import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import CartView from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Your basket — Roomie",
  description:
    "Review your Canvas Series pieces and check out securely with Stripe. Free shipping across Australia.",
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
