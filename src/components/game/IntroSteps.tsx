"use client";

import type { FormContent } from "@/content/types";
import { ArrowIcon } from "../icons";
import { BigButton, Card, Say } from "../ui";

// ------------------------------------------------------------ 1. Meet

export function MeetStep({ form, onNext }: { form: FormContent; onNext: () => void }) {
  const { client } = form;
  const title = `An AI built an app for ${client.name}. Did it get it right?`;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-4">
      <Say
        id="meet.screen"
        as="h1"
        text={title}
        speak={`${title} ${client.name} says: ${form.requestText} ${form.glitchDefinition}`}
        className="text-3xl!"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.15fr_1fr]">
        <Card className="flex flex-col gap-3 p-5!">
          <div className="flex items-center gap-3">
            <span className="text-6xl leading-none" aria-hidden="true">
              {client.avatar}
            </span>
            <p className="flex-1 text-2xl font-bold">
              {client.name} <span className="text-lg font-normal text-ink-soft">· age {client.age}</span>
            </p>
          </div>
          <p className="rounded-2xl bg-amber-soft p-4 text-xl leading-relaxed">&ldquo;{form.requestText}&rdquo;</p>
        </Card>

        <Card className="flex flex-col gap-2 p-5!">
          <p className="text-xl font-bold">{client.name} asked for:</p>
          <ul className="flex flex-col gap-1.5">
            {form.requestItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl bg-paper px-3 py-1 text-lg font-bold">
                <span className="min-w-12 shrink-0 text-center text-2xl whitespace-nowrap" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-4 rounded-3xl border-4 border-amber bg-card px-4 py-3">
          <span className="text-4xl" aria-hidden="true">
            🐞
          </span>
          <p className="flex-1 text-xl font-bold">{form.glitchDefinition}</p>
        </div>
        <BigButton onClick={onNext}>
          Next <ArrowIcon />
        </BigButton>
      </div>
    </main>
  );
}
