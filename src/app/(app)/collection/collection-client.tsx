"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CollectionCard } from "@/lib/supabase/types";
import { toast } from "sonner";
import { Trash2, Upload, Plus, Search, AlertTriangle, Library } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RiffleLoader } from "@/components/riffle-loader";

interface Props {
  initialCards: CollectionCard[];
}

export default function CollectionClient({ initialCards }: Props) {
  const [cards,          setCards]          = useState(initialCards);
  const [search,         setSearch]         = useState("");
  const [newCardName,    setNewCardName]    = useState("");
  const [newCardQty,     setNewCardQty]     = useState(1);
  const [addingCard,     setAddingCard]     = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing,       setClearing]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc      = useQueryClient();

  const filtered = cards.filter((c) =>
    c.card_name.toLowerCase().includes(search.toLowerCase())
  );

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
        const existing = prev.findIndex((c) => c.id === data.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = data;
          return next;
        }
        return [...prev, data].sort((a, b) => a.card_name.localeCompare(b.card_name));
      });
      setNewCardName("");
      setNewCardQty(1);
      toast.success(`${data.card_name} tillagd!`);
      qc.invalidateQueries({ queryKey: ["collection"] });
    } finally {
      setAddingCard(false);
    }
  }

  async function handleClearAll() {
    setClearing(true);
    try {
      const res = await fetch("/api/collection", { method: "DELETE" });
      if (!res.ok) { toast.error("Kunde inte rensa samlingen"); return; }
      setCards([]);
      setClearDialogOpen(false);
      toast.success("Samlingen är rensad");
      qc.invalidateQueries({ queryKey: ["collection"] });
    } finally {
      setClearing(false);
    }
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
      const refreshed  = await fetch("/api/collection");
      const newCards   = await refreshed.json();
      setCards(newCards);
      qc.invalidateQueries({ queryKey: ["collection"] });
    } catch {
      clearInterval(ticker);
      toast.error("Importen misslyckades");
    } finally {
      setTimeout(() => {
        setImportProgress(null);
        if (fileRef.current) fileRef.current.value = "";
      }, 600);
    }
  }

  const totalUnique   = cards.length;
  const totalQuantity = cards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="space-y-6">
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
                  Du kan alltid importera din CSV igen efteråt.
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

      {importProgress !== null && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          {importProgress < 100 ? (
            <RiffleLoader
              text={`Importerar kort... ${Math.round(importProgress)}%`}
              className="py-6"
            />
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

        <TabsContent value="list" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Sök efter kort..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/60"
            />
          </div>

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
                  <p className="text-muted-foreground text-sm">Inga kort matchar sökningen.</p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground uppercase tracking-wide">Kortnamn</TableHead>
                    <TableHead className="w-20 text-center text-xs text-muted-foreground uppercase tracking-wide">Antal</TableHead>
                    <TableHead className="w-24 text-xs text-muted-foreground uppercase tracking-wide">Set</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((card) => (
                    <TableRow key={card.id} className="border-border/30 hover:bg-accent/20 transition-colors">
                      <TableCell className="font-medium text-sm py-2.5">
                        {card.card_name}
                        {card.foil && (
                          <Badge variant="outline" className="ml-2 text-xs py-0 px-1.5 badge-foil">
                            ✦ Foil
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm py-2.5">{card.quantity}</TableCell>
                      <TableCell className="text-muted-foreground uppercase text-xs py-2.5">{card.set_code}</TableCell>
                      <TableCell className="py-2.5">
                        <Button
                          variant="ghost"
                          size="icon"
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
                  type="number"
                  min={1}
                  max={100}
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
