"use client";

import { useEffect, useRef, useState } from "react";

const FEATURES = [
  "Custom pieces from any listing",
  "Your own listing photos",
  "Correct camera distortion",
  "Every piece in the catalog",
];

const press =
  "inline-flex items-center justify-center rounded-full border-[3px] border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

export default function UnlockModal({ open, onClose }) {
  const ref = useRef(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ signedIn: false }));
  }, [open]);

  async function go(url) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, { method: "POST" });
      const body = await response.json();
      if (body.url) return window.location.assign(body.url);
      if (body.login) return window.location.assign(body.login);
      throw new Error(body.error);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="m-auto w-[min(92vw,420px)] overflow-visible rounded-[28px] border-[3px] border-ink bg-white p-0 text-ink shadow-[8px_8px_0_0_#1a1a1a] backdrop:bg-ink/50 backdrop:backdrop-blur-[2px]"
      aria-labelledby="unlock-title"
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
    >
      {/* Rendered only while open, so its heading isn't part of the page's outline. */}
      {open ? (
        <>
          <button
            type="button"
            className="absolute top-3 right-3 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-2 border-ink bg-white text-lg font-bold hover:bg-cream"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
          <div className="rounded-t-[25px] border-b-[3px] border-ink bg-hot px-6 pt-7 pb-5 text-white">
            <h2 id="unlock-title" className="m-0 pr-8 font-display text-3xl leading-none tracking-[0.02em]">
              Unlock custom pieces and more
            </h2>
            <p className="mt-2 mb-0 text-sm text-white/85">with Furniture Finder</p>
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
            {!me ? (
              <span className={`${press} w-full bg-hot/60 px-6 py-3 font-display text-xl text-white`}>One moment…</span>
            ) : me.paid && !me.billing ? (
              <p className="m-0 rounded-xl border-2 border-ink bg-yellow px-3 py-2 text-center font-mono text-[13px] font-bold" role="status">
                Your account has free access. No subscription needed.
              </p>
            ) : me.paid ? (
              <>
                <p className="mt-0 mb-3 rounded-xl border-2 border-ink bg-yellow px-3 py-2 text-center font-mono text-[13px] font-bold" role="status">
                  You&apos;re subscribed. Thanks!
                </p>
                <button type="button" className={`${press} w-full cursor-pointer bg-white px-6 py-3 font-display text-xl`} disabled={busy} onClick={() => go("/api/billing/portal")}>
                  {busy ? "Opening…" : "Manage billing"}
                </button>
              </>
            ) : me.signedIn ? (
              <button type="button" className={`${press} w-full cursor-pointer bg-hot px-6 py-3 font-display text-xl text-white`} disabled={busy} onClick={() => go("/api/billing/checkout")}>
                {busy ? "Opening checkout…" : "Continue to checkout"}
              </button>
            ) : (
              <a className={`${press} w-full bg-hot px-6 py-3 font-display text-xl text-white`} href="/login?back=%2Fstudio%3Funlock%3D1">
                Sign in to subscribe
              </a>
            )}
            {error ? (
              <p className="mt-3 mb-0 rounded-xl border-2 border-ink bg-blush px-3 py-2 font-mono text-[12px] font-bold" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
