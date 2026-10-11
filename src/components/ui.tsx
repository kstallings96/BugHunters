import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ReadAloud } from "./ReadAloud";

export function BigButton({
  children,
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const look =
    variant === "primary"
      ? "bg-teal text-white border-teal-dark hover:bg-teal-dark disabled:bg-ink-soft/40 disabled:border-transparent"
      : "bg-card text-teal border-teal hover:bg-amber-soft";
  return (
    <button
      type="button"
      className={`inline-flex min-h-16 items-center justify-center gap-3 rounded-2xl border-b-4 px-8 text-xl font-bold shadow-sm transition active:translate-y-0.5 active:border-b-2 disabled:cursor-not-allowed ${look} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * A line of text with a read-aloud button. Each screen gets one speaker, on
 * its main instruction; `speak` sets what it reads (often the whole screen),
 * and `speak={false}` shows the text with no button.
 */
export function Say({
  id,
  text,
  speak,
  as = "p",
  className = "",
}: {
  id: string;
  text: string;
  speak?: string | false;
  as?: "p" | "h1" | "h2";
  className?: string;
}) {
  const Tag = as;
  const size = as === "h1" ? "text-4xl font-bold" : as === "h2" ? "text-2xl font-bold" : "text-xl";
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <Tag className={`${size} leading-snug`}>{text}</Tag>
      {speak !== false && <ReadAloud id={id} text={speak ?? text} />}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border-2 border-line bg-card p-6 shadow-sm sm:p-8 ${className}`}>{children}</div>;
}
