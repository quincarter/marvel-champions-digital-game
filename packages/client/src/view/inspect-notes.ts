/**
 * Inspect lines for wave 8's in-play state that no stat tile or counter shows: a hit point floor a rule sets
 * (`consideredRemainingHp`, §3.10), the resource icons a card is considered to have (`consideredResourceIcon`, §3.42)
 * and what being in a scenario play area such as the mission area means for a card (§3.33, MC45 p. 5). Each answer is
 * the engine's own (`hitPointFloor`, `resourceIconsInPlay`, `scenarioPlayAreaOf`); nothing here restates a rule.
 */

import {
  cardOf,
  cardsInPlay,
  hitPointFloor,
  resourceIconsInPlay,
  scenarioPlayAreaOf,
  textBoxBlankFor,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type ResourcePool,
  type ResourceType,
} from "@mc/engine";

/** "Considered to have at least 1 hit point", or null when no rule sets a floor on this card. */
export function hitPointFloorNote(state: GameState, id: InstanceId, deps: EngineDeps): string | null {
  const floor = hitPointFloor(state, id, deps);
  if (floor === undefined) return null;
  return `Considered to have at least ${floor} hit point${floor === 1 ? "" : "s"}`;
}

const ICON_ORDER: readonly ResourceType[] = ["physical", "mental", "energy", "wild"];

/** A pool as a list of icons, a type once for each icon: `{ wild: 2 }` is `["wild", "wild"]`. */
const iconsOf = (pool: ResourcePool): readonly ResourceType[] =>
  ICON_ORDER.flatMap((type) => Array.from({ length: pool[type] }, () => type));

/**
 * "Resource icons: energy, wild (not printed: wild)": the icons a card in play has now, with the ones a rule gives it
 * set apart from the ones it prints. Null for a card that is not in play and for one with no considered icon: the
 * printed icons are already on the card.
 */
export function resourceIconNote(state: GameState, deps: EngineDeps, id: InstanceId): string | null {
  if (!cardsInPlay(state).includes(id)) return null;
  const { icons, considered } = resourceIconsInPlay(state, deps, id);
  const extra = iconsOf(considered);
  if (extra.length === 0) return null;
  return `Resource icons: ${iconsOf(icons).join(", ")} (not printed: ${extra.join(", ")})`;
}

/**
 * What being in a scenario play area means for this card: no player controls it, a closed area is not reached by
 * abilities that do not name it, and an ally there has a blank text box except for its traits. Empty for a card outside
 * every such area.
 */
export function scenarioAreaNotes(state: GameState, deps: EngineDeps, id: InstanceId): readonly string[] {
  const area = scenarioPlayAreaOf(state, id);
  if (area === null) return [];
  const notes = [`In the ${area} area: in play, but no player controls it`];
  if (state.scenarioPlayAreas?.[area]?.closed) notes.push("Card abilities don't reach it unless they name the area");
  if (cardOf(state, id)?.type === "ally" && textBoxBlankFor(state, id, deps)) {
    notes.push("Its text box is blank, except for traits");
  }
  return notes;
}
