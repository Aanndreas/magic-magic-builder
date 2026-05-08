import { createClient } from "@supabase/supabase-js";
import { scrapeMetaDecks, scrapeGoldfishDeck } from "@/lib/scrapers/goldfish";
import { fetchEdhrecTopCommanders, fetchEdhrecCommanderDeck } from "@/lib/scrapers/edhrec";
import type { MTGFormat } from "@/lib/supabase/types";
import type { Database } from "@/lib/supabase/types";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = { success: 0, errors: 0 };

  // Goldfish formats
  const goldfishFormats: MTGFormat[] = ["standard", "pioneer", "modern", "pauper"];
  for (const format of goldfishFormats) {
    try {
      const decks = await scrapeMetaDecks(format);
      for (const deck of decks.slice(0, 10)) {
        const cards = await scrapeGoldfishDeck(deck.source_url);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("meta_decks").upsert(
          {
            format: deck.format,
            deck_name: deck.deck_name,
            archetype: deck.archetype,
            source: deck.source,
            source_url: deck.source_url,
            win_rate: deck.win_rate,
            popularity: deck.popularity,
            cards: cards,
            fetched_at: new Date().toISOString(),
          } as any,
          { onConflict: "deck_name,format,source" }
        );
        if (error) results.errors++;
        else results.success++;
        // Be polite to MTGGoldfish
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      results.errors++;
    }
  }

  // EDHREC Commander
  try {
    const commanders = await fetchEdhrecTopCommanders();
    for (const commander of commanders.slice(0, 20)) {
      const cards = await fetchEdhrecCommanderDeck(commander.deck_name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("meta_decks").upsert(
        {
          format: "commander" as MTGFormat,
          deck_name: commander.deck_name,
          archetype: commander.archetype,
          source: "edhrec",
          source_url: commander.source_url,
          win_rate: null,
          popularity: commander.popularity,
          cards: cards,
          fetched_at: new Date().toISOString(),
        } as any,
        { onConflict: "deck_name,format,source" }
      );
      if (error) results.errors++;
      else results.success++;
    }
  } catch {
    results.errors++;
  }

  const { data: collectionCards } = await supabase
    .from("collection_cards")
    .select("id, card_name, scryfall_id")
    .limit(5000);

  if (collectionCards && collectionCards.length > 0) {
    const uniqueNames = [...new Set(collectionCards.map((c) => c.card_name))];
    const { getCardsByNames } = await import("@/lib/scryfall");
    const batches: string[][] = [];
    for (let i = 0; i < uniqueNames.length; i += 75) {
      batches.push(uniqueNames.slice(i, i + 75));
    }
    for (const batch of batches) {
      const scryfallData = await getCardsByNames(batch);
      const updates = collectionCards
        .filter((c) => scryfallData.has(c.card_name.toLowerCase()))
        .map((c) => ({
          id: c.id,
          price_usd: parseFloat(scryfallData.get(c.card_name.toLowerCase())?.prices?.usd ?? "0") || null,
        }));
      for (const update of updates) {
        await supabase.from("collection_cards").update({ price_usd: update.price_usd }).eq("id", update.id);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return Response.json({ ...results, refreshed_at: new Date().toISOString() });
}
