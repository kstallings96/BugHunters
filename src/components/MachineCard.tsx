"use client";

import type { FormEvent } from "react";
import type { Inputs, Machine, Output } from "@/machines";

/**
 * One AI-built machine: name, purpose, client note, the AI's confident
 * badge, inputs, Try it, and the output. Inputs are plain text fields (not
 * type="number", which would block letters and empty values).
 */
export function MachineCard({
  machine,
  values,
  onChange,
  onTry,
  output,
  disabled = false,
  highlightField,
}: {
  machine: Machine;
  values: Inputs;
  onChange: (values: Inputs) => void;
  onTry: () => void;
  output: Output | null;
  disabled?: boolean;
  /** Draws attention to one input (tutorial). */
  highlightField?: string;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!disabled) onTry();
  }

  return (
    <section className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-3xl border-4 border-ink bg-white p-5 shadow-[6px_6px_0_var(--ink)]">
      <div className="flex items-start gap-3">
        <span className="text-5xl leading-none" aria-hidden="true">
          {machine.icon}
        </span>
        <div className="flex-1">
          <h2 className="text-3xl font-bold">{machine.name}</h2>
          <p className="text-xl">{machine.purpose}</p>
        </div>
      </div>

      {machine.request && (
        <p className="rounded-2xl bg-amber-soft px-4 py-2 text-lg leading-snug">
          <span className="font-bold">📝 Request:</span> &ldquo;
          {machine.request}&rdquo;
        </p>
      )}
      {machine.clientNote && (
        <p className="rounded-2xl bg-amber-soft px-4 py-2 text-lg leading-snug">
          📌 {machine.clientNote}
        </p>
      )}
      {machine.hint && (
        <p className="rounded-2xl border-2 border-dashed border-teal bg-teal/5 px-4 py-2 text-lg font-bold">
          💡 Hint: {machine.hint}
        </p>
      )}

      <p className="self-start rounded-full border-2 border-teal/40 bg-teal/5 px-4 py-1 text-base font-bold text-teal">
        ✅ Built and tested by AI.
      </p>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        {machine.fields.map((f) => (
          <label key={f.id} className="flex flex-col gap-1">
            <span className="text-lg font-bold text-ink-soft">{f.label}</span>
            {f.kind === "select" ? (
              <select
                value={values[f.id] ?? ""}
                onChange={(e) =>
                  onChange({ ...values, [f.id]: e.target.value })
                }
                className="h-14 min-w-36 rounded-2xl border-4 border-line bg-white px-3 text-xl font-bold outline-none focus:border-teal"
              >
                {f.options!.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                inputMode={f.kind === "number" ? "decimal" : "text"}
                autoComplete="off"
                spellCheck={false}
                value={values[f.id] ?? ""}
                onChange={(e) =>
                  onChange({ ...values, [f.id]: e.target.value })
                }
                className={`h-14 rounded-2xl border-4 bg-white px-4 text-2xl font-bold outline-none focus:border-teal ${
                  f.kind === "number" ? "w-40" : "w-80"
                } ${highlightField === f.id ? "border-amber ring-4 ring-amber/40" : "border-line"}`}
              />
            )}
          </label>
        ))}
        <button
          type="submit"
          disabled={disabled}
          className="h-14 rounded-2xl border-b-4 border-teal-dark bg-teal px-8 text-xl font-bold text-white shadow-sm active:translate-y-0.5 active:border-b-2 disabled:opacity-50"
        >
          Try it ▶
        </button>
      </form>

      {machine.display === "jersey" && output?.type === "result" ? (
        <Jersey name={output.text} />
      ) : (
        <div
          className="flex min-h-20 max-w-[36rem] items-center rounded-2xl border-4 border-dashed border-line bg-paper px-5"
          aria-live="polite"
        >
          {output ? (
            // whitespace-pre keeps every space the machine printed, and a very
            // long greeting is allowed to run off the edge: both are bugs
            // students should be able to see.
            <p
              className={`text-3xl font-bold whitespace-pre ${output.type === "not_allowed" ? "text-danger" : ""}`}
            >
              {output.text}
            </p>
          ) : (
            <p className="text-xl text-ink-soft">The answer shows up here.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** Starting values for a machine's fields (selects start on their first option). */
export function blankInputs(machine: Machine): Inputs {
  return Object.fromEntries(
    machine.fields.map((f) => [
      f.id,
      f.kind === "select" ? f.options![0].value : "",
    ]),
  );
}

/**
 * The name printed across the back of a jersey. The lettering band is
 * exactly 12 monospace characters wide (the request's limit), so a 13th
 * letter visibly runs off the shirt, and printed spaces stay visible.
 */
export function Jersey({ name }: { name: string }) {
  return (
    <div
      className="flex justify-center py-1"
      aria-live="polite"
      aria-label={name.trim() ? `Jersey reads ${name}` : "Blank jersey"}
    >
      <div className="relative h-44 w-72">
        <svg
          viewBox="0 0 288 176"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            d="M96 4 L124 4 Q144 22 164 4 L192 4 L276 40 L256 92 L222 78 L222 172 L66 172 L66 78 L32 92 L12 40 Z"
            fill="#0f766e"
            stroke="#0b5a54"
            strokeWidth="4"
          />
        </svg>
        {/* 12 characters span the shirt from sleeve to sleeve (x 12–276 of
            288), so a 13th character prints past the edge. */}
        <p className="absolute top-10 left-3 overflow-visible font-mono text-[2.5rem] leading-none font-bold whitespace-pre text-white">
          {name}
        </p>
        <p
          className="absolute inset-x-0 top-24 text-center font-mono text-5xl font-bold text-white"
          aria-hidden="true"
        >
          10
        </p>
      </div>
    </div>
  );
}
