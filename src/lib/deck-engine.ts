import type { CollectionCard, DeckCard, DeckRecommendation, MetaDeck } from "@/lib/supabase/types";
import { getCardsByNames } from "@/lib/scryfall";

const BASIC_LANDS = new Set([
  "plains", "island", "swamp", "mountain", "forest",
  "snow-covered plains", "snow-covered island", "snow-covered swamp",
  "snow-covered mountain", "snow-covered forest", "wastes",
]);

export function isBasicLand(name: string): boolean {
  return BASIC_LANDS.has(name.toLowerCase());
}

const COLOR_MAP: Record<string, string[]> = {
  azorius: ["W","U"], dimir: ["U","B"], rakdos: ["B","R"],
  gruul: ["R","G"], selesnya: ["G","W"], orzhov: ["W","B"],
  izzet: ["U","R"], golgari: ["B","G"], boros: ["R","W"], simic: ["G","U"],
  esper: ["W","U","B"], grixis: ["U","B","R"], jund: ["B","R","G"],
  naya: ["R","G","W"], bant: ["G","W","U"], abzan: ["W","B","G"],
  jeskai: ["U","R","W"], sultai: ["B","G","U"], mardu: ["R","W","B"],
  temur: ["G","U","R"],
};

export function getDeckColors(deckName: string, archetype: string): string[] {
  const text = `${deckName} ${archetype}`.toLowerCase();
  if (text.includes("five") || text.includes("rainbow") || text.includes("wubrg")) {
    return ["W","U","B","R","G"];
  }
  for (const [keyword, colors] of Object.entries(COLOR_MAP)) {
    if (text.includes(keyword)) return colors;
  }
  if (text.includes("white")) return ["W"];
  if (text.includes("blue")) return ["U"];
  if (text.includes("black")) return ["B"];
  if (text.includes("red")) return ["R"];
  if (text.includes("green")) return ["G"];
  return [];
}

export async function buildRecommendation(
  metaDeck: MetaDeck,
  collection: CollectionCard[],
  includeLands = true
): Promise<DeckRecommendation> {
  const deckCards = metaDeck.cards as unknown as DeckCard[];
  const collectionMap = new Map<string, number>();
  for (const card of collection) {
    collectionMap.set(card.card_name.toLowerCase(), card.quantity);
  }

  const filteredDeckCards = includeLands
    ? deckCards
    : deckCards.filter(c => !isBasicLand(c.name));

  const allCardNames = filteredDeckCards.map((c) => c.name);
  const scryfallData = await getCardsByNames(allCardNames);

  const alreadyHave: DeckCard[] = [];
  const missing: DeckCard[] = [];

  for (const card of filteredDeckCards) {
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

  const totalCards = filteredDeckCards.reduce((s, c) => s + c.quantity, 0);
  const alreadyHaveCount = alreadyHave.reduce((s, c) => s + c.quantity, 0);
  const fullNetdeckCost = missing.reduce(
    (s, c) => s + (c.price_usd ?? 0) * c.quantity,
    0
  );

  const missingByPrice = [...missing].sort(
    (a, b) => (a.price_usd ?? 0) - (b.price_usd ?? 0)
  );

  const mediumThreshold = Math.max(10, fullNetdeckCost * 0.35);

  const mediumCards: DeckCard[] = [];
  let mediumTotal = 0;
  let coverageAfterMedium = alreadyHaveCount;

  for (const card of missingByPrice) {
    const cardCost = (card.price_usd ?? 0) * card.quantity;
    if (mediumTotal + cardCost <= mediumThreshold) {
      mediumCards.push(card);
      mediumTotal += cardCost;
      coverageAfterMedium += card.quantity;
    }
  }

  return {
    metaDeck,
    alreadyHave,
    alreadyHaveCount,
    totalCards,
    coveragePercent: Math.round((alreadyHaveCount / totalCards) * 100),
    budgetUpgrade: {
      cards: mediumCards,
      totalCost: mediumTotal,
      newCoveragePercent: Math.round((coverageAfterMedium / totalCards) * 100),
      threshold: mediumThreshold,
    },
    mediumUpgrade: {
      cards: mediumCards,
      totalCost: mediumTotal,
      newCoveragePercent: Math.round((coverageAfterMedium / totalCards) * 100),
      threshold: mediumThreshold,
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

export function parseMoxfieldCsv(csv: string): Array<{ name: string; quantity: number; foil: boolean; set_code?: string; scryfall_id?: string }> {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const nameIdx = headers.findIndex((h) => h === "name" || h === "card name");
  const qtyIdx = headers.findIndex((h) => h === "count" || h === "qty" || h === "quantity");
  const foilIdx = headers.findIndex((h) => h === "foil");
  const setIdx = headers.findIndex((h) => h === "edition" || h === "set" || h === "set code");
  const scryfallIdIdx = headers.findIndex((h) => h === "scryfall id");

  if (nameIdx === -1 || qtyIdx === -1) return [];

  return lines.slice(1).flatMap((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
    const name = cols[nameIdx];
    const quantity = parseInt(cols[qtyIdx]);
    if (!name || isNaN(quantity) || quantity <= 0) return [];
    const foilRaw = foilIdx !== -1 ? cols[foilIdx]?.toLowerCase() : "";
    return [{
      name,
      quantity,
      foil: foilRaw === "true" || foilRaw === "foil",
      set_code: setIdx !== -1 ? cols[setIdx] : undefined,
      scryfall_id: scryfallIdIdx !== -1 ? cols[scryfallIdIdx] : undefined,
    }];
  });
}
