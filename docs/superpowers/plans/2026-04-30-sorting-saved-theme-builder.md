# Sorting, Saved Recommendations & Theme Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sorting to the meta deck list, save/view recommendations, and a full theme-based deck builder that assembles a deck from the user's collection.

**Architecture:** Sorting is pure client-side. Saved recommendations use the existing DB table + a new API route + a new page. The theme builder adds a new lib module (`theme-builder.ts`), two API routes, and a new client component tabbed into the existing builder page.

**Tech Stack:** Next.js 15 App Router · TypeScript · Supabase · Scryfall API · EDHREC JSON API · shadcn/ui · TanStack Query

---

## File Map

| File | Action | Feature |
|------|--------|---------|
| `src/app/(app)/builder/builder-client.tsx` | Modify | Sorting + saved button + theme tab |
| `src/app/api/saved-recommendations/route.ts` | Create | Saved recommendations API |
| `src/app/(app)/saved/page.tsx` | Create | Saved recommendations page |
| `src/components/nav.tsx` | Modify | Add "Sparade" nav link |
| `src/lib/scryfall.ts` | Modify | Add `searchCardsByQuery()` |
| `src/lib/theme-builder.ts` | Create | Theme builder algorithm |
| `src/app/api/theme-builder/commanders/route.ts` | Create | Commander search API |
| `src/app/api/theme-builder/build/route.ts` | Create | Deck build API |
| `src/app/(app)/builder/theme-builder-client.tsx` | Create | Theme builder UI |

---

## Task 1: Sorting in meta deck list

**Files:** Modify `src/app/(app)/builder/builder-client.tsx`

- [ ] **Step 1: Add sort state and sort logic**

In `builder-client.tsx`, after the existing `useState` declarations, add:

```tsx
type SortKey = "coverage" | "budgetCost" | "popularity";
const [sortKey, setSortKey] = useState<SortKey>("coverage");
```

Replace the block that renders recommendations cards (starting with `{recommendations && recommendations.length > 0 && !selectedRec && (`) — add this sort before the `.map()`:

```tsx
const sorted = [...(recommendations ?? [])].sort((a, b) => {
  if (sortKey === "coverage") return b.coveragePercent - a.coveragePercent;
  if (sortKey === "budgetCost") return a.budgetUpgrade.totalCost - b.budgetUpgrade.totalCost;
  return (b.metaDeck.popularity ?? 0) - (a.metaDeck.popularity ?? 0);
});
```

Then change `recommendations.map(...)` to `sorted.map(...)`.

- [ ] **Step 2: Add sort dropdown to the filter row**

