/**
 * The feat counters of a game (#909, `docs/multiplayer-achievements-plan.md` package A2): what a seat pulled off in one
 * game (minions defeated, Overkill excess, a deck reset twice, an obligation of its own dealt with). Folded over the
 * game record's events with the acting player (`record-actor.ts`); read back as `GameSummary.feats`, one entry per seat
 * (engine player id).
 *
 * Every counter is a count of events the engine emitted, attributed by the readings below; none decides a rule.
 *
 * - **Credit for a hit** (`hitterOf`): the seat whose player card dealt the damage (its controller, else its owner, as
 *   `game-record.ts` `seatFor` reads it); damage with no source, the acting seat; damage from an encounter card, or
 *   marked `noPlayer`, nobody.
 * - **Credit for a minion's defeat**: the seat of the last hit on it this turn (an encounter card's hit: nobody), else
 *   the seat acting as it is defeated. Engine reading: a minion's `characterDefeated` names no source, so a minion hit
 *   by one seat and then defeated by another seat's "defeat" effect in the same turn reads as the hitter's.
 * - **"After each command"** checks (`maxEngagedMinions`, `fellBelowHalf`) read the state after the command the event
 *   belongs to (`RecordFoldContext.state`), so a dip inside one command that the same command undoes (damage healed by
 *   an interrupt before the command ends) is not seen. A hero defeated in the command is caught by its defeat instead.
 *
 * Plain serializable data, never mutated: each step returns a new state. No storage, no Phaser.
 */
