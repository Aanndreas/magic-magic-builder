/**
 * Integration tests för EDHREC-scrapern och commander-flödet.
 * Det här är de tester som hade fångat commander-buggen.
 * Kräver internetuppkoppling.
 */
import { describe, it, expect } from "vitest";
import { fetchEdhrecTopCommanders, fetchEdhrecCommanderDeck } from "@/lib/scrapers/edhrec";

describe("fetchEdhrecTopCommanders – commander-buggen", { timeout: 20000 }, () => {
  it("returnerar minst 10 commanders (ej tom lista)", async () => {
    const commanders = await fetchEdhrecTopCommanders();
    // Exakt det här testet hade misslyckats med den gamla EDHREC-implementationen
    // som returnerade [] pga trasig JSON-struktur.
    expect(commanders.length).toBeGreaterThanOrEqual(10);
  });

  it("varje commander har ett namn", async () => {
    const commanders = await fetchEdhrecTopCommanders();
    commanders.forEach((cmd) => {
      expect(cmd.deck_name).toBeTruthy();
      expect(typeof cmd.deck_name).toBe("string");
    });
  });

  it("commanders har source='edhrec'", async () => {
    const commanders = await fetchEdhrecTopCommanders();
    commanders.forEach((cmd) => {
      expect(cmd.source).toBe("edhrec");
    });
  });

  it("commanders har source_url som börjar med https://edhrec.com", async () => {
    const commanders = await fetchEdhrecTopCommanders();
    commanders.forEach((cmd) => {
      expect(cmd.source_url).toMatch(/^https:\/\/edhrec\.com/);
    });
  });

  it("max 20 commanders returneras (Scryfall-gräns vi sätter)", async () => {
    const commanders = await fetchEdhrecTopCommanders();
    expect(commanders.length).toBeLessThanOrEqual(20);
  });
});

describe("fetchEdhrecCommanderDeck – kortlista per commander", { timeout: 20000 }, () => {
  // Atraxa är en av de mest populära commanders, bra referens
  const TEST_COMMANDER = "Atraxa, Praetors' Voice";

  it("returnerar kort för en känd commander", async () => {
    const cards = await fetchEdhrecCommanderDeck(TEST_COMMANDER);
    // Kan vara tom om EDHREC-JSON har ändrat struktur — det är just det testet ska fånga
    expect(cards.length).toBeGreaterThan(0);
  });

  it("varje kort har ett namn", async () => {
    const cards = await fetchEdhrecCommanderDeck(TEST_COMMANDER);
    cards.forEach((card) => {
      expect(card.name).toBeTruthy();
    });
  });

  it("returnerar max 99 kort (Commander-lek utan commander)", async () => {
    const cards = await fetchEdhrecCommanderDeck(TEST_COMMANDER);
    expect(cards.length).toBeLessThanOrEqual(99);
  });

  it("returnerar tom lista för nonsens-commander utan krasch", async () => {
    const cards = await fetchEdhrecCommanderDeck("Xxxx Finns Inte Yyyy");
    expect(Array.isArray(cards)).toBe(true);
  });
});