In the `<div className="flex flex-col sm:flex-row gap-3">` row (the one with format select + search input), add after the search Input:

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/builder/builder-client.tsx"
git commit -m "feat: add sorting to meta deck list"
```

---

## Task 2: Saved recommendations API route

**Files:** Create `src/app/api/saved-recommendations/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { MTGFormat } from "@/lib/supabase/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_recommendations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { format, deck_name, meta_deck_id, already_have, cards_to_buy_budget, cards_to_buy_full } = body;

  if (!format || !deck_name || !meta_deck_id) {
    return NextResponse.json({ error: "format, deck_name och meta_deck_id krävs" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_recommendations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      user_id: user.id,
      format: format as MTGFormat,
      deck_name,
      meta_deck_id,
      already_have: already_have ?? [],
      cards_to_buy_budget: cards_to_buy_budget ?? [],
      cards_to_buy_full: cards_to_buy_full ?? [],
    } as any)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  const { error } = await supabase
    .from("saved_recommendations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/saved-recommendations/route.ts
git commit -m "feat: add saved recommendations API (GET/POST/DELETE)"
```

---

## Task 3: Save button in deck detail view

**Files:** Modify `src/app/(app)/builder/builder-client.tsx`

- [ ] **Step 1: Add save state and handler to RecommendationDetail**

The `RecommendationDetail` component currently takes `{ rec, onBack }`. Change it to also accept `onSave`:

```tsx
function RecommendationDetail({
  rec,
  onBack,
  onSave,
}: {
  rec: DeckRecommendation;
  onBack: () => void;
  onSave: (rec: DeckRecommendation) => Promise<void>;
}) {
```

Add a save button next to the back button in `RecommendationDetail`:

```tsx
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
```

In the header row (next to `← Tillbaka` button):

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleSave}
  disabled={saving || saved}
>
  {saved ? "Sparad ✓" : saving ? "Sparar..." : "Spara lek"}
</Button>
```

- [ ] **Step 2: Add onSave handler in BuilderClient and pass it down**

In `BuilderClient`, add the handler:

```tsx
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
```

Update the `RecommendationDetail` render call:

```tsx
{selectedRec && (
  <RecommendationDetail
    rec={selectedRec}
    onBack={() => setSelectedRec(null)}
    onSave={handleSaveRec}
  />
)}
```

- [ ] **Step 3: Add missing import**

`RecommendationDetail` uses `useState` — it's a separate function but in the same file. The `useState` import is already present at the top of the file. No change needed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/builder/builder-client.tsx"
git commit -m "feat: add save button to deck recommendation detail"
```

---

## Task 4: Saved recommendations page + nav link

**Files:** Create `src/app/(app)/saved/page.tsx`, modify `src/components/nav.tsx`

- [ ] **Step 1: Create the saved page**

```tsx
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SavedClient from "./saved-client";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: saved } = await supabase
    .from("saved_recommendations")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sparade lekar</h1>
        <p className="text-muted-foreground mt-1">Lekar du sparat från meta-jämförelsen</p>
      </div>
      <SavedClient initialSaved={saved ?? []} />
    </div>
  );
}
```

- [ ] **Step 2: Create the client component** `src/app/(app)/saved/saved-client.tsx`

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { SavedRecommendation } from "@/lib/supabase/types";
import type { DeckCard } from "@/lib/supabase/types";

export default function SavedClient({ initialSaved }: { initialSaved: SavedRecommendation[] }) {
  const [saved, setSaved] = useState(initialSaved);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/saved-recommendations?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Kunde inte ta bort leken"); return; }
    setSaved((prev) => prev.filter((s) => s.id !== id));
    toast.success("Lek borttagen");
  }

  if (saved.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Inga sparade lekar ännu. Gå till Lek-byggaren och spara en lek du vill bygga.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {saved.map((rec) => {
        const budget = rec.cards_to_buy_budget as unknown as DeckCard[];
        const full = rec.cards_to_buy_full as unknown as DeckCard[];
        const budgetCost = budget.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0);
        const fullCost = full.reduce((s, c) => s + (c.price_usd ?? 0) * c.quantity, 0);
        return (
          <Card key={rec.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">{rec.deck_name}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleDelete(rec.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <CardDescription className="capitalize">
                {rec.format} · Sparad {new Date(rec.created_at).toLocaleDateString("sv-SE")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-green-600 font-medium">Budget: ${budgetCost.toFixed(2)} ({budget.length} kort)</p>
              <p className="text-muted-foreground">Full netdeck: ${fullCost.toFixed(2)} ({full.length} kort)</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Add "Sparade" to nav**

In `src/components/nav.tsx`, update `navItems`:

```tsx
const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/collection", label: "Min samling" },
  { href: "/builder", label: "Lek-byggaren" },
  { href: "/saved", label: "Sparade lekar" },
];
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/saved-recommendations/ "src/app/(app)/saved/" src/components/nav.tsx
git commit -m "feat: saved recommendations page and nav link"
```

---

## Task 5: Add Scryfall theme search function

**Files:** Modify `src/lib/scryfall.ts`

- [ ] **Step 1: Add `searchCardsByQuery` function**

After the existing `getCardsByIds` function, add:

```ts
export async function searchCardsByQuery(query: string, maxResults = 175): Promise<ScryfallCard[]> {
  const results: ScryfallCard[] = [];
  let url: string | null =
    `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(query)}&order=edhrec&unique=cards`;

  while (url && results.length < maxResults) {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) break;
    const data: ScryfallSearchResult = await res.json();
    results.push(...data.data);
    url = data.has_more && data.next_page ? data.next_page : null;
  }

  return results.slice(0, maxResults);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scryfall.ts
git commit -m "feat: add searchCardsByQuery to scryfall lib"
```

---

## Task 6: Theme builder core algorithm

**Files:** Create `src/lib/theme-builder.ts`

- [ ] **Step 1: Create the file with types and helpers**

```ts
import { searchCardsByQuery, getCardsByNames } from "@/lib/scryfall";
import { fetchEdhrecCommanderDeck } from "@/lib/scrapers/edhrec";
import type { ScryfallCard } from "@/lib/scryfall";
import type { CollectionCard, MTGFormat } from "@/lib/supabase/types";

