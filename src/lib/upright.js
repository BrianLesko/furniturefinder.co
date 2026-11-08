import { straightenTilt, straightenVerticals } from "./perspective";

/** Past this tilt the full correction stretches the photo too far (votes, Nov 2026). */
export const TILT_LIMIT = 15;
/** Degrees of tilt v2 leaves in, so verticals keep a slight, natural lean. */
export const GENTLE_LEAN = 4;

const toLine = ([x1, y1, x2, y2]) => [
  { x: x1, y: y1 },
  { x: x2, y: y2 },
];

/** plumb-v1: stand the model's verticals fully upright. */
export function uprightFull(image, snap) {
  return snap?.plumb ? straightenVerticals(image, snap.plumb.map(toLine)) : null;
}

/**
 * plumb-v2: turn the camera to within GENTLE_LEAN of level and crop the gaps
 * away. Turning the camera keeps the room's proportions, where pulling two
 * lines upright squashes a steep shot.
 */
export function uprightGentle(image, calib) {
  const tilt = Math.abs(calib.pitch);
  const strength = tilt > GENTLE_LEAN ? 1 - GENTLE_LEAN / tilt : 0;
  return straightenTilt(image, calib, { strength, crop: true });
}

/**
 * The production rule: v1 up to TILT_LIMIT, v2 beyond it with a badge
 * telling the photographer the shot was steep.
 *
 * @param {{calib: object, snap: object}} layout the layout service's reply
 */
export function uprightPlan(layout) {
  const tilt = Math.abs(layout.calib.pitch);
  const steep = tilt > TILT_LIMIT;
  return {
    method: steep ? "plumb-v2" : "plumb-v1",
    tilt,
    badge: steep
      ? `Shot ${Math.round(tilt)}° ${layout.calib.pitch < 0 ? "down" : "up"}. Corrected gently; a level retake will look better.`
      : null,
    render: (image) => (steep ? uprightGentle(image, layout.calib) : uprightFull(image, layout.snap)),
  };
}
