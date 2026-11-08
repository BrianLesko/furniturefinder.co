import Footer from "@/components/Footer";
import { SHARE } from "@/content/seo";
import BlogHeader from "./BlogHeader";
import { posts, formatPostDate } from "./posts";

const PAGE_URL = "https://furniturefinder.co/blog";
const title = "Blog";
const description =
  "Notes from Furniture Finder on listing photos: how to shoot a room, how to straighten it, and how to furnish an empty one at the scale it really is.";

export const metadata = {
  title: `${title} · Furniture Finder`,
  description,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: "website",
    title,
    description,
    url: PAGE_URL,
    images: SHARE.images,
    siteName: "Furniture Finder",
    locale: "en_US",
  },
};

const blogJsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Furniture Finder Blog",
  url: PAGE_URL,
  description,
  publisher: { "@type": "Organization", name: "Furniture Finder", url: "https://furniturefinder.co" },
  blogPost: posts.map((post) => ({
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `${PAGE_URL}/${post.slug}`,
    datePublished: post.published,
    author: { "@type": "Person", name: post.author },
  })),
};

export default function BlogPage() {
  const featured = posts[0];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />
      <BlogHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pt-16 pb-24">
        <div className="pb-12 text-center">
          <h1 className="m-0 font-display text-[clamp(3rem,8vw,5.6rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:4px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
            Blog
          </h1>
          <p className="mx-auto mt-6 mb-0 max-w-[34rem] text-[1.0625rem] leading-[1.7]">
            How to shoot a room, straighten it, and furnish it at the size it really is.
          </p>
        </div>

        <a
          href={`/blog/${featured.slug}`}
          className="group mb-14 flex min-h-48 flex-col rounded-[22px] border-[3px] border-ink bg-white px-6 py-8 no-underline shadow-[6px_6px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[8px_8px_0_0_#1a1a1a] md:px-8"
        >
          <p className="m-0 text-xs font-bold tracking-wide text-ink/50 uppercase">{featured.kicker}</p>
          <p className="mt-2 mb-6 text-[1.05rem] leading-relaxed">{featured.lede}</p>
          <span className="mt-auto inline-flex w-fit rounded-full border-[3px] border-ink bg-hot px-5 py-2 font-display text-lg text-white shadow-[3px_3px_0_0_#1a1a1a]">
            Read full article
          </span>
        </a>

        <ul className="m-0 flex list-none flex-col divide-y-2 divide-ink/10 p-0">
          {posts.map((post) => (
            <li className="py-8 first:pt-0" key={post.slug}>
              <article>
                <p className="m-0 text-xs font-bold tracking-wide text-ink/50 uppercase">{post.kicker}</p>
                <h2 className="mt-2 mb-0 font-display text-[1.6rem] leading-tight font-normal tracking-[0.02em] md:text-[1.9rem]">
                  <a className="no-underline decoration-hot decoration-2 underline-offset-4 hover:underline" href={`/blog/${post.slug}`}>
                    {post.title}
                  </a>
                </h2>
                <p className="mt-3 mb-0 text-sm leading-relaxed text-ink/75">{post.description}</p>
                <p className="mt-3 mb-0 text-xs text-ink/50">
                  By {post.author} · <time dateTime={post.published}>{formatPostDate(post.published)}</time>
                </p>
              </article>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
