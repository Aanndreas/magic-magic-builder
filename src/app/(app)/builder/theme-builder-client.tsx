"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import type { MTGFormat } from "@/lib/supabase/types";
import type { BuiltDeck, ThemedCard, Strategy } from "@/lib/theme-builder";
import { CardHover } from "@/components/card-hover";

const FORMAT_LABELS: Record<string, string> = {
  commander: "Commander",
  standard: "Standard",
  modern: "Modern",
  pauper: "Pauper",
};

const STRATEGY_LABELS: Record<string, string> = {
  aggro: "Aggro (snabb, låg kostnad)",
  control: "Control (långsam, reaktiv)",
  midrange: "Midrange (balanserad)",
  combo: "Combo (synergi-fokus)",
};

interface Commander {
  id: string;
  name: string;
  owned: boolean;
  prices: { usd: string | null };
  color_identity: string[];
}

export default function ThemeBuilderClient() {
  const [format, setFormat] = useState<MTGFormat>("commander");
  const [theme, setTheme] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("midrange");
  const [step, setStep] = useState<"input" | "commander" | "result">("input");
  const [commanders, setCommanders] = useState<Commander[]>([]);
  const [selectedCommander, setSelectedCommander] = useState<Commander | null>(null);
  const [result, setResult] = useState<{ versionA: BuiltDeck; versionB: BuiltDeck } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  async function handleSearchCommanders() {
    if (!theme.trim()) { toast.error("Ange ett tema"); return; }
    setLoading(true);
    setLoadingMsg("Söker commanders...");
    try {
      const res = await fetch(`/api/theme-builder/commanders?theme=${encodeURIComponent(theme)}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      if (data.length === 0) {
        toast.error("Inga commanders hittades för det temat");
        return;
      }
      setCommanders(data);
      setStep("commander");
    } finally {
      setLoading(false);
    }
  }

  async function handleBuild(commanderScryfallId?: string) {
    setLoading(true);
    setLoadingMsg("Bygger din lek... detta kan ta ~20 sekunder");
    try {
      const res = await fetch("/api/theme-builder/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          format,
          strategy: format !== "commander" ? strategy : undefined,
          commanderScryfallId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setResult(data);
      setStep("result");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("input");
    setResult(null);
    setCommanders([]);
    setSelectedCommander(null);
  }

  if (loading) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl">🃏</div>
        <p className="text-muted-foreground">{loadingMsg}</p>
      </div>
    );
  }

  if (step === "input") {
    return (
      <div className="max-w-lg space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Format</label>
          <Select value={format} onValueChange={(v) => setFormat(v as MTGFormat)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FORMAT_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Tema</label>
          <Input
            placeholder="t.ex. spiders, zombies, flyers, burn, tokens..."
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                format === "commander" ? handleSearchCommanders() : handleBuild();
              }
            }}
          />
        </div>

        {format !== "commander" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Strategi</label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STRATEGY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          className="w-full"
          onClick={format === "commander" ? handleSearchCommanders : () => handleBuild()}
          disabled={!theme.trim()}
        >
          {format === "commander" ? "Sök commanders →" : "Bygg lek"}
        </Button>
      </div>
    );
  }

  if (step === "commander") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={reset}>← Tillbaka</Button>
          <p className="text-muted-foreground text-sm">
            Välj en commander för ditt <strong>{theme}</strong>-tema
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {commanders.map((cmd) => (
            <Card
              key={cmd.id}
              className={`cursor-pointer transition-colors ${
                selectedCommander?.id === cmd.id ? "border-primary" : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedCommander(cmd)}
            >
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-tight">{cmd.name}</p>
                  {cmd.owned && <Badge variant="default" className="text-xs shrink-0">Äger</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Färger: {cmd.color_identity.join("") || "Färglös"}
                </p>
                {!cmd.owned && cmd.prices.usd && (
                  <p className="text-xs text-muted-foreground">${cmd.prices.usd}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <Button
          disabled={!selectedCommander}
          onClick={() => selectedCommander && handleBuild(selectedCommander.id)}
        >
          Bygg lek med {selectedCommander?.name ?? "vald commander"} →
        </Button>
      </div>
    );
  }

  if (step === "result" && result) {
    return <DeckResult result={result} theme={theme} onReset={reset} />;
  }

  return null;
}

function DeckResult({
  result,
  theme,
  onReset,
}: {
  result: { versionA: BuiltDeck; versionB: BuiltDeck };
  theme: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onReset}>← Nytt tema</Button>
        <h2 className="text-xl font-bold capitalize">{theme}-lek</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeckVersion deck={result.versionA} title="Din samling" subtitle="Bara kort du äger" />
        <DeckVersion deck={result.versionB} title="Uppgraderad" subtitle="+ populära köp" showBuyList />
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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">{deck.totalCards} kort</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{subtitle} · {deck.ownedCount} äger du</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Manakurva</p>
          <div className="flex items-end gap-1 h-12">
            {cmcKeys.map((k) => {
              const count = deck.manaCurve[k] ?? 0;
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={k} className="flex flex-col items-center flex-1 gap-0.5">
                  <span className="text-xs text-muted-foreground">{count || ""}</span>
                  <div
                    className="w-full bg-primary rounded-sm"
                    style={{ height: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{k}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="spells">
          <TabsList className="w-full">
            <TabsTrigger value="spells" className="flex-1">
              Stavningar ({deck.cards.length})
            </TabsTrigger>
            <TabsTrigger value="lands" className="flex-1">
              Land ({deck.lands.length})
            </TabsTrigger>
            {showBuyList && (
              <TabsTrigger value="buy" className="flex-1">
                Köp ({deck.buyList.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="spells" className="mt-2 max-h-64 overflow-y-auto space-y-0.5">
            {deck.commander && <CardRow card={deck.commander} />}
            {deck.cards.map((card, i) => <CardRow key={i} card={card} />)}
          </TabsContent>

          <TabsContent value="lands" className="mt-2 max-h-64 overflow-y-auto space-y-0.5">
            {deck.lands.map((card, i) => <CardRow key={i} card={card} />)}
          </TabsContent>

          {showBuyList && (
            <TabsContent value="buy" className="mt-2 max-h-64 overflow-y-auto space-y-0.5">
              <p className="text-xs text-muted-foreground mb-2">
                Total: ${deck.buyCost.toFixed(2)}
              </p>
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
    exact: "bg-green-500",
    support: "bg-blue-400",
    general: "bg-gray-400",
    land: "bg-amber-400",
  };
  return (
    <div className="flex items-center justify-between px-1 py-0.5 hover:bg-accent/30 rounded text-sm">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot[card.category]}`} />
        <CardHover name={card.name}>
          <span className={card.owned ? "" : "text-muted-foreground"}>{card.name}</span>
        </CardHover>
        {!card.owned && (
          <Badge variant="outline" className="text-xs py-0">Saknas</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showPrice && card.price_usd > 0 && (
          <span className="text-xs text-muted-foreground">${card.price_usd.toFixed(2)}</span>
        )}
        {showPrice && (
          <a
            href={`https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
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
