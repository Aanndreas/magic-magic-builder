import type { DeckCard } from "@/lib/supabase/types";

const SCRYFALL_BASE = "https://api.scryfall.com";

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  prices: { usd: string | null };
}

interface EdhrecCardView {
  name: string;
  inclusion?: number;
  sanitized?: string;
}

interface EdhrecCardList {
  cardviews?: EdhrecCardView[];
  cardlist?: EdhrecCardView[];
  tag?: string;
  header?: string;
}

interface EdhrecData {
  container?: {
    json_dict?: {
      cardlists?: EdhrecCardList[];
      cardlist?: EdhrecCardView[];
    };
  };
  panels?: {
    json_dict?: {
      cardlists?: EdhrecCardList[];
      cardlist?: EdhrecCardView[];
    };
  };
}

export interface EdhrecTopDeck {
  deck_name: string;
  archetype: string;
  source: string;
  source_url: string;
  win_rate: number | null;
  popularity: number | null;
  cards: DeckCard[];
}

// Use Scryfall (sorted by EDHREC rank) — more reliable than scraping EDHREC's JSON structure
export async function fetchEdhrecTopCommanders(): Promise<EdhrecTopDeck[]> {
  const url = `${SCRYFALL_BASE}/cards/search?q=t:legendary+t:creature+legal:commander&order=edhrec&unique=cards`;
  const res = await fetch(url, { next: { revalidate: 43200 } });
  if (!res.ok) return [];

  const data = await res.json();
  const cards: ScryfallCard[] = data.data ?? [];

  return cards.slice(0, 20).map((card) => ({
    deck_name: card.name,
    archetype: card.name,
    source: "edhrec",
    source_url: `https://edhrec.com/commanders/${card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    win_rate: null,
    popularity: null,
    cards: [],
  }));
}

export async function fetchEdhrecCommanderDeck(commanderName: string): Promise<DeckCard[]> {
  const slug = commanderName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const url = `https://json.edhrec.com/pages/commanders/${slug}.json`;
  const res = await fetch(url, { next: { revalidate: 43200 } });
  if (!res.ok) return [];

  const data: EdhrecData = await res.json();

  // Current EDHREC structure (2025): container.json_dict.cardlists[].cardviews
  // Fallback to older structures in case they change again
  const cardlists =
    data?.container?.json_dict?.cardlists ??
    data?.panels?.json_dict?.cardlists ??
    [];

  if (cardlists.length > 0) {
    const all: DeckCard[] = [];
    for (const group of cardlists) {
      const views = group.cardviews ?? group.cardlist ?? [];
      for (const card of views) {
        if (card.name) all.push({ name: card.name, quantity: 1 });
      }
    }
    return all.slice(0, 99);
  }

  // Older flat cardlist fallback
  const flatList =
    data?.container?.json_dict?.cardlist ??
    data?.panels?.json_dict?.cardlist ??
    [];

  return flatList
    .filter((c) => c.name)
    .slice(0, 99)
    .map((c) => ({ name: c.name, quantity: 1 }));
}
