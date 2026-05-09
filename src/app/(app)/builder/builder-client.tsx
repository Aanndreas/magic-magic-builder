"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { DeckRecommendation, MTGFormat } from "@/lib/supabase/types";
import { Search, TrendingUp, ShoppingCart, Trophy, ExternalLink } from "lucide-react";
import ThemeBuilderClient from "./theme-builder-client";
import { CardHover } from "@/components/card-hover";
import CommanderBuilderClient from "./commander-builder-client";
import { useCurrency } from "@/contexts/currency-context";
import { getDeckColors, isBasicLand } from "@/lib/deck-engine";

const FORMAT_LABELS: Record<string, string> = {
  commander: "Commander",
  standard:  "Standard",
  pioneer:   "Pioneer",
  modern:    "Modern",
  pauper:    "Pauper",
};

const THEME_SUGGESTIONS: Record<string, string[]> = {
  commander: ["Atraxa", "Zombies", "Dragons", "Elves", "Tokens", "Artifacts", "Superfriends", "Tribal"],
  standard:  ["Control", "Aggro", "Midrange", "Burn", "Tokens", "Ramp"],
  pioneer:   ["Azorius", "Control", "Aggro", "Spirits", "Greasefang", "Lotus Field"],
  modern:    ["Burn", "Control", "Storm", "Tron", "Affinity", "Spirits"],
  pauper:    ["Faeries", "Burn", "Stompy", "Flickers", "Elves", "Goblins"],
};

type SortKey = "coverage" | "budgetCost" | "popularity";

function coverageColor(pct: number) {
  if (pct >= 70) return "text-emerald-400";
  if (pct >= 40) return "text-primary";
  return "text-muted-foreground";
}

function coverageBorder(pct: number) {
  if (pct >= 70) return "border-l-4 border-l-emerald-500/60";
  if (pct >= 40) return "border-l-4 border-l-primary/60";
  return "border-l-4 border-l-border/40";
}

function DeckCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="h-4 w-36 rounded skeleton" />
        <div className="h-5 w-12 rounded-full skeleton" />
      </div>
      <div className="h-3 w-24 rounded skeleton" />
      <div className="h-2 rounded-full skeleton" />
      <div className="h-3 w-32 rounded skeleton" />
    </div>
  );
}

