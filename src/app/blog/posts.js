import { comparisons } from "@/content/blog/comparisons";

// Registry of blog posts. Each post lives at src/app/blog/<slug>/page.js
// and owns its own metadata, except the comparisons, which share
// src/app/blog/[slug]/page.js. This list drives the /blog index.
// Newest first.
const comparisonPosts = comparisons.map(({ slug, kicker, title, lede, description, published }) => ({
  slug,
  kicker,
  title,
  lede,
  description,
  author: "Brian Lesko",
  published,
}));

const disclosurePost = comparisonPosts.find((post) => post.slug === "virtually-staged-photo-disclosure");

export const posts = [
  disclosurePost,
  {
    slug: "photos-to-include",
    kicker: "Listing photos",
    title: "The photos to include: one of the room empty, one furnished",
    lede: "Every bedroom and every bathroom, two angles of each bedroom, and the fireplace or the brick on a third of the frame. Furniture Finder can straighten the lean and furnish the empty photo after. It cannot move the spot you stood in.",
    description:
      "Which listing photos to shoot: one empty and one furnished from the same spot, every bedroom and bathroom, two angles of each bedroom, and where to stand so a fireplace or exposed brick lands on a third. What Furniture Finder can still adjust after the shoot.",
    author: "Brian Lesko",
    published: "2026-11-08",
  },
  {
    slug: "four-houses-full",
    kicker: "Occupancy",
    title: "Four houses leased full. The photos got 100 views. The comps got 12.",
    lede: "71 E Patterson, 73 E Patterson, 204 E Oakland, and 217 E Oakland are full. Zillow showed these listings at 100 or more views. Comparable listings showed 12. The difference renters could see was the photos.",
    description:
      "71 E Patterson, 73 E Patterson, 204 E Oakland, and 217 E Oakland leased full. Zillow showed these listings at 100 or more views while comparable listings showed 12. The listing photos are what made the houses stand out.",
    author: "Brian Lesko",
    published: "2026-11-08",
  },
  ...comparisonPosts.filter((post) => post.slug !== "virtually-staged-photo-disclosure"),
  {
    slug: "real-estate-photography-tips",
    kicker: "Listing photos",
    title: "How to take real estate photos: a level camera, open blinds, and the whole floor",
    lede: "Most bad listing photos fail for the same three reasons. The camera was tilted, the window blew out, and the counters were full. None of them needs a better camera.",
    description:
      "How to shoot listing photos with a phone or a camera: where to stand, how high to hold it, which lens, how to keep the window from going white, the shot list, and how to shoot an empty room so it can be furnished later.",
    author: "Brian Lesko",
    published: "2026-11-07",
  },
];

export function formatPostDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
