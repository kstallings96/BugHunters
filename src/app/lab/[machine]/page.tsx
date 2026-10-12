import { notFound } from "next/navigation";
import { MACHINES, type MachineId } from "@/machines";
import { MachineLab } from "./MachineLab";

/**
 * Staff tool: one machine with its scoring shown (categories, buggy vs
 * reference, verdict). Nothing here is logged. /lab/pizza, /lab/grade, ...
 */
export default async function LabPage({ params }: PageProps<"/lab/[machine]">) {
  const { machine } = await params;
  if (!(machine in MACHINES)) notFound();
  return <MachineLab id={machine as MachineId} />;
}

export const metadata = { title: "bugHunters lab" };
