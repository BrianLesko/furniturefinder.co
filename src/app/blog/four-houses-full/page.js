import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import BlogHeader from "../BlogHeader";

// Plain-text mirror for agents: src/content/blog/four-houses-full.md
// Update both when the piece changes.
const SITE_URL = "https://furniturefinder.co";
const PAGE_URL = `${SITE_URL}/blog/four-houses-full`;
const PUBLISHED = "2026-11-08";
const MODIFIED = "2026-11-08";

const AUTHOR_NAME = "Brian Lesko";
const AUTHOR_TITLE = "Creator of Furniture Finder";
const AUTHOR_URL = "https://brianlesko.com";

const title = "Four houses leased full. The photos got 100 views. The comps got 12.";
const metaTitle = "Four Columbus houses leased full. Zillow showed 100 views, comps showed 12";
const description =
  "71 E Patterson, 73 E Patterson, 204 E Oakland, and 217 E Oakland leased full. Zillow showed these listings at 100 or more views while comparable listings showed 12. The listing photos are what made the houses stand out.";

const keywords = ["listing photos", "Zillow views", "full occupancy", "Columbus rentals", "Ohio State rentals", "73 E Patterson", "virtual staging"];

export const metadata = {
  title: `${metaTitle} · Furniture Finder`,
  description,
  alternates: {
    canonical: PAGE_URL,
    types: { "text/markdown": `${PAGE_URL}.md` },
  },
  authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
  openGraph: {
    type: "article",
    title,
    description,
    url: PAGE_URL,
    siteName: "Furniture Finder",
    publishedTime: `${PUBLISHED}T12:00:00Z`,
    modifiedTime: `${MODIFIED}T12:00:00Z`,
    authors: [AUTHOR_URL],
    section: "Occupancy",
    tags: keywords,
    images: [{ url: `${SITE_URL}/examples/living-after.webp`, width: 1448, height: 1086 }],
    locale: "en_US",
  },
};

const houses = [
  ["71 E Patterson", "https://leskohomes.com/71epatterson", "A 2 bedroom, 1 bath duplex."],
  ["73 E Patterson", "https://leskohomes.com/73epatterson", "A 3 bedroom, 2 bath duplex, renovated, with the rooms furnished in the photos."],
  ["204 E Oakland", "https://leskohomes.com/204eoakland", "A 5 bedroom, 2 bath house."],
  ["217 E Oakland", "https://leskohomes.com/217eoakland", "A 4 bedroom, 2 bath house."],
];

const viewRows = [
  ["71 E Patterson, 73 E Patterson, 204 E Oakland, 217 E Oakland", "100 or more"],
  ["Comparable listings", "12"],
];

const faqItems = [
  {
    q: "Are all four houses full?",
    a: "Yes. 71 E Patterson, 73 E Patterson, 204 E Oakland, and 217 E Oakland each leased to full occupancy.",
  },
  {
    q: "Where do the view counts come from?",
    a: "Zillow. These listings showed 100 or more views. Comparable listings showed 12.",
  },
  {
    q: "Which photo matters most?",
    a: "The first one. It is the photo in the search result, and it decides whether a renter opens the listing at all.",
  },
  {
    q: "Can an empty house get this kind of attention?",
    a: "Yes, if each room is clear in the photo. Furnish the empty photo at the real size of the pieces, keep the same camera angle, and label a virtually staged photo where the listing site requires it.",
  },
];

