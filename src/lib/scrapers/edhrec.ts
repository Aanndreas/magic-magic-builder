import type { DeckCard } from "@/lib/supabase/types";

interface EdhrecDeckEntry {
  name: string;
  inclusion: number;
  rank: number;
  primary_types: string[];
}

interface EdhrecThemeData {
  container: {
    json_dict: {
      cardlist: EdhrecDeckEntry[];
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

export async function fetchEdhrecTopCommanders(): Promise<EdhrecTopDeck[]> {
  const url = "https://json.edhrec.com/pages/commanders.json";
  const res = await fetch(url, { next: { revalidate: 43200 } });
  if (!res.ok) return [];

  const data = await res.json();
  const decks: EdhrecTopDeck[] = [];

  const cardlist = data?.container?.json_dict?.cardlist ?? [];
  for (const entry of cardlist.slice(0, 20)) {
    if (!entry.name) continue;
    decks.push({
      deck_name: entry.name,
      archetype: entry.name,
      source: "edhrec",
      source_url: `https://edhrec.com/commanders/${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      win_rate: null,
      popularity: entry.inclusion ?? null,
      cards: [],
    });
  }

  return decks;
}

export async function fetchEdhrecCommanderDeck(commanderName: string): Promise<DeckCard[]> {
  const slug = commanderName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const url = `https://json.edhrec.com/pages/commanders/${slug}.json`;
  const res = await fetch(url, { next: { revalidate: 43200 } });
  if (!res.ok) return [];

  const data: EdhrecThemeData = await res.json();
  const cardlist = data?.container?.json_dict?.cardlist ?? [];

  return cardlist
    .filter((c) => !c.primary_types?.includes("Land") || true)
    .slice(0, 99)
    .map((c) => ({
      name: c.name,
      quantity: 1,
    }));
}
