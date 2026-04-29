import type { CollectionCard, DeckCard, DeckRecommendation, MetaDeck } from "@/lib/supabase/types";
import { getCardsByNames } from "@/lib/scryfall";

export async function buildRecommendation(
  metaDeck: MetaDeck,
  collection: CollectionCard[]
): Promise<DeckRecommendation> {
  const deckCards = metaDeck.cards as unknown as DeckCard[];
  const collectionMap = new Map<string, number>();
  for (const card of collection) {
    collectionMap.set(card.card_name.toLowerCase(), card.quantity);
  }

  const allCardNames = deckCards.map((c) => c.name);
  const scryfallData = await getCardsByNames(allCardNames);

  const alreadyHave: DeckCard[] = [];
  const missing: DeckCard[] = [];

  for (const card of deckCards) {
    const owned = collectionMap.get(card.name.toLowerCase()) ?? 0;
    const scryfallCard = scryfallData.get(card.name.toLowerCase());
    const price = scryfallCard
      ? parseFloat(scryfallCard.prices.usd ?? "0")
      : 0;

    const cardWithPrice: DeckCard = {
      ...card,
      scryfall_id: scryfallCard?.id,
      price_usd: price,
    };

    if (owned >= card.quantity) {
      alreadyHave.push(cardWithPrice);
    } else {
      const alreadyOwnedCount = owned;
      if (alreadyOwnedCount > 0) {
        alreadyHave.push({ ...cardWithPrice, quantity: alreadyOwnedCount });
      }
      missing.push({
        ...cardWithPrice,
        quantity: card.quantity - alreadyOwnedCount,
      });
    }
  }

  // Budget upgrade: missing cards sorted by price ascending, up to ~30 USD
  const missingByPrice = [...missing].sort(
    (a, b) => (a.price_usd ?? 0) - (b.price_usd ?? 0)
  );

  const budgetCards: DeckCard[] = [];
  let budgetTotal = 0;
  let coverageAfterBudget = alreadyHave.reduce((s, c) => s + c.quantity, 0);

  for (const card of missingByPrice) {
    const cardCost = (card.price_usd ?? 0) * card.quantity;
    if (budgetTotal + cardCost <= 30) {
      budgetCards.push(card);
      budgetTotal += cardCost;
      coverageAfterBudget += card.quantity;
    }
  }

  const totalCards = deckCards.reduce((s, c) => s + c.quantity, 0);
  const alreadyHaveCount = alreadyHave.reduce((s, c) => s + c.quantity, 0);
  const fullNetdeckCost = missing.reduce(
    (s, c) => s + (c.price_usd ?? 0) * c.quantity,
    0
  );

  return {
    metaDeck,
    alreadyHave,
    alreadyHaveCount,
    totalCards,
    coveragePercent: Math.round((alreadyHaveCount / totalCards) * 100),
    budgetUpgrade: {
      cards: budgetCards,
      totalCost: budgetTotal,
      newCoveragePercent: Math.round((coverageAfterBudget / totalCards) * 100),
    },
    fullNetdeck: {
      cards: missing,
      totalCost: fullNetdeckCost,
    },
  };
}

export function parseDecklistText(text: string): DeckCard[] {
  const lines = text.trim().split("\n");
  const cards: DeckCard[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    const match = trimmed.match(/^(\d+)[xX]?\s+(.+?)(?:\s+\(.*\))?(?:\s+\d+)?$/);
    if (match) {
      cards.push({ quantity: parseInt(match[1]), name: match[2].trim() });
    }
  }

  return cards;
}

export function parseMoxfieldCsv(csv: string): Array<{ name: string; quantity: number; foil: boolean; set_code?: string }> {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const nameIdx = headers.findIndex((h) => h === "name" || h === "card name");
  const qtyIdx = headers.findIndex((h) => h === "count" || h === "qty" || h === "quantity");
  const foilIdx = headers.findIndex((h) => h === "foil");
  const setIdx = headers.findIndex((h) => h === "edition" || h === "set");

  if (nameIdx === -1 || qtyIdx === -1) return [];

  return lines.slice(1).flatMap((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    const name = cols[nameIdx];
    const quantity = parseInt(cols[qtyIdx]);
    if (!name || isNaN(quantity) || quantity <= 0) return [];
    return [{
      name,
      quantity,
      foil: foilIdx !== -1 ? cols[foilIdx]?.toLowerCase() === "true" : false,
      set_code: setIdx !== -1 ? cols[setIdx] : undefined,
    }];
  });
}
