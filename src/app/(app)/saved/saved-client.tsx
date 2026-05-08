"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, ShoppingCart, Trophy, TrendingUp, ExternalLink } from "lucide-react";
import type { SavedRecommendation } from "@/lib/supabase/types";

type DeckCard = { name: string; quantity: number; price_usd?: number };
type Currency = "USD" | "SEK";
const SEK_RATE = 10.5;

function formatPrice(usd: number, currency: Currency): string {
  if (currency === "SEK") return `${(usd * SEK_RATE).toFixed(0)} kr`;
  return `$${usd.toFixed(2)}`;
}

function toCards(json: unknown): DeckCard[] {
  if (!Array.isArray(json)) return [];
  return json as DeckCard[];
}

interface Props {
  initialSaved: SavedRecommendation[];
}

export default function SavedClient({ initialSaved }: Props) {
  const [saved,    setSaved]    = useState(initialSaved);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [selected, setSelected] = useState<SavedRecommendation | null>(null);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/saved-recommendations?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Kunde inte ta bort leken"); return; }
    setSaved((prev) => prev.filter((s) => s.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success("Lek borttagen");
  }

  if (selected) {
    const alreadyHave  = toCards(selected.already_have);
    const budget       = toCards(selected.cards_to_buy_budget);
    const full         = toCards(selected.cards_to_buy_full);
    const budgetTotal  = budget.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0);
    const fullTotal    = full.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0);

    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="text-muted-foreground">
            ← Tillbaka
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{selected.deck_name}</h2>
            <p className="text-muted-foreground text-xs capitalize">{selected.format}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrency(currency === "USD" ? "SEK" : "USD")} className="text-xs">
            {currency === "USD" ? "$ USD" : "kr SEK"}
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => handleDelete(selected.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <div className="text-3xl font-bold text-emerald-400">{alreadyHave.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Kort du har</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <div className="text-3xl font-bold text-primary">{formatPrice(budgetTotal, currency)}</div>
            <div className="text-xs text-muted-foreground mt-1">Budget-uppgradering</div>
            <div className="text-xs mt-0.5">{budget.length} kort</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <div className="text-3xl font-bold">{formatPrice(fullTotal, currency)}</div>
            <div className="text-xs text-muted-foreground mt-1">Full netdeck</div>
            <div className="text-xs mt-0.5">{full.length} kort</div>
          </div>
        </div>

        <Tabs defaultValue="budget">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50">
            <TabsTrigger value="have" className="gap-1.5 text-xs">
              <Trophy className="w-3.5 h-3.5" /> Har ({alreadyHave.length})
            </TabsTrigger>
            <TabsTrigger value="budget" className="gap-1.5 text-xs">
              <TrendingUp className="w-3.5 h-3.5" /> Budget ({budget.length})
            </TabsTrigger>
            <TabsTrigger value="full" className="gap-1.5 text-xs">
              <ShoppingCart className="w-3.5 h-3.5" /> Full ({full.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="have" className="mt-4">
            <CardList cards={alreadyHave} emptyText="Inga kort sparade." showPrice={false} currency={currency} />
          </TabsContent>
          <TabsContent value="budget" className="mt-4">
            <CardList cards={budget} emptyText="Inga budget-kort sparade." showPrice currency={currency} />
          </TabsContent>
          <TabsContent value="full" className="mt-4">
            <CardList cards={full} emptyText="Inga kort att köpa." showPrice currency={currency} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Sparade lekar</h1>
          <p className="text-muted-foreground mt-1 text-sm">Dina sparade lek-jämförelser</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrency(currency === "USD" ? "SEK" : "USD")}
          className="flex-shrink-0 mt-1 text-xs"
        >
          {currency === "USD" ? "$ USD" : "kr SEK"}
        </Button>
      </div>

      {saved.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          Du har inga sparade lekar ännu.{" "}
          <a href="/builder" className="text-primary hover:underline">Gå till Lek-byggaren</a> och spara en jämförelse.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {saved.map((s) => {
            const budget      = toCards(s.cards_to_buy_budget);
            const budgetTotal = budget.reduce((sum, c) => sum + (c.price_usd ?? 0) * c.quantity, 0);
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border/60 bg-card p-4 cursor-pointer card-hover-glow transition-all duration-200"
                onClick={() => setSelected(s)}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="font-semibold text-sm leading-tight">{s.deck_name}</p>
                  <Badge variant="secondary" className="capitalize text-xs shrink-0">{s.format}</Badge>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Budget-köp</span>
                    <span className="font-semibold text-primary">{formatPrice(budgetTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Antal att köpa</span>
                    <span>{budget.length} kort</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sparat</span>
                    <span>{new Date(s.created_at).toLocaleDateString("sv-SE")}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 mt-3 h-7 text-xs gap-1"
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                >
                  <Trash2 className="w-3 h-3" /> Ta bort
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardList({ cards, emptyText, showPrice, currency }: {
  cards: DeckCard[];
  emptyText: string;
  showPrice: boolean;
  currency: Currency;
}) {
  if (cards.length === 0) return <p className="text-center py-8 text-muted-foreground text-sm">{emptyText}</p>;

  return (
    <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
      {cards.map((card, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-8 justify-center text-xs shrink-0">{card.quantity}x</Badge>
            <span className="text-sm font-medium">{card.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {showPrice && card.price_usd !== undefined && (
              <span className="text-xs text-muted-foreground">
                {formatPrice(card.price_usd * card.quantity, currency)}
              </span>
            )}
            {showPrice && (
              <a
                href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ))}
      {showPrice && (
        <>
          <Separator className="bg-border/60" />
          <div className="flex justify-between px-4 py-2.5 font-semibold text-sm bg-muted/20">
            <span>Totalt</span>
            <span className="text-primary">
              {formatPrice(cards.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0), currency)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
