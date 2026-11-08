import { notFound } from "next/navigation";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import { comparisonBySlug, comparisons } from "@/content/blog/comparisons";
import BlogHeader from "../BlogHeader";
import { formatPostDate } from "../posts";

// The comparison posts. Their words live in src/content/blog/comparisons.js,
// which also builds the .md mirror for agents.
const SITE_URL = "https://furniturefinder.co";
const AUTHOR_NAME = "Brian Lesko";
const AUTHOR_TITLE = "Creator of Furniture Finder";
const AUTHOR_URL = "https://brianlesko.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return comparisons.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const post = comparisonBySlug((await params).slug);
  if (!post) return {};
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.metaTitle} · Furniture Finder`,
    description: post.description,
    keywords: post.keywords,
    alternates: {
      canonical: url,
      types: { "text/markdown": `${url}.md` },
    },
    authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      siteName: "Furniture Finder",
      publishedTime: `${post.published}T12:00:00Z`,
      modifiedTime: `${post.published}T12:00:00Z`,
      authors: [AUTHOR_URL],
      section: post.kicker,
      tags: post.keywords,
      images: [{ url: `${SITE_URL}${post.image.src}`, width: post.image.width, height: post.image.height, alt: post.image.alt }],
      locale: "en_US",
    },
  };
}

function buildJsonLd(post) {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const organization = { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Furniture Finder", url: SITE_URL };
  const author = { "@type": "Person", name: AUTHOR_NAME, jobTitle: AUTHOR_TITLE, url: AUTHOR_URL, worksFor: { "@id": organization["@id"] } };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        isPartOf: { "@type": "Blog", name: "Furniture Finder Blog", url: `${SITE_URL}/blog` },
        image: `${SITE_URL}${post.image.src}`,
        datePublished: post.published,
        dateModified: post.published,
        inLanguage: "en-US",
        author,
        publisher: organization,
        keywords: post.keywords,
        citation: post.sources.map((source) => ({ "@type": "CreativeWork", name: source.label, url: source.url })),
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: post.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Furniture Finder", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };
}

function Link({ href, children }) {
  return (
    <a className="font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot" href={href}>
      {children}
    </a>
  );
}

// Text with [label](href) links in it.
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

function P({ text }) {
  return (
    <p className="m-0 text-[15px] leading-[1.85] text-ink/80 md:text-base">
      <Rich text={text} />
    </p>
  );
}

function H2({ children }) {
  return <h2 className="m-0 pt-8 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">{children}</h2>;
}

function BeforeAfter({ before, after, caption }) {
  return (
    <figure className="my-2">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Empty", before],
          ["Furnished", after],
        ].map(([label, image]) => (
          <div className="relative overflow-hidden rounded-xl border-[3px] border-ink shadow-[5px_5px_0_0_#1a1a1a]" key={label}>
            <img className="block aspect-[4/3] w-full object-cover" src={image.src} alt={image.alt} loading="lazy" />
            <span className="absolute top-2 left-2 rounded-full border-2 border-ink bg-yellow px-2.5 py-0.5 text-[11px] font-bold uppercase">{label}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-4 text-xs leading-relaxed text-ink/55">{caption}</figcaption>
    </figure>
  );
}

function List({ items }) {
  return (
    <ul className="m-0 flex list-disc flex-col gap-2.5 pl-5 text-[15px] leading-[1.8] text-ink/80 marker:text-hot md:text-base">
      {items.map(([lead, rest]) => (
        <li key={lead}>
          <b className="text-ink">{lead}</b> <Rich text={rest} />
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
              {head.map((h, i) => (
                <th className="px-4 py-2.5 font-bold" key={i} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...cells], i) => (
              <tr className={i === rows.length - 1 ? "" : "border-b-2 border-ink/10"} key={label}>
                <th className="px-4 py-3 align-top font-bold whitespace-nowrap" scope="row">{label}</th>
                {cells.map((cell, j) => (
                  <td className={`px-4 py-3 align-top leading-relaxed ${j === 0 ? "font-bold text-ink" : "text-ink/80"}`} key={j}>{cell}</td>
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

export default async function ComparisonPage({ params }) {
  const post = comparisonBySlug((await params).slug);
  if (!post) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(post)) }} />
      <BlogHeader />
      <main>
        <article className="mx-auto w-full max-w-3xl px-5 pb-12">
          <p className="mt-0 mb-0 pt-10 text-xs font-bold tracking-wide text-ink/50 uppercase md:pt-14">
            <a className="no-underline hover:text-hot" href="/blog">Blog</a>
            {" · "}
            {post.kicker}
          </p>
          <h1 className="mt-4 mb-0 font-display text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.02] font-normal tracking-[0.02em] text-ink">{post.title}</h1>
          <p className="mt-5 mb-10 text-xs text-ink/55 md:mb-12">
            By{" "}
            <a className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink" href={AUTHOR_URL} rel="author">
              {AUTHOR_NAME}
            </a>
            , creator of Furniture Finder · Published <time dateTime={post.published}>{formatPostDate(post.published)}</time>
          </p>

          <div className="flex flex-col gap-6">
            {post.intro.map((text) => (
              <P key={text} text={text} />
            ))}
            <Table {...post.table} />
            {post.sections.map((section) => (
              <section className="flex flex-col gap-6" key={section.h}>
                <H2>{section.h}</H2>
                {section.list && <List items={section.list} />}
                {section.paragraphs?.map((text) => (
                  <P key={text} text={text} />
                ))}
                {section.figure && <BeforeAfter {...section.figure} />}
              </section>
            ))}
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                className="rounded-full border-[3px] border-ink bg-hot px-6 py-3 text-sm font-bold text-white no-underline shadow-[4px_4px_0_0_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#1a1a1a]"
                href="/studio"
              >
                Try the studio free
              </a>
              <a
                className="rounded-full border-[3px] border-ink bg-white px-6 py-3 text-sm font-bold text-ink no-underline shadow-[4px_4px_0_0_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#1a1a1a]"
                href="/pricing"
              >
                What $12 includes
              </a>
            </div>
            <div className="mt-6 border-t-2 border-ink/10 pt-6">
              <p className="m-0 mb-2 text-xs font-bold tracking-wide text-ink/50 uppercase">Sources</p>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs leading-relaxed text-ink/60">
                {post.sources.map((source) => (
                  <li key={source.url}>
                    <a className="underline decoration-ink/30 underline-offset-4 hover:text-hot" href={source.url} rel="noopener">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <section className="mx-auto w-full max-w-3xl px-5 pt-8 pb-24" id="faq">
          <h2 className="mt-0 mb-8 font-display text-[1.75rem] leading-tight font-normal tracking-[0.02em] md:text-[2.1rem]">Questions</h2>
          <Faq items={post.faq} />
        </section>
      </main>
      <Footer />
    </>
  );
}
