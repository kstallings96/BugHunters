import type { ButtonHTMLAttributes, ReactNode } from "react";

export function BigButton({
  children,
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const look = {
    primary: "bg-teal text-white border-teal-dark hover:bg-teal-dark disabled:bg-ink-soft/40 disabled:border-transparent",
    secondary: "bg-card text-teal border-teal hover:bg-amber-soft disabled:opacity-50",
    danger: "bg-danger text-white border-[#8a1a12] disabled:bg-ink-soft/40 disabled:border-transparent",
  }[variant];
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

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border-2 border-line bg-card p-6 shadow-sm sm:p-8 ${className}`}>{children}</div>;
}

export function Modal({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded-3xl border-4 border-teal bg-card p-6 shadow-2xl">{children}</div>
    </div>
  );
}

/** A large tappable choice with an optional emoji. */
export function OptionButton({
  icon,
  children,
  onClick,
  selected = false,
}: {
  icon?: string;
  children: ReactNode;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border-4 px-5 py-2 text-left text-xl font-bold transition active:scale-[0.99] ${
        selected ? "border-teal bg-teal text-white" : "border-line bg-white hover:border-teal"
      }`}
    >
      {icon && (
        <span className="shrink-0 text-3xl" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}
