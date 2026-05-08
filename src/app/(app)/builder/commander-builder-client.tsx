"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BuiltDeck, ThemedCard } from "@/lib/theme-builder";
import { CardHover } from "@/components/card-hover";

const COLOR_LABEL: Record<string, string> = {
  W: "Vit", U: "Blå", B: "Svart", R: "Röd", G: "Grön",
};

interface Commander {
  id:             string;
  name:           string;
  color_identity: string[];
  prices:         { usd: string | null };
  owned:          boolean;
}

export default function CommanderBuilderClient() {
  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState<Commander[]>([]);
  const [selected,    setSelected]    = useState<Commander | null>(null);
  const [result,      setResult]      = useState<{ versionA: BuiltDeck; versionB: BuiltDeck } | null>(null);
  const [searching,   setSearching]   = useState(false);
  const [building,    setBuilding]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(val: string) {
    setQuery(val);
    setSelected(null);
    setResult(null);
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/commander-search?name=${encodeURIComponent(val)}`);
        if (!res.ok) return;
        setSuggestions(await res.json());
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function handleSelect(cmd: Commander) {
    setSelected(cmd);
    setQuery(cmd.name);
    setSuggestions([]);
  }

  async function handleBuild() {
    if (!selected) return;
    setBuilding(true);
    setResult(null);
    try {
      const res = await fetch("/api/theme-builder/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "", format: "commander", commanderScryfallId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setResult(data);
    } finally {
      setBuilding(false);
    }
  }

  function reset() {
    setQuery(""); setSuggestions([]); setSelected(null); setResult(null);
  }

  if (building) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin-slow" />
        </div>
        <div className="text-center">
          <p className="font-semibold">{selected?.name}</p>
          <p className="text-sm text-muted-foreground mt-1">Hämtar EDHREC-data och bygger lek... ~20 sek</p>
        </div>
      </div>
    );
  }

  if (result && selected) {
    return <CommanderResult result={result} commander={selected} onReset={reset} />;
  }

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-muted-foreground">
        Sök på valfri legendary creature — vi hämtar EDHREC:s rekommendationer och matchar mot din samling.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Sök commander, t.ex. Atraxa, Ur-Dragon..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-9 bg-card/60"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {suggestions.length > 0 && !selected && (
        <div className="rounded-xl border border-border/60 divide-y divide-border/40 shadow-xl overflow-hidden animate-fade-up">
          {suggestions.map((cmd) => (
            <button
              key={cmd.id}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 text-left transition-colors"
              onClick={() => handleSelect(cmd)}
            >
              <div>
                <p className="text-sm font-medium">{cmd.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cmd.color_identity.map((c) => COLOR_LABEL[c] ?? c).join(" / ") || "Färglös"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {cmd.owned && <Badge variant="default" className="text-xs">Äger</Badge>}
                {!cmd.owned && cmd.prices.usd && (
                  <span className="text-xs text-muted-foreground">${cmd.prices.usd}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              {selected.color_identity.map((c) => COLOR_LABEL[c] ?? c).join(" / ") || "Färglös"}
              {selected.owned && " · Du äger den"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-muted-foreground">
            Byt
          </Button>
        </div>
      )}

      <Button
        className="w-full glow-gold font-semibold"
        disabled={!selected}
        onClick={handleBuild}
      >
        Bygg lek med {selected?.name ?? "vald commander"}
      </Button>
    </div>
  );
}

function CommanderResult({
  result,
  commander,
  onReset,
}: {
  result: { versionA: BuiltDeck; versionB: BuiltDeck };
  commander: Commander;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
          ← Ny commander
        </Button>
        <div>
          <h2 className="text-lg font-bold">{commander.name}</h2>
          <p className="text-xs text-muted-foreground">
            {commander.color_identity.map((c) => COLOR_LABEL[c] ?? c).join(" / ") || "Färglös"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DeckVersion deck={result.versionA} title="Din samling" subtitle="Bara kort du äger" />
        <DeckVersion deck={result.versionB} title="Uppgraderad" subtitle="+ EDHREC-rekommendationer" showBuyList />
      </div>
    </div>
  );
}

function DeckVersion({
  deck,
  title,
  subtitle,
  showBuyList = false,
}: {
  deck: BuiltDeck;
  title: string;
  subtitle: string;
  showBuyList?: boolean;
}) {
  const cmcKeys = ["1", "2", "3", "4", "5", "6+"];
  const maxCount = Math.max(...cmcKeys.map((k) => deck.manaCurve[k] ?? 0), 1);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle} · {deck.ownedCount} äger du av {deck.totalCards}</p>
        </div>
        <Badge variant="outline" className="text-xs">{deck.totalCards} kort</Badge>
      </div>

      <div className="p-4 space-y-4">
        {/* Mana curve */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Manakurva</p>
          <div className="flex items-end gap-1.5 h-12">
            {cmcKeys.map((k, idx) => {
              const count = deck.manaCurve[k] ?? 0;
              const pct   = Math.round((count / maxCount) * 100);
              return (
                <div key={k} className="flex flex-col items-center flex-1 gap-0.5">
                  <span className="text-xs text-muted-foreground leading-none">{count || ""}</span>
                  <div
                    className="w-full rounded-sm animate-bar-grow"
                    style={{
                      height: `${Math.max(pct, count > 0 ? 10 : 0)}%`,
                      background: `oklch(0.76 0.14 ${75 + idx * 8})`,
                      animationDelay: `${idx * 60}ms`,
                    }}
                  />
                  <span className="text-xs text-muted-foreground leading-none">{k}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="bg-border/40" />

        <Tabs defaultValue="spells">
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="spells" className="flex-1 text-xs">Stavningar ({deck.cards.length})</TabsTrigger>
            <TabsTrigger value="lands"  className="flex-1 text-xs">Land ({deck.lands.length})</TabsTrigger>
            {showBuyList && <TabsTrigger value="buy" className="flex-1 text-xs">Köp ({deck.buyList.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="spells" className="mt-2 max-h-72 overflow-y-auto space-y-0.5">
            {deck.commander && <CardRow card={deck.commander} />}
            {deck.cards.map((card, i) => <CardRow key={i} card={card} />)}
          </TabsContent>

          <TabsContent value="lands" className="mt-2 max-h-72 overflow-y-auto space-y-0.5">
            {deck.lands.map((card, i) => <CardRow key={i} card={card} />)}
          </TabsContent>

          {showBuyList && (
            <TabsContent value="buy" className="mt-2 max-h-72 overflow-y-auto space-y-0.5">
              <p className="text-xs text-muted-foreground px-1 mb-2">
                Total: <span className="text-primary font-semibold">${deck.buyCost.toFixed(2)}</span>
              </p>
              {deck.buyList.map((card, i) => <CardRow key={i} card={card} showPrice />)}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function CardRow({ card, showPrice = false }: { card: ThemedCard; showPrice?: boolean }) {
  const dotColor: Record<string, string> = {
    exact:   "bg-emerald-500",
    support: "bg-blue-400",
    general: "bg-muted-foreground/50",
    land:    "bg-amber-400",
  };
  return (
    <div className="flex items-center justify-between px-1 py-1 hover:bg-accent/30 rounded transition-colors text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor[card.category]}`} />
        <CardHover name={card.name}>
          <span className={`truncate hover:text-primary transition-colors cursor-default ${card.owned ? "" : "text-muted-foreground"}`}>
            {card.name}
          </span>
        </CardHover>
        {!card.owned && <Badge variant="outline" className="text-xs py-0 px-1 shrink-0">Saknas</Badge>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {showPrice && card.price_usd > 0 && (
          <span className="text-xs text-muted-foreground">${card.price_usd.toFixed(2)}</span>
        )}
        {showPrice && (
          <a
            href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`}
            target="_blank" rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="Köp på Cardmarket"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <Badge variant="outline" className="text-xs w-7 justify-center">{card.quantity}x</Badge>
      </div>
    </div>
  );
}
