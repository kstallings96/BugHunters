import { notFound } from "next/navigation";
import { GLITCH_APPS } from "@/apps";
import type { Form } from "@/lib/types";
import { LabFrame } from "./LabFrame";

/**
 * A glitch app on its own, outside the game, for checking content and
 * glitches. Nothing here is logged. /lab/A
 */
export default async function LabPage({ params }: PageProps<"/lab/[form]">) {
  const { form } = await params;
  const id = form.toUpperCase() as Form;
  if (!GLITCH_APPS[id]) notFound();
  return <LabFrame form={id} />;
}

export const metadata = { title: "bugHunters lab" };
