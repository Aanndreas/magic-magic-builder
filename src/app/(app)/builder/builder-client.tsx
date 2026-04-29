"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { DeckRecommendation, MTGFormat } from "@/lib/supabase/types";
import { Search, TrendingUp, ShoppingCart, Trophy } from "lucide-react";

const FORMAT_LABELS: Record<string, string> = {
  commander: "Commander",
  standard: "Standard",
  pauper: "Pauper",
  modern: "Modern",
};

export default function BuilderClient() {
  const [format, setFormat] = useState<MTGFormat>("commander");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRec, setSelectedRec] = useState<DeckRecommendation | null>(null);

  const { data: recommendations, isLoading, error } = useQuery<DeckRecommendation[]>({
    queryKey: ["recommendations", format, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ format });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/recommendations?${params}`);
      if (!res.ok) throw new Error("Kunde inte hämta rekommendationer");
      return res.json();
    },
  });

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => setDebouncedSearch(val), 400);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lek-byggaren</h1>
        <p className="text-muted-foreground mt-1">
          Jämför din samling mot meta-lekar och se vad du behöver köpa
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={format} onValueChange={(v) => setFormat(v as MTGFormat)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FORMAT_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sök efter lektyp (t.ex. 'spider', 'storm', 'control')..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          Hämtar meta-lekar och jämför med din samling...
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">
          {(error as Error).message}
        </div>
      )}

      {recommendations && recommendations.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          Inga meta-lekar hittades. Meta-databasen kan behöva uppdateras.
        </div>
      )}

      {recommendations && recommendations.length > 0 && !selectedRec && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((rec) => (
            <Card
              key={rec.metaDeck.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedRec(rec)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{rec.metaDeck.deck_name}</CardTitle>
                  <Badge variant={rec.coveragePercent >= 70 ? "default" : rec.coveragePercent >= 40 ? "secondary" : "outline"}>
                    {rec.coveragePercent}%
                  </Badge>
                </div>
                <CardDescription className="capitalize">{rec.metaDeck.format} · {rec.metaDeck.source}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={rec.coveragePercent} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{rec.alreadyHaveCount}/{rec.totalCards} kort</span>
                  {rec.metaDeck.popularity && <span>{rec.metaDeck.popularity} spelare</span>}
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-600 font-medium">
                    Billig uppgradering: ${rec.budgetUpgrade.totalCost.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-muted-foreground">
                    Full: ${rec.fullNetdeck.totalCost.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedRec && (
        <RecommendationDetail rec={selectedRec} onBack={() => setSelectedRec(null)} />
      )}
    </div>
  );
}

function RecommendationDetail({ rec, onBack }: { rec: DeckRecommendation; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>← Tillbaka</Button>
        <div>
          <h2 className="text-2xl font-bold">{rec.metaDeck.deck_name}</h2>
          <p className="text-muted-foreground text-sm capitalize">
            {rec.metaDeck.format} · Källa: {rec.metaDeck.source}
            {rec.metaDeck.source_url && (
              <a href={rec.metaDeck.source_url} target="_blank" rel="noopener noreferrer" className="ml-2 underline">
                Se originalleken ↗
              </a>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-green-600">{rec.coveragePercent}%</div>
            <div className="text-xs text-muted-foreground mt-1">Täckning</div>
            <div className="text-sm mt-0.5">{rec.alreadyHaveCount}/{rec.totalCards} kort</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-blue-600">${rec.budgetUpgrade.totalCost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">Billig uppgradering</div>
            <div className="text-sm mt-0.5">→ {rec.budgetUpgrade.newCoveragePercent}% täckning</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold">${rec.fullNetdeck.totalCost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">Full netdeck</div>
            <div className="text-sm mt-0.5">{rec.fullNetdeck.cards.length} saknade kort</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="have">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="have" className="gap-2">
            <Trophy className="w-3.5 h-3.5" /> Har redan ({rec.alreadyHave.length})
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> Billig uppgradering ({rec.budgetUpgrade.cards.length})
          </TabsTrigger>
          <TabsTrigger value="full" className="gap-2">
            <ShoppingCart className="w-3.5 h-3.5" /> Full netdeck ({rec.fullNetdeck.cards.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="have" className="mt-4">
          <CardList cards={rec.alreadyHave} emptyText="Du saknar alla kort i den här leken." showPrice={false} />
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md text-sm">
            Dessa kort kostar tillsammans <strong>${rec.budgetUpgrade.totalCost.toFixed(2)}</strong> och
            ökar din täckning från <strong>{rec.coveragePercent}%</strong> till <strong>{rec.budgetUpgrade.newCoveragePercent}%</strong>.
          </div>
          <CardList cards={rec.budgetUpgrade.cards} emptyText="Inga billiga uppgraderingar tillgängliga." showPrice />
        </TabsContent>

        <TabsContent value="full" className="mt-4">
          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950 rounded-md text-sm">
            Köp alla dessa <strong>{rec.fullNetdeck.cards.length} kort</strong> för att kopiera
            leken exakt. Total kostnad: <strong>${rec.fullNetdeck.totalCost.toFixed(2)}</strong>.
          </div>
          <CardList cards={rec.fullNetdeck.cards} emptyText="Du har alla kort! Leken är klar." showPrice />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CardList({ cards, emptyText, showPrice }: {
  cards: Array<{ name: string; quantity: number; price_usd?: number }>;
  emptyText: string;
  showPrice: boolean;
}) {
  if (cards.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="rounded-md border divide-y">
      {cards.map((card, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-8 justify-center text-xs">{card.quantity}x</Badge>
            <span className="text-sm font-medium">{card.name}</span>
          </div>
          {showPrice && card.price_usd !== undefined && (
            <span className="text-sm text-muted-foreground">
              ${(card.price_usd * card.quantity).toFixed(2)}
            </span>
          )}
        </div>
      ))}
      {showPrice && (
        <>
          <Separator />
          <div className="flex justify-between px-4 py-2.5 font-medium text-sm">
            <span>Totalt</span>
            <span>${cards.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0).toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}
