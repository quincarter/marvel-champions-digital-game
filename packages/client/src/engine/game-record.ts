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

import {
  cardOf,
  controllerOf,
  getInstance,
  isMinion,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";

export interface SeatRecord {
  readonly playerId: PlayerId;
  /** Damage dealt to the villain and to minions by cards this seat controls or owns. */
  readonly damage: number;
  /** Threat removed by cards this seat controls or owns. */
  readonly thwart: number;
  readonly cardsPlayed: number;
  /** The round this seat's hero was defeated in, or null if they stood to the end. */
  readonly defeatedInRound: number | null;
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

const blankSeat = (playerId: PlayerId): SeatRecord => ({
  playerId,
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

/**
 * Folds one command's events onto the record. `state` is the state *after*
 * those events — what a host publishes — and is only read for ownership and
 * card types, which don't change within a command in any way that matters here.
 */
export function recordEvents(record: GameRecord, events: readonly GameEvent[], state: GameState): GameRecord {
  let round = record.round;
  const seats = new Map<PlayerId, SeatRecord>(
    (record.seats.length > 0 ? record.seats : state.players.map((player) => blankSeat(player.playerId))).map((seat) => [
      seat.playerId,
      seat,
    ]),
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

  const onRound = (patch: (entry: RoundRecord) => RoundRecord): void => {
    rounds.set(round, patch(rounds.get(round) ?? blankRound(round)));
  };
  const onSeat = (playerId: PlayerId | null, patch: (seat: SeatRecord) => SeatRecord): void => {
    if (!playerId) return;
    const seat = seats.get(playerId);
    if (seat) seats.set(playerId, patch(seat));
  };

  for (const event of events) {
    switch (event.type) {
      case "roundStarted":
        round = event.round;
        break;
      case "enemyActivated":
        activation = { enemyInstanceId: event.enemyInstanceId, playerId: event.playerId };
        break;
      case "damageDealt": {
        const villain = isVillain(state, event.targetInstanceId);
        if (!villain && !isMinion(state, event.targetInstanceId)) break;
        damageToEnemies += event.amount;
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
        onSeat(event.playerId, (seat) => ({ ...seat, cardsPlayed: seat.cardsPlayed + 1 }));
        break;
      case "playerEliminated":
        onSeat(event.playerId, (seat) => ({ ...seat, defeatedInRound: seat.defeatedInRound ?? round }));
        lastEliminated = { playerId: event.playerId, round };
        onRound((entry) => ({ ...entry, heroesDefeated: [...entry.heroesDefeated, event.playerId] }));
        break;
      case "villainStageAdvanced":
        onRound((entry) => ({ ...entry, villainStageAdvanced: true }));
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
    activation,
  };
}
