import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SHARE } from "@/content/seo";
import { getProducts } from "@/lib/products";
import Studio from "./Studio";

const description = "Straighten a room photo, set real-size pieces into it, and save it for your AI to render.";

export const metadata = {
  title: "Studio · Furniture Finder",
  description,
  alternates: { canonical: "/studio" },
  openGraph: { ...SHARE, title: "Studio · Furniture Finder", description, url: "/studio" },
};

export const dynamic = "force-dynamic";

export default async function StudioPage({ searchParams }) {
  const products = getProducts();
  const params = await searchParams;
  const add = String(params?.add ?? "")
    .split(",")
    .map(Number)
    .filter((id) => products.some((product) => product.id === id));

  return (
    <>
      <Header width="max-w-[1240px]" />

      <main className="mx-auto w-full max-w-[1240px] px-5 pt-10 pb-20">
        <h1 className="m-0 font-display text-[clamp(2.6rem,7vw,4.4rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          Furnish the room
        </h1>
        <p className="mt-6 mb-0 max-w-[44rem] text-[1.0625rem] leading-[1.7]">
          Bring a photo, stand its verticals upright, then set pieces in at their real size. Stand the yellow stick on
          something you know the height of and put the dashed line at eye level. Drag a piece by where it meets the floor:
          it shrinks as it moves back into the room. Press Save the room and your AI renders it.
        </p>
        <p className="mt-4 mb-0 text-sm">
          <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot" href="/docs/getting-started">Get started</a>
          {" · "}
          <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot" href="/docs/straighten">Straighten</a>
          {" · "}
          <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot" href="/docs/connect-an-agent">Connect an agent</a>
        </p>
        <div className="mt-8">
          <Studio products={products} initialAdd={add} />
        </div>
      </main>
      <Footer />
    </>
  );
}
