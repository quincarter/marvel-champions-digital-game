/**
 * The "Playing together" counters of a game (#909, `docs/multiplayer-achievements-plan.md` package A1): what one seat
 * did for or to another (an upgrade given, a hit taken for a friend, an ally paid for together). Folded over the game
 * record's events with the acting player (`record-actor.ts`); read back as `GameSummary.together`.
 *
 * A seat is an engine player id, and "another seat" is another player whoever sits there: a multi-seat solo game counts
 * the same as a room game. Each counter is a reading of the log, not a rule, and the reading of each is on its key in
 * `TogetherCounter`. Where the log does not say a thing outright, the fold uses the best signal it has and says so.
 *
 * `ctx.state` is the state after the whole command, so the fold reads it only for what a command does not change in a
 * way that matters (a card's type, its owner, who controls a host) and tracks the rest from the events themselves (an
 * attack's target, a minion's engagement, the last hit on a character).
 *
 * Plain serializable data, never mutated: each step returns a new state. No storage, no Phaser.
 */
import {
  controllerOf,
  isMinion,
  playerCardOwnerOf,
  remainingHitPoints,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
  type ZoneId,
} from "@mc/engine";
import type { RecordFold, RecordFoldContext } from "./record-actor.js";

/** Every counter, per seat. */
export const TOGETHER_COUNTERS = [
  /**
   * Defenses declared by a character this seat controls (`defenderDeclared`, its defender's controller) against an
   * enemy attack on another player (the attack's `enemyActivated.playerId`, moved by `attackRetargeted`).
   */
  "defendedForOthers",
  /**
   * Damage healed (the amount) from another player's identity (`damageHealed`) by a card this seat controls or owns
   * (`damageHealed.sourceInstanceId`), else, in a log without that field, by the acting seat.
   */
  "healedOthers",
  /**
   * Upgrades this seat played (`cardPlayed`) that went under another player's control as they were attached
   * (`controllerChanged` reason `attachedTo`), or into another player's play area, before the next card was played.
   */
  "upgradesGiven",
  /**
   * Cards played (`cardPlayed`) whose payment came from two or more players: the spenders of the hand cards
   * (`paymentCommitted.fromHand[].spenderId`), the players whose resource abilities paid (`resourcesGenerated`) and any
   * helper paying a part of the cost (`costPartPaidBy`), all logged before the `cardPlayed`. Counted for every seat
   * that paid, the player of the card included: each of them helped.
   */
  "multiPayerPlays",
  /**
   * Minions engaged with another player defeated by this seat: the seat of the damage that took the minion to zero
   * (`damageDealt.excess` present), else the acting seat.
   */
  "killSteals",
  /** Cards another player drew (`cardDrawn`) while this seat's ability or play was resolving. Not setup or refills. */
  "drewForOthers",
  /**
   * Cancels (`revealCancelled`, either scope) of a treachery revealed for another player (`encounterCardRevealed`),
   * made while this seat was acting.
   */
  "cancelledForOthers",
  /**
   * Player cards moved (`cardMoved`) from another player's deck or discard pile into this seat's hand, play area or
   * resolving events, or attached to or tucked under a card this seat controls, unless the player they came from was
   * the one acting (that is a gift, not a take).
   */
  "takenFromOthers",
  /** Best effort: see `oopsArmed` on `TogetherFoldState`. */
  "oopsMinions",
  /** Best effort: see `fire` on `TogetherFoldState`. */
  "friendlyFire",
] as const;

export type TogetherCounter = (typeof TOGETHER_COUNTERS)[number];

/** One seat's counters, every key present. */
export type TogetherSeatCounters = Readonly<Record<TogetherCounter, number>>;

/** A minion that came into play engaged with `victim` just after `by` cleared threat or beat a scheme or villain. */
interface OopsCandidate {
  readonly by: PlayerId;
  readonly victim: PlayerId;
}

