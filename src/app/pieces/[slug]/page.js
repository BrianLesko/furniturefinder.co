import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PieceImage from "../PieceImage";
import {
  KIND_PLURAL,
  buyLink,
  cm,
  feet,
  fitNotes,
  inches,
  kindOf,
  listedPieces,
  money,
  pieceBySlug,
  quotedDate,
  sizeLine,
  viewLabel,
  viewPhotos,
} from "@/lib/piece-pages";

const SITE_URL = "https://furniturefinder.co";

export const revalidate = 3600;

export function generateStaticParams() {
  return listedPieces().map(({ slug }) => ({ slug }));
}

const plainInches = (value) => inches(value).replace("″", '"');

function describe(product) {
  return `The ${product.name} from ${product.sellerName} is ${plainInches(product.widthIn)} wide, ${plainInches(product.depthIn)} deep, and ${plainInches(product.heightIn)} tall. See what fits around it, then place it in a photo of your own room at its real size.`;
}

export async function generateMetadata({ params }) {
  const product = pieceBySlug((await params).slug);
  if (!product) return {};
  const url = `${SITE_URL}/pieces/${product.slug}`;
  const title = `${product.name} dimensions: ${plainInches(product.widthIn)} W × ${plainInches(product.depthIn)} D × ${plainInches(product.heightIn)} H`;
  const front = product.photos[0];
  return {
    title: `${title} · Furniture Finder`,
    description: describe(product),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Furniture Finder",
      title,
      description: describe(product),
      url,
      images: front ? [{ url: `${SITE_URL}${front.path}`, alt: `${product.name}, front view` }] : undefined,
      locale: "en_US",
    },
  };
}

function brandOf(product) {
  return /samsung/i.test(product.name) ? "Samsung" : product.sellerName;
}

function buildJsonLd(product) {
  const url = `${SITE_URL}/pieces/${product.slug}`;
  const size = (name, value) => ({ "@type": "QuantitativeValue", name, value, unitCode: "INH" });
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.name,
        description: describe(product),
        url,
        image: viewPhotos(product).map((photo) => `${SITE_URL}${photo.path}`),
        brand: { "@type": "Brand", name: brandOf(product) },
        category: kindOf(product),
        width: size("Width", product.widthIn),
        depth: size("Depth", product.depthIn),
        height: size("Height", product.heightIn),
        offers: {
          "@type": "Offer",
          url: product.productUrl,
          price: (product.priceCents / 100).toFixed(2),
          priceCurrency: "USD",
          seller: { "@type": "Organization", name: product.sellerName, url: product.sellerUrl },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Furniture Finder", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Pieces", item: `${SITE_URL}/pieces` },
          { "@type": "ListItem", position: 3, name: product.name, item: url },
        ],
      },
    ],
  };
}

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

function H2({ children }) {
  return <h2 className="m-0 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">{children}</h2>;
}

function related(product) {
  const others = listedPieces().filter((other) => other.id !== product.id);
  const sameKind = others.filter((other) => kindOf(other) === kindOf(product));
  const sameRoom = others.filter((other) => other.room === product.room && kindOf(other) !== kindOf(product));
  return [...sameKind, ...sameRoom].slice(0, 6);
}

