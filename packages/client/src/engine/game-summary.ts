/**
 * What the achievements need to know about a finished game, kept on its save row (`SaveMeta.summary`).
 *
 * Everything else an achievement reads (outcome, scenario, heroes, round) is already on the row; these are the counts
 * it isn't: why a loss happened, how many heroes fell, how a winning hero stood at the end, and whether an ally was
 * ever played. Derived from the engine's final state and the game record (`game-record.ts`, itself folded from the
 * engine's events), never decided here. Plain data, so it stores and structured-clones as is.
 *
 * Pure: no storage, no Phaser. A game still being played has no summary (null).
 */
import {
  controllerOf,
  getInstance,
  remainingHitPoints,
  type EngineDeps,
  type GameState,
  type PlayerId,
  type ResourcePool,
} from "@mc/engine";
import type { GameRecord } from "./game-record.js";

/**
 * The summary's shape version (`GameSummary.version`), bumped when a summary gains numbers a backfill should fill in
 * on games finished before them (`engine/summary-backfill.ts`):
 *
 * - 1 (absent): up to the per-seat card numbers, the villains and the side schemes.
 * - 2: draws, resources, the cards paid with, best turns, the allies' numbers, the encounter cards revealed, what hurt
 *   the heroes and the card that dealt the final blow.
 */
export const SUMMARY_VERSION = 2;

/** Why a game was lost, in the terms the "Read the Room" and "Respawn Pending" achievements care about. */
export type LossReason = "playersDefeated" | "schemeCompleted" | "conceded" | "other";

/**
 * One seat's game, for the stats screen (`view/player-stats-model.ts`): who they played, what was in their deck and
 * what they did with it. Every count is the game record's.
 */
export interface SeatSummary {
  readonly identityCardId: string;
  /** The deck's aspects, read from the aspect cards in it (a starter deck's included); empty for a deck of none. */
  readonly aspects: readonly string[];
  /** Each card the seat brought in its deck, once, whatever its copies (identity and encounter cards are not). */
  readonly deck: readonly string[];
  readonly plays: Readonly<Record<string, number>>;
  readonly activations: Readonly<Record<string, number>>;
  /** Cards of the seat's that came into play, played or put into play (`SeatRecord.entered`). */
  readonly entered: Readonly<Record<string, number>>;
  readonly damage: number;
  readonly thwart: number;
  /** The seat's hero was defeated during the game. */
  readonly defeated: boolean;
  /** The seat sat the scenario out (`SeatRecord.satOut`). */
  readonly satOut?: true;
  /** Cards drawn (`SeatRecord.drawn`). This and the fields below are absent on a summary before version 2. */
  readonly drawn?: number;
  /** Resources generated paying costs, by type (`SeatRecord.resources`). */
  readonly resources?: ResourcePool;
  /** Cards paid with, by card id, and how many of those were spent from hand (`SeatRecord.paidWith`). */
  readonly paidWith?: Readonly<Record<string, number>>;
  readonly discardedToPay?: number;
  /** The most damage and the most thwart in one of the seat's turns (`SeatRecord.bestTurn`). */
  readonly bestTurn?: { readonly damage: number; readonly thwart: number };
  /** By ally card id: damage to enemies, defenses, and defeats while defending (`SeatRecord.allyDamage` and on). */
  readonly allyDamage?: Readonly<Record<string, number>>;
  readonly allyBlocks?: Readonly<Record<string, number>>;
  readonly allyDiedBlocking?: Readonly<Record<string, number>>;
}

/** A seat standing when the game was won. */
export interface WinningSeat {
  /** The seat's identity card id (the hero a "Win with X" achievement names). */
  readonly identityCardId: string;
  /** Hit points left on the identity at the win; null when the engine can't say. */
  readonly hitPoints: number | null;
  /** True when the seat ended in hero form, false in alter-ego form. */
  readonly inHeroForm: boolean;
}

export interface GameSummary {
  /** Null for a win. */
  readonly lossReason: LossReason | null;
  /** Identity defeats during the game: seats eliminated by play, not seats that sat the scenario out. */
  readonly heroesDefeated: number;
  /** The seats still standing at a win; empty for any other result. */
  readonly winners: readonly WinningSeat[];
  /** Allies played by any seat, over the whole game. */
  readonly alliesPlayed: number;
  /**
   * At a win, the identity card id of the seat whose card dealt the villain its last damage (the game record's last
   * blow, attributed like the game-over screen: the card's controller, else its owner); null when no seat did. Absent
   * on a summary written before the field existed.
   */
  readonly finalBlowBy?: string | null;
  /** Team-Up cards played by any seat, over the whole game. Absent on a summary written before the field existed. */
  readonly teamUpsPlayed?: number;
  /** Each seat's game, in seat order. Absent on a summary written before the field existed. */
  readonly seats?: readonly SeatSummary[];
  /**
   * The scenario's villains by name (a villain's stage cards share one), in the order the game built them. Absent on an
   * older summary.
   */
  readonly villains?: readonly string[];
  /** Side schemes that came into play, and those defeated, by card id. Absent on an older summary. */
  readonly sideSchemes?: {
    readonly seen: Readonly<Record<string, number>>;
    readonly defeated: Readonly<Record<string, number>>;
  };
  /** `SUMMARY_VERSION` when it was written; absent on a version 1 summary. */
  readonly version?: number;
  /** Encounter cards revealed, by card id (`GameRecord.encounterRevealed`). Absent before version 2. */
  readonly encounterRevealed?: Readonly<Record<string, number>>;
  /** Damage to the heroes and their allies by encounter cards, by card id (`GameRecord.hurtBy`). Absent before version 2. */
  readonly hurtBy?: Readonly<Record<string, number>>;
  /**
   * At a win, the card id of the card that dealt the villain its last damage (the source `finalBlowBy` names the seat
   * of); null when the engine named none or for any other result. Absent before version 2.
   */
  readonly finalBlowCardId?: string | null;
}

