"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface ValueData {
  totalValue: number;
  cardCount: number;
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
    <Card>
      <CardContent className="pt-4">
        {!hasCards ? (
          <>
            <div className="text-3xl font-bold text-muted-foreground">—</div>
            <div className="text-xs text-muted-foreground mt-0.5">Samlingsvärde</div>
          </>
        ) : data ? (
          <>
            <div className="text-3xl font-bold text-green-600">${data.totalValue.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Samlingsvärde</div>
            <div className="text-xs text-muted-foreground">USD · Scryfall-priser</div>
          </>
        ) : (
          <>
            <div className="text-3xl font-bold text-muted-foreground animate-pulse">...</div>
            <div className="text-xs text-muted-foreground mt-0.5">Samlingsvärde</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
