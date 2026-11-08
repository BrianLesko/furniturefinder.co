import { posts } from "./blog/posts";
import { docs } from "@/content/docs";
import { rooms } from "@/content/rooms";
import { listedPieces } from "@/lib/piece-pages";

const ORIGIN = "https://furniturefinder.co";

export default function sitemap() {
  return [
    { url: `${ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${ORIGIN}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${ORIGIN}/studio`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${ORIGIN}/pick`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${ORIGIN}/pieces`, changeFrequency: "weekly", priority: 0.7 },
    ...listedPieces().map((piece) => ({ url: `${ORIGIN}/pieces/${piece.slug}`, lastModified: piece.quotedOn, changeFrequency: "monthly", priority: 0.6 })),
    { url: `${ORIGIN}/straighten`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${ORIGIN}/rooms`, changeFrequency: "monthly", priority: 0.7 },
    ...rooms.map((room) => ({ url: `${ORIGIN}/rooms/${room.slug}`, changeFrequency: "yearly", priority: 0.6 })),
    { url: `${ORIGIN}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${ORIGIN}/blog`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${ORIGIN}/docs`, changeFrequency: "monthly", priority: 0.6 },
    ...docs.map((doc) => ({ url: `${ORIGIN}/docs/${doc.slug}`, changeFrequency: "monthly", priority: 0.5 })),
    ...posts.map((post) => ({ url: `${ORIGIN}/blog/${post.slug}`, lastModified: post.published, changeFrequency: "yearly", priority: 0.7 })),
  ];
}
