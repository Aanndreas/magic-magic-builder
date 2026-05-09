"use client";

import { useState, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CollectionCard } from "@/lib/supabase/types";
import { toast } from "sonner";
import { Trash2, Upload, Plus, Search, AlertTriangle, Library, X } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";
import { CardHover } from "@/components/card-hover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { RiffleLoader } from "@/components/riffle-loader";

type SortCol = "name" | "quantity" | "price" | "set";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortCol, string> = {
  name: "Kortnamn", quantity: "Antal", set: "Set", price: "Pris",
};

interface Props { initialCards: CollectionCard[] }

export default function CollectionClient({ initialCards }: Props) {
  const [cards,           setCards]           = useState(initialCards);
  const [search,          setSearch]          = useState("");
  const [sortCol,         setSortCol]         = useState<SortCol>("name");
  const [sortDir,         setSortDir]         = useState<SortDir>("asc");
  const [foilOnly,        setFoilOnly]        = useState(false);
  const [dupeOnly,        setDupeOnly]        = useState(false);
  const [setFilter,       setSetFilter]       = useState("");
  const [minPrice,        setMinPrice]        = useState("");
  const [maxPrice,        setMaxPrice]        = useState("");
  const [newCardName,     setNewCardName]     = useState("");
  const [newCardQty,      setNewCardQty]      = useState(1);
  const [addingCard,      setAddingCard]      = useState(false);
  const [importProgress,  setImportProgress]  = useState<number | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing,        setClearing]        = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc      = useQueryClient();
  const { formatPrice } = useCurrency();

  // Unique sets derived from collection
  const uniqueSets = useMemo(
    () => [...new Set(cards.map((c) => c.set_code).filter(Boolean))].sort() as string[],
    [cards],
  );

  // Sort toggle
  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  // Sort indicator — always visible
  function sortArrow(col: SortCol) {
    if (sortCol !== col) return <span className="ml-1 opacity-25">↕</span>;
    return <span className="ml-1 text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const minPriceNum = parseFloat(minPrice) || 0;
  const maxPriceNum = parseFloat(maxPrice) || Infinity;

  const filtered = useMemo(() => cards.filter((c) => {
    if (search    && !c.card_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (foilOnly  && !c.foil)                                                   return false;
    if (dupeOnly  && c.quantity <= 1)                                           return false;
    if (setFilter && c.set_code !== setFilter)                                  return false;
    if (minPrice  && (c.price_usd ?? 0) < minPriceNum)                         return false;
    if (maxPrice  && (c.price_usd ?? 0) > maxPriceNum)                         return false;
    return true;
  }), [cards, search, foilOnly, dupeOnly, setFilter, minPrice, maxPrice, minPriceNum, maxPriceNum]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case "quantity": cmp = a.quantity - b.quantity; break;
      case "price":    cmp = (a.price_usd ?? 0) - (b.price_usd ?? 0); break;
      case "set":      cmp = (a.set_code ?? "").localeCompare(b.set_code ?? ""); break;
      default:         cmp = a.card_name.localeCompare(b.card_name); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  }), [filtered, sortCol, sortDir]);

  const activeFilterCount = [foilOnly, dupeOnly, !!setFilter, !!minPrice, !!maxPrice].filter(Boolean).length;

  function clearFilters() {
    setSearch(""); setFoilOnly(false); setDupeOnly(false);
    setSetFilter(""); setMinPrice(""); setMaxPrice("");
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!newCardName.trim()) return;
    setAddingCard(true);
    try {
      const res  = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_name: newCardName.trim(), quantity: newCardQty }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setCards((prev) => {
        const idx = prev.findIndex((c) => c.id === data.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = data; return next; }
        return [...prev, data].sort((a, b) => a.card_name.localeCompare(b.card_name));
      });
      setNewCardName(""); setNewCardQty(1);
      toast.success(`${data.card_name} tillagd!`);
      qc.invalidateQueries({ queryKey: ["collection"] });
    } finally { setAddingCard(false); }
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      const res = await fetch("/api/collection", { method: "DELETE" });
      if (!res.ok) { toast.error("Kunde inte rensa samlingen"); return; }
      setCards([]); setClearDialogOpen(false);
      toast.success("Samlingen är rensad");
      qc.invalidateQueries({ queryKey: ["collection"] });
    } finally { setClearing(false); }
  }

  async function handleDelete(id: string, name: string) {
    const res = await fetch(`/api/collection?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Kunde inte ta bort kortet"); return; }
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast.success(`${name} borttagen`);
    qc.invalidateQueries({ queryKey: ["collection"] });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportProgress(5);
    const formData = new FormData();
    formData.append("file", file);
    const ticker = setInterval(() => {
      setImportProgress((prev) => {
        if (prev === null || prev >= 85) return prev;
        return prev + Math.random() * 8;
      });
    }, 400);
    try {
      const res  = await fetch("/api/collection/import", { method: "POST", body: formData });
      const data = await res.json();
      clearInterval(ticker);
      if (!res.ok) { toast.error(data.error); return; }
      setImportProgress(100);
      toast.success(`Importerade ${data.imported} kort! (${data.skipped} hoppades över)`);
      const refreshed = await fetch("/api/collection");
      setCards(await refreshed.json());
      qc.invalidateQueries({ queryKey: ["collection"] });
    } catch {
      clearInterval(ticker);
      toast.error("Importen misslyckades");
    } finally {
      setTimeout(() => { setImportProgress(null); if (fileRef.current) fileRef.current.value = ""; }, 600);
    }
  }

  const totalUnique   = cards.length;
  const totalQuantity = cards.reduce((s, c) => s + c.quantity, 0);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Min samling</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {totalUnique} unika kort · {totalQuantity} totalt
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Importera CSV
          </Button>
          <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <DialogTrigger
              disabled={cards.length === 0}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-3 h-9 text-sm font-medium text-destructive hover:bg-accent hover:text-destructive disabled:pointer-events-none disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Rensa samling
            </DialogTrigger>
            <DialogContent className="border-border/60">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Rensa hela samlingen?
                </DialogTitle>
                <DialogDescription>
                  Detta tar bort alla {cards.length} kort permanent. Åtgärden kan inte ångras.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setClearDialogOpen(false)}>Avbryt</Button>
                <Button variant="destructive" onClick={handleClearAll} disabled={clearing}>
                  {clearing ? "Rensar..." : "Ja, rensa allt"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Import progress */}
      {importProgress !== null && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          {importProgress < 100 ? (
            <RiffleLoader text={`Importerar kort... ${Math.round(importProgress)}%`} className="py-6" />
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-emerald-400">
              <span>✓</span> Importering klar!
            </div>
          )}
          <Progress value={importProgress} className="h-1 transition-all duration-300 rounded-none" />
        </div>
      )}

      <Tabs defaultValue="list">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="add">Lägg till kort</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3 mt-4">

          {/* ── Filter bar ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök efter kort..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card/60"
              />
            </div>

            {/* Filter chips row */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Foil toggle */}
              <button
                onClick={() => setFoilOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                  foilOnly
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                ✦ Foil
              </button>

              {/* Duplicates toggle */}
              <button
                onClick={() => setDupeOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                  dupeOnly
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                Dubletter
              </button>

              {/* Set filter */}
              {uniqueSets.length > 0 && (
                <Select value={setFilter || "__all__"} onValueChange={(v) => setSetFilter(!v || v === "__all__" ? "" : v)}>
                  <SelectTrigger
                    className={`h-8 text-xs w-28 transition-all duration-150 ${
                      setFilter ? "bg-primary/15 border-primary/50 text-primary" : "bg-card border-border/60 text-muted-foreground"
                    }`}
                  >
                    <SelectValue placeholder="Set" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="__all__">Alla set</SelectItem>
                    {uniqueSets.map((s) => (
                      <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Min price */}
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">≥</span>
                <Input
                  type="number"
                  placeholder="Min pris"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  min={0}
                  className={`pl-6 h-8 text-xs w-24 transition-all duration-150 ${minPrice ? "border-primary/50 text-primary" : "bg-card/60 text-muted-foreground"}`}
                />
              </div>

              {/* Max price */}
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">≤</span>
                <Input
                  type="number"
                  placeholder="Max pris"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  min={0}
                  className={`pl-6 h-8 text-xs w-24 transition-all duration-150 ${maxPrice ? "border-primary/50 text-primary" : "bg-card/60 text-muted-foreground"}`}
                />
              </div>

              {/* Clear all filters */}
              {(activeFilterCount > 0 || search) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  <X className="w-3 h-3" /> Rensa
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* ── Table / empty state ─────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              {cards.length === 0 ? (
                <>
                  <Library className="w-12 h-12 text-muted-foreground/30" />
                  <div className="text-center">
                    <p className="font-semibold text-sm">Din samling är tom</p>
                    <p className="text-muted-foreground text-xs mt-1">Importera din Moxfield CSV för att komma igång</p>
                  </div>
                  <Button size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5 glow-gold">
                    <Upload className="w-3.5 h-3.5" /> Importera CSV
                  </Button>
                </>
              ) : (
                <>
                  <Search className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Inga kort matchar filtret.</p>
                  <button onClick={clearFilters} className="text-xs text-primary hover:underline">Rensa filter</button>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    {(["name", "quantity", "set", "price"] as SortCol[]).map((col) => (
                      <TableHead
                        key={col}
                        onClick={() => handleSort(col)}
                        className={`text-xs uppercase tracking-wide cursor-pointer select-none transition-colors group ${
                          col === "quantity" ? "w-20 text-center" :
                          col === "set"      ? "w-24" :
                          col === "price"    ? "w-24 text-right" : ""
                        } ${sortCol === col ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {SORT_LABELS[col]}{sortArrow(col)}
                      </TableHead>
                    ))}
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((card) => (
                    <TableRow key={card.id} className="border-border/30 hover:bg-accent/20 transition-colors">
                      <TableCell className="font-medium text-sm py-2.5">
                        <CardHover name={card.card_name} scryfallId={card.scryfall_id}>
                          <span className="hover:text-primary transition-colors cursor-default">{card.card_name}</span>
                        </CardHover>
                        {card.foil && (
                          <Badge variant="outline" className="ml-2 text-xs py-0 px-1.5 badge-foil">✦ Foil</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm py-2.5 tabular-nums">{card.quantity}</TableCell>
                      <TableCell className="text-muted-foreground uppercase text-xs py-2.5">{card.set_code}</TableCell>
                      <TableCell className="text-right text-xs py-2.5 tabular-nums">
                        {card.price_usd
                          ? <span className="text-muted-foreground">{formatPrice(card.price_usd)}</span>
                          : <span className="text-muted-foreground/30">—</span>
                        }
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleDelete(card.id, card.card_name)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Footer: filtered count + total value */}
              <div className="flex justify-between items-center px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs">
                <span className="text-muted-foreground">
                  {sorted.length} kort
                  {sorted.length !== totalUnique && (
                    <span className="ml-1 opacity-60">av {totalUnique}</span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatPrice(sorted.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0))}
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-4">
          <div className="max-w-md rounded-xl border border-border/60 bg-card p-6">
            <h3 className="font-semibold mb-4 text-sm">Lägg till kort manuellt</h3>
            <form onSubmit={handleAddCard} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Kortnamn</label>
                <Input
                  placeholder="T.ex. Lightning Bolt"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  className="bg-background/60"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Antal</label>
                <Input
                  type="number" min={1} max={100}
                  value={newCardQty}
                  onChange={(e) => setNewCardQty(parseInt(e.target.value) || 1)}
                  className="bg-background/60"
                />
              </div>
              <Button type="submit" disabled={addingCard} className="w-full glow-gold font-semibold gap-1.5">
                <Plus className="w-4 h-4" />
                {addingCard ? "Lägger till..." : "Lägg till"}
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
