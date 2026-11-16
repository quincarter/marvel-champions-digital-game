/**
 * The threat each main scheme gains in step one of the villain phase (RRG 1.8 "Villain Phase", step 1; "Acceleration
 * Icon" and "Acceleration Token", p. 5), split into where it comes from. `executePlaceThreat` places exactly these
 * amounts, and the table reads the same numbers to show "+N per round" on a main scheme (issue #765), so the two can
 * never disagree.
 */

import type { EngineDeps } from "../abilities.js";
import type { InstanceId } from "../ids.js";
import { hasPerPlayerMainSchemes } from "../per-player-main-schemes.js";
import { iconsInPlay } from "../rules.js";
import { mainSchemeValue, playerOrder, sharedMainSchemes } from "../query.js";
import { gliderMainSchemeId, offSchemeAccelerationTokens } from "../select.js";
import type { GameState, MainSchemeState } from "../state.js";

/** One main scheme's step-one threat and its parts. */
export interface StepOneThreat {
  readonly schemeInstanceId: InstanceId;
  /** The stage's printed (or modified) acceleration value. */
  readonly printed: number;
  /** Acceleration tokens on this scheme. */
  readonly tokens: number;
  /**
   * Acceleration tokens that add to this scheme from elsewhere: tokens on other cards (docs/phase7-wave5.md §3.4), or
   * the central stage's tokens in a game with separate game areas (docs/phase7-wave2.md §4.3).
   */
  readonly otherTokens: number;
  /** Acceleration icons in play that count for this scheme, printed and gained. */
  readonly icons: number;
  /** The sum: what step one places. */
  readonly total: number;
}

const sum = (
  schemeInstanceId: InstanceId,
  printed: number,
  tokens: number,
  otherTokens: number,
  icons: number,
): StepOneThreat => ({
  schemeInstanceId,
  printed,
  tokens,
  otherTokens,
  icons,
  total: printed + tokens + otherTokens + icons,
});

/** Every main scheme that gains threat in step one, in the order `executePlaceThreat` places it. */
export function stepOneThreats(state: GameState, deps: EngineDeps): readonly StepOneThreat[] {
  if (state.gameAreas.length === 0) {
    // Every main scheme in play gains threat, each from its own acceleration and tokens plus the icons in play: MC21
    // p. 10 (docs/phase7-wave4.md §3.2). Tokens on other cards add to "the main scheme" (docs/phase7-wave5.md §3.4):
    // the glider's when there is one (MC27 p. 17); with a main scheme per player, to each (MC60 p. 13).
    const offScheme = offSchemeAccelerationTokens(state);
    const tokensGoTo = gliderMainSchemeId(state, deps) ?? state.mainScheme.instanceId;
    const perPlayer = hasPerPlayerMainSchemes(state);
    const icons = iconsInPlay(state, deps, "acceleration");
    return sharedMainSchemes(state).map((scheme: MainSchemeState) =>
      sum(
        scheme.instanceId,
        mainSchemeValue(state, "acceleration", deps, scheme),
        scheme.accelerationTokens,
        perPlayer || scheme.instanceId === tokensGoTo ? offScheme : 0,
        icons,
      ),
    );
  }
  // Separate game areas (docs/phase7-wave2.md §3.1): each area's own stage, acceleration, tokens and icons, plus the
  // central stage's tokens (RRG 1.8 "Acceleration Token", p. 5; docs/phase7-wave2.md §4.3's proposed reading).
  return state.gameAreas.flatMap((area) =>
    area.mainScheme
      ? [
          sum(
            area.mainScheme.instanceId,
            mainSchemeValue(state, "acceleration", deps, area.mainScheme),
            area.mainScheme.accelerationTokens,
            state.mainScheme.accelerationTokens,
            iconsInPlay(state, deps, "acceleration", area),
          ),
        ]
      : [],
  );
}

/** One main scheme's step-one threat, or null for a card that gains none (a side scheme, a stage out of play). */
export const stepOneThreatOf = (
  state: GameState,
  deps: EngineDeps,
  schemeInstanceId: InstanceId,
): StepOneThreat | null =>
  stepOneThreats(state, deps).find((entry) => entry.schemeInstanceId === schemeInstanceId) ?? null;

/**
 * How many encounter cards step 3 of the villain phase deals (RRG 1.8 "Villain Phase", p. 47): one to each player, X
 * more each at heroic level X (RRG 1.8 "Modes of Play", p. 29), then one per hazard icon in play in total, "not one
 * card per player" (RRG 1.8 "Hazard Icon", p. 21). `executeDealEncounterCards` deals exactly this many, and the table's
 * encounter deck forecast (issue #769) reads it.
 */
export function stepThreeDealCount(state: GameState, deps: EngineDeps): number {
  const players = playerOrder(state).length;
  if (players === 0) return 0;
  return players * (1 + (state.scenarioRules.heroicLevel ?? 0)) + iconsInPlay(state, deps, "hazard");
}
