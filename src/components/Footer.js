"use client";

import { useEffect } from "react";
import Mark from "@/components/Mark";

function scrollToHash() {
  const id = window.location.hash.slice(1);
  if (!id) return;
  document.getElementById(id)?.scrollIntoView();
}

export default function Footer() {
  useEffect(() => {
    scrollToHash();
    const later = window.setTimeout(scrollToHash, 0);
    window.addEventListener("hashchange", scrollToHash);
    return () => {
      window.clearTimeout(later);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, []);

  return (
    <footer className="border-t-[5px] border-hot bg-ink text-white">
      <div className="mx-auto w-full max-w-6xl px-6 md:px-8 pt-16">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <a className="inline-flex items-center gap-3 no-underline [--mark-bg:#1a1a1a] [--mark-ink:#fff]" href="/">
              <Mark size={48} />
              <span className="footer-mark font-display text-[2.25rem] leading-none text-hot [-webkit-text-stroke:1px_#1a1a1a] [paint-order:stroke_fill]">Furniture Finder</span>
            </a>
            <p className="mt-3.5 mb-0 text-sm text-white/55">
              Built by <a className="text-yellow underline decoration-yellow underline-offset-4" href="https://brianlesko.com">Brian Lesko</a>
            </p>
            <p className="mt-3.5 mb-0 text-sm leading-snug text-white/55">Empty listing photos, furnished on the floor, at the scale of the room.</p>
          </div>
          <div className="grid grid-cols-2 gap-y-8 gap-x-12 sm:grid-cols-3 lg:grid-cols-5">
            <div className="flex flex-col gap-2">
              <h2 className="m-0 font-display text-[1.1745rem] font-normal tracking-[0.03em] text-yellow normal-case [-webkit-text-stroke:0]">Product</h2>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/#how">How it places</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/rooms">Rooms</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/about">About</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/pick">Pick pieces</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/pieces">Dimensions</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/blog">Blog</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/#mcp">MCP server</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/#compare">Compare</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/pricing">Pricing</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/#faq">FAQ</a>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="m-0 font-display text-[1.1745rem] font-normal tracking-[0.03em] text-yellow normal-case [-webkit-text-stroke:0]">
                <a className="text-yellow no-underline hover:text-white" href="/docs">Docs</a>
              </h2>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/docs/getting-started">Get started</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/docs/straighten">Straighten</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/docs/connect-an-agent">Connect an agent</a>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="m-0 font-display text-[1.1745rem] font-normal tracking-[0.03em] text-yellow normal-case [-webkit-text-stroke:0]">Compare</h2>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/blog/furniture-finder-vs-virtual-staging">vs virtual staging</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/blog/furniture-finder-vs-ai-staging-apps">vs AI staging apps</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/blog/furniture-finder-vs-home-staging">vs home staging</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/blog/furniture-finder-vs-photoshop">vs Photoshop</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="/blog/virtually-staged-photo-disclosure">Disclosure rules</a>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="m-0 font-display text-[1.1745rem] font-normal tracking-[0.03em] text-yellow normal-case [-webkit-text-stroke:0]">Houses</h2>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="https://leskohomes.com/71epatterson">71 E Patterson</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="https://leskohomes.com/73epatterson">73 E Patterson</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="https://leskohomes.com/204eoakland">204 E Oakland</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="https://leskohomes.com/217eoakland">217 E Oakland</a>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="m-0 font-display text-[1.1745rem] font-normal tracking-[0.03em] text-yellow normal-case [-webkit-text-stroke:0]">Sites</h2>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="https://leskohomes.com">Lesko Homes</a>
              <a className="text-sm text-white/40 no-underline hover:text-white" href="https://textwork.co">TextWork</a>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-6xl px-6 md:px-8 md:mt-10">
        <div className="h-[3px] bg-white/15" />
      </div>
      <p className="mx-auto m-0 w-full max-w-6xl px-6 md:px-8 py-6 text-left text-[13px] text-white/40">© 2026 Furniture Finder</p>
    </footer>
  );
}
