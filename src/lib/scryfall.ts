const SCRYFALL_BASE = "https://api.scryfall.com";

export interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  prices: {
    usd: string | null;
    usd_foil: string | null;
    eur: string | null;
  };
  image_uris?: {
    normal: string;
    small: string;
  };
  card_faces?: Array<{
    image_uris?: { normal: string; small: string };
  }>;
  type_line: string;
  mana_cost?: string;
  cmc: number;
  colors?: string[];
  color_identity: string[];
  legalities: Record<string, string>;
}

export interface ScryfallSearchResult {
  data: ScryfallCard[];
  total_cards: number;
  has_more: boolean;
  next_page?: string;
}

export async function searchCards(query: string): Promise<ScryfallCard[]> {
  const res = await fetch(
    `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(query)}&unique=cards`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data: ScryfallSearchResult = await res.json();
  return data.data;
}

export async function getCardByName(name: string): Promise<ScryfallCard | null> {
  const res = await fetch(
    `${SCRYFALL_BASE}/cards/named?exact=${encodeURIComponent(name)}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function getCardById(id: string): Promise<ScryfallCard | null> {
  const res = await fetch(`${SCRYFALL_BASE}/cards/${id}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getCardsByNames(names: string[]): Promise<Map<string, ScryfallCard>> {
  const result = new Map<string, ScryfallCard>();
  const chunks = [];
  for (let i = 0; i < names.length; i += 75) {
    chunks.push(names.slice(i, i + 75));
  }
  for (const chunk of chunks) {
    const res = await fetch(`${SCRYFALL_BASE}/cards/collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) continue;
    const data = await res.json();
    for (const card of data.data as ScryfallCard[]) {
      result.set(card.name.toLowerCase(), card);
    }
  }
  return result;
}

export async function getCardsByIds(ids: string[]): Promise<Map<string, ScryfallCard>> {
  const result = new Map<string, ScryfallCard>();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 75) {
    chunks.push(ids.slice(i, i + 75));
  }
  for (const chunk of chunks) {
    const res = await fetch(`${SCRYFALL_BASE}/cards/collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: chunk.map((id) => ({ id })) }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) continue;
    const data = await res.json();
    for (const card of data.data as ScryfallCard[]) {
      result.set(card.id, card);
    }
  }
  return result;
}

export function getCardImageUrl(card: ScryfallCard): string {
  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.card_faces?.[0]?.image_uris?.normal)
    return card.card_faces[0].image_uris.normal;
  return "";
}

export function getCardPrice(card: ScryfallCard, foil = false): number {
  const price = foil ? card.prices.usd_foil : card.prices.usd;
  return price ? parseFloat(price) : 0;
}