export type CardCategory = "exact" | "support" | "general" | "land";
export type Strategy = "aggro" | "control" | "midrange" | "combo";

export interface ThemedCard {
  name: string;
  scryfall_id: string;
  quantity: number;
  cmc: number;
  price_usd: number;
  category: CardCategory;
  owned: boolean;
}

export interface BuiltDeck {
  commander?: ThemedCard;
  cards: ThemedCard[];
  lands: ThemedCard[];
  totalCards: number;
  manaCurve: Record<string, number>;
  ownedCount: number;
  buyList: ThemedCard[];
  buyCost: number;
}

export interface ThemeBuilderParams {
  theme: string;
  format: MTGFormat;
  strategy?: Strategy;
  commanderScryfallId?: string;
  collection: CollectionCard[];
}

// Basic lands always available regardless of collection
const BASIC_LANDS: Record<string, string[]> = {
  w: ["Plains"],
  u: ["Island"],
  b: ["Swamp"],
  r: ["Mountain"],
  g: ["Forest"],
};

// General good cards by color (staples)
const GENERAL_STAPLES: Record<string, string[]> = {
  any: ["Sol Ring", "Arcane Signet", "Command Tower", "Reliquary Tower", "Mind Stone"],
  w: ["Swords to Plowshares", "Path to Exile", "Wrath of God", "Smothering Tithe"],
  u: ["Counterspell", "Arcane Denial", "Rhystic Study", "Cyclonic Rift"],
  b: ["Sign in Blood", "Read the Bones", "Demonic Tutor", "Deadly Rollick"],
  r: ["Lightning Bolt", "Chaos Warp", "Vandalblast"],
  g: ["Cultivate", "Kodama's Reach", "Rampant Growth", "Farseek", "Birds of Paradise"],
};

function colorIdentityString(colors: string[]): string {
  return colors.map((c) => c.toLowerCase()).join("");
}

function ownedQuantity(name: string, collection: CollectionCard[]): number {
  return collection
    .filter((c) => c.card_name.toLowerCase() === name.toLowerCase())
    .reduce((s, c) => s + c.quantity, 0);
}

function scryfallToThemed(
  card: ScryfallCard,
  category: CardCategory,
  collection: CollectionCard[],
  quantity = 1
): ThemedCard {
  const owned = ownedQuantity(card.name, collection) >= quantity;
  return {
    name: card.name,
    scryfall_id: card.id,
    quantity,
    cmc: card.cmc,
    price_usd: parseFloat(card.prices.usd ?? "0"),
    category,
    owned,
  };
}

