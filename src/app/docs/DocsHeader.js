import Header from "@/components/Header";

const press =
  "inline-flex items-center justify-center rounded-full border-ink font-bold no-underline shadow-[3px_3px_0_0_#1a1a1a] transition hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_0_#1a1a1a] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";

export default function DocsHeader() {
  return (
    <Header sticky>
      <a className={`${press} border-[3px] bg-hot px-[18px] py-2 font-display text-lg text-white`} href="/studio">
        Studio
      </a>
    </Header>
  );
}
