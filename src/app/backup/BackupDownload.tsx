"use client";

import { useEffect, useState } from "react";
import { BigButton, Card } from "@/components/ui";
import { deviceBackups } from "@/lib/backup";

export function BackupDownload() {
  const [info, setInfo] = useState<{ sessions: number; chunks: number; file: string } | null>(null);

  useEffect(() => {
    // Reads this device's localStorage, which only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo(deviceBackups());
  }, []);

  function download() {
    if (!info) return;
    const url = URL.createObjectURL(new Blob([info.file], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bughunters-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-8">
      <Card className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Device backup (staff)</h1>
        {info === null ? (
          <p className="text-xl">Checking this device…</p>
        ) : (
          <>
            <p className="text-xl">
              This Chromebook has a backup of <b>{info.sessions}</b> {info.sessions === 1 ? "session" : "sessions"} ({info.chunks} parts).
            </p>
            <p className="text-lg text-ink-soft">
              The file is encrypted: only the researcher&apos;s key can open it. Bring it back and run <code>npm run pull -- --backup &lt;file&gt;</code>.
            </p>
            <BigButton onClick={download} disabled={info.chunks === 0} className="self-start">
              Download backup file
            </BigButton>
          </>
        )}
      </Card>
    </main>
  );
}
