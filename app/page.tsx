import Nav from "@/components/Nav";
import Hero from "@/components/Hero/Hero";
import ProductIntro from "@/components/sections/ProductIntro";
import CollectionGrid from "@/components/sections/CollectionGrid";
import BrandStory from "@/components/sections/BrandStory";
import Conversion from "@/components/sections/Conversion";
import Footer from "@/components/sections/Footer";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProductIntro />
        <CollectionGrid />
        <BrandStory />
        <Conversion />
      </main>
      <Footer />
    </>
  );
}
