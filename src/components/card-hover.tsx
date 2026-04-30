"use client";

import { useState, useRef, useCallback } from "react";

// Module-level cache persists across renders in the same session
const imageCache = new Map<string, string | null>();

export function CardHover({ name, children }: { name: string; children: React.ReactNode }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMove = useCallback((e: React.MouseEvent) => {
    setPos({ x: e.clientX + 18, y: e.clientY - 60 });
  }, []);

  async function handleEnter(e: React.MouseEvent) {
    setPos({ x: e.clientX + 18, y: e.clientY - 60 });
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setVisible(true);
      if (imageCache.has(name)) {
        setImageUrl(imageCache.get(name) ?? null);
        return;
      }
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`
        );
        if (!res.ok) { imageCache.set(name, null); return; }
        const data = await res.json();
        const url =
          data.image_uris?.normal ??
          data.card_faces?.[0]?.image_uris?.normal ??
          null;
        imageCache.set(name, url);
        setImageUrl(url);
      } catch {
        imageCache.set(name, null);
      }
    }, 250);
  }

  function handleLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }

  return (
    <span
      className="cursor-default"
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
      {visible && imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          className="fixed z-50 pointer-events-none w-48 rounded-xl shadow-2xl border border-border"
          style={{ left: pos.x, top: pos.y }}
        />
      )}
    </span>
  );
}