export default async function PiecePage({ params }) {
  const product = pieceBySlug((await params).slug);
  if (!product) notFound();
  const kind = kindOf(product);
  const views = viewPhotos(product);
  const [front, ...rest] = views;
  const buy = buyLink(product);
  const notes = fitNotes(product);
  const dims = [
    ["Width", product.widthIn],
    ["Depth", product.depthIn],
    ["Height", product.heightIn],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(product)) }} />
      <Header>
        <nav className="flex items-center gap-2.5">
          <a className={`${press} border-2 bg-white px-4 py-2 text-sm`} href="/pieces">
            All pieces
          </a>
          <a className={`${press} border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`} href={`/studio?add=${product.id}`}>
            Studio
          </a>
        </nav>
      </Header>

      <main className="mx-auto w-full max-w-[1120px] px-5 pt-8 pb-20">
        <nav aria-label="Breadcrumb" className="text-xs font-bold tracking-wide text-ink/50 uppercase">
          <a className="no-underline hover:text-hot" href="/pieces">Pieces</a>
          {" · "}
          <a className="no-underline hover:text-hot" href={`/pieces#${kind.replace(/ /g, "-")}`}>{KIND_PLURAL[kind] ?? kind}</a>
        </nav>

        <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            {front && (
              <div className="overflow-hidden rounded-[22px] border-[3px] border-ink bg-white p-6 shadow-[6px_6px_0_0_#1a1a1a]">
                <PieceImage photo={front} alt={`${product.name}, front view`} eager />
              </div>
            )}
            {rest.length > 0 && (
              <ul className="mt-4 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4">
                {rest.map((photo) => (
                  <li className="rounded-xl border-2 border-ink bg-white p-2" key={photo.angle}>
                    <PieceImage photo={photo} alt={`${product.name}, ${viewLabel(photo.angle).toLowerCase()} view`} frame={1} />
                    <p className="m-0 mt-1 text-center text-[11px] text-ink/60">{viewLabel(photo.angle)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="m-0 text-xs font-bold tracking-[0.08em] text-ink/60 uppercase">
              {kind} · {product.sellerName}
            </p>
            <h1 className="mt-3 mb-0 font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.98] font-normal tracking-[0.02em] text-ink">{product.name}</h1>
            <p className="mt-4 mb-0 text-lg font-bold">{sizeLine(product)}</p>
            <p className="mt-1 mb-0 text-sm text-ink/60">
              {cm(product.widthIn)} × {cm(product.depthIn)} × {cm(product.heightIn)}
            </p>
            <p className="mt-6 mb-0 font-display text-[2.2rem] leading-none tracking-[0.02em]">{money(product.priceCents)}</p>
            <p className="mt-1.5 mb-0 text-xs text-ink/60">
              At {product.sellerName}, as of {quotedDate(product.quotedOn)}. Check the seller for today&apos;s price.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className={`${press} border-[3px] bg-hot px-6 py-3 text-white`} href={`/studio?add=${product.id}`}>
                Try it in your room
              </a>
              <a className={`${press} border-[3px] bg-white px-6 py-3`} href={buy.href} rel={buy.rel} target="_blank">
                Buy at {product.sellerName}
              </a>
            </div>
            <p className="mt-4 mb-0 text-sm leading-relaxed text-ink/70">
              Bring a photo of your room. The studio straightens it, sets the {product.name} on the floor at its real size, and keeps your window light. Free to try.
            </p>
          </div>
        </div>

        <section className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            <H2>Dimensions</H2>
            <div className="mt-5 overflow-x-auto rounded-xl border-[3px] border-ink bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-[3px] border-ink bg-yellow">
                    <th className="px-4 py-2.5 font-bold" scope="col"></th>
                    <th className="px-4 py-2.5 font-bold" scope="col">Inches</th>
                    <th className="px-4 py-2.5 font-bold" scope="col">Feet</th>
                    <th className="px-4 py-2.5 font-bold" scope="col">Centimeters</th>
                  </tr>
                </thead>
                <tbody>
                  {dims.map(([label, value], i) => (
                    <tr className={i === dims.length - 1 ? "" : "border-b-2 border-ink/10"} key={label}>
                      <th className="px-4 py-3 font-bold" scope="row">{label}</th>
                      <td className="px-4 py-3">{inches(value)}</td>
                      <td className="px-4 py-3">{value >= 12 ? feet(value) : "—"}</td>
                      <td className="px-4 py-3">{cm(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 mb-0 text-xs leading-relaxed text-ink/55">From {product.sellerName}&apos;s listing. Width is side to side as you face it, depth is front to back.</p>
          </div>

          {notes.length > 0 && (
            <div>
              <H2>Will it fit?</H2>
              <ul className="mt-5 mb-0 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-[1.8] text-ink/80 marker:text-hot">
                {notes.map(([lead, text]) => (
                  <li key={lead}>
                    <b className="text-ink">{lead}</b> {text}
                  </li>
                ))}
              </ul>
              <p className="mt-3 mb-0 text-xs leading-relaxed text-ink/55">Common designer clearances, worked out for this piece. Your room has the final say.</p>
            </div>
          )}
        </section>

        {related(product).length > 0 && (
          <section className="mt-16">
            <H2>More pieces</H2>
            <ul className="mt-6 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3">
              {related(product).map((other) => (
                <li key={other.id}>
                  <a className="block h-full rounded-[18px] border-[3px] border-ink bg-white p-3 no-underline shadow-[4px_4px_0_0_#1a1a1a] hover:border-hot" href={`/pieces/${other.slug}`}>
                    {other.photos[0] && <PieceImage photo={other.photos[0]} alt={`${other.name}, front view`} className="p-2" />}
                    <p className="m-0 mt-2 font-display text-lg leading-tight">{other.name}</p>
                    <p className="m-0 mt-1 text-xs text-ink/60">{sizeLine(other)}</p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