/** The fold's running state, kept on the game record (`GameRecord.together`). Plain serializable data. */
export interface TogetherFoldState {
  /** Per seat, the counters that are not 0. */
  readonly counts: Readonly<Record<string, Partial<Record<TogetherCounter, number>>>>;
  /** The player each enemy's current attack is against (`enemyActivated` attack, `attackRetargeted`). */
  readonly attackOn: Readonly<Record<string, PlayerId>>;
  /** The players who have paid toward the payment in progress, in the order they paid; reset by the play. */
  readonly payers: readonly PlayerId[];
  /** The upgrade last played and its player, until it is placed or the next card is played. */
  readonly upgradePlayed: { readonly instanceId: InstanceId; readonly by: PlayerId } | null;
  /**
   * The player each minion was last engaged with (a minion in play is in its engaged player's play area, RRG 1.8
   * "Engage", p. 18), kept after it leaves play so its defeat reads the same whichever of the defeat and the move the
   * engine logs first. Dropped at the defeat, or when it goes to an in-play area that engages nobody.
   */
  readonly engaged: Readonly<Record<string, PlayerId>>;
  /** The seat of the damage that brought a minion or villain to zero hit points (`damageDealt.excess`), null for none. */
  readonly lethal: Readonly<Record<string, PlayerId | null>>;
  /** The seat that last removed threat from each scheme, null for an encounter card or no player. */
  readonly threatBy: Readonly<Record<string, PlayerId | null>>;
  /** The latest encounter reveals, newest last, for whom each was revealed. */
  readonly reveals: readonly {
    readonly instanceId: InstanceId;
    readonly cardId: string;
    readonly playerId: PlayerId;
  }[];
  /** In a setup step or the end-of-phase refill (`endPhaseDraw`): draws there are nobody's gift. */
  readonly drawsAreRules: boolean;
  /**
   * `oopsMinions`. Engine reading: the log has no command boundary, so "during that command" is read as "after this
   * seat removed threat, defeated a scheme or defeated the villain (`characterDefeated` of a villain), with no new player
   * action since": the arm ends at the next `cardPlayed`, the next `abilityResolved` a player controls, an enemy
   * activation, an encounter card dealt, a step or turn change. An encounter card's ability (a side scheme's "When
   * Defeated", a villain stage's "When Revealed") is no player's, so it keeps the arm. A minion that enters play
   * engaged with another player while armed becomes an `oops` candidate, counted when it attacks that player before the
   * arming seat's next turn starts.
   */
  readonly oopsArmed: PlayerId | null;
  readonly oops: Readonly<Record<string, OopsCandidate>>;
  /**
   * `friendlyFire`: the side scheme this seat just defeated (by the last threat removal from it, else as the actor), and
   * the players its resolution has damaged so far. A `damageDealt` from that scheme (or from no card) to another
   * player's identity with 6 or fewer hit points remaining before it counts once per player. Remaining before is exact
   * when the damage carries `excess` (`amount - excess`), and otherwise read as the identity's remaining hit points
   * after the command plus the damage. Ended as `oopsArmed` is, and by the next scheme defeat.
   */
  readonly fire: { readonly by: PlayerId; readonly scheme: InstanceId; readonly hit: readonly PlayerId[] } | null;
}

/** What the summary keeps (`GameSummary.together`): per seat (engine player id) with any counter above 0. */
export type TogetherCounters = Readonly<Record<string, TogetherSeatCounters>>;

/** How many recent reveals are kept (`TogetherFoldState.reveals`): a reveal inside a reveal (surge, "reveal another"). */
const REVEALS_KEPT = 8;

/** Friendly fire's hit point line (#909, "Friendly Fire"): a hero at 6 or fewer before the hit. */
const FRIENDLY_FIRE_HP = 6;

export const initTogether = (): TogetherFoldState => ({
  counts: {},
  attackOn: {},
  payers: [],
  upgradePlayed: null,
  engaged: {},
  lethal: {},
  threatBy: {},
  reveals: [],
  drawsAreRules: false,
  oopsArmed: null,
  oops: {},
  fire: null,
});

const bump = (state: TogetherFoldState, seat: PlayerId, key: TogetherCounter, by = 1): TogetherFoldState => {
  if (by <= 0) return state;
  const seatCounts = state.counts[seat] ?? {};
  return { ...state, counts: { ...state.counts, [seat]: { ...seatCounts, [key]: (seatCounts[key] ?? 0) + by } } };
};

