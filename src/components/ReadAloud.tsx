"use client";

import { useEffect, useState } from "react";
import { logEvent } from "@/lib/logger";
import { SpeakerIcon, StopIcon } from "./icons";

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-US" && /natural|google/i.test(v.name)) ??
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en"))
  );
}

/**
 * Speaker button that reads a block of text aloud (Web Speech API). Every
 * block of text in the game gets one. `id` names the block in the log.
 */
export function ReadAloud({ id, text, className = "" }: { id: string; text: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    // Feature detection has to wait for the browser; the server can't know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported("speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      logEvent("readaloud", { id, action: "stop" });
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
    logEvent("readaloud", { id, action: "play", chars: text.length });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={speaking ? "Stop reading" : "Read aloud"}
      title={speaking ? "Stop" : "Read aloud"}
      className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-teal bg-card text-teal shadow-sm active:scale-95 ${speaking ? "bg-teal text-white" : ""} ${className}`}
    >
      {speaking ? <StopIcon size={26} /> : <SpeakerIcon size={30} />}
    </button>
  );
}