function buildManaCurve(cards: ThemedCard[]): Record<string, number> {
  const curve: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
  for (const card of cards) {
    const bucket = card.cmc >= 6 ? "6+" : String(Math.max(1, Math.floor(card.cmc)));
    curve[bucket] = (curve[bucket] ?? 0) + card.quantity;
  }
  return curve;
}
```

- [ ] **Step 2: Add commander search function**

After the helpers, add:

```ts
export async function findThemeCommanders(
  theme: string,
  collection: CollectionCard[]
): Promise<Array<ScryfallCard & { owned: boolean }>> {
  // Try exact creature type first, fall back to oracle text
  const typeQuery = `t:legendary t:creature t:${theme}`;
  const oracleQuery = `t:legendary t:creature o:"${theme}"`;

  const [byType, byOracle] = await Promise.all([
    searchCardsByQuery(typeQuery, 20),
    searchCardsByQuery(oracleQuery, 20),
  ]);

  const seen = new Set<string>();
  const combined: Array<ScryfallCard & { owned: boolean }> = [];

  for (const card of [...byType, ...byOracle]) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    combined.push({ ...card, owned: ownedQuantity(card.name, collection) > 0 });
  }

  // Owned commanders first
  combined.sort((a, b) => Number(b.owned) - Number(a.owned));
  return combined.slice(0, 15);
}
```

- [ ] **Step 3: Add card discovery function**

```ts
async function discoverThemeCards(
  theme: string,
  colorIdentity: string[],
  format: MTGFormat,
  collection: CollectionCard[]
): Promise<{ exact: ScryfallCard[]; support: ScryfallCard[]; general: ScryfallCard[] }> {
  const colorStr = colorIdentityString(colorIdentity);
  const formatQuery = format === "commander" ? "legal:commander" : `legal:${format}`;
  const idFilter = colorStr ? `id<=${colorStr}` : "";
  const base = `${idFilter} ${formatQuery}`.trim();

  const [exact, support] = await Promise.all([
    searchCardsByQuery(`t:${theme} ${base}`, 50),
    searchCardsByQuery(`o:"${theme}" -t:${theme} ${base}`, 50),
  ]);

  // General staples: fetch from collection or well-known names
  const stapleNames = [
    ...GENERAL_STAPLES.any,
    ...colorIdentity.flatMap((c) => GENERAL_STAPLES[c.toLowerCase()] ?? []),
  ];
  const stapleMap = await getCardsByNames(stapleNames);
  const general = Array.from(stapleMap.values()).filter((card) =>
    card.legalities[format] === "legal"
  );

  return { exact, support, general };
}
```

- [ ] **Step 4: Add Commander deck assembly**

```ts
async function assembleCommanderDeck(
  commander: ScryfallCard,
  theme: string,
  collection: CollectionCard[]
): Promise<BuiltDeck> {
  const colorIdentity = commander.color_identity;
  const colorStr = colorIdentityString(colorIdentity);

  const { exact, support, general } = await discoverThemeCards(
    theme, colorIdentity, "commander", collection
  );

  // EDHREC synergy cards for Version B
  const edhrecCards = await fetchEdhrecCommanderDeck(commander.name);
  const edhrecNames = edhrecCards.map((c) => c.name);
  const edhrecMap = await getCardsByNames(edhrecNames);

  const commanderCard = scryfallToThemed(commander, "exact", collection, 1);

  // Build spell pool (excluding commander itself)
  const usedIds = new Set<string>([commander.id]);
  const spellPool: ThemedCard[] = [];

  for (const card of exact) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    spellPool.push(scryfallToThemed(card, "exact", collection));
  }
  for (const card of support) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    spellPool.push(scryfallToThemed(card, "support", collection));
  }
  for (const card of general) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    spellPool.push(scryfallToThemed(card, "general", collection));
  }

  // Version A: only owned spells, max 61
  const ownedSpells = spellPool.filter((c) => c.owned).slice(0, 61);

  // Land pool: collection lands within color identity + basics
  const collectionLandNames = collection
    .filter((c) => {
      const lower = c.card_name.toLowerCase();
      return lower.includes("land") || ["plains","island","swamp","mountain","forest"].some(b => lower === b);
    })
    .map((c) => c.card_name);

  const landMap = await getCardsByNames(collectionLandNames.slice(0, 30));
  const ownedLands: ThemedCard[] = Array.from(landMap.values())
    .filter((card) => card.legalities["commander"] === "legal")
    .slice(0, 20)
    .map((card) => scryfallToThemed(card, "land", collection));

  // Fill remaining land slots with basics based on color identity
  const landsNeeded = 38 - ownedLands.length;
  const basicNames = colorIdentity.flatMap((c) => BASIC_LANDS[c.toLowerCase()] ?? []);
  const uniqueBasics = [...new Set(basicNames)];
  const basicsPerColor = Math.ceil(landsNeeded / Math.max(uniqueBasics.length, 1));
  for (const basic of uniqueBasics) {
    ownedLands.push({
      name: basic,
      scryfall_id: basic.toLowerCase(),
      quantity: basicsPerColor,
      cmc: 0,
      price_usd: 0,
      category: "land",
      owned: true,
    });
    if (ownedLands.reduce((s, l) => s + l.quantity, 0) >= 38) break;
  }

  const versionACards = ownedSpells.slice(0, 100 - 1 - ownedLands.length);

  // Version B: fill remaining slots with EDHREC cards not already owned
  const unownedEdhrec: ThemedCard[] = [];
  for (const [name, card] of edhrecMap) {
    if (usedIds.has(card.id)) continue;
    if (ownedQuantity(name, collection) > 0) continue;
    if (card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    unownedEdhrec.push(scryfallToThemed(card, "support", collection));
  }

  const spellSlotsNeeded = 100 - 1 - ownedLands.length;
  const versionBSpells = [
    ...versionACards,
    ...unownedEdhrec.slice(0, spellSlotsNeeded - versionACards.length),
  ];

  const buyList = [...versionBSpells.filter((c) => !c.owned), ...unownedEdhrec]
    .filter((c) => !c.owned)
    .sort((a, b) => a.price_usd - b.price_usd)
    .slice(0, 30);

  const buyCost = buyList.reduce((s, c) => s + c.price_usd * c.quantity, 0);
  const allCards = [commanderCard, ...versionBSpells];

  return {
    commander: commanderCard,
    cards: versionBSpells,
    lands: ownedLands,
    totalCards: 1 + versionBSpells.length + ownedLands.length,
    manaCurve: buildManaCurve(versionBSpells),
    ownedCount: allCards.filter((c) => c.owned).length + ownedLands.filter((c) => c.owned).length,
    buyList,
    buyCost,
  };
}
```

- [ ] **Step 5: Add 60-card deck assembly and main export**

```ts
async function assemble60CardDeck(
  theme: string,
  format: MTGFormat,
  strategy: Strategy,
  collection: CollectionCard[]
): Promise<BuiltDeck> {
  const { exact, support, general } = await discoverThemeCards(
    theme, [], format, collection
  );

  const usedIds = new Set<string>();
  const spellPool: ThemedCard[] = [];

  for (const card of [...exact, ...support, ...general]) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    spellPool.push(scryfallToThemed(card, exact.includes(card) ? "exact" : support.includes(card) ? "support" : "general", collection));
  }

  // Sort by strategy preference
  const sorted = spellPool.sort((a, b) => {
    if (strategy === "aggro") return a.cmc - b.cmc;
    if (strategy === "control") return b.cmc - a.cmc;
    return 0; // midrange/combo: keep EDHREC order
  });

  const ownedSpells = sorted.filter((c) => c.owned).slice(0, 36);
  const unownedSpells = sorted.filter((c) => !c.owned).slice(0, 36 - ownedSpells.length);
  const versionBSpells = [...ownedSpells, ...unownedSpells];

  // Lands: 24 slots, basics based on color distribution
  const colors = [...new Set(versionBSpells.flatMap((c) => {
    const card = exact.find((e) => e.id === c.scryfall_id) ??
                 support.find((s) => s.scryfall_id === c.scryfall_id);
    return card?.color_identity ?? [];
  }))];
  const basicNames = colors.flatMap((c) => BASIC_LANDS[c.toLowerCase()] ?? []);
  const uniqueBasics = [...new Set(basicNames.length > 0 ? basicNames : ["Plains"])];
  const perColor = Math.floor(24 / uniqueBasics.length);
  const lands: ThemedCard[] = uniqueBasics.map((name) => ({
    name,
    scryfall_id: name.toLowerCase(),
    quantity: perColor,
    cmc: 0,
    price_usd: 0,
    category: "land" as CardCategory,
    owned: true,
  }));

  const buyList = unownedSpells
    .sort((a, b) => a.price_usd - b.price_usd)
    .slice(0, 20);
  const buyCost = buyList.reduce((s, c) => s + c.price_usd * c.quantity, 0);

  return {
    cards: versionBSpells,
    lands,
    totalCards: versionBSpells.length + lands.reduce((s, l) => s + l.quantity, 0),
    manaCurve: buildManaCurve(ownedSpells),
    ownedCount: ownedSpells.length,
    buyList,
    buyCost,
  };
}

