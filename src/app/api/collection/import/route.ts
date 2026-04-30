import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parseMoxfieldCsv } from "@/lib/deck-engine";
import { getCardsByNames } from "@/lib/scryfall";

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

  const names = parsed.map((c) => c.name);
  const scryfallMap = await getCardsByNames(names);

  const rowMap = new Map<string, typeof parsed[0] & { scryfall_id: string; card_name: string; set: string; collector_number: string }>();
  for (const card of parsed) {
    const scryfall = scryfallMap.get(card.name.toLowerCase());
    if (!scryfall) continue;
    const key = `${scryfall.id}:${card.foil}`;
    const existing = rowMap.get(key);
    if (existing) {
      existing.quantity += card.quantity;
    } else {
      rowMap.set(key, { ...card, scryfall_id: scryfall.id, card_name: scryfall.name, set: scryfall.set, collector_number: scryfall.collector_number });
    }
  }

  const rows = Array.from(rowMap.values()).map((card) => ({
    user_id: user.id,
    scryfall_id: card.scryfall_id,
    card_name: card.card_name,
    quantity: card.quantity,
    foil: card.foil,
    set_code: card.set_code ?? card.set,
    collector_number: card.collector_number,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from("collection_cards")
    .upsert(rows as any, { onConflict: "user_id,scryfall_id,foil" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: rows.length, skipped: parsed.length - rows.length });
}
