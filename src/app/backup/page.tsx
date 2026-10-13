import { BackupDownload } from "./BackupDownload";

/**
 * Staff page, opened on each Chromebook: downloads this device's backup of
 * every session played on it. The file is encrypted (only the researcher's
 * private key can read it), so it is safe to carry on a USB stick or email.
 */
export default function BackupPage() {
  return <BackupDownload />;
}

export const metadata = { title: "bugHunters backup" };
