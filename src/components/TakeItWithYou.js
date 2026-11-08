// textwork.co's "Take the data with you": a centered title, then three equal
// cards, each a looping product mock with a bold lead and a quieter sentence.
// The room is the 73 E Patterson living room from the before-and-after pairs.

const sectionTitle =
  "m-0 text-center font-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:1.5px_#1a1a1a] [paint-order:stroke_fill]";

const LAYERS = ["Room photo, straightened", "Mockup, 5 pieces", "Gap mask", "Every piece, in inches"];

// The pieces in the furnished living room, in the order they are listed.
const LIST = [
  { slug: "kivik-sofa" },
  { slug: "lohals-rug" },
  { slug: "vaila-table" },
  { slug: "maison-stool", count: 2 },
];

const badge = "rounded-lg bg-ink/75 px-2 py-1 font-mono text-[10px] leading-none font-bold text-white";

function money(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function Check({ className = "" }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SceneCard() {
  return (
    <div className="flex h-full flex-col gap-3 p-[18px]" aria-hidden="true">
      <div className="relative overflow-hidden rounded-xl border-[3px] border-ink">
        <img className="block aspect-[16/9] w-full object-cover" src="/examples/living-empty.webp" alt="" loading="lazy" />
        <span className="absolute top-2 right-2 rounded-full border-2 border-ink bg-yellow px-2.5 py-0.5 font-mono text-[11px] font-bold">
          Saved
        </span>
      </div>
      <div className="flex-1 rounded-xl border-[3px] border-ink bg-white px-3 py-2">
        <p className="m-0 font-mono text-[11px] font-bold text-ink/60">Scene 4f2a</p>
        <ul className="m-0 mt-1 grid list-none gap-1.5 p-0">
          {LAYERS.map((layer) => (
            <li className="flex items-center gap-2 text-[13px] font-bold" key={layer}>
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow">
                <Check />
              </span>
              <span className="truncate">{layer}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RenderCard() {
  return (
    <div className="relative h-full p-[18px]">
      <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-between p-7" aria-hidden="true">
        <span className={badge}>Saved scene</span>
        <span className={badge}>Your AI&apos;s render</span>
      </div>
      <figure className="diff render-diff h-full rounded-xl border-[3px] border-ink" tabIndex={0}>
        <div className="diff-item-1" role="img" aria-label="The empty living room at 73 E Patterson" tabIndex={0}>
          <img src="/examples/living-empty.webp" alt="The empty living room at 73 E Patterson" loading="lazy" />
        </div>
        <div className="diff-item-2" role="img" aria-label="The same living room, rendered with the sofa, rug, table, and stools">
          <img src="/examples/living-after.webp" alt="The same living room, rendered with the sofa, rug, table, and stools" loading="lazy" />
        </div>
        <div className="diff-resizer" />
      </figure>
    </div>
  );
}

function ListCard({ items }) {
  const total = items.reduce((sum, { product, count }) => sum + product.priceCents * count, 0);
  return (
    <div className="flex h-full flex-col p-[18px]" aria-hidden="true">
      <div className="flex flex-1 flex-col rounded-xl border-[3px] border-ink bg-white px-3 py-2.5">
        <p className="m-0 font-mono text-[11px] font-bold text-ink/60">In this room</p>
        <ul className="m-0 mt-1.5 grid list-none gap-2 p-0">
          {items.map(({ product, count }, i) => (
            <li className="take-slide flex min-w-0 items-center gap-2.5" key={product.slug} style={{ animationDelay: `${0.3 + i * 0.35}s` }}>
              <img className="h-9 w-11 shrink-0 object-contain" src={`/spin/${product.slug}-front.webp`} alt="" width={44} height={36} loading="lazy" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">
                  {count > 1 ? `${count} × ` : ""}
                  {product.name}
                </span>
                <span className="block truncate font-mono text-[11px] text-ink/60">
                  {product.sellerName} · {Math.round(product.widthIn)}″ W
                </span>
              </span>
              <span className="shrink-0 font-display text-base">{money(product.priceCents * count)}</span>
            </li>
          ))}
        </ul>
        <div className="take-pop mt-auto flex items-baseline justify-between border-t-2 border-dashed border-ink/30 pt-2" style={{ animationDelay: "2s" }}>
          <span className="font-mono text-[11px] font-bold">Total</span>
          <span className="font-display text-2xl text-hot">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function TakeItWithYou({ products }) {
  const items = LIST.map(({ slug, count = 1 }) => ({ product: products.find((p) => p.slug === slug), count })).filter(
    (item) => item.product,
  );
  const cards = [
    {
      lead: "Save the scene.",
      rest: "The straightened room, the mockup, the gap mask, and every piece's size in inches.",
      picture: <SceneCard />,
      bg: "bg-blush",
    },
    {
      lead: "Your AI does the render.",
      rest: "Claude, ChatGPT, or Codex reads the scene through the Furniture Finder MCP and fills the gaps in the same pass.",
      picture: <RenderCard />,
      bg: "bg-yellow",
    },
    {
      lead: "Then buy what's in it.",
      rest: "Every piece is a real listing, with its seller, price, and size.",
      picture: <ListCard items={items} />,
      bg: "bg-sky",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-[1120px] overflow-hidden px-5 py-32 max-md:py-20" id="take">
      <h2 className={sectionTitle}>Take the scene with you</h2>
      <p className="mx-auto mt-4 mb-0 max-w-[36rem] text-center text-[0.98rem] leading-[1.6] text-ink/70">
        Save the room, hand it to your AI, and buy what&apos;s in it.
      </p>
      <div className="-mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pt-1 pb-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {cards.map((card) => (
          <div className="min-w-[82vw] snap-center sm:min-w-[55vw] lg:min-w-0" key={card.lead}>
            <div className={`take-card aspect-[426/406] overflow-hidden rounded-[22px] border-[3px] border-ink shadow-[6px_6px_0_0_#1a1a1a] ${card.bg}`}>
              {card.picture}
            </div>
            <p className="mt-5 mb-0 text-[0.98rem] leading-snug text-ink/60">
              <strong className="mr-1 text-ink">{card.lead}</strong> {card.rest}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
