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
import { toast } from "sonner";
import type { DeckRecommendation, MTGFormat } from "@/lib/supabase/types";
import { Search, TrendingUp, ShoppingCart, Trophy } from "lucide-react";
import ThemeBuilderClient from "./theme-builder-client";
import CommanderBuilderClient from "./commander-builder-client";

const FORMAT_LABELS: Record<string, string> = {
  commander: "Commander",
  standard: "Standard",
  pauper: "Pauper",
  modern: "Modern",
};

const THEME_SUGGESTIONS: Record<string, string[]> = {
  commander: ["Atraxa", "Zombies", "Dragons", "Elves", "Tokens", "Artifacts", "Superfriends", "Tribal"],
  standard: ["Control", "Aggro", "Midrange", "Burn", "Tokens", "Ramp"],
  modern: ["Burn", "Control", "Storm", "Tron", "Affinity", "Spirits"],
  pauper: ["Faeries", "Burn", "Stompy", "Flickers", "Elves", "Goblins"],
};

const SEK_RATE = 10.5;

type SortKey = "coverage" | "budgetCost" | "popularity";
type Currency = "USD" | "SEK";

function formatPrice(usd: number, currency: Currency): string {
  if (currency === "SEK") return `${(usd * SEK_RATE).toFixed(0)} kr`;
  return `$${usd.toFixed(2)}`;
}

