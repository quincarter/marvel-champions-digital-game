/**
 * "Your play" for one card (#529), for Inspect: what the player's finished games say about it, read from the
 * deck-building insights the stats worker folds (`view/deck-insights.ts`). The insights are kept for a short while so
 * stepping through a hand of cards asks the worker once, and asked again after a game may have finished.
 */
import type { SaveMeta } from "../engine/game-storage.js";
import { cardPlayOf, type CardPlayLine, type DeckInsights } from "../view/deck-insights.js";
import { loadDeckInsights } from "../view/player-stats-client.js";
import type { StatsNames } from "../view/player-stats-model.js";

/** How long folded insights are reused before the saves are read again. */
const KEEP_MS = 30_000;

let cached: { readonly at: number; readonly insights: Promise<DeckInsights> } | null = null;

/** The insights, folded now or within the last `KEEP_MS`. */
export function deckInsightsNow(
  listSaves: () => Promise<readonly SaveMeta[]>,
  now = Date.now(),
  load: (saves: readonly SaveMeta[]) => Promise<DeckInsights> = loadDeckInsights,
): Promise<DeckInsights> {
  if (!cached || now - cached.at > KEEP_MS) {
    const insights = listSaves().then((saves) => load(saves));
    cached = { at: now, insights };
    // A failed read is not kept.
    insights.catch(() => {
      if (cached?.insights === insights) cached = null;
    });
  }
  return cached.insights;
}

/** Player card types Inspect shows "Your play" for: ones that sit in a deck. */
const DECK_TYPES: ReadonlySet<string> = new Set([
  "ally",
  "event",
  "support",
  "upgrade",
  "resource",
  "player_side_scheme",
]);

export interface CardPlaySection {
  /** "Your play with Spider-Man" or "Your play". */
  readonly title: string;
  readonly lines: readonly CardPlayLine[];
}

/** The section for `cardId`, with `identityCardId`'s games only when given; null for a card with nothing to say. */
export function cardPlaySectionOf(
  insights: DeckInsights,
  cardId: string,
  identityCardId: string | null,
  names: StatsNames,
): CardPlaySection | null {
  if (!DECK_TYPES.has(names.cardType(cardId) ?? "")) return null;
  const lines = cardPlayOf(insights, cardId, identityCardId, names);
  if (!lines) return null;
  const hero = identityCardId ? (names.cardName(identityCardId) ?? identityCardId).replace(/ \(.*\)$/, "") : null;
  return { title: hero ? `Your play with ${hero}` : "Your play", lines };
}
