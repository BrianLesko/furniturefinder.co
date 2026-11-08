import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import BlogHeader from "../BlogHeader";

// Plain-text mirror for agents: src/content/blog/photos-to-include.md
// Update both when the advice changes.
const SITE_URL = "https://furniturefinder.co";
const PAGE_URL = `${SITE_URL}/blog/photos-to-include`;
const PUBLISHED = "2026-11-08";
const MODIFIED = "2026-11-08";

const AUTHOR_NAME = "Brian Lesko";
const AUTHOR_TITLE = "Creator of Furniture Finder";
const AUTHOR_URL = "https://brianlesko.com";

const title = "The photos to include: one of the room empty, one furnished";
const metaTitle = "Listing photos to include: one empty, one furnished, every bed and bath";
const description =
  "Which listing photos to shoot: one empty and one furnished from the same spot, every bedroom and bathroom, two angles of each bedroom, and where to stand so a fireplace or exposed brick lands on a third. What Furniture Finder can still adjust after the shoot.";

const keywords = ["listing photos", "empty room photos", "virtually staged photos", "real estate shot list", "rule of thirds", "Furniture Finder"];

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
    tags: keywords,
    images: [{ url: `${SITE_URL}/examples/living-after.webp`, width: 1448, height: 1086, alt: "Furnished living room at 73 E Patterson with a brick fireplace, green sofa, and jute rug" }],
    locale: "en_US",
  },
};

const shotRows = [
  ["Living room", "One empty, one furnished", "A corner, with the feature on a third"],
  ["Kitchen", "One empty, one furnished", "The entry, looking in"],
  ["Each bedroom", "Two angles empty, and furnish the main one", "The doorway, then the far corner"],
  ["Each bathroom", "One, as it is", "The doorway, out of the mirror"],
];

