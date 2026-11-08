import { timingSafeEqual } from "node:crypto";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { CATEGORIES, ROOMS } from "@/lib/pieces";
import { VIEWS } from "@/lib/views";
import AddPiece from "./AddPiece";

export const metadata = {
  title: "Add a piece · Furniture Finder",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function matches(token) {
  const expected = process.env.TEAM_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function AddPage({ params }) {
  const { token } = await params;
  if (!matches(token)) notFound();
  const views = Object.fromEntries(Object.entries(VIEWS).map(([key, view]) => [key, view.label]));

  return (
    <>
      <Header width="max-w-[1240px]">
        <nav className="flex items-center gap-2.5 text-sm font-bold">
          <a className="underline decoration-ink underline-offset-4" href="/pick">
            Pick
          </a>
          <a className="underline decoration-ink underline-offset-4" href="/studio">
            Studio
          </a>
        </nav>
      </Header>
      <main className="mx-auto w-full max-w-[1240px] px-5 pt-8 pb-20">
        <h1 className="m-0 font-display text-[clamp(2.4rem,6vw,4rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          Add a piece
        </h1>
        <p className="mt-5 mb-0 max-w-[44rem] text-[1.0625rem] leading-[1.7]">
          Paste a product link, check the details, pick the clean photos, and fill in the views it still needs. Publishing puts it straight on
          Pick and in the Studio. Keep this link inside the team.
        </p>
        <div className="mt-8">
          <AddPiece token={token} categories={CATEGORIES} rooms={ROOMS} viewLabels={views} />
        </div>
      </main>
      <Footer />
    </>
  );
}
