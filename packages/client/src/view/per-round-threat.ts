/**
 * "+N per round" on a main scheme (issue #765): the threat step one of the villain phase will place on it, read from
 * the engine's own `stepOneThreatOf` (the very numbers `executePlaceThreat` places), with where it comes from for the
 * hover: the stage's acceleration, acceleration tokens, and each card in play that shows acceleration icons.
 */

import {
  areaOfCard,
  cardsInPlay,
  iconsOn,
  sameGameArea,
  stepOneThreatOf,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { faceUpName } from "./names.js";

export interface PerRoundThreat {
  readonly total: number;
  /** "Stage +1", "2 acceleration tokens +2", "Hydra Bomb +1": every non-zero part, in that order. */
  readonly sources: readonly string[];
}

/** "+2", "−1": an effect can lower a stage's acceleration below 0. */
const signed = (value: number): string => (value < 0 ? `−${-value}` : `+${value}`);

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** The step-one threat of the main scheme `id`, or null for a card that gains none (a side scheme). */
export function perRoundThreatOf(state: GameState, deps: EngineDeps, id: InstanceId): PerRoundThreat | null {
  const threat = stepOneThreatOf(state, deps, id);
  if (!threat) return null;
  const sources: string[] = [];
  if (threat.printed !== 0) sources.push(`Stage ${signed(threat.printed)}`);
  const tokens = threat.tokens + threat.otherTokens;
  if (tokens > 0) sources.push(`${plural(tokens, "acceleration token", "acceleration tokens")} +${tokens}`);
  if (threat.icons > 0) {
    // Each card showing the icon, named; anything the per-card count does not reach (an icon granted to the area
    // rather than a card) is one "other" line, so the parts always add up to the total.
    let named = 0;
    // With separate game areas (Kang) the engine counts only the icons in this scheme's area, so only its cards are
    // named (`nonSchemeIcons`' own `sameGameArea` test).
    const area = state.gameAreas.length > 0 ? areaOfCard(state, id) : null;
    for (const card of cardsInPlay(state)) {
      if (area && !sameGameArea(area, areaOfCard(state, card))) continue;
      const count = iconsOn(state, deps, card, "acceleration");
      if (count <= 0 || named + count > threat.icons) continue;
      sources.push(`${faceUpName(state, card)} +${count}`);
      named += count;
    }
    if (named < threat.icons) sources.push(`Acceleration icons +${threat.icons - named}`);
  }
  return { total: threat.total, sources };
}

/** "+3 per round", the line beside a main scheme's threat. */
export const perRoundLabel = (perRound: PerRoundThreat): string => `${signed(perRound.total)} per round`;

/** The hover's line: "+3 per round: Stage +1 · 1 acceleration token +1 · Hydra Bomb +1". */
export const perRoundHoverLine = (perRound: PerRoundThreat): string =>
  perRound.sources.length > 0 ? `${perRoundLabel(perRound)}: ${perRound.sources.join(" · ")}` : perRoundLabel(perRound);
