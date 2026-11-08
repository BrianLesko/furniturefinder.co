/**
 * Every straightening method that has been voted on. Give a changed
 * algorithm a new id so its votes start fresh; retire a method rather than
 * deleting it so its old votes keep a name.
 */
export const STRAIGHTEN_METHODS = [
  { id: "original-v1", label: "Original", note: "As taken", status: "active" },
  { id: "lines-v1", label: "Two lines", note: "On-device detector", status: "active" },
  { id: "corners-v1", label: "Four corners", note: "On-device detector", status: "active" },
  { id: "plumb-v1", label: "Upright · GeoCalib", note: "Camera tilt taken out", status: "active" },
  { id: "plumb-v2", label: "Upright · GeoCalib gentle", note: "Most of the tilt out, cropped", status: "active" },
  { id: "snap-mp3d-v2", label: "Snapped · Matterport", note: "uLayout", status: "active" },
  { id: "snap-st2d3d-v2", label: "Snapped · Stanford", note: "uLayout", status: "active" },
  { id: "snap-pano-v2", label: "Snapped · PanoContext", note: "Dropped: 1 yay in 13", status: "retired" },
  { id: "snap-v1", label: "Snapped (back wall only)", note: "Replaced by v2", status: "retired" },
];

export const NOT_ROOM = "not-room";
export const BEST = "best";
/** "yes" when the photo should be reshot rather than fixed. */
export const RETAKE = "retake";