export default function BuilderClient() {
  const [format, setFormat] = useState<MTGFormat>("commander");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRec, setSelectedRec] = useState<DeckRecommendation | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("coverage");
  const [currency, setCurrency] = useState<Currency>("USD");

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

  function handleThemeChip(theme: string) {
    setSearch(theme);
    setDebouncedSearch(theme);
  }

  const sorted = [...(recommendations ?? [])].sort((a, b) => {
    if (sortKey === "coverage") return b.coveragePercent - a.coveragePercent;
    if (sortKey === "budgetCost") return a.budgetUpgrade.totalCost - b.budgetUpgrade.totalCost;
    return (b.metaDeck.popularity ?? 0) - (a.metaDeck.popularity ?? 0);
  });

  async function handleSaveRec(rec: DeckRecommendation) {
    const res = await fetch("/api/saved-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: rec.metaDeck.format,
        deck_name: rec.metaDeck.deck_name,
        meta_deck_id: rec.metaDeck.id,
        already_have: rec.alreadyHave,
        cards_to_buy_budget: rec.budgetUpgrade.cards,
        cards_to_buy_full: rec.fullNetdeck.cards,
      }),
    });
    if (!res.ok) toast.error("Kunde inte spara leken");
    else toast.success("Lek sparad!");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Lek-byggaren</h1>
          <p className="text-muted-foreground mt-1">
            Jämför din samling mot meta-lekar och se vad du behöver köpa
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrency(currency === "USD" ? "SEK" : "USD")}
          className="flex-shrink-0 mt-1"
        >
          {currency === "USD" ? "$ USD" : "kr SEK"}
        </Button>
      </div>

      <Tabs defaultValue="meta">
        <TabsList>
          <TabsTrigger value="meta">Meta-lekar</TabsTrigger>
          <TabsTrigger value="commander">Commander-lek</TabsTrigger>
          <TabsTrigger value="theme">Bygg från tema</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="mt-4 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={format} onValueChange={(v) => { setFormat(v as MTGFormat); setSearch(""); setDebouncedSearch(""); }}>
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
                placeholder="Sök efter lektyp..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coverage">Sortera: Täckning %</SelectItem>
                <SelectItem value="budgetCost">Sortera: Billigaste köp</SelectItem>
                <SelectItem value="popularity">Sortera: Popularitet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme suggestion chips */}
          <div className="flex flex-wrap gap-2">
            {(THEME_SUGGESTIONS[format] ?? []).map((theme) => (
              <Badge
                key={theme}
                variant={search === theme ? "default" : "secondary"}
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => handleThemeChip(search === theme ? "" : theme)}
              >
                {theme}
              </Badge>
            ))}
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

          {sorted.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              Inga meta-lekar hittades. Prova ett annat sökord eller kör meta-uppdateringen.
            </div>
          )}

          {sorted.length > 0 && !selectedRec && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((rec) => (
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
                        Budget: {formatPrice(rec.budgetUpgrade.totalCost, currency)}
                      </span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-muted-foreground">
                        Full: {formatPrice(rec.fullNetdeck.totalCost, currency)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedRec && (
            <RecommendationDetail
              rec={selectedRec}
              onBack={() => setSelectedRec(null)}
              onSave={handleSaveRec}
              currency={currency}
            />
          )}
        </TabsContent>

        <TabsContent value="commander" className="mt-4">
          <CommanderBuilderClient />
        </TabsContent>

        <TabsContent value="theme" className="mt-4">
          <ThemeBuilderClient />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecommendationDetail({
  rec,
  onBack,
  onSave,
  currency,
}: {
  rec: DeckRecommendation;
  onBack: () => void;
  onSave: (rec: DeckRecommendation) => Promise<void>;
  currency: Currency;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(rec);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>← Tillbaka</Button>
        <div className="flex-1">
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
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || saved}>
          {saved ? "Sparad ✓" : saving ? "Sparar..." : "Spara lek"}
        </Button>
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
            <div className="text-3xl font-bold text-blue-600">{formatPrice(rec.budgetUpgrade.totalCost, currency)}</div>
            <div className="text-xs text-muted-foreground mt-1">Budget-uppgradering</div>
            <div className="text-sm mt-0.5">→ {rec.budgetUpgrade.newCoveragePercent}% täckning</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold">{formatPrice(rec.fullNetdeck.totalCost, currency)}</div>
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
            <TrendingUp className="w-3.5 h-3.5" /> Budget ({rec.budgetUpgrade.cards.length})
          </TabsTrigger>
          <TabsTrigger value="full" className="gap-2">
            <ShoppingCart className="w-3.5 h-3.5" /> Full netdeck ({rec.fullNetdeck.cards.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="have" className="mt-4">
          <CardList cards={rec.alreadyHave} emptyText="Du saknar alla kort i den här leken." showPrice={false} currency={currency} />
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md text-sm">
            Dessa kort kostar <strong>{formatPrice(rec.budgetUpgrade.totalCost, currency)}</strong> och
            ökar täckningen från <strong>{rec.coveragePercent}%</strong> till <strong>{rec.budgetUpgrade.newCoveragePercent}%</strong>.
          </div>
          <CardList cards={rec.budgetUpgrade.cards} emptyText="Inga billiga uppgraderingar tillgängliga." showPrice currency={currency} />
        </TabsContent>

        <TabsContent value="full" className="mt-4">
          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950 rounded-md text-sm">
            Köp alla <strong>{rec.fullNetdeck.cards.length} kort</strong> för att kopiera leken exakt.
            Total kostnad: <strong>{formatPrice(rec.fullNetdeck.totalCost, currency)}</strong>.
          </div>
          <CardList cards={rec.fullNetdeck.cards} emptyText="Du har alla kort! Leken är klar." showPrice currency={currency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CardList({ cards, emptyText, showPrice, currency }: {
  cards: Array<{ name: string; quantity: number; price_usd?: number }>;
  emptyText: string;
  showPrice: boolean;
  currency: Currency;
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
              {formatPrice(card.price_usd * card.quantity, currency)}
            </span>
          )}
        </div>
      ))}
      {showPrice && (
        <>
          <Separator />
          <div className="flex justify-between px-4 py-2.5 font-medium text-sm">
            <span>Totalt</span>
            <span>{formatPrice(cards.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0), currency)}</span>
          </div>
        </>
      )}
    </div>
  );
}
