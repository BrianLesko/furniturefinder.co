import Footer from "@/components/Footer";
import { docs } from "@/content/docs";
import { SHARE } from "@/content/seo";
import DocsHeader from "./DocsHeader";

const PAGE_URL = "https://furniturefinder.co/docs";
const title = "Docs";
const description = "How to use the Furniture Finder studio, straighten a listing photo, and connect your AI.";

export const metadata = {
  title: `${title} · Furniture Finder`,
  description,
  alternates: { canonical: PAGE_URL },
  openGraph: { ...SHARE, title, description, url: PAGE_URL },
};

export default function DocsPage() {
  return (
    <>
      <DocsHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pt-16 pb-24">
        <h1 className="m-0 font-display text-[clamp(2.6rem,7vw,4.4rem)] leading-[0.95] font-normal tracking-[0.02em]">Docs</h1>
        <p className="mt-5 mb-0 max-w-[36rem] text-[1.0625rem] leading-[1.7]">
          Three pages for the studio. Shoot and straighten the photo, place a real piece, then hand the saved room to your AI.
        </p>
        <ul className="m-0 mt-12 flex list-none flex-col gap-4 p-0">
          {docs.map((doc) => (
            <li key={doc.slug}>
              <a
                className="group block rounded-[22px] border-[3px] border-ink bg-white px-6 py-6 no-underline shadow-[6px_6px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[8px_8px_0_0_#1a1a1a] md:px-8"
                href={`/docs/${doc.slug}`}
              >
                <h2 className="m-0 font-display text-[1.7rem] leading-tight font-normal tracking-[0.02em] group-hover:text-hot md:text-[2rem]">
                  {doc.title}
                </h2>
                <p className="mt-2 mb-0 text-sm leading-relaxed text-ink/75">{doc.summary}</p>
              </a>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
