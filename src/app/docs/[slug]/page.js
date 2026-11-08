import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import { docBySlug, docs, docUrl } from "@/content/docs";
import { SHARE } from "@/content/seo";
import DocsHeader from "../DocsHeader";

export const dynamicParams = false;

export function generateStaticParams() {
  return docs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const doc = docBySlug((await params).slug);
  if (!doc) return {};
  const url = docUrl(doc);
  return {
    title: `${doc.title} · Furniture Finder`,
    description: doc.description,
    alternates: {
      canonical: url,
      types: { "text/markdown": `${url}.md` },
    },
    openGraph: { ...SHARE, title: doc.title, description: doc.description, url },
  };
}

function Link({ href, children }) {
  const external = href.startsWith("http");
  return (
    <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot" href={href} {...(external ? { rel: "noopener" } : {})}>
      {children}
    </a>
  );
}

function Rich({ text }) {
  const parts = text.split(/\[([^\]]+)\]\(([^)]+)\)/g);
  return parts.map((part, i) => {
    if (i % 3 === 0) return part;
    if (i % 3 === 2) return null;
    return (
      <Link href={parts[i + 1]} key={i}>
        {part}
      </Link>
    );
  });
}

export default async function DocPage({ params }) {
  const doc = docBySlug((await params).slug);
  if (!doc) notFound();
  const others = docs.filter((item) => item.slug !== doc.slug);

  return (
    <>
      <DocsHeader />
      <main>
        <article className="mx-auto w-full max-w-3xl px-5 pb-12">
          <p className="mt-0 mb-0 pt-10 text-xs font-bold tracking-wide text-ink/50 uppercase md:pt-14">
            <a className="no-underline hover:text-hot" href="/docs">Docs</a>
          </p>
          <h1 className="mt-4 mb-0 font-display text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.02] font-normal tracking-[0.02em]">{doc.title}</h1>
          <p className="mt-5 mb-10 text-[1.0625rem] leading-[1.7] text-ink/80 md:mb-12">{doc.summary}</p>

          <div className="flex flex-col gap-6">
            {doc.sections.map((section) => (
              <section className="flex flex-col gap-6" key={section.h ?? section.paragraphs[0]}>
                {section.h ? (
                  <h2 className="m-0 pt-4 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">{section.h}</h2>
                ) : null}
                {section.paragraphs?.map((text) => (
                  <p className="m-0 text-[15px] leading-[1.85] text-ink/80 md:text-base" key={text}>
                    <Rich text={text} />
                  </p>
                ))}
                {section.list ? (
                  <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-[1.8] text-ink/80 marker:text-hot md:text-base">
                    {section.list.map(([lead, rest]) => (
                      <li key={lead}>
                        <b className="text-ink">{lead}</b> {rest}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.codes?.map((code) => (
                  <figure className="my-1" key={code.label}>
                    <figcaption className="mb-1.5 font-mono text-[12px] font-bold">{code.label}</figcaption>
                    <pre className="m-0 overflow-x-auto rounded-xl border-2 border-ink bg-ink p-3 font-mono text-[12px] leading-relaxed text-cream">{code.text}</pre>
                  </figure>
                ))}
              </section>
            ))}
          </div>

          <nav className="mt-14 border-t-2 border-ink/10 pt-8" aria-label="Other docs">
            <p className="m-0 text-xs font-bold tracking-wide text-ink/50 uppercase">Also in the docs</p>
            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
              {others.map((item) => (
                <li key={item.slug}>
                  <a className="font-bold text-ink no-underline decoration-hot decoration-2 underline-offset-4 hover:underline" href={`/docs/${item.slug}`}>
                    {item.title}
                  </a>
                  <p className="mt-1 mb-0 text-sm leading-relaxed text-ink/70">{item.summary}</p>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>
      <Footer />
    </>
  );
}
