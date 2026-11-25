/**
 * What the final state says about a finished game (#909, `docs/multiplayer-achievements-plan.md` package A4): how the
 * heroes stood at the end (full health, over printed hit points, supports in play), what was left in play, and in
 * which phase the game was won. Read once in `summarizeGame`, from the engine's final state and the game record;
 * kept as `GameSummary.endState`.
 *
 * Every number is the engine's own reading (`maxHitPoints`, `printedHpNumeral`, `keywordsOf`, `cardsInPlay`,
 * `isMinion`, `cardTypeOf`, `controllerOf`, `podOf`), never re-derived here. Plain data, so it stores and
 * structured-clones as is. Pure: no storage, no Phaser.
 */
import {
  cardTypeOf,
  cardsInPlay,
  controllerOf,
  isMinion,
  keywordsOf,
  maxHitPoints,
  printedHpNumeral,
  remainingHitPoints,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import type { GameRecord } from "./game-record.js";

/** A winning seat's hit points at the end ("Not a Scratch": remaining == max; "Plenty to Spare": remaining > printed). */
export interface EndStateWinner {
  readonly playerId: string;
  readonly identityCardId: string;
  /** Hit points left (the summary's `winners[].hitPoints`); null when the engine reads none. */
  readonly hitPoints: number | null;
  /** The identity's current maximum hit points, every modifier applied; null when the engine reads none. */
  readonly maxHitPoints: number | null;
  /** The hit points printed on the identity (RRG 1.8 "Printed", p. 35: never modified). */
  readonly printedHitPoints: number;
}

/** One seat's supports at the end ("Saving It for Later"). */
export interface EndStateSeat {
  readonly playerId: string;
  readonly identityCardId: string;
  /** Supports this seat controls that have the Uses keyword. */
  readonly usesSupports: number;
  /** Of those, the ones still holding every counter their Uses keywords placed (RRG 1.8 "Uses", p. 46). */
  readonly fullUsesSupports: number;
}

/** What the summary keeps (`GameSummary.endState`). */
export interface EndStateCounters {
  /** At a win, each seat still in the game, in seat order (the summary's `winners`); empty for any other result. */
  readonly winners: readonly EndStateWinner[];
  /** Every seat, in seat order, eliminated or not. */
  readonly seats: readonly EndStateSeat[];
  /** Minions in play at the end, held and attached ones included ("Clean Sweep" reads 0). */
  readonly minionsInPlayAtEnd: number;
  /** Encounter side schemes in play at the end ("Case Closed" reads 0). Player side schemes are not counted. */
  readonly sideSchemesInPlayAtEnd: number;
  /** Cards in the victory display at the end ("Trophy Case"). */
  readonly victoryDisplayCount: number;
  /**
   * The phase the game ended in ("Come at Me, Bro": a win in the villain phase). Read from the game record's
   * `lastPhase`, the phase the step change into `gameOver` came from (the final state's step is `gameOver` and keeps
   * no phase). A record written before that field existed falls back to the turn: a player's turn still open at the
   * end (`GameRecord.turn`) is the player phase, none open the villain phase, which misreads a game ended in the player
   * phase's end steps (discard, draw, ready) as the villain phase.
   */
  readonly endPhase: "player" | "villain";
  /** This table's group in an Epic Multiplayer pod (`PodState.groupId`); null outside a pod with a shared villain. */
  readonly groupId: string | null;
  /**
   * The group whose damage took the pod's shared villain (Loki) to its last hit points (`SharedPodState.defeatedByGroup`):
   * "Shatter the Illusion" when it equals `groupId`. Null when the shared villain was not defeated or there is no pod.
   */
  readonly lokiDefeatedByGroup: string | null;
}

/** A stand-in for another group's card is not this table's card (`CardInstance.remoteOf`). */
const isLocal = (state: GameState, id: InstanceId): boolean => !state.instances[id]?.remoteOf;

/**
 * Whether a support holds every counter its Uses keywords placed as it entered play, by counter type: `count` plus
 * `countPerPlayer` per player (RRG 1.8 "Per Player Icon", p. 32). The engine's own per player reading for a card
 * (`perPlayerCountAt`) is not exported; a player card counts the players who started the game, which is what it reads
 * for every player card (no printed player support has a per player Uses today).
 */
function usesOf(state: GameState, id: InstanceId, deps?: EngineDeps): Record<string, number> | null {
  const placed: Record<string, number> = {};
  let any = false;
  for (const keyword of keywordsOf(state, id, deps)) {
    if (keyword.name !== "uses") continue;
    any = true;
    placed[keyword.counterType] =
      (placed[keyword.counterType] ?? 0) + keyword.count + (keyword.countPerPlayer ?? 0) * state.startingPlayerCount;
  }
  return any ? placed : null;
}

function seatOf(state: GameState, playerId: PlayerId, identityCardId: string, deps?: EngineDeps): EndStateSeat {
  let usesSupports = 0;
  let fullUsesSupports = 0;
  for (const id of cardsInPlay(state)) {
    if (!isLocal(state, id) || cardTypeOf(state, id) !== "support" || controllerOf(state, id) !== playerId) continue;
    const uses = usesOf(state, id, deps);
    if (!uses) continue;
    usesSupports++;
    const counters = state.instances[id]!.counters;
    if (Object.entries(uses).every(([type, amount]) => (counters[type] ?? 0) >= amount)) fullUsesSupports++;
  }
  return { playerId, identityCardId, usesSupports, fullUsesSupports };
}

/** The end-state facts of a finished game (`state.outcome` set). */
export function endStateOf(state: GameState, record: GameRecord, deps?: EngineDeps): EndStateCounters {
  const won = state.outcome?.result === "win";
  const inPlay = cardsInPlay(state).filter((id) => isLocal(state, id));
  const shared = state.pod?.shared ?? null;
  return {
    // The same seats as the summary's `winners`.
    winners: won
      ? state.players
          .filter((player) => !player.eliminated)
          .map((player) => {
            const id = player.identity.instanceId;
            return {
              playerId: player.playerId,
              identityCardId: player.identity.cardId as string,
              hitPoints: remainingHitPoints(state, id, deps) ?? null,
              maxHitPoints: maxHitPoints(state, id, deps) ?? null,
              printedHitPoints: printedHpNumeral(state, id),
            };
          })
      : [],
    seats: state.players.map((player) => seatOf(state, player.playerId, player.identity.cardId as string, deps)),
    minionsInPlayAtEnd: inPlay.filter((id) => isMinion(state, id)).length,
    sideSchemesInPlayAtEnd: inPlay.filter((id) => cardTypeOf(state, id) === "side_scheme").length,
    victoryDisplayCount: state.victoryDisplay.length,
    endPhase: record.lastPhase ?? (record.turn ? "player" : "villain"),
    groupId: shared && state.pod ? (state.pod.groupId as string) : null,
    lokiDefeatedByGroup: (shared?.defeatedByGroup as string | undefined) ?? null,
  };
}
