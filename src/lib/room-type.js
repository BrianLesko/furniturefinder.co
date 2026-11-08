import { PRESETS } from "./presets";

export const ROOM_TYPES = [
  { id: "living", label: "Living room" },
  { id: "kitchen", label: "Kitchen" },
  { id: "bedroom", label: "Bedroom" },
];

// Example photos whose room we already know. A front room is furnished from
// the living-room catalog. A bath or laundry has no pieces of its own.
const FROM_PRESET = {
  bedroom: "bedroom",
  "bedroom-2": "bedroom",
  "bedroom-3": "bedroom",
  kitchen: "kitchen",
  "front-room": "living",
};

export function roomTypeForSrc(src) {
  const preset = PRESETS.find((item) => item.src === src);
  if (!preset) return null;
  return FROM_PRESET[preset.slug] ?? null;
}

export function roomTypeFromGuess(value) {
  return ROOM_TYPES.some((item) => item.id === value) ? value : null;
}
