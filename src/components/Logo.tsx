/**
 * The bugHunters mascot: a little bug caught under a magnifying glass.
 * Same drawing as src/app/icon.svg (the browser tab icon).
 */
export function BugMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 180" className={className} aria-hidden="true">
      <line x1="122" y1="132" x2="156" y2="172" stroke="#0b5a54" strokeWidth="14" strokeLinecap="round" />
      <circle cx="84" cy="94" r="58" fill="#ffffff" stroke="#0f766e" strokeWidth="12" />
      <line x1="74" y1="70" x2="64" y2="54" stroke="#1f2933" strokeWidth="3" strokeLinecap="round" />
      <line x1="94" y1="70" x2="104" y2="54" stroke="#1f2933" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="84" cy="104" rx="28" ry="30" fill="#f59e0b" stroke="#b45309" strokeWidth="3" />
      <line x1="84" y1="78" x2="84" y2="133" stroke="#b45309" strokeWidth="3" />
      <circle cx="72" cy="108" r="4" fill="#1f2933" />
      <circle cx="97" cy="114" r="4" fill="#1f2933" />
      <circle cx="74" cy="122" r="3" fill="#1f2933" />
      <circle cx="84" cy="76" r="14" fill="#1f2933" />
      <circle cx="79" cy="75" r="5" fill="#ffffff" />
      <circle cx="90" cy="75" r="5" fill="#ffffff" />
      <circle cx="80" cy="76" r="2.5" fill="#1f2933" />
      <circle cx="91" cy="76" r="2.5" fill="#1f2933" />
    </svg>
  );
}

/** Mascot plus the "bugHunters" wordmark. `size` picks the header or the big login version. */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <span className={`inline-flex shrink-0 items-center font-bold tracking-tight ${big ? "gap-3 text-5xl" : "gap-1.5 text-xl"}`}>
      <BugMark className={big ? "h-20 w-20" : "h-9 w-9"} />
      <span>
        bug<span className="text-teal">Hunters</span>
      </span>
    </span>
  );
}
