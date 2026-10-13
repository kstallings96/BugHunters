import { StartFlow } from "@/components/StartFlow";
import { readStudySettings } from "@/config/study";

export const dynamic = "force-dynamic";

export default function Home() {
  // The public key can only encrypt; it's safe in the page (device backups use it).
  return <StartFlow periods={readStudySettings().periods} publicKey={process.env.NAMES_PUBLIC_KEY?.trim() || null} />;
}
