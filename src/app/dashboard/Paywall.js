const FEATURES = [
  "Save rooms and come back to them",
  "Connect Claude, Cursor, or Codex to render your rooms",
  "Custom pieces from any listing",
  "Your own listing photos, straightened",
  "Every piece in the catalog",
];

const press =
  "inline-flex items-center justify-center rounded-full border-[3px] border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

export default function Paywall({ failed }) {
  return (
    <section className="mt-10 max-w-[520px] overflow-hidden rounded-[28px] border-[3px] border-ink bg-white shadow-[8px_8px_0_0_#1a1a1a]" aria-labelledby="paywall-title">
      <div className="border-b-[3px] border-ink bg-hot px-6 pt-7 pb-5 text-white">
        <h2 id="paywall-title" className="m-0 font-display text-3xl leading-none tracking-[0.02em]">
          Subscribe to use your dashboard
        </h2>
        <p className="mt-2 mb-0 text-sm text-white/85">The free studio stays open to try.</p>
      </div>
      <div className="px-6 pt-6 pb-7">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-6xl leading-none">$12</span>
          <span className="font-display text-xl">/ month</span>
        </div>
        <ul className="mt-5 mb-7 grid list-none gap-2.5 p-0">
          {FEATURES.map((item) => (
            <li className="flex items-center gap-3 text-sm" key={item}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>
        <a className={`${press} w-full bg-hot px-6 py-3 font-display text-xl text-white`} href="/subscribe">
          Continue to checkout
        </a>
        <a className="mt-4 block text-center font-mono text-[12px] font-bold" href="/studio">
          Try the free studio
        </a>
        {failed ? (
          <p className="mt-3 mb-0 rounded-xl border-2 border-ink bg-blush px-3 py-2 font-mono text-[12px] font-bold" role="alert">
            Checkout couldn&apos;t start. Try again in a minute.
          </p>
        ) : null}
      </div>
    </section>
  );
}
