import { Caveat, Chewy, Space_Mono } from "next/font/google";
import Script from "next/script";
import { SHARE, SITE_DESCRIPTION } from "@/content/seo";
import "./globals.css";

const chewy = Chewy({ weight: "400", subsets: ["latin"], variable: "--font-chewy" });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space" });
const caveat = Caveat({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-caveat" });

export const metadata = {
  title: "Furniture Finder",
  description: SITE_DESCRIPTION,
  metadataBase: new URL("https://furniturefinder.co"),
  // Each route's own URL, resolved against metadataBase.
  alternates: { canonical: "./" },
  openGraph: { ...SHARE, title: "Furniture Finder", description: SITE_DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
};

// From the furniturefinder.co site in the DataFast dashboard.
const DATAFAST_ID = process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID;
const analytics = process.env.NODE_ENV === "production" && DATAFAST_ID;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${chewy.variable} ${mono.variable} ${caveat.variable}`}>
      <head>
        {analytics ? (
          // Queues datafast() calls made before the script loads.
          <script
            id="datafast-queue"
            dangerouslySetInnerHTML={{
              __html: "window.datafast=window.datafast||function(){(window.datafast.q=window.datafast.q||[]).push(arguments)};",
            }}
          />
        ) : null}
      </head>
      <body className="min-h-screen bg-cream font-mono text-ink">
        {children}
        {analytics ? <Script defer data-website-id={DATAFAST_ID} data-domain="furniturefinder.co" src="/js/script.js" /> : null}
      </body>
    </html>
  );
}
