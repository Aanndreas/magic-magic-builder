"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/contexts/currency-context";
import type { SavedRecommendation } from "@/lib/supabase/types";

type DeckCard = { price_usd?: number; quantity: number };

export function DashboardSavedCard({ s }: { s: SavedRecommendation }) {
  const { formatPrice } = useCurrency();
  const budget = Array.isArray(s.cards_to_buy_budget)
    ? s.cards_to_buy_budget as DeckCard[]
    : [];
  const cost = budget.reduce((sum, c) => sum + (c.price_usd ?? 0) * c.quantity, 0);
  return (
    <Link href="/saved">
      <div className="rounded-xl border border-border/60 bg-card p-4 cursor-pointer card-hover-glow transition-all duration-200">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium leading-tight">{s.deck_name}</p>
          <Badge variant="secondary" className="capitalize text-xs shrink-0">{s.format}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Budget: <span className="text-primary font-medium">{formatPrice(cost)}</span> · {budget.length} kort att köpa
        </p>
      </div>
    </Link>
  );
}
