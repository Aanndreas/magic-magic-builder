"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface RiffleLoaderProps {
  text?: string;
  className?: string;
}

const KEYFRAMES = `
@keyframes riffle-a {
  0%,100% { transform: translate(0px, 0px) rotate(0deg); z-index: 1; }
  20%      { transform: translate(-4px, -28px) rotate(-6deg); z-index: 10; }
  50%      { transform: translate(44px, -12px) rotate(4deg); z-index: 10; }
  80%      { transform: translate(48px, 0px) rotate(0deg); z-index: 1; }
}
@keyframes riffle-b {
  0%,100% { transform: translate(48px, 0px) rotate(0deg); z-index: 1; }
  20%      { transform: translate(52px, -28px) rotate(6deg); z-index: 10; }
  50%      { transform: translate(4px, -12px) rotate(-4deg); z-index: 10; }
  80%      { transform: translate(0px, 0px) rotate(0deg); z-index: 1; }
}
`;

function playRiffleSound() {
  try {
    const ctx = new AudioContext();
    const rate = ctx.sampleRate;
    const dur = 0.75;
    const buf = ctx.createBuffer(1, rate * dur, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const env = [0,1,2,3,4,5,6,7]
        .map((k) => Math.exp(-((t - (k + 0.5) / 8 * dur) ** 2) * 900))
        .reduce((a, b) => a + b, 0);
      data[i] = (Math.random() * 2 - 1) * env * 0.22;
    }
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 2400;
    filt.Q.value = 0.9;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(filt);
    filt.connect(ctx.destination);
    src.start();
  } catch {
    // silent fallback
  }
}

const CARD_BACK = `
  repeating-linear-gradient(
    45deg,
    oklch(0.28 0.06 268) 0px,
    oklch(0.28 0.06 268) 3px,
    oklch(0.22 0.04 268) 3px,
    oklch(0.22 0.04 268) 6px
  )
`;

export function RiffleLoader({ text = "Laddar...", className }: RiffleLoaderProps) {
  useEffect(() => {
    playRiffleSound();
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-5 py-8", className)}>
      <style>{KEYFRAMES}</style>

      <div className="relative" style={{ width: 96, height: 72 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={`a${i}`}
            style={{
              position: "absolute",
              width: 44,
              height: 60,
              top: i * 2,
              left: i * 1,
              borderRadius: 3,
              border: "1.5px solid oklch(0.76 0.14 75 / 0.55)",
              background: CARD_BACK,
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
              animation: `riffle-a 1.8s ease-in-out ${i * 0.12}s infinite`,
            }}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={`b${i}`}
            style={{
              position: "absolute",
              width: 44,
              height: 60,
              top: i * 2,
              left: 48 + i * 1,
              borderRadius: 3,
              border: "1.5px solid oklch(0.76 0.14 75 / 0.55)",
              background: CARD_BACK,
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
              animation: `riffle-b 1.8s ease-in-out ${i * 0.12 + 0.9}s infinite`,
            }}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
    </div>
  );
}

export default RiffleLoader;