const without = <V>(map: Readonly<Record<string, V>>, key: string): Readonly<Record<string, V>> => {
  if (!(key in map)) return map;
  const { [key]: _gone, ...rest } = map;
  return rest;
};

/** The seat a card acts for: its controller (an identity's player), else its owner; null for an encounter card. */
const seatOf = (state: GameState, id: InstanceId): PlayerId | null =>
  controllerOf(state, id) ?? playerCardOwnerOf(state, id);

/** The player whose identity this is, else null. */
const identityPlayer = (state: GameState, id: InstanceId): PlayerId | null =>
  state.players.find((player) => player.identity.instanceId === id)?.playerId ?? null;

/** The seat an event with a source acts for: the source's seat, nobody for `noPlayer`, the actor with no source. */
const sourceSeat = (
  ctx: RecordFoldContext,
  source: InstanceId | null | undefined,
  noPlayer?: true,
): PlayerId | null => {
  if (noPlayer) return null;
  return source ? seatOf(ctx.state, source) : ctx.actor;
};

const typeOf = (state: GameState, cardId: string | undefined): string | undefined =>
  cardId ? state.cardPool[cardId]?.type : undefined;

/** Zones a card is in play in (a minion moving between these did not enter play). */
const IN_PLAY: ReadonlySet<ZoneId["kind"]> = new Set([
  "playArea",
  "identity",
  "villainArea",
  "attachment",
  "scenarioPlayArea",
]);

/** The seat that gets a card moved to `to`: a player's hand, play area or resolving pile, or a host's controller. */
function receiver(state: GameState, to: ZoneId): PlayerId | null {
  switch (to.kind) {
    case "hand":
    case "playArea":
    case "resolving":
      return to.playerId;
    case "attachment":
    case "tucked":
      return seatOf(state, to.hostInstanceId);
    default:
      return null;
  }
}

/** Ends the arms that last only until the next player action, step or turn (`oopsArmed`, `fire`). */
const disarm = (state: TogetherFoldState): TogetherFoldState =>
  state.oopsArmed === null && state.fire === null ? state : { ...state, oopsArmed: null, fire: null };

