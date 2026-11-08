"use client";

import { useEffect, useRef, useState } from "react";

const action =
  "shrink-0 cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 font-mono text-[12px] font-normal text-ink/55 no-underline hover:text-ink hover:underline hover:underline-offset-2";

const press =
  "inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold shadow-[2px_2px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_#1a1a1a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-default disabled:opacity-60";

const when = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function SavedRooms({ initial, openId, stacked = false }) {
  const [rooms, setRooms] = useState(initial);
  const [copied, setCopied] = useState(null);
  const [pending, setPending] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  async function confirmDelete() {
    if (!pending || deleting) return;
    setDeleting(true);
    const response = await fetch(`/api/scenes/${pending.id}`, { method: "DELETE" });
    if (response.ok) setRooms((list) => list.filter((room) => room.id !== pending.id));
    setDeleting(false);
    setPending(null);
  }

  async function copy(id) {
    await navigator.clipboard.writeText(`Render Furniture Finder scene ${id}.`);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
  }

  if (!rooms.length) {
    return (
      <p className={stacked
        ? "m-0 px-2 py-4 text-center font-mono text-[13px] text-ink/70"
        : "mt-5 mb-0 rounded-2xl border-[3px] border-dashed border-ink bg-white px-5 py-6 text-center font-mono text-[13px]"}>
        No saved rooms yet. Furnish a photo in the studio above and save it on the Render step.
      </p>
    );
  }
  return (
    <>
    <ul className={`m-0 flex list-none flex-col gap-1.5 p-0 ${stacked ? "" : "mt-6"}`}>
      {rooms.map((room) => {
        const href = room.editable ? `/dashboard?scene=${room.id}#studio` : `/api/scenes/${room.id}/mockup`;
        const title = room.title || room.names[0] || "Saved room";
        const open = room.id === openId;
        return (
          <li
            key={room.id}
            className={`flex items-center gap-3 rounded-xl border-2 px-2 py-1.5 ${open ? "border-hot bg-blush" : "border-ink/15 bg-white hover:border-ink"}`}
          >
            <a className="shrink-0" href={href}>
              <img
                className="block h-11 w-12 rounded-lg border-2 border-ink object-cover sm:h-12 sm:w-16"
                src={`/api/scenes/${room.id}/mockup`}
                alt=""
                loading="lazy"
              />
            </a>
            <div className="min-w-0 flex-1">
              <a className="block truncate text-sm font-bold no-underline" href={href} title={room.names.join(", ")}>
                {title}
              </a>
              <p className="m-0 truncate font-mono text-[11px] text-ink/60">
                {room.pieces} {room.pieces === 1 ? "piece" : "pieces"}
                {room.savedAt ? ` · ${when(room.savedAt)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {room.editable ? (
                <a className={action} href={href}>
                  Open
                </a>
              ) : null}
              <button type="button" className={action} onClick={() => copy(room.id)}>
                {copied === room.id ? "Copied" : "Copy"}
              </button>
              <a className={action} href={`/api/scenes/${room.id}/mockup`} download={`furniture-finder-${room.id}.png`}>
                Download
              </a>
              <button type="button" className={action} onClick={() => setPending(room)}>
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(92vw,400px)] rounded-[28px] border-[3px] border-ink bg-white p-0 text-ink shadow-[8px_8px_0_0_#1a1a1a] backdrop:bg-ink/50"
      aria-labelledby="delete-room-title"
      onClose={() => setPending(null)}
      onClick={(event) => event.target === dialogRef.current && setPending(null)}
    >
      {pending ? (
        <div className="px-6 py-6">
          <h2 id="delete-room-title" className="m-0 font-display text-3xl leading-none tracking-[0.02em]">
            Delete this saved room?
          </h2>
          <p className="mt-3 mb-0 text-[15px] leading-relaxed">
            <b>{pending.title || "This room"}</b> will be gone, and your AI won&apos;t be able to render it anymore.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <button type="button" className={`${press} bg-white`} onClick={() => setPending(null)} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className={`${press} bg-hot text-white`} onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
    </>
  );
}
