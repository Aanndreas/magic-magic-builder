"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";

interface ValueData {
  totalValue: number;
  cardCount:  number;
}

export default function DashboardValueCard({ hasCards }: { hasCards: boolean }) {
  const [data, setData] = useState<ValueData | null>(null);

  useEffect(() => {
    if (!hasCards) return;
    fetch("/api/collection/value")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [hasCards]);

  return (
    <div className="rounded-xl border border-border/60 border-t-4 border-t-emerald-500/70 bg-card p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/8 blur-2xl -translate-y-6 translate-x-6" />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Samlingsvärde</span>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <DollarSign className="w-4.5 h-4.5 text-emerald-400" />
        </div>
      </div>

      {!hasCards ? (
        <>
          <div className="text-4xl font-black tabular-nums text-muted-foreground/40">—</div>
          <div className="text-xs text-muted-foreground mt-0.5">Inga kort ännu</div>
        </>
      ) : data ? (
        <>
          <div className="text-4xl font-black tabular-nums text-primary">${data.totalValue.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">USD · Scryfall-priser</div>
        </>
      ) : (
        <>
          <div className="h-9 w-24 rounded skeleton mb-1" />
          <div className="h-3 w-16 rounded skeleton" />
        </>
      )}
    </div>
  );
}
