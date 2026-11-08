import "@/app/pick/gallery.css";

const FRACTIONS = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];

// Same order as the listing gallery: front showing, one-quarter on the left, three-quarter on the right.
const GALLERY_ANGLES = ["front", "one-quarter", "three-quarter"];

function inches(value) {
  const eighths = Math.round((value - Math.floor(value)) * 8);
  const whole = Math.floor(value) + (eighths === 8 ? 1 : 0);
  const mark = FRACTIONS[eighths === 8 ? 0 : eighths];
  return `${whole || ""}${mark}` || "0";
}

function money(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function quoted(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function shot(piece, angle) {
  return piece.photos
    .filter((photo) => photo.angle === angle)
    .sort((a, b) => a.altitudeDeg - b.altitudeDeg)[0];
}

const SIZES = [
  ["wide", "widthIn"],
  ["high", "heightIn"],
  ["deep", "depthIn"],
];

export default function PieceCard({ piece }) {
  const [title, fabric] = piece.name.split(/, (.+)/);
  const views = GALLERY_ANGLES.map((angle) => shot(piece, angle)).filter(Boolean);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-5 py-20 md:gap-12 md:px-8 md:py-28" id="piece">
      <div className="text-center">
        <h2 className="m-0 font-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:1.5px_#1a1a1a] [paint-order:stroke_fill]">
          Pieces you can buy
        </h2>
        <p className="mx-auto mt-4 mb-0 max-w-xl text-[0.98rem] leading-[1.6]">
          Each one is a real listing, with a price, a size in inches, and a photo from every side.
        </p>
      </div>

      <a
        className="relative block w-full max-w-4xl overflow-hidden rounded-2xl border-[3px] border-ink bg-white px-6 pt-8 pb-0 no-underline shadow-[8px_8px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[11px_11px_0_0_#1a1a1a] md:rounded-[20px] md:px-12 md:pt-16 lg:rounded-3xl lg:px-28 lg:pt-28"
        href="/pick"
      >
        <div className="absolute inset-x-6 top-4 z-10 md:inset-x-12 md:top-6 lg:inset-x-28 lg:top-10">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
            <h3 className="m-0 font-display text-3xl leading-none font-normal tracking-[0.02em] md:text-4xl">{title}</h3>
            <p className="m-0 font-display text-3xl leading-none text-hot md:text-4xl">{money(piece.priceCents)}</p>
          </div>
          <p className="mt-1.5 mb-0 text-xs text-ink/60 md:text-sm">
            {fabric ? `${fabric} · ` : ""}
            {piece.sellerName}
            {" · "}quoted {quoted(piece.quotedOn)}
          </p>
          <dl className="mt-3 mb-0 flex flex-wrap gap-2">
            {SIZES.map(([label, key]) => (
              <div className="rounded-full border-2 border-ink bg-white px-3 py-1" key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="m-0 text-xs font-bold md:text-sm">
                  {inches(piece[key])} in {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative aspect-[1962/2529] overflow-hidden rounded-t-lg sm:aspect-[3102/2508] lg:aspect-[3966/2536]">
          <figure className="pick-gallery pick-gallery-fill">
            {views.map((photo) => (
              <img key={photo.angle} src={photo.path} alt={`${piece.name}, ${photo.angle.replace("-", " ")} view`} draggable={false} />
            ))}
            <span className="pick-zones" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </figure>
        </div>
      </a>
    </section>
  );
}
