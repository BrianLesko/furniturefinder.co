import { SHARE } from "@/content/seo";

const description = "Drag the four corners of a wall to straighten a listing photo in the browser.";

export const metadata = {
  title: "Straighten a listing photo · Furniture Finder",
  description,
  alternates: { canonical: "/straighten" },
  openGraph: { ...SHARE, title: "Straighten a listing photo · Furniture Finder", description, url: "/straighten" },
};

export default function StraightenLayout({ children }) {
  return children;
}