/** The four aspects and 'Pool, as a deck's aspect cards name them (`Aspect`); basic and hero cards are neither. */
const DECK_ASPECTS: ReadonlySet<string> = new Set(["aggression", "justice", "leadership", "protection", "pool"]);
const DECK_TYPES: ReadonlySet<string> = new Set([
  "ally",
  "event",
  "support",
  "upgrade",
  "resource",
  "player_side_scheme",
]);

/**
 * The cards a seat could play (its deck at the start, `SeatRecord.deck`, else every instance it owns of a player deck
 * card type), and the aspects among every card it brought.
 */
function deckOf(
  state: GameState,
  playerId: PlayerId,
  atStart: readonly string[] | undefined,
): { readonly deck: string[]; readonly aspects: string[] } {
  const deck = new Set<string>();
  const aspects = new Set<string>();
  for (const instance of Object.values(state.instances)) {
    if (instance.ownerId !== playerId) continue;
    const card = state.cardPool[instance.cardId];
    if (!card || !DECK_TYPES.has(card.type)) continue;
    deck.add(instance.cardId);
    if ("aspect" in card && DECK_ASPECTS.has(card.aspect)) aspects.add(card.aspect);
  }
  return { deck: atStart ? [...atStart] : [...deck].sort(), aspects: [...aspects].sort() };
}

function seatSummariesOf(state: GameState, record: GameRecord): SeatSummary[] {
  return state.players.map((player) => {
    const seat = record.seats.find((s) => s.playerId === player.playerId);
    return {
      identityCardId: player.identity.cardId as string,
      ...deckOf(state, player.playerId, seat?.deck),
      plays: seat?.plays ?? {},
      entered: seat?.entered ?? {},
      activations: seat?.activations ?? {},
      damage: seat?.damage ?? 0,
      thwart: seat?.thwart ?? 0,
      defeated: (seat?.defeatedInRound ?? null) !== null,
      ...(seat?.satOut ? { satOut: true as const } : {}),
      drawn: seat?.drawn ?? 0,
      resources: seat?.resources ?? { physical: 0, mental: 0, energy: 0, wild: 0 },
      paidWith: seat?.paidWith ?? {},
      discardedToPay: seat?.discardedToPay ?? 0,
      bestTurn: seat?.bestTurn ?? { damage: 0, thwart: 0 },
      allyDamage: seat?.allyDamage ?? {},
      allyBlocks: seat?.allyBlocks ?? {},
      allyDiedBlocking: seat?.allyDiedBlocking ?? {},
    };
  });
}

/** Every villain the game built, by name: each one's stages count once. */
function villainsOf(state: GameState): string[] {
  const names = new Set<string>();
  for (const instance of Object.values(state.instances)) {
    const card = state.cardPool[instance.cardId];
    if (card?.type === "villain") names.add(card.name);
  }
  return [...names];
}

const lossReasonOf = (outcome: NonNullable<GameState["outcome"]>): LossReason | null => {
  if (outcome.result === "win") return null;
  if (outcome.result === "conceded") return "conceded";
  if (outcome.result !== "loss") return "other";
  if (outcome.reason === "mainSchemeCompleted") return "schemeCompleted";
  if (outcome.reason === "allPlayersDefeated") return "playersDefeated";
  return "other";
};

function finalBlowIdentityOf(state: GameState, record: GameRecord): string | null {
  const source = record.lastVillainDamage?.sourceInstanceId ?? null;
  if (!source) return null;
  const playerId = controllerOf(state, source) ?? getInstance(state, source)?.ownerId ?? null;
  const player = state.players.find((p) => p.playerId === playerId);
  return player ? (player.identity.cardId as string) : null;
}

function finalBlowCardOf(state: GameState, record: GameRecord): string | null {
  const blow = record.lastVillainDamage;
  if (blow?.sourceCardId) return blow.sourceCardId;
  // A record from before the mark kept the card: read it from the instance.
  const source = blow?.sourceInstanceId ?? null;
  return source ? ((getInstance(state, source)?.cardId as string | undefined) ?? null) : null;
}

/** The summary of a finished game, or null while the game is still being played. */
export function summarizeGame(state: GameState, record: GameRecord, deps?: EngineDeps): GameSummary | null {
  const outcome = state.outcome;
  if (!outcome) return null;
  const won = outcome.result === "win";
  return {
    lossReason: lossReasonOf(outcome),
    heroesDefeated: record.seats.filter((seat) => seat.defeatedInRound !== null).length,
    winners: won
      ? state.players
          .filter((player) => !player.eliminated)
          .map((player) => ({
            identityCardId: player.identity.cardId as string,
            hitPoints: remainingHitPoints(state, player.identity.instanceId, deps) ?? null,
            inHeroForm: player.identity.form === "hero",
          }))
      : [],
    alliesPlayed: record.seats.reduce((sum, seat) => sum + (seat.alliesPlayed ?? 0), 0),
    finalBlowBy: won ? finalBlowIdentityOf(state, record) : null,
    teamUpsPlayed: record.seats.reduce((sum, seat) => sum + (seat.teamUpsPlayed ?? 0), 0),
    seats: seatSummariesOf(state, record),
    villains: villainsOf(state),
    sideSchemes: { seen: record.sideSchemesSeen ?? {}, defeated: record.sideSchemesDefeated ?? {} },
    version: SUMMARY_VERSION,
    encounterRevealed: record.encounterRevealed ?? {},
    hurtBy: record.hurtBy ?? {},
    finalBlowCardId: won ? finalBlowCardOf(state, record) : null,
  };
}
