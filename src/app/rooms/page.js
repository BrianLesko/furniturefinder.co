import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SHARE } from "@/content/seo";
import { rooms } from "@/content/rooms";

const PAGE_URL = "https://furniturefinder.co/rooms";
const title = "Virtual staging, room by room";
const description =
  "Empty and furnished photos of the living room, kitchen, and three bedrooms at 73 E Patterson. Same camera in each pair. Pieces set on the floor at real size.";

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

export const metadata = {
  title: `${title} · Furniture Finder`,
  description,
  alternates: { canonical: PAGE_URL },
  openGraph: { ...SHARE, title, description, url: PAGE_URL },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: title,
  url: PAGE_URL,
  itemListElement: rooms.map((room, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: room.h1,
    url: `https://furniturefinder.co/rooms/${room.slug}`,
  })),
};

export default function RoomsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Header>
        <nav className="flex items-center gap-2.5">
          <a className={`${press} hidden border-2 bg-white px-4 py-2 text-sm sm:inline-flex`} href="/about">About</a>
          <a className={`${press} border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`} href="/studio">Start now</a>
        </nav>
      </Header>
      <main className="mx-auto w-full max-w-[1120px] px-5 pt-12 pb-24">
        <h1 className="m-0 max-w-[16ch] font-display text-[clamp(2.8rem,7vw,4.8rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          Virtual staging, room by room
        </h1>
        <p className="mt-6 mb-0 max-w-[40rem] text-[1.0625rem] leading-[1.7]">
          Five rooms at <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4" href="https://leskohomes.com/73epatterson">73 E Patterson</a>.
          Each pair is one camera: the empty photo, then the same room with real pieces on the floor. The furniture is not included with the house.
        </p>
        <ul className="m-0 mt-12 grid list-none gap-6 p-0 sm:grid-cols-2">
          {rooms.map((room) => (
            <li key={room.slug}>
              <a className="group block overflow-hidden rounded-[28px] border-[3px] border-ink bg-white no-underline shadow-[6px_6px_0_0_#1a1a1a] hover:-translate-y-px hover:shadow-[8px_8px_0_0_#1a1a1a]" href={`/rooms/${room.slug}`}>
                <img className="block aspect-[4/3] w-full object-cover" src={room.after} alt={room.afterAlt} />
                <span className="block px-5 py-4">
                  <span className="block font-display text-2xl leading-none tracking-wide text-ink group-hover:text-hot">{room.title}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-ink/70">{room.h1}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