function formatBadgeClass(format: string): string {
  const map: Record<string, string> = {
    commander: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    standard:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
    pioneer:   "bg-green-500/15 text-green-300 border-green-500/30",
    modern:    "bg-red-500/15 text-red-300 border-red-500/30",
    pauper:    "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  };
  return map[format.toLowerCase()] ?? "bg-muted/50 text-muted-foreground border-border/40";
}

function FormatPicker({ onSelect }: { onSelect: (f: MTGFormat) => void }) {
  const formats = [
    { id: "commander", label: "Commander", desc: "100-kort singleton med commander", color: "purple" },
    { id: "standard",  label: "Standard",  desc: "Senaste expansioner",              color: "blue" },
    { id: "pioneer",   label: "Pioneer",   desc: "Non-rotating format",              color: "green" },
    { id: "modern",    label: "Modern",    desc: "Modern cardpool",                  color: "red" },
    { id: "pauper",    label: "Pauper",    desc: "Bara commons",                     color: "yellow" },
  ] as const;

  const colorMap = {
    purple: "border-purple-500/40 hover:border-purple-500/70 hover:bg-purple-500/8 text-purple-300",
    blue:   "border-blue-500/40 hover:border-blue-500/70 hover:bg-blue-500/8 text-blue-300",
    green:  "border-green-500/40 hover:border-green-500/70 hover:bg-green-500/8 text-green-300",
    red:    "border-red-500/40 hover:border-red-500/70 hover:bg-red-500/8 text-red-300",
    yellow: "border-yellow-500/40 hover:border-yellow-500/70 hover:bg-yellow-500/8 text-yellow-300",
  } as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">Välj ett format för att se meta-lekar som passar din samling</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {formats.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id as MTGFormat)}
            className={`rounded-xl border bg-card p-5 text-left transition-all duration-150 card-hover-glow ${colorMap[f.color]}`}
          >
            <p className="font-bold text-lg mb-1">{f.label}</p>
            <p className="text-xs text-muted-foreground leading-snug">{f.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BuilderClient() {
  const { formatPrice } = useCurrency();
  const [format,          setFormat]          = useState<MTGFormat | null>(null);
  const [showTheme,       setShowTheme]       = useState(false);
  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRec,     setSelectedRec]     = useState<DeckRecommendation | null>(null);
  const [sortKey,         setSortKey]         = useState<SortKey>("coverage");

  const { data: recommendations, isLoading, error } = useQuery<DeckRecommendation[]>({
    queryKey: ["recommendations", format, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ format: format! });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/recommendations?${params}`);
      if (!res.ok) throw new Error("Kunde inte hämta rekommendationer");
      return res.json();
    },
    enabled: format !== null && format !== "commander",
  });

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => setDebouncedSearch(val), 400);
  }

  function handleThemeChip(theme: string) {
    const next = search === theme ? "" : theme;
    setSearch(next);
    setDebouncedSearch(next);
  }

  const sorted = [...(recommendations ?? [])].sort((a, b) => {
    if (sortKey === "coverage")   return b.coveragePercent - a.coveragePercent;
    if (sortKey === "budgetCost") return a.budgetUpgrade.totalCost - b.budgetUpgrade.totalCost;
    return (b.metaDeck.popularity ?? 0) - (a.metaDeck.popularity ?? 0);
  });

  async function handleSaveRec(rec: DeckRecommendation) {
    const res = await fetch("/api/saved-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format:               rec.metaDeck.format,
        deck_name:            rec.metaDeck.deck_name,
        meta_deck_id:         rec.metaDeck.id,
        already_have:         rec.alreadyHave,
        cards_to_buy_budget:  rec.budgetUpgrade.cards,
        cards_to_buy_full:    rec.fullNetdeck.cards,
      }),
    });
    if (!res.ok) toast.error("Kunde inte spara leken");
    else         toast.success("Lek sparad!");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Lek-byggaren</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Jämför din samling mot meta-lekar och se vad du behöver köpa
        </p>
      </div>

      {/* Step 1: Format picker */}
      {format === null && <FormatPicker onSelect={(f) => setFormat(f)} />}

      {/* Step 2a: Commander */}
      {format === "commander" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setFormat(null); setSelectedRec(null); }}
              className="text-muted-foreground">
              ← Byt format
            </Button>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${formatBadgeClass("commander")}`}>
              Commander
            </span>
          </div>
          <CommanderBuilderClient />
        </div>
      )}

      {/* Step 2b: Other formats */}
      {format !== null && format !== "commander" && (
        <div className="space-y-5">
          {/* Back + format badge */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm"
              onClick={() => { setFormat(null); setSearch(""); setDebouncedSearch(""); setSelectedRec(null); }}
              className="text-muted-foreground">
              ← Byt format
            </Button>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${formatBadgeClass(format)}`}>
              {FORMAT_LABELS[format]}
            </span>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök efter lektyp..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 bg-card/60"
              />
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-48 bg-card/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coverage">Täckning %</SelectItem>
                <SelectItem value="budgetCost">Billigaste köp</SelectItem>
                <SelectItem value="popularity">Popularitet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme chips */}
          <div className="flex flex-wrap gap-2">
            {(THEME_SUGGESTIONS[format] ?? []).map((theme) => (
              <Badge
                key={theme}
                variant={search === theme ? "default" : "secondary"}
                className="cursor-pointer hover:border-primary/50 transition-all duration-150 select-none"
                onClick={() => handleThemeChip(theme)}
              >
                {theme}
              </Badge>
            ))}
          </div>

          {/* Loading / error / empty */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <DeckCardSkeleton key={i} />)}
            </div>
          )}
          {error && <div className="text-center py-12 text-destructive text-sm">{(error as Error).message}</div>}
          {sorted.length === 0 && !isLoading && !error && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Search className="w-10 h-10 text-muted-foreground/30" />
              <div className="text-center">
                <p className="font-semibold text-sm">Inga meta-lekar hittades</p>
                <p className="text-muted-foreground text-xs mt-1">Prova ett annat sökord eller kör meta-uppdateringen</p>
              </div>
            </div>
          )}

          {/* Deck grid */}
          {sorted.length > 0 && !selectedRec && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((rec, i) => (
                <div
                  key={rec.metaDeck.id}
                  className={`rounded-xl border border-border/60 bg-card p-4 cursor-pointer card-hover-glow transition-all duration-200 space-y-3 animate-fade-up ${coverageBorder(rec.coveragePercent)}`}
                  style={{ animationDelay: `${i * 45}ms` }}
                  onClick={() => setSelectedRec(rec)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-tight">{rec.metaDeck.deck_name}</p>
                    <span className={`text-2xl font-black shrink-0 tabular-nums leading-none ${coverageColor(rec.coveragePercent)}`}>
                      {rec.coveragePercent}<span className="text-xs font-semibold">%</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${formatBadgeClass(rec.metaDeck.format)}`}>
                      {rec.metaDeck.format}
                    </span>
                    <span className="text-xs text-muted-foreground">{rec.metaDeck.source}</span>
                  </div>
                  {(() => {
                    const colors = getDeckColors(rec.metaDeck.deck_name, rec.metaDeck.archetype ?? "");
                    const colorStyle: Record<string, string> = {
                      W: "bg-yellow-100 border-yellow-300",
                      U: "bg-blue-500 border-blue-600",
                      B: "bg-gray-800 border-gray-600",
                      R: "bg-red-500 border-red-600",
                      G: "bg-green-600 border-green-700",
                    };
                    return colors.length > 0 ? (
                      <div className="flex gap-1">
                        {colors.map(c => (
                          <div key={c} className={`w-3.5 h-3.5 rounded-full border ${colorStyle[c] ?? "bg-muted"}`} title={c} />
                        ))}
                      </div>
                    ) : null;
                  })()}
                  <div className="space-y-1">
                    <Progress value={rec.coveragePercent} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{rec.alreadyHaveCount}/{rec.totalCards} kort</span>
                      {rec.metaDeck.popularity && <span>{rec.metaDeck.popularity} spelare</span>}
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs pt-0.5">
                    <span className="text-primary font-medium">Budget: {formatPrice(rec.budgetUpgrade.totalCost)}</span>
                    <span className="text-muted-foreground">Full: {formatPrice(rec.fullNetdeck.totalCost)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedRec && (
            <RecommendationDetail rec={selectedRec} onBack={() => setSelectedRec(null)} onSave={handleSaveRec} />
          )}

          {/* Bygg från tema link */}
          {!selectedRec && (
            <div className="text-center pt-4">
              <button
                onClick={() => setShowTheme((v) => !v)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {showTheme ? "↑ Dölj tema-byggaren" : "Vill du bygga från ett tema istället? →"}
              </button>
              {showTheme && <div className="mt-6"><ThemeBuilderClient /></div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationDetail({
  rec,
  onBack,
  onSave,
}: {
  rec: DeckRecommendation;
  onBack: () => void;
  onSave: (rec: DeckRecommendation) => Promise<void>;
}) {
  const { formatPrice } = useCurrency();
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [includeLands, setIncludeLands] = useState(true);

  const displayHave   = includeLands ? rec.alreadyHave       : rec.alreadyHave.filter(c => !isBasicLand(c.name));
  const displayBudget = includeLands ? rec.budgetUpgrade.cards : rec.budgetUpgrade.cards.filter(c => !isBasicLand(c.name));
  const displayFull   = includeLands ? rec.fullNetdeck.cards  : rec.fullNetdeck.cards.filter(c => !isBasicLand(c.name));

  async function handleSave() {
    setSaving(true);
    try { await onSave(rec); setSaved(true); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          ← Tillbaka
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{rec.metaDeck.deck_name}</h2>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${formatBadgeClass(rec.metaDeck.format)}`}>
              {rec.metaDeck.format}
            </span>
            <span className="text-xs text-muted-foreground">{rec.metaDeck.source}</span>
            {rec.metaDeck.source_url && (
              <a href={rec.metaDeck.source_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline">
                Se originalleken ↗
              </a>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || saved} className="text-xs">
          {saved ? "✓ Sparad" : saving ? "Sparar..." : "Spara lek"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className={`text-3xl font-bold ${coverageColor(rec.coveragePercent)}`}>{rec.coveragePercent}%</div>
          <div className="text-xs text-muted-foreground mt-1">Täckning</div>
          <div className="text-xs mt-0.5">
            {rec.alreadyHaveCount} kort ({rec.alreadyHave.length} unika)
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-3xl font-bold text-primary">{formatPrice(rec.budgetUpgrade.totalCost)}</div>
          <div className="text-xs text-muted-foreground mt-1">Budget-uppgradering</div>
          <div className="text-xs mt-0.5">→ {rec.budgetUpgrade.newCoveragePercent}% täckning</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-3xl font-bold">{formatPrice(rec.fullNetdeck.totalCost)}</div>
          <div className="text-xs text-muted-foreground mt-1">Full netdeck</div>
          <div className="text-xs mt-0.5">{rec.fullNetdeck.cards.length} saknade kort</div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          onClick={() => setIncludeLands(!includeLands)}
          className={`w-8 h-4 rounded-full transition-colors relative ${includeLands ? "bg-primary" : "bg-muted"}`}
        >
          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${includeLands ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
        <span>Inkludera basic lands</span>
      </div>

      <Tabs defaultValue="have">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <TabsTrigger value="have" className="gap-1.5 text-xs">
            <Trophy className="w-3.5 h-3.5" /> Har: {rec.alreadyHaveCount} kort ({rec.alreadyHave.length} unika)
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-1.5 text-xs">
            <TrendingUp className="w-3.5 h-3.5" /> Budget: {rec.budgetUpgrade.cards.length} kort
          </TabsTrigger>
          <TabsTrigger value="full" className="gap-1.5 text-xs">
            <ShoppingCart className="w-3.5 h-3.5" /> Fullständig: {rec.fullNetdeck.cards.length} kort
          </TabsTrigger>
        </TabsList>

        <TabsContent value="have" className="mt-4">
          <CardList cards={displayHave} emptyText="Du saknar alla kort i den här leken." showPrice={false} />
        </TabsContent>
        <TabsContent value="budget" className="mt-4">
          <div className="mb-3 px-3 py-2.5 bg-primary/8 border border-primary/20 rounded-lg text-xs text-muted-foreground">
            Dessa kort kostar{" "}
            <strong className="text-primary">{formatPrice(rec.budgetUpgrade.totalCost)}</strong>{" "}
            och ökar täckningen från{" "}
            <strong>{rec.coveragePercent}%</strong> till{" "}
            <strong className="text-primary">{rec.budgetUpgrade.newCoveragePercent}%</strong>.
          </div>
          <CardList cards={displayBudget} emptyText="Inga billiga uppgraderingar tillgängliga." showPrice />
        </TabsContent>
        <TabsContent value="full" className="mt-4">
          <div className="mb-3 px-3 py-2.5 bg-muted/40 border border-border/60 rounded-lg text-xs text-muted-foreground">
            Köp alla <strong>{rec.fullNetdeck.cards.length} kort</strong> för att kopiera leken exakt.
            Total: <strong>{formatPrice(rec.fullNetdeck.totalCost)}</strong>.
          </div>
          <CardList cards={displayFull} emptyText="Du har alla kort! Leken är klar." showPrice />
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
  const { formatPrice } = useCurrency();

  if (cards.length === 0) return <p className="text-center py-8 text-muted-foreground text-sm">{emptyText}</p>;

  return (
    <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
      {cards.map((card, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="w-8 justify-center text-xs shrink-0">{card.quantity}x</Badge>
            <CardHover name={card.name}>
              <span className="text-sm font-medium hover:text-primary transition-colors cursor-default">
                {card.name}
              </span>
            </CardHover>
          </div>
          <div className="flex items-center gap-2">
            {showPrice && card.price_usd !== undefined && (
              <span className="text-xs text-muted-foreground">
                {formatPrice(card.price_usd * card.quantity)}
              </span>
            )}
            {showPrice && (
              <a
                href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
                title="Köp på Cardmarket"
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
              {formatPrice(cards.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
