import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parseMoxfieldCsv } from "@/lib/deck-engine";
import { getCardsByNames, getCardsByIds } from "@/lib/scryfall";
import type { ScryfallCard } from "@/lib/scryfall";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const parsed = parseMoxfieldCsv(text);
  if (parsed.length === 0) return NextResponse.json({ error: "Could not parse CSV" }, { status: 400 });

  // Fetch card data from Scryfall — use ID when available (faster, more accurate), name otherwise
  const idsToFetch = [...new Set(parsed.filter((c) => c.scryfall_id).map((c) => c.scryfall_id!))];
  const namesToFetch = [...new Set(parsed.filter((c) => !c.scryfall_id).map((c) => c.name))];

  const [idMap, nameMap] = await Promise.all([
    idsToFetch.length > 0 ? getCardsByIds(idsToFetch) : Promise.resolve(new Map<string, ScryfallCard>()),
    namesToFetch.length > 0 ? getCardsByNames(namesToFetch) : Promise.resolve(new Map<string, ScryfallCard>()),
  ]);

  // Merge rows — deduplicate on (scryfall_id, foil) and sum quantities
  const rowMap = new Map<string, {
    scryfall_id: string;
    card_name: string;
    quantity: number;
    foil: boolean;
    set_code: string;
    collector_number: string;
  }>();

  for (const card of parsed) {
    const scryfall = card.scryfall_id
      ? idMap.get(card.scryfall_id)
      : nameMap.get(card.name.toLowerCase());

    if (!scryfall) continue;

    const key = `${scryfall.id}:${card.foil}`;
    const existing = rowMap.get(key);
    if (existing) {
      existing.quantity += card.quantity;
    } else {
      rowMap.set(key, {
        scryfall_id: scryfall.id,
        card_name: scryfall.name,
        quantity: card.quantity,
        foil: card.foil,
        set_code: card.set_code ?? scryfall.set,
        collector_number: scryfall.collector_number,
      });
    }
  }

  const rows = Array.from(rowMap.values()).map((card) => ({
    user_id: user.id,
    ...card,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from("collection_cards")
    .upsert(rows as any, { onConflict: "user_id,scryfall_id,foil" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: rows.length, skipped: parsed.length - rows.length });
}
