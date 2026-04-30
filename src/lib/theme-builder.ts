import { searchCardsByQuery, getCardsByNames, getCardById } from "@/lib/scryfall";
import { fetchEdhrecCommanderDeck } from "@/lib/scrapers/edhrec";
import type { ScryfallCard } from "@/lib/scryfall";
import type { CollectionCard, MTGFormat } from "@/lib/supabase/types";

export type CardCategory = "exact" | "support" | "general" | "land";
export type Strategy = "aggro" | "control" | "midrange" | "combo";

export interface ThemedCard {
  name: string;
  scryfall_id: string;
  quantity: number;
  cmc: number;
  price_usd: number;
  category: CardCategory;
  owned: boolean;
}

export interface BuiltDeck {
  commander?: ThemedCard;
  cards: ThemedCard[];
  lands: ThemedCard[];
  totalCards: number;
  manaCurve: Record<string, number>;
  ownedCount: number;
  buyList: ThemedCard[];
  buyCost: number;
}

export interface ThemeBuilderParams {
  theme: string;
  format: MTGFormat;
  strategy?: Strategy;
  commanderScryfallId?: string;
  collection: CollectionCard[];
}

const BASIC_LANDS: Record<string, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

const GENERAL_STAPLES: Record<string, string[]> = {
  any: ["Sol Ring", "Arcane Signet", "Command Tower", "Reliquary Tower", "Mind Stone"],
  W: ["Swords to Plowshares", "Path to Exile", "Wrath of God", "Smothering Tithe"],
  U: ["Counterspell", "Arcane Denial", "Rhystic Study", "Cyclonic Rift"],
  B: ["Sign in Blood", "Read the Bones", "Demonic Tutor", "Deadly Rollick"],
  R: ["Lightning Bolt", "Chaos Warp", "Vandalblast"],
  G: ["Cultivate", "Kodama's Reach", "Rampant Growth", "Farseek", "Birds of Paradise"],
};

function ownedQuantity(name: string, collection: CollectionCard[]): number {
  return collection
    .filter((c) => c.card_name.toLowerCase() === name.toLowerCase())
    .reduce((s, c) => s + c.quantity, 0);
}

function scryfallToThemed(
  card: ScryfallCard,
  category: CardCategory,
  collection: CollectionCard[],
  quantity = 1
): ThemedCard {
  return {
    name: card.name,
    scryfall_id: card.id,
    quantity,
    cmc: card.cmc,
    price_usd: parseFloat(card.prices.usd ?? "0"),
    category,
    owned: ownedQuantity(card.name, collection) >= quantity,
  };
}

function buildManaCurve(cards: ThemedCard[]): Record<string, number> {
  const curve: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
  for (const card of cards) {
    const bucket = card.cmc >= 6 ? "6+" : String(Math.max(1, Math.floor(card.cmc)));
    curve[bucket] = (curve[bucket] ?? 0) + card.quantity;
  }
  return curve;
}

export async function findThemeCommanders(
  theme: string,
  collection: CollectionCard[]
): Promise<Array<ScryfallCard & { owned: boolean }>> {
  const [byType, byOracle] = await Promise.all([
    searchCardsByQuery(`t:legendary t:creature t:${theme}`, 20),
    searchCardsByQuery(`t:legendary t:creature o:"${theme}"`, 20),
  ]);

  const seen = new Set<string>();
  const combined: Array<ScryfallCard & { owned: boolean }> = [];

  for (const card of [...byType, ...byOracle]) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    combined.push({ ...card, owned: ownedQuantity(card.name, collection) > 0 });
  }

  combined.sort((a, b) => Number(b.owned) - Number(a.owned));
  return combined.slice(0, 15);
}

