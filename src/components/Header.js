import AccountMenu from "@/components/AccountMenu";
import Mark from "@/components/Mark";
import StickyStart from "@/components/StickyStart";

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/#how", label: "How it places" },
];

export default function Header({ width = "max-w-[1120px]", sticky = false, children }) {
  return (
    <>
      <header className={`mx-auto flex w-full ${width} flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pt-[22px] pb-2`}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-x-8 lg:gap-x-12">
          <a className="inline-flex items-center gap-2.5 font-bold whitespace-nowrap no-underline" href="/">
            <Mark />
            Furniture Finder
          </a>
          <nav className="hidden flex-wrap items-center gap-x-4 gap-y-1 sm:flex sm:gap-x-5" aria-label="Main">
            {links.map((link) => (
              <a key={link.href} className="text-[0.9rem] font-normal no-underline underline-offset-4 hover:underline" href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          {children}
          <AccountMenu />
        </div>
      </header>
      {sticky ? <StickyStart /> : null}
    </>
  );
}
