import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { SHARE } from "@/content/seo";
import {
  PRICING_URL,
  comparisons,
  freeItems,
  notIncluded,
  paidItems,
  pricingDescription,
  pricingFaq,
  pricingTitle,
} from "@/content/pricing";

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

export const metadata = {
  title: "Virtual staging cost: $12 a month · Furniture Finder",
  description: pricingDescription,
  alternates: {
    canonical: PRICING_URL,
    types: { "text/markdown": `${PRICING_URL}.md` },
  },
  openGraph: {
    ...SHARE,
    title: pricingTitle,
    description: pricingDescription,
    url: PRICING_URL,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${PRICING_URL}#webpage`,
      url: PRICING_URL,
      name: pricingTitle,
      description: pricingDescription,
      isPartOf: { "@type": "WebSite", name: "Furniture Finder", url: "https://furniturefinder.co" },
    },
    {
      "@type": "Offer",
      name: "Furniture Finder monthly",
      price: "12.00",
      priceCurrency: "USD",
      url: PRICING_URL,
      category: "subscription",
      description: "One month of Furniture Finder. Saving rooms and connecting your AI, for every room you do.",
    },
    {
      "@type": "FAQPage",
      mainEntity: pricingFaq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Furniture Finder", item: "https://furniturefinder.co" },
        { "@type": "ListItem", position: 2, name: "Pricing", item: PRICING_URL },
      ],
    },
  ],
};

function CheckList({ items }) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0">
      {items.map(([name, detail]) => (
        <li className="flex items-start gap-3" key={name}>
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className="text-sm leading-relaxed">
            <b>{name}.</b> {detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Header sticky>
        <a className={`${press} border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`} href="/studio">Start now</a>
      </Header>
      <main>
        <section className="mx-auto w-full max-w-3xl px-5 pt-12 pb-16 text-center md:pt-16">
          <p className="m-0 text-xs font-bold tracking-wide text-ink/50 uppercase">Pricing</p>
          <h1 className="m-0 mt-4 font-display text-[clamp(2.8rem,7vw,4.8rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
            Virtual staging cost
          </h1>
          <p className="mx-auto mt-6 mb-0 max-w-[36rem] text-[1.0625rem] leading-[1.7]">
            Trying a room is free. Furniture Finder is $12 a month after that, for every room you furnish. The render still runs on your model.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md px-5" aria-labelledby="price-card">
          <div className="overflow-hidden rounded-xl border-[3px] border-ink bg-white shadow-[5px_5px_0_0_#1a1a1a]">
            <div className="flex items-center justify-between border-b-[3px] border-ink bg-hot px-5 py-3 text-white">
              <h2 id="price-card" className="m-0 font-display text-lg tracking-wide uppercase">Billed monthly</h2>
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-ink bg-white" />
            </div>
            <div className="p-8">
              <div className="flex items-baseline justify-center gap-2">
                <span className="font-display text-[96px] leading-none text-ink">$12</span>
                <span className="font-display text-2xl text-ink">/ month</span>
              </div>
              <p className="mt-2 mb-8 text-center text-sm text-ink/80">One price for every room that month.</p>
              <div className="flex flex-col gap-3">
                <a className={`${press} border-[3px] bg-hot px-8 py-3.5 font-display text-xl text-white`} href="/subscribe">Subscribe</a>
                <a className={`${press} border-[3px] bg-white px-8 py-3.5 font-display text-xl`} href="/studio">Try the studio free</a>
              </div>
              <p className="mt-4 mb-0 text-center text-xs text-ink/60">Stripe checkout. A promo code works there. Cancel from the dashboard.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="rounded-xl border-[3px] border-ink bg-white p-6 shadow-[5px_5px_0_0_#1a1a1a] md:p-8">
            <h2 className="m-0 font-display text-3xl leading-none tracking-wide uppercase">Free to try</h2>
            <div className="mt-6">
              <CheckList items={freeItems} />
            </div>
          </div>
          <div className="rounded-xl border-[3px] border-ink bg-white p-6 shadow-[5px_5px_0_0_#1a1a1a] md:p-8">
            <h2 className="m-0 font-display text-3xl leading-none tracking-wide uppercase">$12 a month</h2>
            <div className="mt-6">
              <CheckList items={paidItems} />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 pb-16">
          <h2 className="m-0 font-display text-3xl leading-none tracking-wide uppercase md:text-4xl">What the $12 does not include</h2>
          <div className="mt-6">
            <CheckList items={notIncluded} />
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 pb-16">
          <h2 className="m-0 font-display text-3xl leading-none tracking-wide uppercase md:text-4xl">Compared with paying another way</h2>
          <ul className="m-0 mt-6 grid list-none gap-3 p-0">
            {comparisons.map(([name, href, detail]) => (
              <li key={href}>
                <a className="block rounded-xl border-[3px] border-ink bg-white px-5 py-4 no-underline shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_#1a1a1a]" href={href}>
                  <span className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4">{name}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink/75">{detail}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-2xl px-5 pt-4 pb-24" id="faq">
          <h2 className="m-0 mb-8 text-center font-display text-4xl leading-none tracking-wide text-hot uppercase [-webkit-text-stroke:2px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:3px_3px_0_#fff]">
            FAQ
          </h2>
          <Faq items={pricingFaq} />
        </section>
      </main>
      <Footer />
    </>
  );
}
