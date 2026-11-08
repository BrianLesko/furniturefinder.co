"use client";

import { useEffect, useState } from "react";

const pill =
  "inline-flex items-center justify-center rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a]";

export default function AccountMenu() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ signedIn: false }));
  }, []);

  if (!me) return <span className="h-[38px] w-[78px]" aria-hidden="true" />;
  if (!me.signedIn) {
    const path = window.location.pathname + window.location.search;
    const here = path === "/" ? "/dashboard" : path;
    if (here.startsWith("/login")) return null;
    return (
      <a className={pill} href={`/login?back=${encodeURIComponent(here)}`}>
        Sign in
      </a>
    );
  }
  const avatar = (
    <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-yellow font-mono text-[12px] uppercase">
      {(me.name || me.email || "?")[0]}
    </span>
  );
  // The menu only belongs on the dashboard. Everywhere else the avatar is the way in.
  if (window.location.pathname !== "/dashboard") {
    return (
      <a className={pill} href="/dashboard" aria-label={`Open your dashboard, signed in as ${me.label}`}>
        {avatar}
      </a>
    );
  }
  return (
    <details className="relative">
      <summary className={`${pill} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label={`Account ${me.label}`}>
        {avatar}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[5px_5px_0_0_#1a1a1a]">
        <p className="m-0 truncate font-mono text-[12px] text-ink/70">{me.label}</p>
        <a className="mt-2 block rounded-xl border-2 border-ink bg-hot px-3 py-1.5 text-center text-sm font-bold text-white no-underline" href="/dashboard">
          Dashboard
        </a>
        <form className="mt-2" method="post" action="/api/auth/logout">
          <button type="submit" className="w-full cursor-pointer rounded-xl border-2 border-ink bg-cream px-3 py-1.5 text-sm font-bold hover:bg-blush">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
