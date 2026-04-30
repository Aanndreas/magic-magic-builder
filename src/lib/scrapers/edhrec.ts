import type { DeckCard } from "@/lib/supabase/types";

const SCRYFALL_BASE = "https://api.scryfall.com";

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  prices: { usd: string | null };
}

interface EdhrecDeckEntry {
  name: string;
  inclusion: number;
  rank: number;
  primary_types: string[];
}

interface EdhrecThemeData {
  container?: { json_dict?: { cardlist?: EdhrecDeckEntry[] } };
  panels?: { json_dict?: { cardlist?: EdhrecDeckEntry[] } };
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

// Use Scryfall (sorted by EDHREC rank) for the top commander list — more reliable than scraping EDHREC's JSON structure
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

  const data: EdhrecThemeData = await res.json();

  // Handle multiple possible JSON structures from EDHREC
  const cardlist =
    data?.container?.json_dict?.cardlist ??
    data?.panels?.json_dict?.cardlist ??
    [];

  return cardlist
    .filter((c) => c.name && !c.primary_types?.includes("Basic"))
    .slice(0, 99)
    .map((c) => ({ name: c.name, quantity: 1 }));
}
