"use client";

import type { ReactNode } from "react";
import type { Step } from "@/lib/types";
import { BugIcon, MagnifierIcon } from "../icons";

const STEPS: { step: Step; icon: string; label: string }[] = [
  { step: "meet", icon: "👋", label: "Meet" },
  { step: "card", icon: "📝", label: "Plan" },
  { step: "hunt", icon: "🔍", label: "Hunt" },
  { step: "done", icon: "✋", label: "Stop" },
  { step: "reveal", icon: "🗺️", label: "Map" },
  { step: "fix", icon: "🔧", label: "Fix" },
];

export function GameHeader({ step }: { step: Step }) {
  const at = STEPS.findIndex((s) => s.step === step);
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-line bg-card px-5">
      <div className="flex items-center gap-2 text-teal">
        <MagnifierIcon size={28} />
        <span className="text-xl font-bold text-ink">
          bug<span className="text-teal">Hunters</span>
        </span>
        <BugIcon size={24} className="text-amber" />
      </div>
      {at >= 0 && (
        <ol className="flex items-center gap-1" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li
              key={s.step}
              aria-current={i === at ? "step" : undefined}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
                i === at ? "bg-teal text-white" : i < at ? "text-teal" : "text-ink-soft/60"
              }`}
            >
              <span aria-hidden="true">{s.icon}</span>
              <span className="hidden lg:inline">{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="w-40" aria-hidden="true" />
    </header>
  );
}

export function Modal({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="max-h-full w-full max-w-2xl overflow-auto rounded-3xl border-4 border-teal bg-card p-6 shadow-2xl">{children}</div>
    </div>
  );
}

/** A large tappable option with an emoji, used in dialogs and the done step. */
export function OptionButton({
  icon,
  children,
  onClick,
  selected = false,
}: {
  icon: string;
  children: ReactNode;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border-4 px-5 py-2 text-left text-xl font-bold transition active:scale-[0.98] ${
        selected ? "border-teal bg-teal text-white" : "border-line bg-white hover:border-teal"
      }`}
    >
      <span className="text-3xl" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </button>
  );
}