function step(state: TogetherFoldState, event: GameEvent, ctx: RecordFoldContext): TogetherFoldState {
  const game = ctx.state;
  switch (event.type) {
    case "stepChanged": {
      const drawsAreRules = event.to.phase === "setup" || event.to.kind === "endPhaseDraw";
      return { ...disarm(state), drawsAreRules, payers: [] };
    }
    case "turnStarted": {
      // The candidates of the seat whose turn it now is have had their chance to attack.
      const oops = Object.fromEntries(Object.entries(state.oops).filter(([, entry]) => entry.by !== event.playerId));
      return { ...disarm(state), oops, payers: [] };
    }
    case "turnEnded":
    case "roundStarted":
      return { ...disarm(state), payers: [], upgradePlayed: null };
    case "abilityResolved":
      return event.controllerId === null ? state : { ...disarm(state), payers: [] };

    // Defending another player.
    case "enemyActivated":
      return {
        ...disarm(state),
        ...(event.activation === "attack"
          ? { attackOn: { ...state.attackOn, [event.enemyInstanceId]: event.playerId } }
          : {}),
      };
    case "attackRetargeted":
      return { ...state, attackOn: { ...state.attackOn, [event.enemyInstanceId]: event.playerId } };
    case "attackResolved":
    case "activationCancelled":
      return { ...state, attackOn: without(state.attackOn, event.enemyInstanceId) };
    case "defenderDeclared": {
      const attacked = state.attackOn[event.attackInstanceId];
      const defender = seatOf(game, event.defenderInstanceId) ?? event.playerId;
      return attacked && defender !== attacked ? bump(state, defender, "defendedForOthers") : state;
    }

    // Healing another player.
    case "damageHealed": {
      const patient = identityPlayer(game, event.targetInstanceId);
      const healer = event.sourceInstanceId !== undefined ? seatOf(game, event.sourceInstanceId) : ctx.actor;
      return patient && healer && healer !== patient ? bump(state, healer, "healedOthers", event.amount) : state;
    }

    // Paying together, and upgrades given.
    case "paymentCommitted":
      return { ...state, payers: [...state.payers, ...event.fromHand.map((spent) => spent.spenderId)] };
    case "resourcesGenerated":
      return { ...state, payers: [...state.payers, event.playerId] };
    case "costPartPaidBy":
      return { ...state, payers: [...state.payers, event.helperId] };
    case "cardPlayed": {
      const payers = [...new Set(state.payers)];
      let next: TogetherFoldState = { ...disarm(state), payers: [], upgradePlayed: null };
      if (payers.length >= 2) for (const payer of payers) next = bump(next, payer, "multiPayerPlays");
      if (typeOf(game, event.cardId) === "upgrade") {
        next = { ...next, upgradePlayed: { instanceId: event.instanceId, by: event.playerId } };
      }
      return next;
    }
    case "controllerChanged": {
      const played = state.upgradePlayed;
      if (!played || played.instanceId !== event.instanceId || event.reason !== "attachedTo") return state;
      if (event.to === played.by) return state;
      return bump({ ...state, upgradePlayed: null }, played.by, "upgradesGiven");
    }

    // Engagement, last hits and kill steals.
    case "cardMoved":
      return cardMoved(state, event, ctx);
    case "damageDealt": {
      let next = state;
      const target = event.targetInstanceId;
      const dealer = sourceSeat(ctx, event.sourceInstanceId, event.noPlayer);
      if (event.excess !== undefined && identityPlayer(game, target) === null) {
        next = { ...next, lethal: { ...next.lethal, [target]: dealer } };
      }
      return friendlyFire(next, event, ctx);
    }
    case "characterDefeated": {
      const id = event.instanceId;
      const killer = id in state.lethal ? (state.lethal[id] ?? null) : ctx.actor;
      const victim = state.engaged[id];
      let next: TogetherFoldState = {
        ...state,
        lethal: without(state.lethal, id),
        engaged: without(state.engaged, id),
        oops: without(state.oops, id),
      };
      if (victim !== undefined && killer && killer !== victim) next = bump(next, killer, "killSteals");
      if (typeOf(game, event.cardId) === "villain" && killer) next = { ...next, oopsArmed: killer };
      return next;
    }

    // Threat, schemes, and what follows them.
    case "threatRemoved": {
      const by = sourceSeat(ctx, event.sourceInstanceId, event.noPlayer);
      const next = { ...state, threatBy: { ...state.threatBy, [event.schemeInstanceId]: by } };
      return by && event.amount > 0 ? { ...next, oopsArmed: by } : next;
    }
    case "schemeDefeated": {
      const id = event.instanceId;
      const by = id in state.threatBy ? (state.threatBy[id] ?? null) : ctx.actor;
      const next: TogetherFoldState = { ...state, threatBy: without(state.threatBy, id), fire: null };
      if (!by) return next;
      const side = typeOf(game, event.cardId) === "side_scheme";
      return { ...next, oopsArmed: by, ...(side ? { fire: { by, scheme: id, hit: [] } } : {}) };
    }

    // Oops: the minion attacks the player it came in engaged with.
    case "encounterCardDealt":
      return disarm(state);

    // Draws and cancels for another player.
    case "cardDrawn": {
      const giver = ctx.actor;
      if (state.drawsAreRules || !giver || giver === event.playerId) return state;
      return bump(state, giver, "drewForOthers");
    }
    case "encounterCardRevealed": {
      const reveal = { instanceId: event.instanceId, cardId: event.cardId, playerId: event.playerId };
      const reveals = [...state.reveals.filter((entry) => entry.instanceId !== event.instanceId), reveal];
      return { ...state, reveals: reveals.slice(-REVEALS_KEPT) };
    }
    case "revealCancelled": {
      const reveal = state.reveals.find((entry) => entry.instanceId === event.instanceId);
      const by = ctx.actor;
      if (!reveal || !by || by === reveal.playerId || typeOf(game, reveal.cardId) !== "treachery") return state;
      return bump(state, by, "cancelledForOthers");
    }
    default:
      return state;
  }
}

