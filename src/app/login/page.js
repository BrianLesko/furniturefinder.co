import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { safeBack } from "@/lib/auth";
import { currentUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign in · Furniture Finder",
  description: "Sign in to Furniture Finder with your email or phone.",
};

const LINK_ERRORS = {
  expired: "That sign-in link has expired. Send yourself a new one.",
  invalid: "That sign-in link didn't work. Send yourself a new one.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const add = ["email", "phone"].includes(params?.add) ? params.add : null;
  const user = add ? await currentUser() : null;
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[480px] px-5 pt-14 pb-24">
        <h1 className="m-0 font-display text-[clamp(2.6rem,7vw,3.6rem)] leading-[0.92] tracking-[0.03em] text-hot uppercase [-webkit-text-stroke:3px_#1a1a1a] [paint-order:stroke_fill] [text-shadow:4px_4px_0_#fff]">
          {add ? `Add ${add === "phone" ? "a phone" : "an email"}` : "Sign in"}
        </h1>
        <p className="mt-4 mb-0 text-[1.0625rem] leading-[1.7]">
          {add
            ? "Verify it once, and you can sign in to this account with it too."
            : "Use your email or your phone. No password needed, and it makes an account if you don\u2019t have one."}
        </p>
        <LoginForm
          back={safeBack(params?.back)}
          linkError={LINK_ERRORS[params?.error] ?? null}
          initialMethod={add ?? (params?.method === "phone" ? "phone" : "email")}
          link={Boolean(add)}
          prefill={{ name: user?.name ?? "", email: user?.email ?? "" }}
        />
      </main>
      <Footer />
    </>
  );
}
