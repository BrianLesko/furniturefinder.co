import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PieceImage from "./PieceImage";
import { SHARE } from "@/content/seo";
import { KIND_PLURAL, kindOf, listedPieces, money, sizeLine } from "@/lib/piece-pages";

const PAGE_URL = "https://furniturefinder.co/pieces";
const title = "Furniture dimensions, piece by piece";
const description =
  "Real sofas, tables, chairs, rugs, and TVs from IKEA, West Elm, Pottery Barn, Crate & Barrel, Best Buy, and Rugs USA, with their exact width, depth, and height, and what fits around them.";

export const metadata = {
  title: `${title} · Furniture Finder`,
  description,
  alternates: { canonical: PAGE_URL },
  openGraph: { ...SHARE, title, description, url: PAGE_URL },
};

export const revalidate = 3600;

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

export default function PiecesPage() {
  const groups = new Map();
  for (const product of listedPieces()) {
    const kind = kindOf(product);
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(product);
  }

  return (
    <>
      <Header>
        <a className={`${press} border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`} href="/studio">
          Studio
        </a>
      </Header>

      <main className="mx-auto w-full max-w-[1120px] px-5 pt-12 pb-20">
        <h1 className="m-0 font-display text-[clamp(2.6rem,7vw,4.4rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          Every piece, at its real size
        </h1>
        <p className="mt-6 mb-0 max-w-[44rem] text-[1.0625rem] leading-[1.7]">
          Each piece is a real listing, with its seller&apos;s width, depth, and height, and the space it needs around it. Open one in the
          studio to set it into a photo of your room at that size.
        </p>

        {[...groups].map(([kind, pieces]) => (
          <section className="mt-14" id={kind.replace(/ /g, "-")} key={kind}>
            <h2 className="m-0 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">{KIND_PLURAL[kind] ?? kind}</h2>
            <ul className="mt-6 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {pieces.map((product) => (
                <li key={product.id}>
                  <a className="flex h-full flex-col rounded-[22px] border-[3px] border-ink bg-white p-4 no-underline shadow-[6px_6px_0_0_#1a1a1a] hover:border-hot" href={`/pieces/${product.slug}`}>
                    {product.photos[0] && <PieceImage photo={product.photos[0]} alt={`${product.name}, front view`} className="p-3" />}
                    <p className="m-0 mt-3 font-display text-[1.5rem] leading-none tracking-[0.02em]">{product.name}</p>
                    <p className="m-0 mt-1.5 text-xs font-bold tracking-[0.08em] text-ink/60 uppercase">{product.sellerName}</p>
                    <p className="m-0 mt-2 text-sm">{sizeLine(product)}</p>
                    <p className="m-0 mt-auto pt-3 font-display text-lg">{money(product.priceCents)}</p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
