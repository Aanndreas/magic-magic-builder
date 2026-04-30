"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { toast } from "sonner";
import type { BuiltDeck, ThemedCard } from "@/lib/theme-builder";

const COLOR_LABEL: Record<string, string> = {
  W: "Vit", U: "Blå", B: "Svart", R: "Röd", G: "Grön",
};

interface Commander {
  id: string;
  name: string;
  color_identity: string[];
  prices: { usd: string | null };
  owned: boolean;
}

export default function CommanderBuilderClient() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Commander[]>([]);
  const [selected, setSelected] = useState<Commander | null>(null);
  const [result, setResult] = useState<{ versionA: BuiltDeck; versionB: BuiltDeck } | null>(null);
  const [searching, setSearching] = useState(false);
  const [building, setBuilding] = useState(false);
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
        body: JSON.stringify({
          theme: "",
          format: "commander",
          commanderScryfallId: selected.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setResult(data);
    } finally {
      setBuilding(false);
    }
  }

  function reset() {
    setQuery("");
    setSuggestions([]);
    setSelected(null);
    setResult(null);
  }

  if (building) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl">🃏</div>
        <p className="text-muted-foreground">Bygger lek med {selected?.name}... ~20 sekunder</p>
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
          className="pl-9"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Söker...
          </span>
        )}
      </div>

      {suggestions.length > 0 && !selected && (
        <div className="rounded-md border divide-y shadow-md">
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
        <div className="rounded-md border px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-medium">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              {selected.color_identity.map((c) => COLOR_LABEL[c] ?? c).join(" / ") || "Färglös"}
              {selected.owned && " · Du äger den"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
            Byt
          </Button>
        </div>
      )}

      <Button className="w-full" disabled={!selected} onClick={handleBuild}>
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onReset}>← Ny commander</Button>
        <div>
          <h2 className="text-xl font-bold">{commander.name}</h2>
          <p className="text-xs text-muted-foreground">
            {commander.color_identity.map((c) => COLOR_LABEL[c] ?? c).join(" / ") || "Färglös"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle} · {deck.ownedCount} äger du av {deck.totalCards}</p>
          </div>
          <Badge variant="outline">{deck.totalCards} kort</Badge>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Manakurva</p>
          <div className="flex items-end gap-1 h-10">
            {cmcKeys.map((k) => {
              const count = deck.manaCurve[k] ?? 0;
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={k} className="flex flex-col items-center flex-1 gap-0.5">
                  <span className="text-xs text-muted-foreground leading-none">{count || ""}</span>
                  <div className="w-full bg-primary rounded-sm" style={{ height: `${Math.max(pct, count > 0 ? 10 : 0)}%` }} />
                  <span className="text-xs text-muted-foreground leading-none">{k}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="spells">
          <TabsList className="w-full">
            <TabsTrigger value="spells" className="flex-1">Stavningar ({deck.cards.length})</TabsTrigger>
            <TabsTrigger value="lands" className="flex-1">Land ({deck.lands.length})</TabsTrigger>
            {showBuyList && <TabsTrigger value="buy" className="flex-1">Köp ({deck.buyList.length})</TabsTrigger>}
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
              <p className="text-xs text-muted-foreground mb-2">Total: ${deck.buyCost.toFixed(2)}</p>
              {deck.buyList.map((card, i) => <CardRow key={i} card={card} showPrice />)}
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function CardRow({ card, showPrice = false }: { card: ThemedCard; showPrice?: boolean }) {
  const dot: Record<string, string> = {
    exact: "bg-green-500", support: "bg-blue-400", general: "bg-gray-400", land: "bg-amber-400",
  };
  return (
    <div className="flex items-center justify-between px-1 py-0.5 hover:bg-accent/30 rounded text-sm">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[card.category]}`} />
        <span className={card.owned ? "" : "text-muted-foreground"}>{card.name}</span>
        {!card.owned && <Badge variant="outline" className="text-xs py-0">Saknas</Badge>}
      </div>
      <div className="flex items-center gap-2">
        {showPrice && card.price_usd > 0 && (
          <span className="text-xs text-muted-foreground">${card.price_usd.toFixed(2)}</span>
        )}
        <Badge variant="outline" className="text-xs w-7 justify-center">{card.quantity}x</Badge>
      </div>
    </div>
  );
}
