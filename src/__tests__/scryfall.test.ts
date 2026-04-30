/**
 * Integration tests — kräver internetuppkoppling, slår mot Scryfall API.
 * Kör med: npm test
 */
import { describe, it, expect } from "vitest";
import {
  getCardByName,
  getCardsByNames,
  getCardsByIds,
  searchCards,
  searchCardsByQuery,
} from "@/lib/scryfall";

describe("Scryfall – getCardByName", { timeout: 15000 }, () => {
  it("hämtar Lightning Bolt med korrekt namn", async () => {
    const card = await getCardByName("Lightning Bolt");
    expect(card).not.toBeNull();
    expect(card!.name).toBe("Lightning Bolt");
    expect(card!.id).toBeTypeOf("string");
  });

  it("returnerar null för okänt kortnamn", async () => {
    const card = await getCardByName("Xxxx Inte Ett Riktigt Kort Yyyy");
    expect(card).toBeNull();
  });

  it("returnerar pris-fält", async () => {
    const card = await getCardByName("Sol Ring");
    expect(card).not.toBeNull();
    expect(card!.prices).toBeDefined();
    expect("usd" in card!.prices).toBe(true);
  });
});

describe("Scryfall – getCardsByNames (batch)", { timeout: 15000 }, () => {
  it("hämtar flera kort i ett anrop", async () => {
    const map = await getCardsByNames(["Sol Ring", "Lightning Bolt", "Counterspell"]);
    expect(map.size).toBe(3);
    expect(map.has("sol ring")).toBe(true);
    expect(map.has("lightning bolt")).toBe(true);
    expect(map.has("counterspell")).toBe(true);
  });

  it("ignorerar okända namn utan att krascha", async () => {
    const map = await getCardsByNames(["Lightning Bolt", "Xxxx Okänt Kortnamn Yyyy"]);
    expect(map.has("lightning bolt")).toBe(true);
    expect(map.size).toBeGreaterThanOrEqual(1);
  });

  it("returnerar tom map för tom lista", async () => {
    const map = await getCardsByNames([]);
    expect(map.size).toBe(0);
  });
});

describe("Scryfall – getCardsByIds (Manabox Scryfall IDs)", { timeout: 15000 }, () => {
  // Lightning Bolt (M10) känt Scryfall-ID
  const LIGHTNING_BOLT_ID = "e3285e6b-3e79-4d7c-bf96-d920f973b122";

  it("hämtar kort via Scryfall ID", async () => {
    const map = await getCardsByIds([LIGHTNING_BOLT_ID]);
    expect(map.has(LIGHTNING_BOLT_ID)).toBe(true);
    expect(map.get(LIGHTNING_BOLT_ID)!.name).toBe("Lightning Bolt");
  });

  it("returnerar tom map för ogiltigt ID", async () => {
    const map = await getCardsByIds(["00000000-0000-0000-0000-000000000000"]);
    expect(map.size).toBe(0);
  });
});

describe("Scryfall – searchCards", { timeout: 15000 }, () => {
  it("hittar zombie-kort", async () => {
    const cards = await searchCards("t:zombie legal:commander");
    expect(cards.length).toBeGreaterThan(0);
    cards.slice(0, 5).forEach((card) => {
      expect(card.type_line.toLowerCase()).toContain("zombie");
    });
  });
});

describe("Scryfall – searchCardsByQuery (paginering)", { timeout: 15000 }, () => {
  it("returnerar upp till maxResults kort", async () => {
    const cards = await searchCardsByQuery("t:zombie legal:commander", 30);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(30);
  });

  it("returnerar inga resultat för omöjlig sökning", async () => {
    const cards = await searchCardsByQuery("t:xxxxomöjligtyp123");
    expect(cards).toHaveLength(0);
  });
});
