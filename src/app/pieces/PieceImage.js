import { visibleBox } from "@/lib/piece-pages";

// A product photo cropped to the piece and fitted, centered, into a frame of
// `frame` aspect ratio.
export default async function PieceImage({ photo, alt, frame = 4 / 3, className = "", eager = false }) {
  const box = await visibleBox(photo);
  const wide = box.aspect >= frame;
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ aspectRatio: frame }}>
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: box.aspect, width: wide ? "100%" : "auto", height: wide ? "auto" : "100%" }}
      >
        <img
          className="absolute block max-w-none"
          src={photo.path}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          style={{
            width: `${100 / box.w}%`,
            height: `${100 / box.h}%`,
            left: `${(-box.x / box.w) * 100}%`,
            top: `${(-box.y / box.h) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
