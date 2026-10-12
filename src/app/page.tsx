import { StartFlow } from "@/components/StartFlow";
import { readStudySettings } from "@/config/study";

export const dynamic = "force-dynamic";

export default function Home() {
  return <StartFlow periods={readStudySettings().periods} />;
}
