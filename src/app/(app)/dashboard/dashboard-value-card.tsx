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
    <div className="rounded-xl border border-border/60 border-t-2 border-t-emerald-500/50 bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Samlingsvärde</span>
        <DollarSign className="w-4 h-4 text-primary/60" />
      </div>

      {!hasCards ? (
        <>
          <div className="text-3xl font-bold text-muted-foreground/40">—</div>
          <div className="text-xs text-muted-foreground mt-0.5">Inga kort ännu</div>
        </>
      ) : data ? (
        <>
          <div className="text-3xl font-bold text-primary">${data.totalValue.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">USD · Scryfall-priser</div>
        </>
      ) : (
        <>
          <div className="h-8 w-24 rounded skeleton mb-1" />
          <div className="h-3 w-16 rounded skeleton" />
        </>
      )}
    </div>
  );
}
