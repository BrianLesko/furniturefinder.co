import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SHARE } from "@/content/seo";
import { getProducts } from "@/lib/products";
import Gallery from "./Gallery";
import "./gallery.css";

const description = "Sofas, tables, rugs, beds, and the rest of the Furniture Finder catalog, with a seller, a price, and a size in inches.";

export const metadata = {
  title: "Pick a piece · Furniture Finder",
  description,
  alternates: { canonical: "/pick" },
  openGraph: { ...SHARE, title: "Pick a piece · Furniture Finder", description, url: "/pick" },
};

export const dynamic = "force-dynamic";

export default function PickPage() {
  const products = getProducts();
  const sellers = [];
  for (const product of products) {
    if (!sellers.some((seller) => seller.sellerName === product.sellerName)) {
      sellers.push(product);
    }
  }

  return (
    <>
      <Header sticky />

      <main className="mx-auto w-full max-w-[1120px] px-5 pt-12 pb-20">
        <h1 className="m-0 font-display text-[clamp(2.8rem,7vw,4.8rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          Pick a piece
        </h1>
        <p className="mt-6 mb-0 max-w-[40rem] text-[1.0625rem] leading-[1.7]">
          Whole pieces, cut out and held at one scale, so they can sit on a room photo. The front stays in the middle. Hover left for the one-quarter and right for the three-quarter. Real pieces from{" "}
          {sellers.map((seller, index) => {
            const link = (
              <a
                key={seller.sellerName}
                className="font-bold whitespace-nowrap text-hot underline decoration-ink underline-offset-4"
                href={seller.sellerUrl}
              >
                {seller.sellerName}
              </a>
            );
            if (index === 0) return link;
            if (index === sellers.length - 1) return <span key={`${seller.sellerName}-join`}> and {link}</span>;
            return <span key={`${seller.sellerName}-join`}>, {link}</span>;
          })}
          , picked for the rooms at 73&nbsp;E&nbsp;Patterson.
        </p>
        <div className="mt-8">
          <Gallery products={products} />
        </div>
      </main>

      <Footer />
    </>
  );
}