async function discoverThemeCards(
  theme: string,
  colorIdentity: string[],
  format: MTGFormat,
  collection: CollectionCard[]
): Promise<{ exact: ScryfallCard[]; support: ScryfallCard[]; general: ScryfallCard[] }> {
  const formatQuery = `legal:${format}`;
  const idFilter = colorIdentity.length > 0
    ? `id<=${colorIdentity.map((c) => c.toLowerCase()).join("")}`
    : "";
  const base = [idFilter, formatQuery].filter(Boolean).join(" ");

  // Skip theme searches when no theme given — rely on EDHREC + generals only
  const [exact, support] = theme.trim()
    ? await Promise.all([
        searchCardsByQuery(`t:${theme} ${base}`, 50),
        searchCardsByQuery(`o:"${theme}" -t:${theme} ${base}`, 50),
      ])
    : [[], []];

  const stapleNames = [
    ...GENERAL_STAPLES.any,
    ...colorIdentity.flatMap((c) => GENERAL_STAPLES[c] ?? []),
  ];
  const stapleMap = await getCardsByNames(stapleNames);
  const general = Array.from(stapleMap.values()).filter(
    (card) => card.legalities[format] === "legal"
  );

  return { exact, support, general };
}

async function assembleCommanderDeck(
  commander: ScryfallCard,
  theme: string,
  collection: CollectionCard[]
): Promise<BuiltDeck> {
  const colorIdentity = commander.color_identity;

  const { exact, support, general } = await discoverThemeCards(
    theme, colorIdentity, "commander", collection
  );

  const edhrecCards = await fetchEdhrecCommanderDeck(commander.name);
  const edhrecNames = edhrecCards.map((c) => c.name);
  const edhrecMap = await getCardsByNames(edhrecNames);

  const commanderCard = scryfallToThemed(commander, "exact", collection);
  const usedIds = new Set<string>([commander.id]);
  const spellPool: ThemedCard[] = [];

  for (const card of exact) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    spellPool.push(scryfallToThemed(card, "exact", collection));
  }
  for (const card of support) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    spellPool.push(scryfallToThemed(card, "support", collection));
  }
  for (const card of general) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    spellPool.push(scryfallToThemed(card, "general", collection));
  }

  const ownedSpells = spellPool.filter((c) => c.owned);

  // Build lands: owned lands from collection + basics
  const collectionLandNames = collection
    .filter((c) => ["plains", "island", "swamp", "mountain", "forest"].includes(c.card_name.toLowerCase()))
    .map((c) => c.card_name);
  const landMap = await getCardsByNames(collectionLandNames.slice(0, 30));
  const ownedLands: ThemedCard[] = Array.from(landMap.values())
    .filter((card) => card.legalities["commander"] === "legal")
    .slice(0, 10)
    .map((card) => scryfallToThemed(card, "land", collection));

  const landsNeeded = 38 - ownedLands.reduce((s, l) => s + l.quantity, 0);
  const uniqueBasics = [...new Set(colorIdentity.map((c) => BASIC_LANDS[c]).filter(Boolean))];
  if (uniqueBasics.length > 0) {
    const perColor = Math.ceil(landsNeeded / uniqueBasics.length);
    for (const basic of uniqueBasics) {
      ownedLands.push({
        name: basic,
        scryfall_id: basic.toLowerCase(),
        quantity: perColor,
        cmc: 0,
        price_usd: 0,
        category: "land",
        owned: true,
      });
    }
  }

  const landSlots = 38;
  const spellSlotsTotal = 100 - 1 - landSlots;
  const versionACards = ownedSpells.slice(0, spellSlotsTotal);

  // Version B: fill remaining slots with EDHREC cards
  const unownedEdhrec: ThemedCard[] = [];
  for (const [, card] of edhrecMap) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    unownedEdhrec.push(scryfallToThemed(card, "support", collection));
  }

  const versionBSpells = [
    ...versionACards,
    ...unownedEdhrec.slice(0, spellSlotsTotal - versionACards.length),
  ];

  const buyList = versionBSpells
    .filter((c) => !c.owned)
    .sort((a, b) => a.price_usd - b.price_usd)
    .slice(0, 30);

  const buyCost = buyList.reduce((s, c) => s + c.price_usd * c.quantity, 0);
  const allCards = [commanderCard, ...versionBSpells, ...ownedLands];

  return {
    commander: commanderCard,
    cards: versionBSpells,
    lands: ownedLands.slice(0, landSlots),
    totalCards: 1 + versionBSpells.length + Math.min(ownedLands.length, landSlots),
    manaCurve: buildManaCurve(versionBSpells),
    ownedCount: allCards.filter((c) => c.owned).length,
    buyList,
    buyCost,
  };
}

