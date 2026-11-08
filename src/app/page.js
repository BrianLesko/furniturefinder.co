import { Fragment } from "react";
import Compare from "@/components/Compare";
import HeroCtaRow from "@/components/HeroCtaRow";
import DistortionDemo from "@/components/DistortionDemo";
import Faq from "@/components/Faq";
import PieceCard from "@/components/PieceCard";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import OasisCouch from "@/components/OasisCouch";
import ProductSpin from "@/components/ProductSpin";
import RoomPair from "@/components/RoomPair";
import TakeItWithYou from "@/components/TakeItWithYou";
import WhyIBuilt from "@/components/WhyIBuilt";
import { FAQ } from "@/content/faq";
import { SHARE, SITE_DESCRIPTION } from "@/content/seo";
import { getProducts } from "@/lib/products";
import Studio from "./studio/Studio";

// Bed against the back wall, a nightstand beside it, a rug in front.
const heroPieces = [
  { id: 17, x: 0.47, y: 0.38, yaw: 90 },
  { id: 14, x: 0.47, y: 0.3 },
  { id: 13, x: 0.645, y: 0.31 },
];

// textwork.co's hero timing: each title word starts as the previous one is
// settling, then the subtitle, the button, and the stage. WORD_MS and FADE_MS
// match .hero-word-up and .hero-fade in globals.css.
const titleWords = ["Furnish", "the", "photo"];
const TITLE_START_MS = 40;
const TITLE_STAGGER_MS = 150;
const WORD_MS = 250;
const FADE_MS = 800;
const subtitleDelay = TITLE_START_MS + (titleWords.length - 1) * TITLE_STAGGER_MS + WORD_MS;
const ctaDelay = subtitleDelay + FADE_MS / 2;
// The button's ease-out looks settled early, so the stage starts a quarter of
// the way into its fade.
const stageDelay = ctaDelay + FADE_MS / 4;

// Same orbit as DataFast's agent section: a cluster above the card on a phone,
// and just outside the card on a wider screen.
const agents = [
  { src: "/agents/codex.svg", label: "Codex", delay: "0ms", className: "top-10 left-[calc(9%-1.75rem)] -rotate-12 sm:top-5 sm:-left-[5.75rem]" },
  { src: "/agents/grok.svg", label: "Grok", delay: "90ms", className: "top-2 left-[calc(29%-5.75rem)] rotate-[7deg] sm:-top-12 sm:left-[calc(10%-5.75rem)]" },
  { src: "/agents/copilot.svg", label: "Copilot", delay: "180ms", className: "top-2 right-[calc(29%-5.75rem)] -rotate-6 sm:-top-12 sm:right-[calc(10%-5.75rem)]" },
  { src: "/agents/gemini.svg", label: "Gemini", delay: "270ms", className: "top-10 right-[calc(9%-1.75rem)] rotate-12 sm:top-5 sm:-right-[5.75rem]" },
  { src: "/agents/claude.svg", label: "Claude", delay: "360ms", className: "top-18 left-[calc(25%-1.75rem)] -rotate-[8deg] sm:top-30 sm:-left-[6.75rem]" },
  { src: "/agents/openai.svg", label: "ChatGPT", delay: "450ms", className: "top-18 right-[calc(25%-1.75rem)] rotate-[8deg] sm:top-30 sm:-right-[6.75rem]" },
];

const press = "items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";
const sectionTitle = "m-0 text-center font-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:1.5px_#1a1a1a] [paint-order:stroke_fill]";

const TITLE = "Virtual Staging with Real Furniture, at True Scale | Furniture Finder";

