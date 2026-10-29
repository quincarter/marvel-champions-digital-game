/**
 * What happened in a game, in the terms the game-over screen reports it.
 *
 * **Derived, never saved.** The game's log (`initialState` + commands) is the
 * one thing persisted; this record is folded from the events that log produces,
 * either live as each command lands or all at once when a saved game is
 * replayed. Both paths run this same reducer, so a game resumed after a refresh
 * ends with exactly the summary it would have had if the tab had never closed —
 * which an in-memory tally kept by the UI could never promise.
 *
 * Every number is a count of events the engine emitted. Nothing here decides a
 * rule or guesses at a cause: attribution is "the player who controls, or else
 * owns, the card the engine named as the source".
 */

import type { CardId } from "@mc/content";
import {
  cardOf,
  controllerOf,
  getInstance,
  isMinion,
  playerCardOwnerOf,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";

/** A card with the Team-Up keyword (RRG 1.8 "Team-Up", p. 43). */
const isTeamUpCard = (card: GameState["cardPool"][string] | undefined): boolean =>
  !!card && "keywords" in card && card.keywords.some((keyword) => keyword.name === "teamUp");

export interface SeatRecord {
  readonly playerId: PlayerId;
  /** Damage dealt to the villain and to minions by cards this seat controls or owns. */
  readonly damage: number;
  /** Threat removed by cards this seat controls or owns. */
  readonly thwart: number;
  readonly cardsPlayed: number;
  /** Allies this seat played (a `cardPlayed` of an ally card). Absent on a record written before the field existed. */
  readonly alliesPlayed?: number;
  /** Team-Up cards this seat played (a `teamUp` keyword, RRG 1.8 p. 43). Absent on a record written before the field existed. */
  readonly teamUpsPlayed?: number;
  /** The round this seat's hero was defeated in, or null if they stood to the end. */
  readonly defeatedInRound: number | null;
  /**
   * True for a seat that sat the scenario out (`playerSatOut`; owner decision 66B): not a defeat, and not counted in
   * the table's per-player numbers. Absent on a record written before the field existed, which reads as false.
   */
  readonly satOut?: true;
  /**
   * Plays by card id (each `cardPlayed` this seat made), for the stats screen's "most played" lists. Absent on a record
   * written before the field existed, and while the seat has played nothing.
   */
  readonly plays?: Readonly<Record<string, number>>;
  /**
   * Abilities this seat chose to use, by the card whose text they are (`abilityResolved`; a granted ability counts for
   * the granting card): actions, resource abilities, and interrupts and responses that are not forced, on player cards
   * (identity abilities, supports, upgrades and allies alike). Forced and setup abilities, state checks and keyword
   * abilities (Temporary, Villainous) are the game's, not the player's, and are left out; so is an event's own play,
   * which is a play. Counted for the seat that controls the ability, so a card from one seat's deck another seat
   * controls counts for the seat using it. Absent while there are none.
   */
  readonly activations?: Readonly<Record<string, number>>;
  /** Cards of this seat's that came into play (any `cardMoved` into a play area), played or put. Absent while none. */
  readonly entered?: Readonly<Record<string, number>>;
  /**
   * The seat's deck when the record began (its deck and hand after setup), by card id once each: the cards it could
   * have played. A card set aside or put into play by setup is not in it. Absent on a record written before it existed.
   */
  readonly deck?: readonly string[];
}

export interface RoundRecord {
  readonly round: number;
  readonly threatPlaced: number;
  readonly threatRemoved: number;
  readonly damageToVillain: number;
  /** Threat removals Crisis blocked this round (RRG "Crisis Icon"). */
  readonly crisisBlocks: number;
  readonly heroesDefeated: readonly PlayerId[];
  readonly villainStageAdvanced: boolean;
  /**
   * The villain's next stage was revealed by an effect, with no defeat (`villainStageRevealed`: Apocalypse's main
   * scheme). Absent on a record written before the field existed, which reads as false.
   */
  readonly villainStageRevealed?: boolean;
}

/** One placement of threat, kept so "the scheme wins" can say who put the last of it there. */
export interface ThreatMark {
  readonly schemeInstanceId: InstanceId;
  readonly amount: number;
  readonly sourceInstanceId: InstanceId | null;
  /** The player the placing enemy was scheming against, when it came from an activation. */
  readonly againstPlayerId: PlayerId | null;
  readonly round: number;
}

/** One hit on the villain, kept so "the villain is defeated" can name the last blow. */
export interface DamageMark {
  readonly targetInstanceId: InstanceId;
  readonly amount: number;
  readonly sourceInstanceId: InstanceId | null;
  readonly round: number;
}

/**
 * One main scheme swap (`mainSchemeSwapped`: Change of Venue), kept so "the scheme wins" can say the scheme that won is
 * not the one the game started with (issue #518).
 */
export interface SchemeSwapMark {
  readonly outgoing: InstanceId;
  readonly incoming: InstanceId;
  readonly outgoingCardId: CardId;
  readonly round: number;
}

export interface GameRecord {
  readonly round: number;
  /** In seat order. */
  readonly seats: readonly SeatRecord[];
  /** In round order; a round with nothing recorded is absent. */
  readonly rounds: readonly RoundRecord[];
  readonly threatPlaced: number;
  readonly threatRemoved: number;
  readonly damageToEnemies: number;
  readonly damageToVillain: number;
  readonly lastThreat: ThreatMark | null;
  readonly lastVillainDamage: DamageMark | null;
  readonly lastEliminated: { readonly playerId: PlayerId; readonly round: number } | null;
  /** Main scheme swaps, oldest first. Absent on a record written before the field existed, which reads as none. */
  readonly schemeSwaps?: readonly SchemeSwapMark[];
  /**
   * Times a side scheme came into play (revealed, or put into play by setup or an effect), by card id: a scheme
   * defeated, shuffled back and revealed again counts twice. Absent while there are none.
   */
  readonly sideSchemesSeen?: Readonly<Record<string, number>>;
  /** Times a side scheme was defeated (`schemeDefeated` of a side scheme), by card id. Absent while none. */
  readonly sideSchemesDefeated?: Readonly<Record<string, number>>;
  /**
   * The side schemes in play now, by instance, with their card ids: one appearance is counted once however many
   * events report it (the reveal, then its move into play), and a scheme that leaves play can appear again.
   */
  readonly sideSchemesInPlay?: Readonly<Record<string, string>>;
  /**
   * The enemy activation in progress. Threat an activation places carries the
   * activating enemy as its source, so matching the two is how a placement
   * learns which player it was scheming against.
   */
  readonly activation: { readonly enemyInstanceId: InstanceId; readonly playerId: PlayerId } | null;
}

export const emptyRecord = (): GameRecord => ({
  round: 1,
  seats: [],
  rounds: [],
  threatPlaced: 0,
  threatRemoved: 0,
  damageToEnemies: 0,
  damageToVillain: 0,
  lastThreat: null,
  lastVillainDamage: null,
  lastEliminated: null,
  activation: null,
});

const blankSeat = (state: GameState, playerId: PlayerId): SeatRecord => ({
  playerId,
  deck: deckAtStart(state, playerId),
  damage: 0,
  thwart: 0,
  cardsPlayed: 0,
  defeatedInRound: null,
});

const blankRound = (round: number): RoundRecord => ({
  round,
  threatPlaced: 0,
  threatRemoved: 0,
  damageToVillain: 0,
  crisisBlocks: 0,
  heroesDefeated: [],
  villainStageAdvanced: false,
});

/**
 * The seat a card's effects count toward: its controller, or else its owner.
 *
 * The owner fallback matters for events. A played event has usually left play
 * by the time the state after its command is read, and `controllerOf` only
 * answers for identities and controlled cards; the card's owner is still the
 * seat that played it. Encounter cards have no owner, so they count toward nobody.
 */
function seatFor(state: GameState, id: InstanceId | null): PlayerId | null {
  if (!id) return null;
  return controllerOf(state, id) ?? getInstance(state, id)?.ownerId ?? null;
}

/**
 * The villain by card type rather than by `state.villain.instanceId`, so a hit
 * is still counted if the instance id changes when a stage advances in the same
 * command.
 */
const isVillain = (state: GameState, id: InstanceId): boolean => cardOf(state, id)?.type === "villain";

/** Every card in the seat's deck and hand, once each. */
function deckAtStart(state: GameState, playerId: PlayerId): string[] {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return [];
  const ids = new Set<string>();
  for (const id of [...player.deck, ...player.hand]) {
    const instance = getInstance(state, id);
    if (instance) ids.add(instance.cardId);
  }
  return [...ids].sort();
}

/** In-play zones a side scheme can enter. */
const IN_PLAY: ReadonlySet<string> = new Set(["villainArea", "playArea", "scenarioPlayArea"]);

/**
 * Whether the player chose to use this ability (RRG 1.8 "Abilities", p. 9): an action, a resource ability, or an
 * interrupt or response that is not forced. The same reading as the engine's `byPlayer` (`resolve/ability.ts`).
 * Without the ability registry only a forced action and a keyword ability can be told apart, so the rest count.
 */
function playerChose(event: Extract<GameEvent, { type: "abilityResolved" }>, deps: EngineDeps | undefined): boolean {
  if ((event.abilityId as string).startsWith("keyword:") || event.forced) return false;
  if (!deps) return true;
  const trigger = deps.abilities[event.abilityId]?.trigger;
  if (!trigger) return false;
  if (trigger.kind === "action" || trigger.kind === "resource") return true;
  return (trigger.kind === "interrupt" || trigger.kind === "response") && !trigger.forced;
}

const bump = (counts: Readonly<Record<string, number>> | undefined, key: string): Readonly<Record<string, number>> => ({
  ...counts,
  [key]: (counts?.[key] ?? 0) + 1,
});

/**
 * Folds one command's events onto the record. `state` is the state *after*
 * those events — what a host publishes — and is only read for ownership and
 * card types, which don't change within a command in any way that matters here.
 */
export function recordEvents(
  record: GameRecord,
  events: readonly GameEvent[],
  state: GameState,
  deps?: EngineDeps,
): GameRecord {
  let round = record.round;
  const seats = new Map<PlayerId, SeatRecord>(
    (record.seats.length > 0 ? record.seats : state.players.map((player) => blankSeat(state, player.playerId))).map(
      (seat) => [seat.playerId, seat],
    ),
  );
  const rounds = new Map<number, RoundRecord>(record.rounds.map((entry) => [entry.round, entry]));
  let {
    threatPlaced,
    threatRemoved,
    damageToEnemies,
    damageToVillain,
    lastThreat,
    lastVillainDamage,
    lastEliminated,
    activation,
  } = record;
  let schemeSwaps = record.schemeSwaps ?? [];
  let { sideSchemesSeen, sideSchemesDefeated, sideSchemesInPlay } = record;
  /** A side scheme is in play: a new appearance unless this one is already counted. */
  const sideScheme = (instanceId: InstanceId, cardId: CardId): void => {
    if (sideSchemesInPlay?.[instanceId] !== undefined) return;
    sideSchemesInPlay = { ...sideSchemesInPlay, [instanceId]: cardId };
    sideSchemesSeen = bump(sideSchemesSeen, cardId);
  };
  const sideSchemeGone = (instanceId: InstanceId): void => {
    if (sideSchemesInPlay?.[instanceId] === undefined) return;
    const { [instanceId]: _left, ...rest } = sideSchemesInPlay;
    sideSchemesInPlay = rest;
  };

  const onRound = (patch: (entry: RoundRecord) => RoundRecord): void => {
    rounds.set(round, patch(rounds.get(round) ?? blankRound(round)));
  };
  const onSeat = (playerId: PlayerId | null, patch: (seat: SeatRecord) => SeatRecord): void => {
    if (!playerId) return;
    const seat = seats.get(playerId);
    if (seat) seats.set(playerId, patch(seat));
  };

  /** Who last hit each target in this command, so an Overkill spill can take its excess back off the first hit. */
  const lastHitBy = new Map<InstanceId, InstanceId | null>();
  for (const event of events) {
    switch (event.type) {
      case "roundStarted":
        round = event.round;
        break;
      // Overkill (RRG 1.8, p. 31): the defeated enemy took the whole hit, excess included, and the excess then lands
      // again where it spills. It counts where it lands, not twice, so it comes back off the first target here.
      case "overkillSpilled": {
        const countedFirst = isVillain(state, event.fromInstanceId) || isMinion(state, event.fromInstanceId);
        if (!countedFirst) break;
        damageToEnemies -= event.amount;
        onSeat(seatFor(state, lastHitBy.get(event.fromInstanceId) ?? null), (seat) => ({
          ...seat,
          damage: seat.damage - event.amount,
        }));
        if (isVillain(state, event.fromInstanceId)) {
          damageToVillain -= event.amount;
          onRound((entry) => ({ ...entry, damageToVillain: entry.damageToVillain - event.amount }));
        }
        break;
      }
      case "enemyActivated":
        activation = { enemyInstanceId: event.enemyInstanceId, playerId: event.playerId };
        break;
      case "damageDealt": {
        const villain = isVillain(state, event.targetInstanceId);
        if (!villain && !isMinion(state, event.targetInstanceId)) break;
        damageToEnemies += event.amount;
        lastHitBy.set(event.targetInstanceId, event.sourceInstanceId);
        onSeat(seatFor(state, event.sourceInstanceId), (seat) => ({ ...seat, damage: seat.damage + event.amount }));
        if (villain) {
          damageToVillain += event.amount;
          lastVillainDamage = {
            targetInstanceId: event.targetInstanceId,
            amount: event.amount,
            sourceInstanceId: event.sourceInstanceId,
            round,
          };
          onRound((entry) => ({ ...entry, damageToVillain: entry.damageToVillain + event.amount }));
        }
        break;
      }
      case "threatPlaced": {
        threatPlaced += event.amount;
        const against =
          activation && activation.enemyInstanceId === event.sourceInstanceId ? activation.playerId : null;
        lastThreat = {
          schemeInstanceId: event.schemeInstanceId,
          amount: event.amount,
          sourceInstanceId: event.sourceInstanceId,
          againstPlayerId: against,
          round,
        };
        onRound((entry) => ({ ...entry, threatPlaced: entry.threatPlaced + event.amount }));
        break;
      }
      case "threatRemoved":
        threatRemoved += event.amount;
        onSeat(seatFor(state, event.sourceInstanceId), (seat) => ({ ...seat, thwart: seat.thwart + event.amount }));
        onRound((entry) => ({ ...entry, threatRemoved: entry.threatRemoved + event.amount }));
        break;
      case "threatRemovalBlocked":
        if (event.reason === "crisis") onRound((entry) => ({ ...entry, crisisBlocks: entry.crisisBlocks + 1 }));
        break;
      case "cardPlayed":
        onSeat(event.playerId, (seat) => ({
          ...seat,
          cardsPlayed: seat.cardsPlayed + 1,
          alliesPlayed: (seat.alliesPlayed ?? 0) + (state.cardPool[event.cardId]?.type === "ally" ? 1 : 0),
          teamUpsPlayed: (seat.teamUpsPlayed ?? 0) + (isTeamUpCard(state.cardPool[event.cardId]) ? 1 : 0),
          plays: bump(seat.plays, event.cardId),
        }));
        break;
      case "abilityResolved": {
        const source = event.grantedByInstanceId ?? event.instanceId;
        // Player cards only (an owned Labor encounter card is not one): an encounter card's ability is the villain side's.
        const owner = playerCardOwnerOf(state, source);
        const cardId = getInstance(state, source)?.cardId;
        if (!owner || !cardId || state.cardPool[cardId]?.type === "event" || !playerChose(event, deps)) break;
        onSeat(event.controllerId ?? owner, (seat) => ({ ...seat, activations: bump(seat.activations, cardId) }));
        break;
      }
      case "cardMoved": {
        if (state.cardPool[event.cardId]?.type === "side_scheme") {
          if (IN_PLAY.has(event.to.kind)) sideScheme(event.instanceId, event.cardId);
          else sideSchemeGone(event.instanceId);
        }
        if (event.to.kind === "playArea") {
          const owner = playerCardOwnerOf(state, event.instanceId);
          if (owner) onSeat(owner, (seat) => ({ ...seat, entered: bump(seat.entered, event.cardId) }));
        }
        break;
      }
      case "encounterCardRevealed":
        if (state.cardPool[event.cardId]?.type === "side_scheme") sideScheme(event.instanceId, event.cardId);
        break;
      case "schemeDefeated":
        if (state.cardPool[event.cardId]?.type === "side_scheme") {
          sideScheme(event.instanceId, event.cardId);
          sideSchemesDefeated = bump(sideSchemesDefeated, event.cardId);
          sideSchemeGone(event.instanceId);
        }
        break;
      case "playerEliminated":
        onSeat(event.playerId, (seat) => ({ ...seat, defeatedInRound: seat.defeatedInRound ?? round }));
        lastEliminated = { playerId: event.playerId, round };
        onRound((entry) => ({ ...entry, heroesDefeated: [...entry.heroesDefeated, event.playerId] }));
        break;
      case "playerSatOut": {
        // Always follows the seat's `playerEliminated` (sit-out is an elimination with no defeat window): take that
        // defeat back, so the debrief reads a seat that sat out as neither a loss nor a hero down.
        onSeat(event.playerId, (seat) => ({ ...seat, defeatedInRound: null, satOut: true }));
        if (lastEliminated?.playerId === event.playerId) lastEliminated = null;
        onRound((entry) => ({
          ...entry,
          heroesDefeated: entry.heroesDefeated.filter((id) => id !== event.playerId),
        }));
        break;
      }
      case "villainStageAdvanced":
        onRound((entry) => ({ ...entry, villainStageAdvanced: true }));
        break;
      case "villainStageRevealed":
        onRound((entry) => ({ ...entry, villainStageRevealed: true }));
        break;
      case "mainSchemeSwapped":
        schemeSwaps = [
          ...schemeSwaps,
          { outgoing: event.outgoing, incoming: event.incoming, outgoingCardId: event.cardIds[0], round },
        ];
        break;
      default:
        break;
    }
  }

  return {
    round,
    seats: [...seats.values()],
    rounds: [...rounds.values()].sort((a, b) => a.round - b.round),
    threatPlaced,
    threatRemoved,
    damageToEnemies,
    damageToVillain,
    lastThreat,
    lastVillainDamage,
    lastEliminated,
    ...(schemeSwaps.length > 0 ? { schemeSwaps } : {}),
    ...(sideSchemesSeen ? { sideSchemesSeen } : {}),
    ...(sideSchemesDefeated ? { sideSchemesDefeated } : {}),
    ...(sideSchemesInPlay && Object.keys(sideSchemesInPlay).length > 0 ? { sideSchemesInPlay } : {}),
    activation,
  };
}
