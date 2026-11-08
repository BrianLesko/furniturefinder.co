"use client";

import { useEffect, useState } from "react";
import Chip from "@/components/Chip";

const press =
  "inline-flex items-center justify-center rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_#1a1a1a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60";
const CLIENTS = [
  {
    id: "claude",
    label: "Claude Code",
    where: "Run in a terminal:",
    snippet: (url, key) => `claude mcp add --transport http furniture-finder ${url} --header "Authorization: Bearer ${key}"`,
  },
  {
    id: "cursor",
    label: "Cursor",
    where: "Add to ~/.cursor/mcp.json:",
    snippet: (url, key) =>
      JSON.stringify({ mcpServers: { "furniture-finder": { url, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
  },
  {
    id: "codex",
    label: "Codex",
    where: "Add to ~/.codex/config.toml:",
    snippet: (url, key) => `[mcp_servers.furniture-finder]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${key}" }`,
  },
  {
    id: "other",
    label: "Other",
    where: "Any MCP client that speaks Streamable HTTP:",
    snippet: (url, key) => `URL:    ${url}\nHeader: Authorization: Bearer ${key}`,
  },
];

const when = (iso) => (iso ? new Date(`${iso.replace(" ", "T")}${iso.endsWith("Z") ? "" : "Z"}`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "never");

export default function ConnectAi({ initialKeys }) {
  const [keys, setKeys] = useState(initialKeys);
  const [fresh, setFresh] = useState(null);
  const [client, setClient] = useState("claude");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("https://furniturefinder.co/api/mcp");

  useEffect(() => setUrl(`${window.location.origin}/api/mcp`), []);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setFresh(body.key);
      setKeys((list) => [body.record, ...list]);
      setName("");
    } catch (err) {
      setError(err.message || "The key wasn't made. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    if (!window.confirm("Revoke this key? Any AI using it stops connecting.")) return;
    const response = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (response.ok) setKeys((list) => list.filter((key) => key.id !== id));
  }

  const chosen = CLIENTS.find((c) => c.id === client);
  const snippet = chosen.snippet(url, fresh ?? "ff_YOUR_KEY");

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-[22px] border-[3px] border-ink bg-white p-5 shadow-[5px_5px_0_0_#1a1a1a]">
        <p className="m-0 text-[15px] leading-relaxed">
          Your AI reads your saved rooms and the catalog through the Furniture Finder MCP server, then does the final render
          itself. Ask it to &ldquo;render my latest Furniture Finder room.&rdquo;
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="AI app">
          {CLIENTS.map((c) => (
            <Chip key={c.id} size="md" pressed={client === c.id} onClick={() => setClient(c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
        <p className="mt-4 mb-1.5 font-mono text-[12px] font-bold">{chosen.where}</p>
        <pre className="m-0 overflow-x-auto rounded-xl border-2 border-ink bg-ink p-3 font-mono text-[12px] leading-relaxed text-cream">{snippet}</pre>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={`${press} cursor-pointer bg-yellow`} onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
          {!fresh ? <span className="font-mono text-[12px] text-ink/60">Make a key to fill it in.</span> : null}
        </div>
      </div>

      <div className="rounded-[22px] border-[3px] border-ink bg-white p-5 shadow-[5px_5px_0_0_#1a1a1a]">
        <h3 className="m-0 font-display text-xl tracking-[0.02em]">Keys</h3>
        <form className="mt-3 flex gap-2" onSubmit={create}>
          <input
            className="min-w-0 flex-1 rounded-full border-2 border-ink px-3 py-1.5 text-sm"
            placeholder="Name, e.g. Laptop Claude"
            aria-label="Key name"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className={`${press} cursor-pointer bg-hot text-white`} disabled={busy}>
            {busy ? "Making…" : "New key"}
          </button>
        </form>
        {fresh ? (
          <div className="mt-3 rounded-xl border-2 border-ink bg-yellow p-3" role="status">
            <p className="m-0 font-mono text-[12px] font-bold">Copy it now. It won&apos;t be shown again.</p>
            <code className="mt-1.5 block font-mono text-[12px] break-all select-all">{fresh}</code>
          </div>
        ) : null}
        {error ? (
          <p className="mt-3 mb-0 rounded-xl border-2 border-ink bg-blush px-3 py-2 font-mono text-[12px] font-bold" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="m-0 mt-4 grid list-none gap-2 p-0">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-ink bg-cream px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{key.name}</span>
                <span className="block font-mono text-[11px] text-ink/60">
                  {key.prefix}… · used {when(key.last_used_at)}
                </span>
              </span>
              <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[12px] font-bold underline" onClick={() => revoke(key.id)}>
                Revoke
              </button>
            </li>
          ))}
          {!keys.length ? <li className="font-mono text-[12px] text-ink/60">No keys yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}
