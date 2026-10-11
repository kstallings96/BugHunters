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

/** A line of instruction with its read-aloud button. */
export function Say({ id, text, as = "p", className = "" }: { id: string; text: string; as?: "p" | "h1" | "h2"; className?: string }) {
  const Tag = as;
  const size = as === "h1" ? "text-4xl font-bold" : as === "h2" ? "text-2xl font-bold" : "text-xl";
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <Tag className={`${size} leading-snug`}>{text}</Tag>
      <ReadAloud id={id} text={text} />
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border-2 border-line bg-card p-6 shadow-sm sm:p-8 ${className}`}>{children}</div>;
}
