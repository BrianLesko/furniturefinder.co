import { Caveat, Chewy, Space_Mono } from "next/font/google";
import "./globals.css";

const chewy = Chewy({ weight: "400", subsets: ["latin"], variable: "--font-chewy" });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space" });
const caveat = Caveat({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-caveat" });

export const metadata = {
  title: "Furniture Finder",
  description: "Place real furniture into an empty listing photo, on the floor, at the scale of the room.",
  metadataBase: new URL("https://furniturefinder.co"),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${chewy.variable} ${mono.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