function buildJsonLd(items) {
  const organization = { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Furniture Finder", url: SITE_URL };
  const author = { "@type": "Person", name: AUTHOR_NAME, jobTitle: AUTHOR_TITLE, url: AUTHOR_URL, worksFor: { "@id": organization["@id"] } };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${PAGE_URL}#article`,
        headline: title,
        description,
        url: PAGE_URL,
        mainEntityOfPage: { "@type": "WebPage", "@id": PAGE_URL },
        isPartOf: { "@type": "Blog", name: "Furniture Finder Blog", url: `${SITE_URL}/blog` },
        image: `${SITE_URL}/examples/living-after.webp`,
        datePublished: PUBLISHED,
        dateModified: MODIFIED,
        inLanguage: "en-US",
        author,
        publisher: organization,
        keywords,
      },
      {
        "@type": "FAQPage",
        "@id": `${PAGE_URL}#faq`,
        mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Furniture Finder", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: title, item: PAGE_URL },
        ],
      },
    ],
  };
}

function P({ children }) {
  return <p className="m-0 text-[15px] leading-[1.85] text-ink/80 md:text-base">{children}</p>;
}

function H2({ children }) {
  return <h2 className="m-0 pt-8 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">{children}</h2>;
}

function Link({ href, children }) {
  const external = href.startsWith("http");
  return (
    <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot" href={href} {...(external ? { rel: "noopener" } : {})}>
      {children}
    </a>
  );
}

function Figure({ src, alt, children }) {
  return (
    <figure className="my-2">
      <div className="overflow-hidden rounded-xl border-[3px] border-ink shadow-[5px_5px_0_0_#1a1a1a]">
        <img className="block w-full" src={src} alt={alt} />
      </div>
      <figcaption className="mt-4 text-xs leading-relaxed text-ink/55">{children}</figcaption>
    </figure>
  );
}

function List({ items }) {
  return (
    <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-[1.8] text-ink/80 marker:text-hot md:text-base">
      {items.map(([lead, rest]) => (
        <li key={lead}>
          <b className="text-ink">{lead}</b> {rest}
        </li>
      ))}
    </ul>
  );
}