async function assemble60CardDeck(
  theme: string,
  format: MTGFormat,
  strategy: Strategy,
  collection: CollectionCard[]
): Promise<BuiltDeck> {
  const { exact, support, general } = await discoverThemeCards(theme, [], format, collection);

  const usedIds = new Set<string>();
  const spellPool: ThemedCard[] = [];
  const exactIds = new Set(exact.map((c) => c.id));
  const supportIds = new Set(support.map((c) => c.id));

  for (const card of [...exact, ...support, ...general]) {
    if (usedIds.has(card.id) || card.type_line?.includes("Land")) continue;
    usedIds.add(card.id);
    const category: CardCategory = exactIds.has(card.id)
      ? "exact"
      : supportIds.has(card.id)
      ? "support"
      : "general";
    spellPool.push(scryfallToThemed(card, category, collection));
  }

  const sorted = [...spellPool].sort((a, b) => {
    if (strategy === "aggro") return a.cmc - b.cmc;
    if (strategy === "control") return b.cmc - a.cmc;
    return 0;
  });

  const ownedSpells = sorted.filter((c) => c.owned).slice(0, 36);
  const unownedSpells = sorted.filter((c) => !c.owned).slice(0, 36 - ownedSpells.length);
  const versionBSpells = [...ownedSpells, ...unownedSpells];

  // Infer colors from spell pool for basic land distribution
  const colorCounts: Record<string, number> = {};
  for (const card of [...exact, ...support]) {
    for (const color of card.color_identity ?? []) {
      colorCounts[color] = (colorCounts[color] ?? 0) + 1;
    }
  }
  const colors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
  const uniqueBasics = [...new Set(colors.map((c) => BASIC_LANDS[c]).filter(Boolean))];
  const basicList = uniqueBasics.length > 0 ? uniqueBasics : ["Plains"];
  const perColor = Math.floor(24 / basicList.length);

  const lands: ThemedCard[] = basicList.map((name) => ({
    name,
    scryfall_id: name.toLowerCase(),
    quantity: perColor,
    cmc: 0,
    price_usd: 0,
    category: "land" as CardCategory,
    owned: true,
  }));

  const buyList = unownedSpells
    .sort((a, b) => a.price_usd - b.price_usd)
    .slice(0, 20);
  const buyCost = buyList.reduce((s, c) => s + c.price_usd * c.quantity, 0);

  return {
    cards: versionBSpells,
    lands,
    totalCards: versionBSpells.length + lands.reduce((s, l) => s + l.quantity, 0),
    manaCurve: buildManaCurve(ownedSpells),
    ownedCount: ownedSpells.length,
    buyList,
    buyCost,
  };
}

export async function buildThemeDeck(params: ThemeBuilderParams): Promise<{
  versionA: BuiltDeck;
  versionB: BuiltDeck;
}> {
  if (params.format === "commander" && params.commanderScryfallId) {
    const commander = await getCardById(params.commanderScryfallId);
    if (!commander) throw new Error("Commander hittades inte");
    const deck = await assembleCommanderDeck(commander, params.theme, params.collection);
    const versionA: BuiltDeck = {
      ...deck,
      cards: deck.cards.filter((c) => c.owned),
      buyList: [],
      buyCost: 0,
      ownedCount: deck.cards.filter((c) => c.owned).length + (deck.commander?.owned ? 1 : 0),
    };
    return { versionA, versionB: deck };
  }

  const deck = await assemble60CardDeck(
    params.theme,
    params.format,
    params.strategy ?? "midrange",
    params.collection
  );
  const versionA: BuiltDeck = {
    ...deck,
    cards: deck.cards.filter((c) => c.owned),
    buyList: [],
    buyCost: 0,
    ownedCount: deck.cards.filter((c) => c.owned).length,
  };
  return { versionA, versionB: deck };
}
