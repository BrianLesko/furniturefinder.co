import Footer from "@/components/Footer";
import Header from "@/components/Header";
import WhyIBuilt from "@/components/WhyIBuilt";
import { ABOUT_URL, aboutDescription, aboutTitle } from "@/content/about";
import { SHARE } from "@/content/seo";

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

export const metadata = {
  title: `${aboutTitle} · Furniture Finder`,
  description: aboutDescription,
  alternates: { canonical: ABOUT_URL, types: { "text/markdown": `${ABOUT_URL}.md` } },
  openGraph: { ...SHARE, title: aboutTitle, description: aboutDescription, url: ABOUT_URL },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${ABOUT_URL}#webpage`,
      url: ABOUT_URL,
      name: aboutTitle,
      description: aboutDescription,
      mainEntity: { "@id": "https://furniturefinder.co/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://furniturefinder.co/#organization",
      name: "Furniture Finder",
      url: "https://furniturefinder.co",
      logo: "https://furniturefinder.co/icon.svg",
      sameAs: ["https://brianlesko.com", "https://leskohomes.com"],
      founder: { "@type": "Person", name: "Brian Lesko", url: "https://brianlesko.com" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Furniture Finder", item: "https://furniturefinder.co" },
        { "@type": "ListItem", position: 2, name: "About", item: ABOUT_URL },
      ],
    },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Header>
        <nav className="flex items-center gap-2.5">
          <a className={`${press} hidden border-2 bg-white px-4 py-2 text-sm sm:inline-flex`} href="/rooms">Rooms</a>
          <a className={`${press} border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`} href="/studio">Start now</a>
        </nav>
      </Header>
      <main className="mx-auto w-full max-w-[40rem] px-5 pt-14 pb-40 md:pt-20 md:pb-56">
        <WhyIBuilt as="h1" />
      </main>
      <Footer />
    </>
  );
}
