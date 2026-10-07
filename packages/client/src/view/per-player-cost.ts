/**
 * A cost printed with the per player icon (Team Investigation 40053, Break Time 44046), as Inspect words it
 * (design frames 08B, L06B, 14B): the scaled price leads and the printed rate explains it. The multiplication is the
 * engine's (`printedCostOf`, RRG 1.8 "Per Player Icon", p. 32); this module only words what the engine already worked out.
 */
import { printedCostOf, type GameState } from "@mc/engine";
import type { AnyCard } from "@mc/content";

export interface PerPlayerCost {
  /** The printed numeral ("2" in "2 per player"). */
  readonly rate: number;
  /** Players who started the scenario, or null on a sheet with no game behind it (the Title screen's pickers). */
  readonly players: number | null;
  /** The price in this game, `rate × players`: what the badge and the Play button print. Null with no game. */
  readonly scaled: number | null;
  /** "2 per player" */
  readonly rateLabel: string;
  /** "× 2 players" ("× 1 player"); null with no game. */
  readonly countLabel: string | null;
  /** "2 per player × 2 players" */
  readonly line: string;
}

export function perPlayerCostOf(state: GameState | null, card: AnyCard | undefined): PerPlayerCost | null {
  if (!card || !("cost" in card) || typeof card.cost !== "number" || !card.costPerPlayer) return null;
  const rate = card.cost;
  const rateLabel = `${rate} per player`;
  if (!state) return { rate, players: null, scaled: null, rateLabel, countLabel: null, line: rateLabel };
  const players = state.startingPlayerCount;
  const countLabel = `× ${players} player${players === 1 ? "" : "s"}`;
  return {
    rate,
    players,
    scaled: printedCostOf(state, card),
    rateLabel,
    countLabel,
    line: `${rateLabel} ${countLabel}`,
  };
}
