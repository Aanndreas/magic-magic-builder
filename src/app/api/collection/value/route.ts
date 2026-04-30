import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCardsByIds, getCardsByNames } from "@/lib/scryfall";
import type { CollectionCard } from "@/lib/supabase/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cards } = await (supabase as any)
    .from("collection_cards")
    .select("card_name, scryfall_id, quantity, foil")
    .eq("user_id", user.id) as { data: Pick<CollectionCard, "card_name" | "scryfall_id" | "quantity" | "foil">[] | null };

  if (!cards || cards.length === 0) {
    return NextResponse.json({ totalValue: 0, topCards: [], cardCount: 0 });
  }

  // Batch fetch prices by Scryfall ID where available, then by name for the rest
  const withId = cards.filter((c) => c.scryfall_id);
  const withoutId = cards.filter((c) => !c.scryfall_id);

  const [byId, byName] = await Promise.all([
    withId.length > 0 ? getCardsByIds(withId.map((c) => c.scryfall_id!)) : Promise.resolve(new Map()),
    withoutId.length > 0 ? getCardsByNames(withoutId.map((c) => c.card_name)) : Promise.resolve(new Map()),
  ]);

  let totalValue = 0;
  const cardValues: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }> = [];

  for (const card of cards) {
    const scryfall = card.scryfall_id
      ? byId.get(card.scryfall_id)
      : byName.get(card.card_name.toLowerCase());

    const priceStr = card.foil ? scryfall?.prices.usd_foil : scryfall?.prices.usd;
    const unitPrice = priceStr ? parseFloat(priceStr) : 0;
    const totalPrice = unitPrice * card.quantity;
    totalValue += totalPrice;

    if (unitPrice > 0) {
      cardValues.push({ name: card.card_name, quantity: card.quantity, unitPrice, totalPrice });
    }
  }

  const topCards = cardValues
    .sort((a, b) => b.totalPrice - a.totalPrice)
    .slice(0, 10);

  return NextResponse.json({
    totalValue: Math.round(totalValue * 100) / 100,
    topCards,
    cardCount: cards.length,
  });
}