export async function buildThemeDeck(params: ThemeBuilderParams): Promise<{
  versionA: BuiltDeck;
  versionB: BuiltDeck;
}> {
  if (params.format === "commander" && params.commanderScryfallId) {
    const { getCardById } = await import("@/lib/scryfall");
    const commander = await getCardById(params.commanderScryfallId);
    if (!commander) throw new Error("Commander not found");
    const deck = await assembleCommanderDeck(commander, params.theme, params.collection);
    // Version A = owned only subset
    const versionA: BuiltDeck = {
      ...deck,
      cards: deck.cards.filter((c) => c.owned),
      buyList: [],
      buyCost: 0,
      ownedCount: deck.cards.filter((c) => c.owned).length + (deck.commander?.owned ? 1 : 0),
    };
    return { versionA, versionB: deck };
  }

  const deck = await assemble60CardDeck(
    params.theme, params.format, params.strategy ?? "midrange", params.collection
  );
  const versionA: BuiltDeck = {
    ...deck,
    cards: deck.cards.filter((c) => c.owned),
    buyList: [],
    buyCost: 0,
    ownedCount: deck.cards.filter((c) => c.owned).length,
  };
  return { versionA, versionB: deck };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/theme-builder.ts
git commit -m "feat: theme builder algorithm (card discovery + deck assembly)"
```

---

## Task 7: Theme builder API routes

**Files:** Create `src/app/api/theme-builder/commanders/route.ts` and `src/app/api/theme-builder/build/route.ts`

- [ ] **Step 1: Create commanders route**

`src/app/api/theme-builder/commanders/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { findThemeCommanders } from "@/lib/theme-builder";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("theme");
  if (!theme) return NextResponse.json({ error: "theme krävs" }, { status: 400 });

  const { data: collection } = await supabase
    .from("collection_cards").select("*").eq("user_id", user.id);

  const commanders = await findThemeCommanders(theme, collection ?? []);
  return NextResponse.json(commanders);
}
```

- [ ] **Step 2: Create build route**

`src/app/api/theme-builder/build/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { buildThemeDeck } from "@/lib/theme-builder";
import type { MTGFormat } from "@/lib/supabase/types";
import type { Strategy } from "@/lib/theme-builder";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { theme, format, strategy, commanderScryfallId } = body;

  if (!theme || !format) {
    return NextResponse.json({ error: "theme och format krävs" }, { status: 400 });
  }

  const { data: collection } = await supabase
    .from("collection_cards").select("*").eq("user_id", user.id);

  try {
    const result = await buildThemeDeck({
      theme,
      format: format as MTGFormat,
      strategy: strategy as Strategy | undefined,
      commanderScryfallId,
      collection: collection ?? [],
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kunde inte bygga leken" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/theme-builder/
git commit -m "feat: theme builder API routes (commanders + build)"
```

---

## Task 8: Theme builder UI component

**Files:** Create `src/app/(app)/builder/theme-builder-client.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
import type { MTGFormat } from "@/lib/supabase/types";
import type { BuiltDeck, ThemedCard, Strategy } from "@/lib/theme-builder";

const FORMAT_LABELS: Record<string, string> = {
  commander: "Commander", standard: "Standard", modern: "Modern", pauper: "Pauper",
};
const STRATEGY_LABELS: Record<string, string> = {
  aggro: "Aggro (snabb, låg kostnad)", control: "Control (långsam, reaktiv)",
  midrange: "Midrange (balanserad)", combo: "Combo (synergi-fokus)",
};

interface Commander {
  id: string; name: string; owned: boolean;
  prices: { usd: string | null };
  color_identity: string[];
  image_uris?: { small: string };
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
      setCommanders(data);
      setStep("commander");
    } finally {
      setLoading(false);
    }
  }

  async function handleBuild(commanderScryfallId?: string) {
    setLoading(true);
    setLoadingMsg("Bygger din lek... detta tar ~20 sekunder");
    try {
      const res = await fetch("/api/theme-builder/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, format, strategy: format !== "commander" ? strategy : undefined, commanderScryfallId }),
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
    setStep("input"); setResult(null); setCommanders([]); setSelectedCommander(null);
  }

  if (loading) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl animate-bounce">🃏</div>
        <p className="text-muted-foreground">{loadingMsg}</p>
      </div>
    );
  }

  if (step === "input") {
    return (
      <div className="max-w-lg space-y-6">
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
            onKeyDown={(e) => e.key === "Enter" && (format === "commander" ? handleSearchCommanders() : handleBuild())}
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
          <p className="text-muted-foreground text-sm">Välj en commander för ditt {theme}-tema</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {commanders.map((cmd) => (
            <Card
              key={cmd.id}
              className={`cursor-pointer transition-colors ${selectedCommander?.id === cmd.id ? "border-primary" : "hover:border-primary/50"}`}
              onClick={() => setSelectedCommander(cmd)}
            >
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-tight">{cmd.name}</p>
                  {cmd.owned && <Badge variant="default" className="text-xs flex-shrink-0">Äger</Badge>}
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
          className="mt-4"
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
        {/* Mana curve */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Manakurva</p>
          <div className="flex items-end gap-1 h-12">
            {cmcKeys.map((k) => {
              const count = deck.manaCurve[k] ?? 0;
              const height = Math.round((count / maxCount) * 100);
              return (
                <div key={k} className="flex flex-col items-center flex-1 gap-0.5">
                  <span className="text-xs text-muted-foreground">{count}</span>
                  <div
                    className="w-full bg-primary rounded-sm"
                    style={{ height: `${Math.max(height, count > 0 ? 8 : 0)}%` }}
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
            <TabsTrigger value="spells" className="flex-1">Stavningar ({deck.cards.length})</TabsTrigger>
            <TabsTrigger value="lands" className="flex-1">Land ({deck.lands.length})</TabsTrigger>
            {showBuyList && <TabsTrigger value="buy" className="flex-1">Köp ({deck.buyList.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="spells" className="mt-2 space-y-0.5 max-h-64 overflow-y-auto">
            {deck.cards.map((card, i) => <CardRow key={i} card={card} />)}
          </TabsContent>

          <TabsContent value="lands" className="mt-2 space-y-0.5 max-h-64 overflow-y-auto">
            {deck.lands.map((card, i) => <CardRow key={i} card={card} />)}
          </TabsContent>

          {showBuyList && (
            <TabsContent value="buy" className="mt-2 space-y-0.5 max-h-64 overflow-y-auto">
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
  const categoryColor: Record<string, string> = {
    exact: "bg-green-500", support: "bg-blue-400", general: "bg-gray-400", land: "bg-amber-400",
  };
  return (
    <div className="flex items-center justify-between px-1 py-0.5 hover:bg-accent/30 rounded text-sm">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${categoryColor[card.category]}`} />
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
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/builder/theme-builder-client.tsx"
git commit -m "feat: theme builder UI component"
```

---

## Task 9: Add theme tab to builder page

**Files:** Modify `src/app/(app)/builder/builder-client.tsx`

- [ ] **Step 1: Add tab wrapper around existing content**

At the top of the file, add the import:

```tsx
import ThemeBuilderClient from "./theme-builder-client";
```

Wrap the entire return of `BuilderClient` in a `<Tabs>` component. Change:

```tsx
return (
  <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold">Lek-byggaren</h1>
      <p className="text-muted-foreground mt-1">
        Jämför din samling mot meta-lekar och se vad du behöver köpa
      </p>
    </div>

    <div className="flex flex-col sm:flex-row gap-3">
      {/* ... existing filter row ... */}
    </div>
    {/* ... rest of existing JSX ... */}
  </div>
);
```

To:

```tsx
return (
  <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold">Lek-byggaren</h1>
      <p className="text-muted-foreground mt-1">
        Jämför din samling mot meta-lekar och se vad du behöver köpa
      </p>
    </div>

    <Tabs defaultValue="meta">
      <TabsList>
        <TabsTrigger value="meta">Meta-lekar</TabsTrigger>
        <TabsTrigger value="theme">Bygg från tema</TabsTrigger>
      </TabsList>

      <TabsContent value="meta" className="mt-4 space-y-6">
        {/* move existing filter row + results here */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* ... existing filter row content ... */}
        </div>
        {/* ... existing loading/error/cards JSX ... */}
      </TabsContent>

      <TabsContent value="theme" className="mt-4">
        <ThemeBuilderClient />
      </TabsContent>
    </Tabs>
  </div>
);
```

- [ ] **Step 2: Commit and push**

```bash
git add "src/app/(app)/builder/builder-client.tsx"
git commit -m "feat: add theme builder tab to deck builder page"
git push
```

---

## Self-Review

**Spec coverage check:**
- ✅ Format selected first (Task 8, step input)
- ✅ Free-text theme input (Task 8)
- ✅ Strategy for non-Commander formats (Task 8)
- ✅ Commander list: owned first, then popular (Task 6 `findThemeCommanders`)
- ✅ Three card categories: exact/support/general (Task 6)
- ✅ Two deck versions: collection-only + upgraded (Task 6 `buildThemeDeck`)
- ✅ Buy list with prices (Task 6 + Task 8 `DeckVersion`)
- ✅ Mana curve visualization (Task 8 `DeckVersion`)
- ✅ Sorting (Task 1)
- ✅ Saved recommendations API (Task 2)
- ✅ Save button (Task 3)
- ✅ Saved page + nav (Task 4)

**Type consistency check:**
- `ThemedCard`, `BuiltDeck`, `Strategy` defined in Task 6 and imported in Task 7 and Task 8 ✅
- `buildThemeDeck` returns `{ versionA, versionB }` — consumed correctly in Task 8 ✅
- `findThemeCommanders` returns `Array<ScryfallCard & { owned: boolean }>` — `Commander` interface in Task 8 matches ✅

**Placeholder scan:** No TBDs or incomplete sections found.
