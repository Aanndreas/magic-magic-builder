import * as cheerio from "cheerio";
import type { MTGFormat } from "@/lib/supabase/types";
import type { DeckCard } from "@/lib/supabase/types";

const FORMAT_SLUGS: Partial<Record<MTGFormat, string>> = {
  standard: "standard",
  modern: "modern",
  pauper: "pauper",
  pioneer: "pioneer",
  legacy: "legacy",
};

export interface ScrapedDeck {
  deck_name: string;
  archetype: string;
  source: string;
  source_url: string;
  win_rate: number | null;
  popularity: number | null;
  cards: DeckCard[];
  format: MTGFormat;
}

export async function scrapeMetaDecks(format: MTGFormat): Promise<ScrapedDeck[]> {
  const slug = FORMAT_SLUGS[format];
  if (!slug) return [];

  const url = `https://www.mtggoldfish.com/metagame/${slug}/full`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) return [];

  const html = await res.text();
  const $ = cheerio.load(html);
  const decks: ScrapedDeck[] = [];

  $(".archetype-tile").each((_, tile) => {
    const nameEl = $(tile).find(".archetype-tile-title a");
    const deck_name = nameEl.text().trim();
    const href = nameEl.attr("href") || "";
    const source_url = href ? `https://www.mtggoldfish.com${href}` : url;

    const popularityText = $(tile).find(".archetype-tile-statistic-value").first().text().trim();
    const popularity = parseInt(popularityText) || null;

    if (!deck_name) return;

    decks.push({
      deck_name,
      archetype: deck_name,
      source: "mtggoldfish",
      source_url,
      win_rate: null,
      popularity,
      cards: [],
      format,
    });
  });

  return decks;
}

export async function scrapeGoldfishDeck(deckUrl: string): Promise<DeckCard[]> {
  const res = await fetch(deckUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) return [];

  const html = await res.text();
  const $ = cheerio.load(html);
  const cards: DeckCard[] = [];

  $(".deck-view-deck-table tr").each((_, row) => {
    const quantityText = $(row).find("td.deck-col-qty").text().trim();
    const nameEl = $(row).find("td.deck-col-card a");
    const name = nameEl.text().trim();
    const quantity = parseInt(quantityText);

    if (name && !isNaN(quantity) && quantity > 0) {
      cards.push({ name, quantity });
    }
  });

  return cards;
}
