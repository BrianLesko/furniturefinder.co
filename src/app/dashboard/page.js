import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { listApiKeys } from "@/lib/auth";
import { isPaid } from "@/lib/billing";
import { PRESETS } from "@/lib/presets";
import { getProducts } from "@/lib/products";
import { listScenes, readOwnScene } from "@/lib/scenes";
import { currentUser } from "@/lib/session";
import Studio from "../studio/Studio";
import ConnectAi from "./ConnectAi";
import Paywall from "./Paywall";
import SavedRooms from "./SavedRooms";

export const metadata = {
  title: "Dashboard · Furniture Finder",
  description:
    "Your saved rooms, the studio, and your AI's connection to Furniture Finder.",
};

export const dynamic = "force-dynamic";

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";
const heading =
  "m-0 font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-none tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:1.5px_#1a1a1a] [paint-order:stroke_fill]";

// The 73 E Patterson thread, drawn with the same border and shadow as the
// dashboard cards. No blue field.
function LeasingThread() {
  const bubble = "m-0 max-w-[85%] rounded-2xl border-[3px] border-ink px-3.5 py-2.5 text-[13px] leading-snug shadow-[3px_3px_0_0_#1a1a1a]";
  return (
    <div aria-hidden className="mt-5 flex flex-col gap-3">
      <p className={`${bubble} self-start bg-cream`}>
        Hi! 73 E Patterson is
        <br />
        $2,700/mo and opens Aug 12.
        <br />
        Does August work for you?
      </p>
      <p className={`${bubble} self-end bg-yellow`}>Yes! 3 of us, no pets.</p>
      <p className={`${bubble} self-start bg-cream`}>
        Perfect, that fits the house.
        <br />
        Want a tour this week?
      </p>
    </div>
  );
}

const roomTitle = (scene) => {
  const preset = PRESETS.find((preset) => preset.src === scene.source);
  if (preset) return preset.label;
  const name = scene.items.map((item) => item.name).find(Boolean);
  if (name) return name.split(",")[0];
  return scene.source === "upload" ? "Your photo" : "Saved room";
};

const summary = (scene) => ({
  id: scene.id,
  title: roomTitle(scene),
  pieces: scene.items.length,
  names: scene.items.map((item) => item.name),
  width: scene.room.width,
  height: scene.room.height,
  savedAt: scene.updatedAt ?? scene.createdAt,
  editable: Boolean(scene.edit),
});

export default async function DashboardPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/login?back=%2Fdashboard");
  const params = await searchParams;
  const [scenes, open] = await Promise.all([
    listScenes({ ownerId: user.id }),
    params?.scene
      ? readOwnScene(String(params.scene), user.id).catch(() => null)
      : null,
  ]);
  const source =
    open &&
    (open.sourceFile
      ? `/api/scenes/${open.id}/source`
      : open.source !== "upload"
        ? open.source
        : null);
  const paid = isPaid(user);
  const editing = paid && open?.edit && source ? open : null;

  return (
    <>
      <Header width="max-w-[1240px]" />

      <main className="mx-auto w-full max-w-[1240px] px-5 pt-10 pb-20">
        <h1 className="m-0 font-display text-[clamp(2.6rem,7vw,4.4rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          Dashboard
        </h1>

        {!paid ? (
          <Paywall failed={params?.checkout === "failed"} />
        ) : (
          <section className="mt-10 w-full" id="studio" aria-labelledby="studio-title">
            <h2 id="studio-title" className={heading}>
              Studio
            </h2>
            <div className="mt-6">
              <Studio
                key={editing?.id ?? "new"}
                products={getProducts()}
                initialAdd={[]}
                wide
                rooms={scenes.map(summary)}
                {...(editing
                  ? {
                      initialSrc: source,
                      initialStraighten: editing.straighten,
                      initialScene: editing,
                    }
                  : {})}
              />
            </div>
          </section>
        )}

        {!paid && scenes.length ? (
          <section className="mt-16" id="rooms" aria-labelledby="rooms-title">
            <h2 id="rooms-title" className={heading}>
              Saved rooms
            </h2>
            <SavedRooms
              initial={scenes.map(summary)}
              openId={editing?.id ?? null}
            />
          </section>
        ) : null}

        {paid ? (
          <section
            className="mt-16"
            id="connect"
            aria-labelledby="connect-title"
          >
            <h2 id="connect-title" className={heading}>
              Connect your AI
            </h2>
            <ConnectAi initialKeys={listApiKeys(user.id)} />
            {scenes.length ? (
              <a
                className="mt-12 ml-auto flex w-full flex-col rounded-[22px] border-[3px] border-ink bg-white px-5 pt-6 pb-5 text-ink no-underline shadow-[5px_5px_0_0_#1a1a1a] md:w-1/2"
                href="https://textwork.co/leasing"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="flex items-center gap-3.5">
                  <span
                    aria-hidden
                    className="block h-16 w-16 shrink-0"
                    style={{
                      backgroundImage: "linear-gradient(245deg, #65656f, #1a1a24)",
                      WebkitMask: "url(/textwork-logo.svg) center / contain no-repeat",
                      mask: "url(/textwork-logo.svg) center / contain no-repeat",
                    }}
                  />
                  <span>
                    <span className="block text-xs font-bold tracking-wide text-ink/50 uppercase">TextWork</span>
                    <span className="mt-1 block text-[15px] leading-relaxed">
                      Managing properties and want automated screening and tour booking? TextWork has you covered after hours and weekends.
                    </span>
                  </span>
                </span>
                <LeasingThread />
                <span className={`${press} mt-5 self-end border-[3px] bg-hot px-5 py-2 font-display text-lg text-white`}>See leasing</span>
              </a>
            ) : null}
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