export const metadata = {
  title: { absolute: TITLE },
  openGraph: { ...SHARE, title: TITLE, description: SITE_DESCRIPTION, url: "/" },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Furniture Finder",
    url: "https://furniturefinder.co",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    description: "Virtual staging with real furniture you can buy. Straighten a listing photo, set real pieces on the floor at true size, and let your AI render the room.",
    image: "https://furniturefinder.co/og.jpg",
    offers: { "@type": "Offer", price: "12.00", priceCurrency: "USD", category: "subscription", url: "https://furniturefinder.co/pricing" },
    publisher: { "@id": "https://furniturefinder.co/#organization" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://furniturefinder.co/#organization",
    name: "Furniture Finder",
    url: "https://furniturefinder.co",
    logo: "https://furniturefinder.co/icon.svg",
    image: "https://furniturefinder.co/og.jpg",
    sameAs: ["https://brianlesko.com", "https://leskohomes.com"],
    founder: { "@type": "Person", name: "Brian Lesko", url: "https://brianlesko.com" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  },
];

export default function HomePage() {
  const products = getProducts();
  const piece = products.find((product) => product.slug === "kivik-sofa");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Header sticky>
        <a className={`${press} inline-flex border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`} href="/studio">Start now</a>
      </Header>

      <main>
        <section className="mx-auto w-full max-w-[1120px] px-5 pt-24 text-center max-md:pt-16">
          <h1 className="m-0 font-display text-[clamp(3rem,8vw,5.6rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:4px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
            {titleWords.map((word, i) => (
              <Fragment key={word}>
                {i > 0 ? " " : null}
                <span className="hero-word">
                  <span className="hero-word-up" style={{ animationDelay: `${TITLE_START_MS + i * TITLE_STAGGER_MS}ms` }}>
                    {word}
                  </span>
                </span>
              </Fragment>
            ))}
          </h1>
          <p className="hero-fade mx-auto mt-8 mb-0 max-w-[38rem] text-[1.0625rem] leading-[1.7]" style={{ animationDelay: `${subtitleDelay}ms` }}>
            Virtual staging with real furniture. Straighten a listing photo, set pieces you can buy on the floor at true size, and let your AI render the room.
          </p>
          <HeroCtaRow className="hero-fade mt-10" style={{ animationDelay: `${ctaDelay}ms` }}>
            <a className={`${press} inline-flex border-[3px] bg-hot px-[26px] py-3.5 font-display text-[1.35rem] text-white`} href="/studio">Start now</a>
          </HeroCtaRow>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-5 pt-16 pb-24 max-md:pt-10" aria-label="Try the studio">
          <Studio
            products={products}
            initialSrc="/examples/wyandotte-bedroom-3-upright.webp"
            initialStraighten="none"
            initialAdd={heroPieces}
            quiet
            compact
            enterAfter={stageDelay}
          />
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-32" id="how">
          <div className="mb-20 text-center md:mb-28">
            <h2 className="m-0 font-display text-4xl leading-none tracking-wide text-hot uppercase [-webkit-text-stroke:2px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:3px_3px_0_#fff] md:text-6xl">
              Fix your listing photos
            </h2>
          </div>
          <div className="grid gap-24 md:gap-32">
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div>
                <h3 className="mb-4 font-display text-2xl leading-tight tracking-wide text-ink uppercase md:text-3xl">Correct camera distortion</h3>
                <p className="mb-6 text-sm leading-relaxed text-ink/60">
                  Listing photos are wide shots, so the uprights lean in. Drag the four corners of the back wall until they make a rectangle. See{" "}
                  <a className="font-bold text-ink underline decoration-hot underline-offset-4" href="/docs/straighten">how straightening works</a>
                  , and <a className="font-bold text-ink underline decoration-hot underline-offset-4" href="/blog/real-estate-photography-tips">how to shoot the photo</a> so it can be straightened.
                </p>
                <ul className="grid list-none gap-3 p-0">
                  {["Two-point becomes one-point", "The fireplace and the window stay", "Start from Patterson, or load your own"].map((item) => (
                    <li className="flex items-center gap-3 text-sm" key={item}>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" aria-hidden="true"><path strokeLinecap="round" d="M20 6L9 17l-5-5" /></svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <DistortionDemo />
            </div>

            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div className="md:order-2">
                <h3 className="mb-4 font-display text-2xl leading-tight tracking-wide text-ink uppercase md:text-3xl">Pick a real piece</h3>
                <p className="mb-6 text-sm leading-relaxed text-ink/60">The thing in the picture has a width, a height, and a depth. The front photo sits in the frame. The other sides are there when you need them.</p>
                <ul className="grid list-none gap-3 p-0">
                  {["KIVIK sofa, LOHALS rug, oak table, leather stools", "Sizes in inches", "One-quarter, front, and three-quarter"].map((item) => (
                    <li className="flex items-center gap-3 text-sm" key={item}>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" aria-hidden="true"><path strokeLinecap="round" d="M20 6L9 17l-5-5" /></svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <ProductSpin />
            </div>

            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div>
                <h3 className="mb-4 font-display text-2xl leading-tight tracking-wide text-ink uppercase md:text-3xl">Set it on the floor</h3>
                <p className="mb-6 text-sm leading-relaxed text-ink/60">Place the piece on the floor at that size. The mockup keeps the window light. Your model does the final render.</p>
                <ul className="grid list-none gap-3 p-0">
                  {["Same camera as the empty shot", "The floor line stays", "No image credits spent here"].map((item) => (
                    <li className="flex items-center gap-3 text-sm" key={item}>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" aria-hidden="true"><path strokeLinecap="round" d="M20 6L9 17l-5-5" /></svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="overflow-hidden rounded-xl border-[3px] border-ink shadow-[5px_5px_0_0_#1a1a1a]">
                <img className="block aspect-[4/3] w-full object-cover" src="/examples/living-after.webp" alt="The same living room furnished, with the sofa meeting the floor" />
              </div>
            </div>
          </div>
        </section>

        {piece ? <PieceCard piece={piece} /> : null}

        <TakeItWithYou products={products} />

        <section className="overflow-hidden px-5 py-20 md:py-28" id="mcp">
          <div className="relative mx-auto max-w-4xl pt-36 sm:pt-20">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-36" aria-hidden="true">
              {agents.map((agent) => (
                <div key={agent.label} className={`absolute ${agent.className}`}>
                  <div
                    className="agent-float flex size-8 items-center justify-center rounded-xl border border-ink/10 bg-white/75 p-1.5 shadow-sm backdrop-blur-sm sm:size-12 sm:rounded-2xl sm:p-2.5"
                    style={{ animationDelay: agent.delay }}
                    title={agent.label}
                  >
                    <img src={agent.src} alt="" className="size-full object-contain" />
                  </div>
                </div>
              ))}
            </div>
            <div className="relative z-10 rounded-2xl bg-ink px-6 pt-8 pb-8 text-center text-white md:px-12 md:pt-10 md:pb-12">
              <div className="absolute -top-5 left-1/2 z-30 -translate-x-1/2 rotate-1 border-[3px] border-ink bg-white px-5 py-1.5 font-display text-base whitespace-nowrap text-ink uppercase">
                MCP server
              </div>
              <h2 className="pt-[calc(3px+1.25rem)] font-display text-3xl leading-none tracking-wide text-white uppercase md:text-5xl">Furniture Finder for AI agents</h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
                AI agents make better listing photos with Furniture Finder, using pieces you can actually buy. Connect Furniture Finder to Claude, ChatGPT, or Codex with MCP.{" "}
                <a className="font-bold text-yellow underline decoration-yellow underline-offset-4" href="/docs/connect-an-agent">The connection steps</a>.
              </p>
              <div className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="font-display text-3xl text-yellow">6</p>
                  <p className="mt-1 text-sm text-white/80">Agents</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl text-yellow">3</p>
                  <p className="mt-1 text-sm text-white/80">Steps</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-3xl text-yellow">1</p>
                  <p className="mt-1 text-sm text-white/80">Your model</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <RoomPair />

        <section className="mx-auto w-full max-w-[40rem] scroll-mt-24 px-5 py-20 md:py-28" id="why">
          <WhyIBuilt className="max-md:pr-28" />
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 py-20 md:px-8 md:py-28" id="price">
          <div className="mb-12 text-center">
            <h2 className="m-0 font-display text-4xl leading-none tracking-wide text-hot uppercase [-webkit-text-stroke:2px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:3px_3px_0_#fff] md:text-6xl">
              Cheaper than one staged photo
            </h2>
            <p className="mx-auto mt-5 mb-0 max-w-xl text-base leading-relaxed text-ink/80 md:text-lg">
              A staged listing photo is billed again for every room.
              <br />
              Furniture Finder is $12. A month.{" "}
              <a className="font-bold text-ink underline decoration-hot underline-offset-4" href="/pricing">See what $12 includes.</a>
            </p>
          </div>
          <div className="relative mx-auto max-w-md overflow-hidden rounded-xl border-[3px] border-ink bg-white shadow-[5px_5px_0_0_#1a1a1a]">
            <div className="flex items-center justify-between border-b-[3px] border-ink bg-hot px-5 py-3 text-white">
              <span className="font-display text-lg tracking-wide uppercase">Billed monthly</span>
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-ink bg-white" />
            </div>
            <div className="p-8 md:p-12">
              <div className="mb-8 text-center">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="font-display text-[96px] leading-none text-ink">$12</span>
                  <span className="font-display text-2xl text-ink">/ month</span>
                </div>
                <p className="mt-2 mb-0 text-sm text-ink/80">Billed once a month</p>
              </div>
              <div className="mx-auto mb-10 grid max-w-xs gap-3">
                {[
                  "Correct camera distortion",
                  "Real pieces, with sizes",
                  "Same camera as the empty photo",
                  "The render runs on your model",
                  "The listing photo stays yours",
                ].map((item) => (
                  <div className="flex items-center gap-3" key={item}>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <a className={`${press} inline-flex border-[3px] bg-hot px-8 py-3.5 font-display text-xl text-white shadow-[5px_5px_0_0_#1a1a1a] hover:shadow-[7px_7px_0_0_#1a1a1a]`} href="/studio">
                  Start now
                </a>
              </div>
            </div>
          </div>
          <p className="mt-8 mb-0 text-center text-xs font-bold text-ink/60">The rooms on this page are 73 E Patterson.</p>
        </section>

        <section className="mx-auto w-full max-w-2xl px-5 py-20 md:px-8 md:py-28" id="faq">
          <div className="mb-12 text-center md:mb-16">
            <h2 className="m-0 font-display text-4xl leading-none tracking-wide text-hot uppercase [-webkit-text-stroke:2px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:3px_3px_0_#fff] md:text-6xl">
              FAQ
            </h2>
          </div>
          <Faq />
          <p className="mt-10 mb-0 text-center text-sm text-ink/50">
            Have another question?{" "}
            <a className="font-bold text-hot underline decoration-hot underline-offset-4 hover:text-hot/80" href="mailto:hello@brianlesko.com">
              Get support
            </a>
          </p>
        </section>

        <Compare />

        <section className="relative w-full px-5 pt-28 pb-40 text-center select-none md:pt-40 md:pb-56" id="start">
          <OasisCouch />
          <h2 className={`${sectionTitle} relative`}>Design your oasis 🏝️</h2>
          <p className="mx-auto mt-4 mb-0 max-w-xl text-[0.98rem] leading-[1.6]">
            Try Furniture Finder today. Straighten the walls, pick a real piece, and set it on the floor of the photo you already have.
          </p>
          <div className="mt-8">
            <a className={`${press} inline-flex border-[3px] bg-hot px-[26px] py-3.5 font-display text-[1.35rem] text-white`} href="/studio">
              Start now
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
