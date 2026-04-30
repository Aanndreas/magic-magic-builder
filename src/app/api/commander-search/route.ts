import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { searchCards } from "@/lib/scryfall";
import type { CollectionCard } from "@/lib/supabase/types";

function ownedQuantity(name: string, collection: CollectionCard[]): boolean {
  return collection.some((c) => c.card_name.toLowerCase() === name.toLowerCase());
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  if (!name || name.length < 2) return NextResponse.json([]);

  const { data: collection } = await supabase
    .from("collection_cards")
    .select("card_name")
    .eq("user_id", user.id);

  const cards = await searchCards(
    `t:legendary t:creature name:/^${name.replace(/[^a-zA-Z0-9\s]/g, "")}/`
  );

  const results = cards.slice(0, 20).map((card) => ({
    id: card.id,
    name: card.name,
    color_identity: card.color_identity,
    prices: { usd: card.prices.usd },
    image_uris: card.image_uris,
    card_faces: card.card_faces,
    owned: ownedQuantity(card.name, collection ?? []),
  }));

  // Owned commanders first
  results.sort((a, b) => Number(b.owned) - Number(a.owned));

  return NextResponse.json(results);
}
