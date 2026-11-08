export const PRESETS = [
  { slug: "bedroom", label: "Bedroom" },
  { slug: "kitchen", label: "Kitchen" },
  { slug: "front-room", label: "Front room" },
  { slug: "bedroom-2", label: "Bedroom 2" },
  { slug: "bedroom-3", label: "Bedroom 3" },
  { slug: "bath", label: "Bath" },
  { slug: "laundry", label: "Laundry" },
].map((preset) => ({
  ...preset,
  src: `/examples/wyandotte-${preset.slug}.webp`,
  thumb: `/examples/thumbs/wyandotte-${preset.slug}.webp`,
}));
