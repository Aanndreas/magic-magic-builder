import { describe, it, expect } from "vitest";
import { parseMoxfieldCsv, parseDecklistText, buildRecommendation } from "@/lib/deck-engine";
import type { MetaDeck, CollectionCard } from "@/lib/supabase/types";

// ---------- parseMoxfieldCsv ----------

describe("parseMoxfieldCsv", () => {
  const manaboxHeader = `Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Scryfall ID`;

  it("parses basic Manabox row", () => {
    const csv = `${manaboxHeader}\n1,1,Lightning Bolt,M10,Near Mint,English,normal,,2024-01-01,149,abc-123`;
    const result = parseMoxfieldCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Lightning Bolt");
    expect(result[0].quantity).toBe(1);
    expect(result[0].foil).toBe(false);
    expect(result[0].set_code).toBe("M10");
    expect(result[0].scryfall_id).toBe("abc-123");
  });

  it("detects foil=foil (Manabox format)", () => {
    const csv = `${manaboxHeader}\n1,1,Black Lotus,LEA,Near Mint,English,foil,,2024-01-01,232,def-456`;
    const result = parseMoxfieldCsv(csv);
    expect(result[0].foil).toBe(true);
  });

  it("detects foil=true (legacy format)", () => {
    const csv = `Count,Name,Foil\n2,Sol Ring,true`;
    const result = parseMoxfieldCsv(csv);
    expect(result[0].foil).toBe(true);
    expect(result[0].quantity).toBe(2);
  });

  it("skips rows with invalid quantity", () => {
    const csv = `Count,Name,Foil\nabc,Bad Card,false\n1,Good Card,false`;
    const result = parseMoxfieldCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Good Card");
  });

  it("skips rows with missing name", () => {
    const csv = `Count,Name,Foil\n1,,false`;
    const result = parseMoxfieldCsv(csv);
    expect(result).toHaveLength(0);
  });

  it("returns empty for csv with only header", () => {
    const csv = `Count,Name,Foil`;
    expect(parseMoxfieldCsv(csv)).toHaveLength(0);
  });

  it("handles multiple rows", () => {
    const csv = `Count,Name,Foil\n3,Island,false\n4,Mountain,false`;
    const result = parseMoxfieldCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].quantity).toBe(3);
    expect(result[1].quantity).toBe(4);
  });

  it("recognises 'set code' header (Manabox column name)", () => {
    const csv = `Count,Name,Set Code\n1,Forest,ONE`;
    const result = parseMoxfieldCsv(csv);
    expect(result[0].set_code).toBe("ONE");
  });
});

// ---------- parseDecklistText ----------

describe("parseDecklistText", () => {
  it("parses standard MTGO decklist format", () => {
    const text = `4 Lightning Bolt\n2 Counterspell\n1 Black Lotus`;
    const result = parseDecklistText(text);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ quantity: 4, name: "Lightning Bolt" });
    expect(result[1]).toEqual({ quantity: 2, name: "Counterspell" });
  });

  it("skips comment lines starting with //", () => {
    const text = `// Instants\n4 Lightning Bolt`;
    const result = parseDecklistText(text);
    expect(result).toHaveLength(1);
  });

  it("skips empty lines", () => {
    const text = `\n4 Sol Ring\n\n1 Command Tower\n`;
    const result = parseDecklistText(text);
    expect(result).toHaveLength(2);
  });

  it("accepts 4x format", () => {
    const text = `4x Lightning Bolt`;
    const result = parseDecklistText(text);
    expect(result[0].quantity).toBe(4);
    expect(result[0].name).toBe("Lightning Bolt");
  });
});

// ---------- buildRecommendation (pure logic via mocking) ----------

describe("buildRecommendation – coverage calculation", () => {
  function makeMetaDeck(cards: Array<{ name: string; quantity: number }>): MetaDeck {
    return {
      id: "test-deck",
      format: "standard",
      deck_name: "Test Deck",
      archetype: "Test",
      source: "test",
      source_url: null,
      win_rate: null,
      popularity: null,
      cards: cards,
      fetched_at: new Date().toISOString(),
    };
  }

  function makeCollectionCard(card_name: string, quantity: number): CollectionCard {
    return {
      id: `col-${card_name}`,
      user_id: "user-1",
      scryfall_id: `sf-${card_name}`,
      card_name,
      quantity,
      foil: false,
      set_code: null,
      collector_number: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  it("100% coverage when collection matches deck exactly", async () => {
    const deck = makeMetaDeck([
      { name: "Lightning Bolt", quantity: 4 },
      { name: "Mountain", quantity: 20 },
    ]);
    const collection = [
      makeCollectionCard("Lightning Bolt", 4),
      makeCollectionCard("Mountain", 20),
    ];

    const rec = await buildRecommendation(deck, collection);
    expect(rec.coveragePercent).toBe(100);
    expect(rec.alreadyHaveCount).toBe(24);
    expect(rec.fullNetdeck.cards).toHaveLength(0);
  });

  it("0% coverage when collection is empty", async () => {
    const deck = makeMetaDeck([
      { name: "Lightning Bolt", quantity: 4 },
    ]);
    const rec = await buildRecommendation(deck, []);
    expect(rec.coveragePercent).toBe(0);
    expect(rec.alreadyHaveCount).toBe(0);
    expect(rec.fullNetdeck.cards).toHaveLength(1);
  });

  it("partial coverage: owns 2 of 4 copies", async () => {
    const deck = makeMetaDeck([{ name: "Lightning Bolt", quantity: 4 }]);
    const collection = [makeCollectionCard("Lightning Bolt", 2)];

    const rec = await buildRecommendation(deck, collection);
    expect(rec.coveragePercent).toBe(50);
    expect(rec.alreadyHaveCount).toBe(2);
    // Missing 2 copies in full netdeck
    expect(rec.fullNetdeck.cards[0].quantity).toBe(2);
    // Also tracked in alreadyHave with partial quantity
    expect(rec.alreadyHave[0].quantity).toBe(2);
  });

  it("totalCards counts sum of quantities", async () => {
    const deck = makeMetaDeck([
      { name: "Lightning Bolt", quantity: 4 },
      { name: "Counterspell", quantity: 4 },
    ]);
    const rec = await buildRecommendation(deck, []);
    expect(rec.totalCards).toBe(8);
  });

  it("budget upgrade respects $30 cap", async () => {
    // Cards above $30 total should not all be included in budget
    const deck = makeMetaDeck([
      { name: "Lightning Bolt", quantity: 4 },
      { name: "Counterspell", quantity: 4 },
    ]);
    const rec = await buildRecommendation(deck, []);
    expect(rec.budgetUpgrade.totalCost).toBeLessThanOrEqual(30);
  });
});
