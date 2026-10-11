"use client";

import { GLITCH_APPS } from "@/apps";
import type { Form } from "@/lib/types";

export function LabFrame({ form }: { form: Form }) {
  const App = GLITCH_APPS[form]!;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="h-[34rem] w-full max-w-4xl overflow-hidden rounded-3xl border-4 border-ink shadow-xl">
        <App onAppEvent={(type, payload) => console.info("app_event", type, payload)} />
      </div>
    </main>
  );
}
