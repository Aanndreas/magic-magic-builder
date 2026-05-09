"use client";

import { useState, useRef, useCallback } from "react";

const imageCache = new Map<string, string | null>();

interface CardHoverProps {
  name: string;
  scryfallId?: string;
  children: React.ReactNode;
}

export function CardHover({ name, scryfallId, children }: CardHoverProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pos, setPos]           = useState({ x: 0, y: 0 });
  const [visible, setVisible]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cacheKey = scryfallId ?? name;

  function clamp(x: number, y: number) {
    const W = typeof window !== "undefined" ? window.innerWidth  : 1200;
    const H = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      x: Math.min(Math.max(x, 8), W - 232),
      y: Math.min(Math.max(y, 8), H - 320),
    };
  }

  const fetchImage = useCallback(async () => {
    const ckey = scryfallId ?? name;
    if (imageCache.has(ckey)) {
      const cached = imageCache.get(ckey) ?? null;
      setImageUrl(cached);
      setVisible(true);
      return;
    }
    setVisible(true);
    try {
      const url = scryfallId
        ? `https://api.scryfall.com/cards/${scryfallId}`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
      const res  = await fetch(url);
      if (!res.ok) { imageCache.set(ckey, null); return; }
      const data = await res.json();
      const img  = data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null;
      imageCache.set(ckey, img);
      setImageUrl(img);
    } catch {
      imageCache.set(ckey, null);
    }
  }, [name, scryfallId]);

  // ── Desktop ──────────────────────────────────────────────────────────────

  const handleMove = useCallback((e: React.MouseEvent) => {
    setPos(clamp(e.clientX + 20, e.clientY - 80));
  }, []);

  function handleEnter(e: React.MouseEvent) {
    if (hideRef.current) clearTimeout(hideRef.current);
    setPos(clamp(e.clientX + 20, e.clientY - 80));
    timerRef.current = setTimeout(fetchImage, 220);
  }

  function handleLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoaded(false);
    setVisible(false);
  }

  // ── Mobile long-press ────────────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent) {
    if (hideRef.current) clearTimeout(hideRef.current);
    const t = e.touches[0];
    setPos(clamp(t.clientX - 112, t.clientY - 350));
    timerRef.current = setTimeout(fetchImage, 500);
  }

  function handleTouchEnd() {
    if (timerRef.current) clearTimeout(timerRef.current);
    hideRef.current = setTimeout(() => {
      setLoaded(false);
      setVisible(false);
    }, 900);
  }

  return (
    <span
      className="cursor-default"
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {children}
      {visible && imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          onLoad={() => setLoaded(true)}
          className="fixed z-50 pointer-events-none w-56 rounded-xl shadow-2xl border border-white/10 transition-all duration-200 ease-out"
          style={{
            left: pos.x,
            top: pos.y,
            opacity: loaded ? 1 : 0,
            transform: loaded ? "scale(1) translateY(0)" : "scale(0.94) translateY(6px)",
          }}
        />
      )}
    </span>
  );
}
