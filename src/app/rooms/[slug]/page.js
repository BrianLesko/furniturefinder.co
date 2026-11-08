import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { rooms, roomBySlug, roomUrl } from "@/content/rooms";

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

export const dynamicParams = false;

export function generateStaticParams() {
  return rooms.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const room = roomBySlug((await params).slug);
  if (!room) return {};
  const url = roomUrl(room);
  return {
    title: `${room.h1} · Furniture Finder`,
    description: room.description,
    alternates: { canonical: url, types: { "text/markdown": `${url}.md` } },
    openGraph: {
      title: room.h1,
      description: room.description,
      url,
      siteName: "Furniture Finder",
      images: [{ url: room.after, width: room.afterWidth, height: room.afterHeight, alt: room.afterAlt }],
    },
  };
}

function structuredData(room) {
  const url = roomUrl(room);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: room.h1,
        description: room.description,
        primaryImageOfPage: `https://furniturefinder.co${room.after}`,
        about: { "@type": "Place", name: room.place, url: room.placeUrl },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Furniture Finder", item: "https://furniturefinder.co" },
          { "@type": "ListItem", position: 2, name: "Rooms", item: "https://furniturefinder.co/rooms" },
          { "@type": "ListItem", position: 3, name: room.title, item: url },
        ],
      },
    ],
  };
}

export default async function RoomPage({ params }) {
  const room = roomBySlug((await params).slug);
  if (!room) notFound();
  const others = rooms.filter((item) => item.slug !== room.slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(room)).replace(/</g, "\\u003c") }} />
      <Header>
        <nav className="flex items-center gap-2.5">
          <a className={`${press} hidden border-2 bg-white px-4 py-2 text-sm sm:inline-flex`} href="/rooms">Rooms</a>
          <a className={`${press} border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`} href="/studio">Start now</a>
        </nav>
      </Header>
      <main className="mx-auto w-full max-w-[1120px] px-5 pt-10 pb-24">
        <p className="m-0 text-xs font-bold tracking-wide text-ink/50 uppercase">
          <a className="no-underline hover:text-hot" href="/rooms">Rooms</a>
          {" · "}
          <a className="no-underline hover:text-hot" href={room.placeUrl}>{room.place}</a>
        </p>
        <h1 className="m-0 mt-4 max-w-[18ch] font-display text-[clamp(2.6rem,6vw,4.4rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          {room.h1}
        </h1>
        <p className="mt-6 mb-0 max-w-[40rem] text-[1.0625rem] leading-[1.7]">{room.description}</p>

        <div className="mt-10 grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-[18px]">
          <figure className="m-0 overflow-hidden rounded-[28px] border-[3px] border-ink bg-white shadow-[8px_8px_0_0_#1a1a1a]">
            <div className="aspect-[4/3] bg-cream">
              <img className="block h-full w-full object-cover" src={room.before} alt={room.beforeAlt} />
            </div>
            <figcaption className="flex justify-between px-4 py-2.5 font-mono text-[13px]">
              <span className="font-bold">Empty</span>
              <span className="text-ink/55">{room.place}</span>
            </figcaption>
          </figure>
          <svg className="mx-auto h-9 w-9 rotate-90 text-hot md:rotate-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <figure className="m-0 overflow-hidden rounded-[28px] border-[3px] border-ink bg-white shadow-[8px_8px_0_0_#1a1a1a]">
            <div className="aspect-[4/3] bg-cream">
              <img className="block h-full w-full object-cover" src={room.after} alt={room.afterAlt} />
            </div>
            <figcaption className="flex justify-between px-4 py-2.5 font-mono text-[13px]">
              <span className="font-bold">Furnished</span>
              <span className="text-ink/55">{room.place}</span>
            </figcaption>
          </figure>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {room.pieces.map(([name, note]) => (
            <div className="rounded-2xl border-[3px] border-ink bg-white px-3.5 py-3" key={name}>
              <b className="block font-display text-[1.2rem] font-normal">{name}</b>
              <span className="text-xs text-ink/60">{note}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 flex max-w-[40rem] flex-col gap-5 text-[15px] leading-[1.85] text-ink/80 md:text-base">
          {room.paragraphs.map((text) => (
            <p className="m-0" key={text}>{text}</p>
          ))}
          <p className="m-0">
            The house is <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4" href={room.placeUrl}>{room.place}</a>.
            Try the same steps on <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4" href="/studio">your own photo</a>.
            Saving a room is <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4" href="/pricing">$12 a month</a>.
          </p>
        </div>

        <nav className="mt-14 border-t-2 border-ink/10 pt-8" aria-label="Other rooms">
          <h2 className="m-0 font-display text-2xl leading-none tracking-wide uppercase">The other rooms</h2>
          <ul className="m-0 mt-5 grid list-none gap-3 p-0 sm:grid-cols-2">
            {others.map((item) => (
              <li key={item.slug}>
                <a className="flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-white p-2 no-underline shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-px hover:shadow-[5px_5px_0_0_#1a1a1a]" href={`/rooms/${item.slug}`}>
                  <img className="h-16 w-24 shrink-0 rounded-xl border-2 border-ink object-cover" src={item.after} alt="" />
                  <span>
                    <span className="block font-display text-xl leading-none">{item.title}</span>
                    <span className="mt-1 block text-xs text-ink/60">{item.place}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <Footer />
    </>
  );
}
