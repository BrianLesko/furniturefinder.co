"use client";

import { useEffect, useState } from "react";

const press =
  "inline-flex items-center justify-center rounded-full border-[3px] border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-wait disabled:opacity-60";
const field =
  "mt-2 block w-full rounded-2xl border-[3px] border-ink bg-white px-4 py-3 text-lg outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-hot";
const label = "block font-mono text-[13px] font-bold";
const linkButton = "cursor-pointer border-0 bg-transparent p-0 font-bold underline";
const POLL_MS = 2500;

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

function displayPhone(e164) {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 ?? "");
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

export default function LoginForm({ back, linkError, initialMethod = "email", link = false, prefill = {} }) {
  const [method, setMethod] = useState(initialMethod);
  const [error, setError] = useState(linkError);

  return (
    <div className="mt-8 rounded-[28px] border-[3px] border-ink bg-white p-6 shadow-[8px_8px_0_0_#1a1a1a]">
      {link ? null : (
        <div className="mb-5 flex gap-2" role="tablist" aria-label="Sign in with">
          {[
            ["email", "Email"],
            ["phone", "Phone"],
          ].map(([id, text]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={method === id}
              className={`${press} flex-1 px-4 py-2 text-sm ${method === id ? "bg-ink text-white" : "bg-white"}`}
              onClick={() => {
                setMethod(id);
                setError(null);
              }}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      {method === "phone" ? <PhoneLogin back={back} link={link} prefill={prefill} setError={setError} /> : <EmailLogin back={back} link={link} setError={setError} />}
      {error ? (
        <p className="mt-4 mb-0 rounded-xl border-2 border-ink bg-blush px-3 py-2 font-mono text-[12px] font-bold" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EmailLogin({ back, link, setError }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(event) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(await post("/api/auth/send-login", { email, back, link }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(value) {
    setBusy(true);
    setError(null);
    try {
      const { redirect } = await post("/api/auth/check-code", { email, code: value });
      window.location.assign(redirect);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function onCode(event) {
    const value = event.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    if (value.length === 6) checkCode(value);
  }

  if (!sent) {
    return (
      <form onSubmit={sendLink}>
        <label className={label} htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className={field}
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className={`${press} mt-5 w-full bg-hot px-6 py-3 font-display text-xl text-white`} disabled={busy}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === 6) checkCode(code);
      }}
    >
      <p className="m-0 text-[15px] leading-relaxed">
        Check <b>{email}</b>. Open the link in the email, or enter its 6-digit code here.
      </p>
      <label className={`${label} mt-5`} htmlFor="login-code">
        Code
      </label>
      <input
        id="login-code"
        className={`${field} text-center font-mono text-3xl tracking-[0.4em]`}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={code}
        onChange={onCode}
        disabled={busy}
      />
      {sent.dev_code ? (
        <p className="mt-3 mb-0 rounded-xl border-2 border-ink bg-yellow px-3 py-2 font-mono text-[12px] break-all">
          Dev mode, no email sent. Code {sent.dev_code} · <a href={sent.dev_link}>open the link</a>
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 font-mono text-[12px] font-bold">
        <button
          type="button"
          className={linkButton}
          onClick={() => {
            setSent(null);
            setCode("");
            setError(null);
          }}
        >
          Use a different email
        </button>
        <button type="button" className={linkButton} disabled={busy} onClick={sendLink}>
          Send it again
        </button>
      </div>
    </form>
  );
}

// The number comes first. One with an account gets a code texted to it. A new
// one fills in textwork.co's signup form, name and email, then texts a code to
// textwork's line, and the number it came from is the one verified.
function PhoneLogin({ back, link, prefill, setError }) {
  const [phone, setPhone] = useState("");
  const [known, setKnown] = useState(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState(prefill.name ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [pending, setPending] = useState(null);
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function lookup(event) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setKnown(await post("/api/auth/phone/lookup", { phone, back, link }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(value) {
    setBusy(true);
    setError(null);
    try {
      const { redirect } = await post("/api/auth/phone/check-code", { phone: known.phone, code: value });
      window.location.assign(redirect);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function onCode(event) {
    const value = event.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    if (value.length === 6) checkCode(value);
  }

  function restart() {
    setKnown(null);
    setPending(null);
    setCode("");
    setError(null);
  }

  async function start(event) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setQr(null);
      setPending(await post("/api/auth/phone/start", { name, email, back, link }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(`SMSTO:${pending.smsNumber}:${pending.code}`, { width: 360, margin: 1, color: { dark: "#1a1a1a", light: "#ffffff" } }))
      .then((url) => !cancelled && setQr(url))
      .catch(() => {});
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/auth/phone/status", { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (data.status === "verified") {
          clearInterval(timer);
          window.location.assign(data.redirect);
        } else if (data.status === "expired") {
          restart();
          setError("That code expired. Get a new one.");
        } else if (data.status === "refused") {
          restart();
          setError("That number can't sign in by text. Use email instead.");
        }
      } catch {
        // A dropped poll just waits for the next one.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pending, setError]);

  if (!known) {
    return (
      <form onSubmit={lookup}>
        <label className={label} htmlFor="phone-number">
          Phone
        </label>
        <input
          id="phone-number"
          className={field}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          autoFocus
          placeholder="(555) 555-5555"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <button type="submit" className={`${press} mt-5 w-full bg-hot px-6 py-3 font-display text-xl text-white`} disabled={busy}>
          {busy ? "One moment…" : "Continue"}
        </button>
      </form>
    );
  }
  if (known.known) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === 6) checkCode(code);
        }}
      >
        <p className="m-0 text-[15px] leading-relaxed">
          We texted a code to <b className="whitespace-nowrap">{displayPhone(known.phone)}</b>. Enter it here.
        </p>
        <label className={`${label} mt-5`} htmlFor="phone-code">
          Code
        </label>
        <input
          id="phone-code"
          className={`${field} text-center font-mono text-3xl tracking-[0.4em]`}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={onCode}
          disabled={busy}
        />
        {known.dev_code ? (
          <p className="mt-3 mb-0 rounded-xl border-2 border-ink bg-yellow px-3 py-2 font-mono text-[12px]">Dev mode, no text sent. Code {known.dev_code}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 font-mono text-[12px] font-bold">
          <button type="button" className={linkButton} onClick={restart}>
            Use a different number
          </button>
          <button type="button" className={linkButton} disabled={busy} onClick={lookup}>
            Text it again
          </button>
        </div>
      </form>
    );
  }
  if (!pending) {
    return (
      <form onSubmit={start}>
        <p className="mt-0 mb-4 text-[15px] leading-relaxed">
          <b className="whitespace-nowrap">{displayPhone(known.phone)}</b> is new here. Tell us who you are to make your account.
        </p>
        <label className={label} htmlFor="phone-name">
          Name
        </label>
        <input id="phone-name" className={field} autoComplete="name" required autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        <label className={`${label} mt-4`} htmlFor="phone-email">
          Email
        </label>
        <input
          id="phone-email"
          className={field}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className={`${press} mt-5 w-full bg-hot px-6 py-3 font-display text-xl text-white`} disabled={busy}>
          {busy ? "One moment…" : "Continue"}
        </button>
        <p className="mt-3 mb-0 font-mono text-[11px] leading-relaxed text-ink/60">
          Next you&apos;ll text us a code from your phone, which verifies your number. Texting is run by{" "}
          <a href="https://textwork.co" target="_blank" rel="noreferrer">
            TextWork
          </a>
          , and standard messaging rates apply.
        </p>
        <div className="mt-4 flex justify-center font-mono text-[12px]">
          <button type="button" className={linkButton} onClick={restart}>
            Use a different number
          </button>
        </div>
      </form>
    );
  }
  const number = displayPhone(pending.smsNumber);
  return (
    <div className="text-center">
      <p className="m-0 text-[15px] leading-relaxed">Text this code from your phone to verify your number.</p>
      <div className="mx-auto mt-4 hidden h-44 w-44 place-items-center rounded-2xl border-[3px] border-ink bg-white p-2 sm:grid">
        {qr ? <img className="h-full w-full" src={qr} alt={`Scan to text ${pending.code} to ${number}`} /> : null}
      </div>
      <p className="mt-4 mb-0 text-[15px]">
        Text <b className="font-mono text-lg tracking-[0.2em]">{pending.code}</b> to <b className="whitespace-nowrap">{number}</b>
      </p>
      <a className={`${press} mt-4 w-full bg-hot px-6 py-3 font-display text-xl text-white`} href={`sms:${pending.smsNumber}?&body=${pending.code}`}>
        On your phone? Tap to text
      </a>
      <p className="mt-4 mb-0 inline-flex items-center gap-2 font-mono text-[12px] text-ink/60" role="status">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden="true" />
        Waiting for your text…
      </p>
      <div className="mt-4 flex justify-center font-mono text-[12px]">
        <button type="button" className={linkButton} onClick={restart}>
          Start over
        </button>
      </div>
    </div>
  );
}
