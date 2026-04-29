"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CollectionCard } from "@/lib/supabase/types";
import { toast } from "sonner";
import { Trash2, Upload, Plus, Search } from "lucide-react";

interface Props {
  initialCards: CollectionCard[];
}

export default function CollectionClient({ initialCards }: Props) {
  const [cards, setCards] = useState(initialCards);
  const [search, setSearch] = useState("");
  const [newCardName, setNewCardName] = useState("");
  const [newCardQty, setNewCardQty] = useState(1);
  const [addingCard, setAddingCard] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const filtered = cards.filter((c) =>
    c.card_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!newCardName.trim()) return;
    setAddingCard(true);
    try {
      const res = await fetch("/api/collection", {
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
    setImportProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/collection/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(`Importerade ${data.imported} kort! (${data.skipped} hoppades över)`);
      const refreshed = await fetch("/api/collection");
      const newCards = await refreshed.json();
      setCards(newCards);
      qc.invalidateQueries({ queryKey: ["collection"] });
    } finally {
      setImportProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const totalUnique = cards.length;
  const totalQuantity = cards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Min samling</h1>
          <p className="text-muted-foreground mt-1">
            {totalUnique} unika kort · {totalQuantity} totalt
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Importera CSV
          </Button>
        </div>
      </div>

      {importProgress !== null && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm mb-2">Importerar...</p>
            <Progress value={importProgress} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="list">
        <TabsList>
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
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {cards.length === 0
                ? "Inga kort ännu. Importera en CSV eller lägg till kort manuellt."
                : "Inga kort matchar sökningen."}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kortnamn</TableHead>
                    <TableHead className="w-20 text-center">Antal</TableHead>
                    <TableHead className="w-24">Set</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">
                        {card.card_name}
                        {card.foil && <Badge variant="outline" className="ml-2 text-xs">Foil</Badge>}
                      </TableCell>
                      <TableCell className="text-center">{card.quantity}</TableCell>
                      <TableCell className="text-muted-foreground uppercase text-xs">
                        {card.set_code}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(card.id, card.card_name)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Lägg till kort manuellt</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCard} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kortnamn</label>
                  <Input
                    placeholder="T.ex. Lightning Bolt"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Antal</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={newCardQty}
                    onChange={(e) => setNewCardQty(parseInt(e.target.value) || 1)}
                  />
                </div>
                <Button type="submit" disabled={addingCard} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  {addingCard ? "Lägger till..." : "Lägg till"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
