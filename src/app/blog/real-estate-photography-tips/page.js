import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import BlogHeader from "../BlogHeader";

// Plain-text mirror for agents: src/content/blog/real-estate-photography-tips.md
// Update both when the advice changes.
const SITE_URL = "https://furniturefinder.co";
const PAGE_URL = `${SITE_URL}/blog/real-estate-photography-tips`;
const PUBLISHED = "2026-11-07";
const MODIFIED = "2026-11-07";

const AUTHOR_NAME = "Brian Lesko";
const AUTHOR_TITLE = "Creator of Furniture Finder";
const AUTHOR_URL = "https://brianlesko.com";

const title = "How to take real estate photos: a level camera, open blinds, and the whole floor";
const metaTitle = "Real estate photography tips: how to take listing photos with a phone";
const description =
  "How to shoot listing photos with a phone or a camera: where to stand, how high to hold it, which lens, how to keep the window from going white, the shot list, and how to shoot an empty room so it can be furnished later.";

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
    section: "Listing photos",
    tags: ["real estate photography", "listing photos", "real estate photography tips", "phone real estate photos", "virtual staging"],
    images: [{ url: `${SITE_URL}/examples/wyandotte-front-room.webp`, width: 1448, height: 1086 }],
    locale: "en_US",
  },
};

const lensRows = [
  ["Full-frame camera", "16 to 24mm", "Wider than 16mm stretches the corners"],
  ["APS-C camera", "10 to 16mm", "Same view as 16 to 24mm on full frame"],
  ["Phone, 0.5x", "About 13mm equivalent", "Fine for small rooms. Keep doors and furniture out of the edges"],
  ["Phone, 1x", "About 24 to 26mm equivalent", "Large rooms, and any room where 0.5x bends the walls"],
];

const shotRows = [
  ["Front of the house", "From across the street, at a corner, with the whole roofline"],
  ["Living room", "Two angles, from opposite corners"],
  ["Kitchen", "Wide from the entry, then one of the counters and appliances"],
  ["Primary bedroom", "From the doorway, with the window in the frame"],
  ["Other bedrooms", "One each, from the door"],
  ["Bathrooms", "From the door, with the mirror angled so you are not in it"],
  ["Backyard", "From the back corner, looking at the house"],
  ["The one thing", "The fireplace, the view, the built-ins. Whatever the house is known for"],
];

