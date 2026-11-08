export const SITE_DESCRIPTION =
  "Virtual staging with real furniture you can buy. Straighten a listing photo, set real pieces on the floor at true size, and let your AI render the room. $12 a month.";

// A page that sets its own openGraph replaces the layout's whole object, so
// pages spread this in to keep the image.
export const SHARE = {
  type: "website",
  siteName: "Furniture Finder",
  images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "An empty listing photo of a living room, and the same room staged with a real sofa, rug, and table" }],
};
