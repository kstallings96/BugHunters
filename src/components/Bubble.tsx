import type { ReactNode } from "react";

/**
 * A speech bubble that points at what to do next (practice only): "left"
 * points back at the input row, "down" at whatever sits below it. Amber like
 * the highlighted input, and it bobs gently so students notice it.
 */
export function Bubble({ children, point, className = "" }: { children: ReactNode; point: "left" | "down"; className?: string }) {
  return (
    <div role="status" className={`relative animate-bob rounded-2xl bg-amber px-4 py-2 text-xl leading-snug font-bold text-ink shadow-md ${className}`}>
      <span
        aria-hidden="true"
        className={`absolute size-4 rotate-45 bg-amber ${point === "left" ? "bottom-5 -left-2" : "-bottom-2 left-1/2 -translate-x-1/2"}`}
      />
      <span className="relative">{children}</span>
    </div>
  );
}