const faqItems = [
  {
    q: "Do I need both the empty and the furnished photo?",
    a: "Yes, for every room you furnish. The empty one is the original. The furnished one is the showing. Same spot, same camera.",
  },
  {
    q: "How many photos of a bedroom?",
    a: "Two angles, shot empty. Furnish the one that shows the whole room. Furnish the second too when it is a clean frame. One photo of each bathroom, from the door, left as it is.",
  },
  {
    q: "Where should the fireplace go?",
    a: "On a third. Turn on the grid and put the brick, the fireplace, or the built-in on a crossing, in from the edge, with the floor still in the frame.",
  },
  {
    q: "What can I fix after the shoot?",
    a: "The lean of the walls, the scale of the pieces, and the furniture in the empty photo. Furniture Finder does those. It cannot change where you stood, the light, the clutter, or a room you did not shoot.",
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

function BeforeAfter() {
  const frames = [
    ["/examples/living-empty.webp", "Empty", "Empty living room at 73 E Patterson, with the brick fireplace, the arch, and a bare floor"],
    ["/examples/living-after.webp", "Furnished", "The same living room furnished with a green sofa, jute rug, and round wood table"],
  ];
  return (
    <figure className="my-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {frames.map(([src, label, alt]) => (
          <div className="relative overflow-hidden rounded-xl border-[3px] border-ink shadow-[5px_5px_0_0_#1a1a1a]" key={label}>
            <img className="block aspect-[4/3] w-full object-cover" src={src} alt={alt} />
            <span className="absolute top-2 left-2 rounded-full border-2 border-ink bg-yellow px-2.5 py-0.5 text-[11px] font-bold uppercase">{label}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-4 text-xs leading-relaxed text-ink/55">
        The living room at 73 E Patterson, empty and furnished, from the same camera. The brick fireplace is the feature the frame is built around.
      </figcaption>
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

export default function PhotosToIncludePage() {
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
            The photos to include: one of the room empty, one <span className="text-hot [-webkit-text-stroke:2px_#1a1a1a] [paint-order:stroke_fill]">furnished</span>
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
              A listing set is pairs. For every room a renter will ask about, shoot one photo empty and one furnished, from the same spot. The empty one is the room. The furnished one is how it lives.
            </P>
            <P>Shoot the empty one while the room is empty. Once a bed is in it, that photo is gone.</P>

            <H2>One empty, one furnished</H2>
            <P>
              Leave the tripod where it is. The furnished photo has to be the same camera, the same height, and the same corner as the empty one. A renter flips between them and should see one room, not two.
            </P>
            <P>
              At <Link href="https://leskohomes.com/73epatterson">73 E Patterson</Link> the living room was shot that way. The empty frame has the brick fireplace, the arch, and the bare floor. The furnished frame has a sofa, a rug, and a table in that same room.
            </P>
            <BeforeAfter />
            <P>
              If you only post the furnished photo, a renter cannot tell what was added. Most MLSs want a virtually staged photo labeled, and some want the original next to it. The empty frame is that original. <Link href="/">Furniture Finder</Link> can make the furnished one later, from the empty photo, so you do not have to move furniture in and shoot again.
            </P>

            <H2>Every bedroom, every bathroom</H2>
            <P>Skip a room and a renter assumes you are hiding it. Shoot each bedroom and each bathroom, even the small ones.</P>
            <P>Give each bedroom two shots.</P>
            <List
              items={[
                ["The whole room,", "from the doorway. Window in the frame, floor to the bottom edge, closet door in view if it fits."],
                ["The second angle,", "from a corner. Aim it at whatever that bedroom is known for: the brick, the second window, the closet. A renter who only sees one wall still has a question."],
              ]}
            />
            <P>
              One photo of each bathroom is enough when it shows the whole room. Stand in the doorway. If the shower is out of that frame, take a second of the shower and stop there. Leave the bathroom as it is. Do not furnish it.
            </P>
            <Table
              caption="Shoot the empty frames first. Furnish the living room, the kitchen, and the main bedroom angle from those same spots."
              head={["Room", "What to include", "Where to stand"]}
              rows={shotRows}
            />

            <H2>Put the feature on a third</H2>
            <P>
              Exposed brick, a fireplace, stained glass, a built-in. That object gets the frame. Everything else fits around it.
            </P>
            <P>
              Turn on the grid in the camera. The lines cut the frame into thirds. Put the feature on a crossing: about a third of the way in from the left or the right, and about a third of the way down from the top. Keep it off the edge.
            </P>
            <P>
              Centered, the fireplace fills the middle and the room disappears. Shoved to the edge, a later straighten can crop it off. On a third, the eye lands on it and the floor still has room to show how big the room is.
            </P>
            <P>
              Stand in the corner that puts the feature on that crossing. In the 73 E Patterson living room, that corner is the one looking toward the brick fireplace, with the arch and the floor still in the frame.
            </P>

            <H2>Where to stand</H2>
            <P>
              Hold the camera at chest height, about 4 to 5 feet off the floor, and point it straight ahead. Higher looks down the room. Lower hides the floor and makes the ceiling loom. If the uprights lean, the camera was tilted. Line a door frame up with the grid before you shoot.
            </P>
            <P>
              Stand in a corner or a doorway and aim at the opposite corner. You get two walls, the floor, and the depth. Standing in the middle, square to one wall, shows a flat rectangle.
            </P>
            <List
              items={[
                ["Living room.", "The corner that puts the fireplace or the brick on a third. Floor runs to the bottom of the frame. Leave a margin around the brick."],
                ["Kitchen.", "In the entry or the arch, looking in, so the counters and the far wall are both there. A second shot from the side only if the first one misses the appliances."],
                ["Bedroom, first shot.", "In the doorway. Window in the frame. Whole floor."],
                ["Bedroom, second shot.", "The corner opposite the feature, so the brick, the closet, or the second window lands on a third."],
                ["Bathroom.", "In the doorway, a step to the side, so the mirror does not show you. Lid down. Shower curtain straight, or open enough to see the tile."],
                ["Mark the tripod.", "Tape or a pencil tick at the feet. The furnished photo, whether you shoot it or build it later, has to stand in that same place."],
              ]}
            />
            <P>
              Shoot horizontal. A vertical photo of a room is mostly ceiling and floor. Skip the panorama. It bends the walls, and the straighten step wants the original frame.
            </P>
            <P>
              The longer version of how to hold the camera, set the exposure, and keep the window is in <Link href="/blog/real-estate-photography-tips">How to take real estate photos</Link>.
            </P>

            <H2>What Furniture Finder can adjust after</H2>
            <P>Some things are fixed at the shutter. Some can be fixed after, on the empty photo.</P>
            <P>Furniture Finder can do three of them.</P>
            <List
              items={[
                ["The lean.", "A wide lens makes uprights tip in. When a wall faces the camera, drag its four corners until they make a rectangle and the photo squares to that wall. When you shot into a corner, drag two lines onto the uprights and they stand up. The fireplace and the window stay. A hard straighten crops the edges, which is why the feature needs a margin."],
                ["The scale.", "Stand the height mark on a door or the ceiling, and put the dashed line at eye level. Pieces then sit at their real width, height, and depth, and they shrink as you slide them back into the room. A bed that does not fit shows that it does not fit."],
                ["The furnished half of the pair.", "Pick real pieces and set them on the floor of the empty photo. The window and the floor line stay. You get the second photo from the same camera without carrying furniture in."],
              ]}
            />
            <P>
              <Link href="/studio">Try it in the studio</Link>.
            </P>
            <P>What it leaves alone:</P>
            <List
              items={[
                ["Where you stood.", "The corner is the photo. No tool moves the camera into a better one."],
                ["The light.", "A window blown to white, a dark wall, a closed blind. Shoot those right."],
                ["Clutter.", "The ladder, the bag, the soap. Clear them before the shutter."],
                ["A room you skipped.", "It cannot invent the third bedroom or the hall bath."],
                ["A room that is already full.", "It furnishes empty rooms. It does not remove furniture that is already there."],
              ]}
            />
            <P>
              Save the scene and your own AI renders the furnished photo. Label it where the listing site asks, and keep the empty original next to it. The rules are in <Link href="/blog/virtually-staged-photo-disclosure">Do you have to label a virtually staged listing photo?</Link> The houses in <Link href="/blog/four-houses-full">Four houses leased full</Link> were leased on photos a renter could already picture.
            </P>
          </div>
        </article>

        <section className="mx-auto w-full max-w-3xl px-5 pt-8 pb-24" id="faq">
          <h2 className="mt-0 mb-8 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">Questions about the shot list</h2>
          <Faq items={faqItems} />
        </section>
      </main>
      <Footer />
    </>
  );
}