function Table({ caption, head, rows }) {
  return (
    <figure className="my-2">
      <div className="overflow-x-auto rounded-xl border-[3px] border-ink bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-[3px] border-ink bg-yellow">
              {head.map((h) => (
                <th className="px-4 py-2.5 font-bold" key={h} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...cells], i) => (
              <tr className={i === rows.length - 1 ? "" : "border-b-2 border-ink/10"} key={label}>
                <th className="px-4 py-3 align-top font-bold" scope="row">{label}</th>
                {cells.map((cell) => (
                  <td className="px-4 py-3 align-top leading-relaxed text-ink/80" key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-3 text-xs leading-relaxed text-ink/55">{caption}</figcaption>
    </figure>
  );
}

export default function FourHousesFullPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(faqItems)) }} />
      <BlogHeader />
      <main>
        <article className="mx-auto w-full max-w-3xl px-5 pb-12">
          <p className="mt-0 mb-0 pt-10 text-xs font-bold tracking-wide text-ink/50 uppercase md:pt-14">
            <a className="no-underline hover:text-hot" href="/blog">Blog</a>
            {" · "}
            Occupancy
          </p>
          <h1 className="mt-4 mb-0 font-display text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.02] font-normal tracking-[0.02em] text-ink">
            Four houses leased full. The photos got <span className="text-hot [-webkit-text-stroke:2px_#1a1a1a] [paint-order:stroke_fill]">100 views</span>. The comps got 12.
          </h1>
          <p className="mt-5 mb-10 text-xs text-ink/55 md:mb-12">
            By{" "}
            <a className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink" href={AUTHOR_URL} rel="author">
              {AUTHOR_NAME}
            </a>
            , creator of Furniture Finder · Published <time dateTime={PUBLISHED}>November 8, 2026</time>
          </p>

          <div className="flex flex-col gap-6">
            <P>
              <Link href="https://leskohomes.com/71epatterson">71 E Patterson</Link>, <Link href="https://leskohomes.com/73epatterson">73 E Patterson</Link>, <Link href="https://leskohomes.com/204eoakland">204 E Oakland</Link>, and <Link href="https://leskohomes.com/217eoakland">217 E Oakland</Link> are full. Four houses near Ohio State, in Columbus, and every bedroom leased.
            </P>
            <P>
              A renter does not start on the sidewalk. They start in a list, on a phone, with a thumbnail. The listing photo is the first showing. For most people it is the only one they will give a house before they move on.
            </P>
            <P>
              Zillow showed these listings at 100 or more views. Comparable listings showed 12. That is the count on the listings themselves.
            </P>

            <H2>What Zillow showed</H2>
            <Table
              caption="The count Zillow displayed. These four listings passed 100 views. Comparable listings showed 12."
              head={["Listings", "Views on Zillow"]}
              rows={viewRows}
            />

            <H2>The four houses</H2>
            <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-[1.8] text-ink/80 marker:text-hot md:text-base">
              {houses.map(([name, href, detail]) => (
                <li key={name}>
                  <Link href={href}>{name}</Link>. {detail}
                </li>
              ))}
            </ul>
            <P>Each one leased to full occupancy.</P>

            <H2>The photo has to show the room</H2>
            <P>
              A listing gets skipped when the photo hides the room. A window blown out to white, a camera pointed at the ceiling, one shot of the nicest corner, and the renter cannot tell what they would be paying for.
            </P>
            <P>
              The photos on these listings do the plain things. The camera is level, so the walls stay upright. It sits at chest height, so the floor and the far wall are both in the frame. The blinds are open and the lights are on. Every room a renter asks about is there: the front, the kitchen, each bedroom, the bath, the yard. The first photo is the one in the search result, so it is the front of the house or the best room. It is horizontal, because that is the shape of the screen.
            </P>
            <P>
              An empty room reads smaller than it is. Nothing in it tells you how wide the floor is. At 73 E Patterson the listing photos show the same rooms furnished, from the same camera, so a sofa sits where a sofa fits.
            </P>
            <Figure src="/examples/living-after.webp" alt="Furnished living room at 73 E Patterson, with a green sofa, jute rug, round wood table, and the brick fireplace">
              The living room at 73 E Patterson, furnished. Same camera as the empty room: the brick fireplace, the arch, and the floor from the far wall to the near edge. The kitchen and the three bedrooms, empty and furnished, are in <Link href="/rooms">the rooms</Link>.
            </Figure>
            <P>
              <Link href="/">Furniture Finder</Link> starts from that empty photo. <Link href="/straighten">Straighten the walls</Link>, then <Link href="/pick">set real pieces on the floor</Link> at their real size. The empty photo and the furnished one stay the same room.
            </P>

            <H2>From a view to a full house</H2>
            <P>
              A view is the start of the lease. The photo earns the tour, and the tour earns the application. When a dozen houses are up at once, the tour goes to the listing a renter can already picture. These four got those tours. All four leased full.
            </P>
            <P>
              The count on Zillow is the part anyone can check. More than 100 views on these listings. 12 on the comparables. The photo put the houses ahead of the competition before anyone turned the key.
            </P>

            <H2>Shoot the next listing this way</H2>
            <P>
              The full method is in <Link href="/blog/real-estate-photography-tips">How to take real estate photos</Link>. The short version is what these four depended on:
            </P>
            <List
              items={[
                ["Clear the room first.", "Counters empty, blinds open, every light on, before the camera comes out."],
                ["Stand in a corner.", "Hold it level, at chest height, with the whole floor in the frame."],
                ["Shoot every bedroom.", "One pretty room does not answer the question a renter came with."],
                ["Check the set on a phone.", "That is the size Zillow shows it at."],
                ["If the house is empty,", "furnish the photo at the real size of the pieces, and label it where the site asks you to."],
              ]}
            />
          </div>
        </article>

        <section className="mx-auto w-full max-w-3xl px-5 pt-8 pb-24" id="faq">
          <h2 className="mt-0 mb-8 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">Questions about these listings</h2>
          <Faq items={faqItems} />
        </section>
      </main>
      <Footer />
    </>
  );
}