import {
  controllerOf,
  getInstance,
  isMinion,
  maxHitPoints,
  minionsEngagedWith,
  playerCardOwnerOf,
  remainingHitPoints,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import type { RecordFold, RecordFoldContext } from "./record-actor.js";

/** One seat's feats in one game. */
export interface SeatFeats {
  /** Minions defeated with this seat's credit (the module header's reading). */
  readonly minionsDefeated: number;
  /** The most minions engaged with this seat at once, after any command. */
  readonly maxEngagedMinions: number;
  /** The largest excess damage (`damageDealt.excess`) of one hit this seat dealt to an enemy. */
  readonly maxExcess: number;
  /** Times this seat's deck ran out and was reset from its discard pile (`playerDeckReset`). */
  readonly deckResets: number;
  /** Minions this seat stunned and then defeated with its credit, in the same turn. */
  readonly stunDefeats: number;
  /** The most resources this seat paid for one card it played. */
  readonly maxPaidForOneCard: number;
  /** This seat's identity stood below half its maximum hit points after some command, or was defeated. */
  readonly fellBelowHalf: boolean;
  /** An obligation of this seat's own identity was removed from the game. */
  readonly ownObligationRemoved: boolean;
  /** The longest run of encounter cards revealed for this seat, each after the one before it surged. */
  readonly maxSurgeChain: number;
}

/** What the summary keeps (`GameSummary.feats`): each seat's feats, by engine player id. */
export type FeatsCounters = Readonly<Record<string, SeatFeats>>;

/** The fold's running state, kept on the game record (`GameRecord.feats`). Plain serializable data. */
export interface FeatsFoldState {
  readonly seats: FeatsCounters;
  /** The seat credited with the last hit on each enemy this turn (null: an encounter card's hit). */
  readonly hits?: Readonly<Record<string, PlayerId | null>>;
  /** The seat acting as each minion was stunned this turn. */
  readonly stuns?: Readonly<Record<string, PlayerId | null>>;
  /** A card's own minion-ness while some effect treats it as a minion or an ally (`treatedAsChanged`). */
  readonly treatedAs?: Readonly<Record<string, "minion" | "ally">>;
  /** The run length each encounter card revealed this round was revealed at, until its surge links the next. */
  readonly revealRun?: Readonly<Record<string, number>>;
  /** A card dealt by surge this round: the run length its reveal continues. */
  readonly surgeRun?: Readonly<Record<string, number>>;
  /** The last encounter card dealt to each seat (`cardMoved` to its dealt pile), for the surge that follows it. */
  readonly lastDealt?: Readonly<Record<string, InstanceId>>;
}

export const blankSeatFeats = (): SeatFeats => ({
  minionsDefeated: 0,
  maxEngagedMinions: 0,
  maxExcess: 0,
  deckResets: 0,
  stunDefeats: 0,
  maxPaidForOneCard: 0,
  fellBelowHalf: false,
  ownObligationRemoved: false,
  maxSurgeChain: 0,
});

/** `record` without `key` (absent when nothing is left), or `record` itself when `key` is not in it. */
function without<V>(record: Readonly<Record<string, V>> | undefined, key: string): Record<string, V> | undefined {
  if (!record || !(key in record)) return record;
  const { [key]: _gone, ...rest } = record;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/** `state` with `key` set (or removed, for undefined), the key dropped when the record empties. */
function withEntry<K extends "hits" | "stuns" | "treatedAs" | "revealRun" | "surgeRun" | "lastDealt">(
  state: FeatsFoldState,
  key: K,
  entryKey: string,
  value: NonNullable<FeatsFoldState[K]>[string] | undefined,
): FeatsFoldState {
  const current = state[key] as Readonly<Record<string, unknown>> | undefined;
  const next = value === undefined ? without(current, entryKey) : { ...current, [entryKey]: value };
  const { [key]: _old, ...rest } = state;
  return (next ? { ...rest, [key]: next } : rest) as FeatsFoldState;
}

/** `state` with one seat's feats patched. A seat not seen before starts blank. */
function onSeat(
  state: FeatsFoldState,
  playerId: PlayerId | null,
  patch: (seat: SeatFeats) => SeatFeats,
): FeatsFoldState {
  if (!playerId) return state;
  const before = state.seats[playerId];
  const after = patch(before ?? blankSeatFeats());
  if (after === before) return state;
  return { ...state, seats: { ...state.seats, [playerId]: after } };
}

const max =
  (field: "maxEngagedMinions" | "maxExcess" | "maxPaidForOneCard" | "maxSurgeChain", value: number) =>
  (seat: SeatFeats): SeatFeats =>
    value > seat[field] ? { ...seat, [field]: value } : seat;
const add =
  (field: "minionsDefeated" | "deckResets" | "stunDefeats") =>
  (seat: SeatFeats): SeatFeats => ({
    ...seat,
    [field]: seat[field] + 1,
  });
const flag =
  (field: "fellBelowHalf" | "ownObligationRemoved") =>
  (seat: SeatFeats): SeatFeats =>
    seat[field] ? seat : { ...seat, [field]: true };

/** The seat a player card counts toward: its controller, else its owner. Null for an encounter card. */
function playerSeatOf(state: GameState, id: InstanceId): PlayerId | null {
  if (!playerCardOwnerOf(state, id)) return null;
  return controllerOf(state, id) ?? getInstance(state, id)?.ownerId ?? null;
}

/** The seat credited with a damage event (the module header's reading). */
function hitterOf(event: Extract<GameEvent, { type: "damageDealt" }>, ctx: RecordFoldContext): PlayerId | null {
  if (event.noPlayer) return null;
  if (event.sourceInstanceId === null) return ctx.actor;
  return playerSeatOf(ctx.state, event.sourceInstanceId);
}

/** An enemy: a character no player has as a player card (a minion or a villain). */
const isEnemy = (state: GameState, id: InstanceId): boolean =>
  !playerCardOwnerOf(state, id) && !state.players.some((player) => player.identity.instanceId === id);

/** Whether `id` is (or, gone from play, was) a minion: an effect's treatment first, then the state, then its card. */
function wasMinion(state: GameState, fold: FeatsFoldState, id: InstanceId, cardId?: string): boolean {
  const treated = fold.treatedAs?.[id];
  if (treated) return treated === "minion";
  if (isMinion(state, id)) return true;
  const card = cardId ?? getInstance(state, id)?.cardId;
  return !!card && state.cardPool[card]?.type === "minion";
}

/** What the state after a command shows of each seat: its engaged minions and whether it stands below half. */
interface SeatSnapshot {
  readonly playerId: PlayerId;
  readonly engaged: number;
  readonly belowHalf: boolean;
}

/** One snapshot per state object: every event of a command shares its state, and hit points are not cheap to read. */
const SNAPSHOTS = new WeakMap<GameState, readonly SeatSnapshot[]>();

function snapshotOf(state: GameState, deps: EngineDeps | undefined): readonly SeatSnapshot[] {
  const cached = SNAPSHOTS.get(state);
  if (cached) return cached;
  const snapshot = state.players.map((player): SeatSnapshot => {
    // An eliminated seat's identity is not read: its defeat (`characterDefeated`) already counted.
    if (player.eliminated) return { playerId: player.playerId, engaged: 0, belowHalf: false };
    const identity = player.identity.instanceId;
    const most = maxHitPoints(state, identity, deps);
    const left = remainingHitPoints(state, identity, deps);
    return {
      playerId: player.playerId,
      engaged: minionsEngagedWith(state, player.playerId).length,
      belowHalf: most !== undefined && left !== undefined && left * 2 < most,
    };
  });
  SNAPSHOTS.set(state, snapshot);
  return snapshot;
}

/** Folds the state after the command into every seat's "after each command" feats. */
function afterCommand(fold: FeatsFoldState, ctx: RecordFoldContext): FeatsFoldState {
  let next = fold;
  for (const seat of snapshotOf(ctx.state, ctx.deps)) {
    next = onSeat(next, seat.playerId, max("maxEngagedMinions", seat.engaged));
    if (seat.belowHalf) next = onSeat(next, seat.playerId, flag("fellBelowHalf"));
  }
  return next;
}

/** No hit or stun carries across a turn's start or end, or a round's: "the same turn" ends there. */
function endTurnWindow(fold: FeatsFoldState): FeatsFoldState {
  if (!fold.hits && !fold.stuns) return fold;
  const { hits: _hits, stuns: _stuns, ...rest } = fold;
  return rest;
}

function step(fold: FeatsFoldState, event: GameEvent, ctx: RecordFoldContext): FeatsFoldState {
  const { state } = ctx;
  // A record kept while this fold was a stub (summary version 7's scaffold) holds `{}`.
  let next = afterCommand(fold.seats ? fold : { ...fold, seats: {} }, ctx);
  switch (event.type) {
    case "turnStarted":
    case "turnEnded":
      return endTurnWindow(next);
    case "roundStarted": {
      const { revealRun: _runs, surgeRun: _surges, lastDealt: _dealt, ...rest } = endTurnWindow(next);
      return rest;
    }
    case "treatedAsChanged":
      return withEntry(next, "treatedAs", event.instanceId, event.as ?? undefined);
    case "damageDealt": {
      const target = event.targetInstanceId;
      if (!isEnemy(state, target)) return next;
      const hitter = hitterOf(event, ctx);
      if (event.excess !== undefined && event.excess > 0) next = onSeat(next, hitter, max("maxExcess", event.excess));
      return withEntry(next, "hits", target, hitter);
    }
    case "statusGiven":
      if (event.status !== "stunned" || !wasMinion(state, next, event.instanceId)) return next;
      return withEntry(next, "stuns", event.instanceId, ctx.actor);
    case "characterDefeated": {
      const id = event.instanceId;
      const owner = state.players.find((player) => player.identity.instanceId === id);
      if (owner) return onSeat(next, owner.playerId, flag("fellBelowHalf"));
      const minion = event.facedownAs?.kind === "minion" || wasMinion(state, next, id, event.cardId);
      if (!minion) return withEntry(withEntry(next, "hits", id, undefined), "treatedAs", id, undefined);
      const hits = next.hits;
      const credited = hits && id in hits ? (hits[id] ?? null) : ctx.actor;
      next = onSeat(next, credited, add("minionsDefeated"));
      const stunner = next.stuns?.[id];
      if (credited && stunner === credited) next = onSeat(next, credited, add("stunDefeats"));
      next = withEntry(next, "hits", id, undefined);
      next = withEntry(next, "stuns", id, undefined);
      return withEntry(next, "treatedAs", id, undefined);
    }
    case "playerDeckReset":
      return onSeat(next, event.playerId, add("deckResets"));
    case "cardPlayed":
      // `paidCount`, when the play logs it, leaves out resources overpaid; otherwise everything spent on the play counts.
      // A helper's share of an alliance cost (`costPartPaidBy`) counts toward the card's player, whose card it is.
      return onSeat(next, event.playerId, max("maxPaidForOneCard", event.paidCount ?? event.resourcesPaid));
    case "cardMoved": {
      if (event.to.kind === "dealtEncounter") return withEntry(next, "lastDealt", event.to.playerId, event.instanceId);
      if (event.to.kind !== "removedFromGame" || state.cardPool[event.cardId]?.type !== "obligation") return next;
      for (const player of state.players) {
        const identity = state.cardPool[player.identity.cardId];
        if (identity && "obligationCardId" in identity && identity.obligationCardId === event.cardId) {
          next = onSeat(next, player.playerId, flag("ownObligationRemoved"));
        }
      }
      return next;
    }
    case "encounterCardRevealed": {
      const run = next.surgeRun?.[event.instanceId] ?? 1;
      next = withEntry(next, "surgeRun", event.instanceId, undefined);
      next = withEntry(next, "revealRun", event.instanceId, run);
      return onSeat(next, event.playerId, max("maxSurgeChain", run));
    }
    case "surgeTriggered": {
      // The surge's card was dealt just before this (`dealSurgeCard`: the deal, then `surgeTriggered`); its reveal, in
      // this villain phase's step four or the next one's, continues the surging card's run.
      const dealt = next.lastDealt?.[event.playerId];
      const run = next.revealRun?.[event.instanceId] ?? 1;
      next = withEntry(next, "revealRun", event.instanceId, undefined);
      return dealt ? withEntry(next, "surgeRun", dealt, run + 1) : next;
    }
    default:
      return next;
  }
}

export const featsFold: RecordFold<FeatsFoldState, FeatsCounters> = {
  init: () => ({ seats: {} }),
  step,
  finish: (state) => state.seats ?? {},
};