const faqItems = [
  {
    q: "Do I need a real camera?",
    a: "No. A recent phone, held level at chest height, with HDR on, takes a listing photo good enough for any site. A camera helps most with the window, because it can bracket exposures and blend them.",
  },
  {
    q: "How many photos should a listing have?",
    a: "Shoot more than you need, then keep 20 to 30. Every room a buyer will ask about should be there at least once. The first photo is the one most people see, so make it the front of the house or the best room.",
  },
  {
    q: "Should the photos be vertical or horizontal?",
    a: "Horizontal. Listing sites and screens are wide, and a vertical photo of a room is mostly ceiling and floor.",
  },
  {
    q: "What time of day is best?",
    a: "For rooms, when the sun is not pouring straight through a window. Overcast days are easy. For the front of the house, when the sun is on the front.",
  },
  {
    q: "Can I furnish an empty room photo?",
    a: "Yes, if it was shot level, from a corner, with the back wall and the floor in the frame. Furniture Finder straightens the walls, then sets real pieces on the floor at their real size. Many MLSs require a virtually staged photo to be labeled as one. Check your MLS rules before you post.",
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
        image: `${SITE_URL}/examples/wyandotte-front-room.webp`,
        datePublished: PUBLISHED,
        dateModified: MODIFIED,
        inLanguage: "en-US",
        author,
        publisher: organization,
        keywords: ["real estate photography", "listing photos", "real estate photography tips", "phone real estate photos", "virtual staging"],
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
  return (
    <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot" href={href}>
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
                <th className="px-4 py-3 align-top font-bold whitespace-nowrap" scope="row">{label}</th>
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

export default function RealEstatePhotographyTipsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(faqItems)) }} />
      <BlogHeader />
      <main>
        <article className="mx-auto w-full max-w-3xl px-5 pb-12">
          <p className="mt-0 mb-0 pt-10 text-xs font-bold tracking-wide text-ink/50 uppercase md:pt-14">
            <a className="no-underline hover:text-hot" href="/blog">Blog</a>
            {" · "}
            Listing photos
          </p>
          <h1 className="mt-4 mb-0 font-display text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.02] font-normal tracking-[0.02em] text-ink">
            How to take real estate photos: a <span className="text-hot [-webkit-text-stroke:2px_#1a1a1a] [paint-order:stroke_fill]">level camera</span>, open blinds, and the whole floor
          </h1>
          <p className="mt-5 mb-10 text-xs text-ink/55 md:mb-12">
            By{" "}
            <a className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink" href={AUTHOR_URL} rel="author">
              {AUTHOR_NAME}
            </a>
            , creator of Furniture Finder · Published <time dateTime={PUBLISHED}>November 7, 2026</time>
          </p>

          <div className="flex flex-col gap-6">
            <P>
              The listing photo is the first showing. Most people decide whether to book the real one from a phone screen, in a few seconds, scrolling.
            </P>
            <P>
              Most bad listing photos fail for the same three reasons. The camera was tilted, so the walls lean in. The window blew out to white. The counters were full. None of those needs a better camera. All three are fixed before you press the shutter.
            </P>

            <Figure src="/examples/wyandotte-front-room.webp" alt="Empty front room shot from a corner at chest height, with two walls, the stairs, the window, and the floor in the frame">
              Shot from the corner, at chest height, camera level. Two walls, the stairs, the window, and the floor from the far wall to the near edge.
            </Figure>

            <H2>Get the room ready</H2>
            <P>Spend more time here than on the camera. A clean, bright room photographed badly still beats a cluttered one photographed well.</P>
            <List
              items={[
                ["Clear every surface.", "Toasters, soap, mail, magnets, cords. Each one is small. Together they make a room look busy and smaller than it is."],
                ["Open the blinds all the way.", "Daylight is the cheapest light you have."],
                ["Turn every light on.", "Ceiling, lamps, under-cabinet, range hood. Replace dead bulbs, and keep them all one color, warm or cool, not both."],
                ["Close what can be closed.", "Toilet seats down, closet doors shut, shower curtain pulled straight, towels folded or gone."],
                ["Clean the floor.", "It is the biggest surface in most photos. Vacuum lines show, and so do pet hairs."],
                ["Take your tools with you.", "Ladders, paint cans, and shoe covers end up in more listing photos than you would think."],
              ]}
            />

            <Figure src="/examples/bedroom2-empty.webp" alt="Empty bedroom with a green step ladder and a bag left on the carpet">
              A finished bedroom at 73 E Patterson. The step ladder and the bag on the carpet are the first things you see.
            </Figure>

            <H2>Put the camera at chest height, and keep it level</H2>
            <P>
              Hold the lens about 4 to 5 feet off the floor. Higher looks down on the room and makes it feel like a hallway. Lower makes the ceiling loom and hides the floor.
            </P>
            <P>
              Then point the camera straight ahead, not up and not down. Tilt is what makes walls lean. If the uprights in the photo are not vertical, the camera was not level. Turn on the grid and the level in your camera settings, and line the vertical gridline up with a door frame before you shoot.
            </P>
            <P>
              Stand in a corner or a doorway and aim at the opposite corner. You get two walls, the floor, and the depth of the room. Shooting one wall straight on shows a flat rectangle and nothing about how big the room is.
            </P>
            <P>
              Hold it still. Indoor light is low, and blur is the first thing a buyer notices. A tripod is best. A phone braced against a door frame is fine.
            </P>

            <H2>Use a wide lens, not the widest one</H2>
            <P>
              A room needs a wide lens to fit. Too wide and the corners stretch, the furniture near the edges bends, and the room looks bigger than it is. Buyers notice that at the showing.
            </P>
            <Table
              caption="Focal lengths are approximate. Phone equivalents vary by model."
              head={["Camera", "Lens", "Notes"]}
              rows={lensRows}
            />
            <P>
              Shoot horizontal. Listing sites and screens are wide. A vertical photo of a room is mostly ceiling and floor. Skip the panorama mode too: it fits the whole room and bends every wall to do it.
            </P>

            <Figure src="/examples/wyandotte-bedroom.webp" alt="Panorama of an empty bedroom, very wide and short, with the side walls stretched">
              A panorama fits the whole bedroom and stretches both side walls. Most listing sites crop or letterbox a photo this wide.
            </Figure>

            <H2>Set the exposure on the room, then save the window</H2>
            <P>
              The window is the brightest thing in the frame by far. If the camera exposes for it, the room goes dark. If it exposes for the room, the window turns white.
            </P>
            <List
              items={[
                ["On a phone,", "tap the wall, not the window, to set focus and exposure. Long-press to lock it. If the window is pure white, drag the brightness down a little."],
                ["Leave HDR on.", "The phone takes several exposures and blends them, which is what saves the view."],
                ["On a camera,", "bracket three to five exposures from dark to bright, on a tripod, and blend them."],
                ["No flash pointed at the room.", "It makes hard shadows and shiny floors. Bounce it off the ceiling behind you, or skip it."],
                ["One white balance for the house.", "A white wall should be the same white in every room."],
              ]}
            />
            <P>
              Pick the hour. Shoot rooms when the sun is not pouring straight in, and the front of the house when the sun is on the front. Overcast days are easy everywhere.
            </P>

            <H2>Shoot the empty room so it can be furnished</H2>
            <P>
              Empty rooms look smaller in photos than they are, because there is nothing in them to give them a scale. That is what <Link href="/">Furniture Finder</Link> is for. It works best on a photo shot this way:
            </P>
            <List
              items={[
                ["Keep the back wall in the frame,", "edge to edge if you can. That is the rectangle the walls are straightened to."],
                ["Show the whole floor,", "from the back wall to the bottom of the frame. Furniture sits on that plane."],
                ["Keep a door, a counter, or the ceiling in the frame.", "Something of known height sets the scale for every piece."],
                ["Do not crop or zoom afterward.", "The straighten step needs the full frame."],
                ["If you will reshoot it furnished,", "mark where the tripod stood, so the before and after line up."],
              ]}
            />

            <Figure src="/examples/kitchen-empty.webp" alt="Empty kitchen shot level from the entry, with the back wall, window, and the full floor visible">
              The kitchen at 73 E Patterson, from the entry. Level, the back wall in the frame, and the floor from the far wall to the near edge.
            </Figure>

            <P>
              Once you have one, <Link href="/straighten">straighten the walls</Link> and <Link href="/pick">pick real pieces</Link> to set on the floor.
            </P>

            <H2>The shot list</H2>
            <P>Every room a buyer will ask about should appear at least once. Shoot more than you need, then keep 20 to 30.</P>
            <Table caption="A standard single-family listing. Add a shot for every room that is not on this list." head={["Room", "How"]} rows={shotRows} />

            <H2>Before you post</H2>
            <P>
              Look at each photo on a phone, not on a laptop. That is the size most buyers see it at. If the walls lean, reshoot it level rather than fixing it later. Straightening in an editor crops the edges, and the edges are the room. Keep edits to brightness and white balance. Do not change what is in the room. Many MLSs require virtually staged or digitally altered photos to be labeled. Check yours.
            </P>
          </div>
        </article>

        <section className="mx-auto w-full max-w-3xl px-5 pt-8 pb-24" id="faq">
          <h2 className="mt-0 mb-8 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">Questions about listing photos</h2>
          <Faq items={faqItems} />
        </section>
      </main>
      <Footer />
    </>
  );
}
