import { SPACE_MARK } from "@/lib/clean";

/** One visible space: a small dashed box (the ␣ character is too faint in this font). */
export function SpaceBox() {
  return <span aria-label="space" className="mx-px inline-block h-[0.8em] w-[0.5em] rounded-sm border-2 border-dashed border-ink-soft/70 align-[-0.05em]" />;
}

/** Text from shownText(), with each ␣ drawn as a SpaceBox. */
export function Spaced({ children }: { children: string }) {
  const parts = children.split(SPACE_MARK);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <SpaceBox />}
          {p}
        </span>
      ))}
    </>
  );
}
