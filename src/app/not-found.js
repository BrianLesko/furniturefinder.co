import Footer from "@/components/Footer";

export const metadata = {
  title: "Page not found · Furniture Finder",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col">
        <section className="flex flex-1 items-center justify-center px-6 pt-24 pb-16 text-center md:pt-32 md:pb-20">
          <div className="mx-auto max-w-2xl">
            <h1 className="m-0 mb-6 font-display text-[106px] leading-none tracking-[0.03em] text-hot [-webkit-text-stroke:4px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:5px_5px_0_#fff] md:mb-8 md:text-[154px]">
              404
            </h1>
            <p className="mx-auto mt-0 mb-8 max-w-xl text-lg leading-relaxed text-ink/70 md:mb-10 md:text-xl">
              This room is empty. Not even a sofa. We hope you find what you came for back on the homepage.
            </p>
            <a
              className="inline-flex items-center justify-center rounded-full border-[3px] border-ink bg-hot px-[26px] py-3 font-display text-xl text-white no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              href="/"
            >
              Go to homepage
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