/** `cardMoved`: engagement, an upgrade played into another's play area, oops candidates, and cards taken. */
function cardMoved(
  state: TogetherFoldState,
  event: Extract<GameEvent, { type: "cardMoved" }>,
  ctx: RecordFoldContext,
): TogetherFoldState {
  const game = ctx.state;
  const { instanceId: id, from, to } = event;
  let next = state;
  const minion = typeOf(game, event.cardId) === "minion" || isMinion(game, id);
  if (minion) {
    if (to.kind === "playArea") {
      next = { ...next, engaged: { ...next.engaged, [id]: to.playerId } };
      // Came into play (not an engagement moving), engaged with someone other than the seat that just set it off.
      const armer = next.oopsArmed;
      if (armer && armer !== to.playerId && !IN_PLAY.has(from.kind)) {
        next = { ...next, oops: { ...next.oops, [id]: { by: armer, victim: to.playerId } } };
      }
    } else if (IN_PLAY.has(to.kind)) {
      next = { ...next, engaged: without(next.engaged, id), oops: without(next.oops, id) };
    } else {
      next = { ...next, oops: without(next.oops, id) };
    }
  }
  const played = next.upgradePlayed;
  if (played?.instanceId === id && to.kind === "playArea" && to.playerId !== played.by) {
    next = bump({ ...next, upgradePlayed: null }, played.by, "upgradesGiven");
  }
  if ((from.kind === "deck" || from.kind === "discard") && playerCardOwnerOf(game, id) !== null) {
    const taker = receiver(game, to);
    if (taker && taker !== from.playerId && ctx.actor !== from.playerId) next = bump(next, taker, "takenFromOthers");
  }
  return next;
}

/** `damageDealt` to another player's identity from the side scheme this seat just defeated (`fire`). */
function friendlyFire(
  state: TogetherFoldState,
  event: Extract<GameEvent, { type: "damageDealt" }>,
  ctx: RecordFoldContext,
): TogetherFoldState {
  const fire = state.fire;
  if (!fire || (event.sourceInstanceId !== null && event.sourceInstanceId !== fire.scheme)) return state;
  const victim = identityPlayer(ctx.state, event.targetInstanceId);
  if (!victim || victim === fire.by || fire.hit.includes(victim) || event.amount <= 0) return state;
  const before =
    event.excess !== undefined
      ? event.amount - event.excess
      : (remainingHitPoints(ctx.state, event.targetInstanceId, ctx.deps) ?? Number.POSITIVE_INFINITY) + event.amount;
  if (before > FRIENDLY_FIRE_HP) return state;
  return bump({ ...state, fire: { ...fire, hit: [...fire.hit, victim] } }, fire.by, "friendlyFire");
}

/** The oops candidate attacks the player it came in engaged with: counted for the seat that set it off. */
function oopsAttack(state: TogetherFoldState, event: GameEvent): TogetherFoldState {
  if (event.type !== "enemyActivated" || event.activation !== "attack") return state;
  const candidate = state.oops[event.enemyInstanceId];
  if (!candidate || candidate.victim !== event.playerId) return state;
  return bump({ ...state, oops: without(state.oops, event.enemyInstanceId) }, candidate.by, "oopsMinions");
}

const zeroes = (): Record<TogetherCounter, number> =>
  Object.fromEntries(TOGETHER_COUNTERS.map((key) => [key, 0])) as Record<TogetherCounter, number>;

export const togetherFold: RecordFold<TogetherFoldState, TogetherCounters> = {
  init: initTogether,
  // A record saved by the A0 scaffold kept `{}` here: read it as a fresh fold.
  step: (state, event, ctx) => step(oopsAttack({ ...initTogether(), ...state }, event), event, ctx),
  finish: (state) =>
    Object.fromEntries(
      Object.entries(state.counts ?? {})
        .filter(([, counts]) => Object.values(counts).some((value) => (value ?? 0) > 0))
        .map(([seat, counts]) => [seat, { ...zeroes(), ...counts }]),
    ),
};
