const sizeClass = {
  sm: "px-2.5 py-0.5 text-[11px]",
  md: "px-3 py-1 text-[12px]",
};

export default function Chip({ pressed, size = "sm", className = "", children, ...props }) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={pressed}
      className={`cursor-pointer whitespace-nowrap rounded-full border-2 border-ink font-mono font-bold transition-colors duration-200 ${sizeClass[size]} ${
        pressed ? "bg-hot text-white hover:bg-hot/80" : "bg-white hover:bg-cream"
      }${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}
