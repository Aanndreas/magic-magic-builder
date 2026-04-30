# Theme-Based Deck Builder — Design Spec
_2026-04-30_

## Overview

A new tab in the deck builder ("Bygg från tema") that lets the user describe a theme and format, then automatically assembles a deck from their collection — with an optional upgraded version showing what to buy.

---

## User Flow

1. **Pick format** — Commander / Standard / Modern / Pauper
2. **Enter theme** — free text (e.g. "spiders", "flyers", "zombies", "burn")
3. **Pick strategy** _(non-Commander only)_ — Aggro / Control / Midrange / Combo
4. **Pick commander** _(Commander only)_ — list sorted: owned cards first, then popular cards the user doesn't own (sourced from EDHREC)
5. Click **"Bygg lek"**
6. See two deck versions side by side, with per-card editing

---

## Card Discovery Algorithm

### Step 1 — Theme search via Scryfall (free API)

Three parallel searches for cards matching the theme within the color identity:

| Category | Scryfall query | Example (theme: spiders) |
|----------|---------------|--------------------------|
| Exact match | `t:{theme} id:{colors} legal:{format}` | `t:spider id:bg legal:commander` |
| Theme support | `o:{theme} id:{colors} legal:{format}` | `o:spider id:bg legal:commander` |
| General good | hardcoded lists per format: ramp, draw, removal | Sol Ring, Kodama's Reach |

Results are deduplicated across categories. A card belongs to the highest-priority category it matches.

### Step 2 — Commander selection (Commander only)

- Search Scryfall: `t:legendary t:creature o:{theme} id:{theme_color_guess}`
- Also fetch EDHREC top commanders for the theme keyword
- Present list: owned cards marked, unowned shown with price
- After user picks, re-run step 1 filtered to the commander's color identity

### Step 3 — EDHREC synergy fill (Commander only)

Fetch the commander's EDHREC page and extract:
- Top synergy cards (existing scraper)
- Classify each as Exact / Support / General based on the theme

### Step 4 — Deck assembly

**Commander (100 cards):**
- Slots: 1 commander + up to 37 theme cards + up to 24 support + up to 38 lands
- Land count: 38 fixed, drawn from collection (basics always available)
- Priority order: Exact match → Theme support → General good → Basics

**60-card formats:**
- Slots: 24 lands + 36 spells
- Mana curve target by strategy:
  - Aggro: ≥40% of spells at CMC 1–2
  - Control: ≥40% of spells at CMC 3–5
  - Midrange: balanced spread
  - Combo: key combo pieces prioritized, rest flexible
- Legality enforced via Scryfall `legalities` field

---

## Output

Two deck versions presented side by side:

**Version A — Din samling**
- Built using only cards the user owns
- Shows mana curve chart (simple bar, CMC 1–7+)
- Total card count badge

**Version B — Uppgraderad**
- Same base as Version A + most popular missing theme cards from EDHREC
- Buy list sorted by (popularity / price) ratio — best value first
- Total buy cost shown

**Per-card editing (both versions):**
- Remove a card → replaced automatically with next best available card
- Add a card → search box, filtered to color identity + format legality

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/theme-builder/commanders` | GET | Search for commanders matching a theme. Params: `theme`, `format` |
| `/api/theme-builder/build` | POST | Build the deck. Body: `{ theme, format, strategy?, commander_id?, scryfall_commander_id? }` |

---

## Data Flow

```
User input (theme + format + strategy/commander)
  → /api/theme-builder/build
    → Scryfall: search by type + oracle text
    → EDHREC: synergy cards for commander (Commander only)
    → Cross-reference with user's collection (Supabase)
    → Assemble Version A (collection only)
    → Assemble Version B (+ EDHREC top picks)
  → Return both deck versions + buy list
```

---

## Out of Scope

- Saving theme-built decks (can be added later via saved_recommendations table)
- AI/LLM synergy suggestions (not needed — Scryfall + EDHREC covers it)
- Pioneer / Legacy formats (no scraper for these yet)
- Sideboard building

---

## Related Features (same release)

- **Sorting in meta deck list** — sort by coverage %, buy cost, popularity
- **Saved recommendations** — save a meta deck comparison to view later
