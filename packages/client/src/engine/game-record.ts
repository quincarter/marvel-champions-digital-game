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
  handCardResources,
  isMinion,
  locateCard,
  playerCardOwnerOf,
  printedResources,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
  type ResourcePool,
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
  /** Cards this seat drew (`cardDrawn`). Absent on a record written before the field existed. */
  readonly drawn?: number;
  /**
   * Resources this seat generated paying costs, by type: each resource ability's (`resourcesGenerated`), and the
   * printed icons of each card it spent from hand (a hand card's spending logs no resources of its own, so they are
   * read from the command's payment). Absent while there are none.
   */
  readonly resources?: ResourcePool;
  /**
   * The cards this seat paid costs with, by card id: a card spent from hand (the command's `payment`), or a card in
   * play whose resource ability the payment used (`resourcesGenerated`). Absent while there are none.
   */
  readonly paidWith?: Readonly<Record<string, number>>;
  /** How many of `paidWith` were cards spent from hand (discarded to pay), not cards in play. Absent while none. */
  readonly discardedToPay?: number;
  /**
   * The seat's best single turn (between its `turnStarted` and `turnEnded`): the most damage to enemies, and the most
   * threat removed, counted as `damage` and `thwart` are. Each is its own best, not one turn's pair. Folded in as a
   * turn ends, or as the game ends during one (not after each command, so an Overkill excess taken back in a later
   * command never stands as a best). Absent until the seat has finished a turn.
   */
  readonly bestTurn?: { readonly damage: number; readonly thwart: number };
  /** Damage each of this seat's allies dealt to the villain and minions, by ally card id (Overkill as `damage`). */
  readonly allyDamage?: Readonly<Record<string, number>>;
  /** Times each of this seat's allies was declared the defender of an enemy attack (`defenderDeclared`), by card id. */
  readonly allyBlocks?: Readonly<Record<string, number>>;
  /**
   * Times each of this seat's allies was defeated defending (`GameRecord.allyDefending`): before the attack it defended
   * resolved, or by that attack's damage. By card id; absent while none.
   */
  readonly allyDiedBlocking?: Readonly<Record<string, number>>;
}

/** An ally declared the defender of an attack, until that attack is over (`GameRecord.allyDefending`). */
export interface AllyDefense {
  readonly allyInstanceId: InstanceId;
  readonly allyCardId: string;
  readonly playerId: PlayerId;
  /** The attack has resolved (`attackResolved`): from here only its own damage to the ally makes a defeat count. */
  readonly resolved?: true;
  /** The attack's damage reached the ally. */
  readonly hit?: true;
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
  /** The source's card as it was at the hit (a double-sided card can flip later in the same command). */
  readonly sourceCardId?: string;
  readonly round: number;
}

/**
 * The last hit on a character, kept until an Overkill spill from it is dealt: the spill waits for the defeat's
 * interrupt window (`beginDefeat`, engine `resolve/event.ts`), so it can land in a later command than the hit.
 */
export interface HitMark {
  readonly sourceInstanceId: InstanceId | null;
  /** The source's card at the hit. */
  readonly sourceCardId?: string;
  /** The hit counted in `GameRecord.hurtBy` (an encounter card's on a player character). */
  readonly hurt?: true;
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
  /**
   * The turn in progress (`turnStarted` to `turnEnded`) and what its player did in it so far, for `SeatRecord.bestTurn`.
   * Absent outside a player's turn and on a record written before the field existed.
   */
  readonly turn?: { readonly playerId: PlayerId; readonly damage: number; readonly thwart: number };
  /**
   * Allies defending attacks still in progress, by the attacking enemy's instance (`AllyDefense`). The log marks no
   * attack's end, so one is over once it has resolved and the next attack, turn, round or encounter reveal begins.
   * Absent while none.
   */
  readonly allyDefending?: Readonly<Record<string, AllyDefense>>;
  /** Encounter cards revealed (`encounterCardRevealed`), by card id. Absent while none. */
  readonly encounterRevealed?: Readonly<Record<string, number>>;
  /**
   * Damage dealt to the players' characters (identities and allies) by encounter cards (enemies, treacheries,
   * attachments: a source no player owns), by the source's card id. Absent while none.
   */
  readonly hurtBy?: Readonly<Record<string, number>>;
  /** The last hit on each character this round (`HitMark`), by the character's instance. Absent while none. */
  readonly lastHits?: Readonly<Record<string, HitMark>>;
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

const bump = (
  counts: Readonly<Record<string, number>> | undefined,
  key: string,
  by = 1,
): Readonly<Record<string, number>> => ({
  ...counts,
  [key]: (counts?.[key] ?? 0) + by,
});

const addPool = (sum: ResourcePool | undefined, pool: ResourcePool): ResourcePool => ({
  physical: (sum?.physical ?? 0) + pool.physical,
  mental: (sum?.mental ?? 0) + pool.mental,
  energy: (sum?.energy ?? 0) + pool.energy,
  wild: (sum?.wild ?? 0) + pool.wild,
});

const isAlly = (state: GameState, id: InstanceId | null): boolean => !!id && cardOf(state, id)?.type === "ally";

/** An identity (either form) or an ally: a character on the players' side. */
const isPlayerCharacter = (state: GameState, id: InstanceId): boolean =>
  isAlly(state, id) || state.players.some((player) => player.identity.instanceId === id);

/**
 * The card a command's payment pays for, as the engine passes it to `payPayment` (`payingFor`); null for the rest. An
 * ability whose cost pays another card's printed cost (`AbilityCost.payPrintedCostOf`, Spell Mastery) pays for the card
 * picked in its cost choices. Engine-specific simplification: the ability's printed cost is read, not a cost a rule
 * replaced it with as the engine planned the use (`plan.cost`).
 */
function payingForOf(command: Command, deps: EngineDeps | undefined): InstanceId | null {
  if (command.type === "playCard") return command.cardInstanceId;
  if (command.type !== "useAbility") return null;
  const slot = deps?.abilities[command.abilityId]?.cost?.payPrintedCostOf?.slot;
  return (slot ? command.costChoices?.[slot]?.[0] : undefined) ?? command.cardInstanceId;
}

/** The hand cards a command spent paying (`Payment.fromHand`), in payment order; none for a command without one. */
function spentFromHand(command: Command | undefined): InstanceId[] {
  const payment = command && "payment" in command ? command.payment : undefined;
  return (payment ?? []).flatMap((entry) => ("fromHand" in entry ? [entry.fromHand] : []));
}

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
  /**
   * The command that produced `events`, when there was one (not for setup): the cards it spent from hand are read from
   * its payment, which no event names as a payment (a spent card logs only its discard).
   */
  command?: Command,
  /**
   * The state before `command`, where the caller has it: a hand card's resources are priced in the hand, as the
   * engine priced them (`handCardResources`: "double … while paying for", a rule that treats hand icons as one type).
   * Absent, a hand card counts its printed icons.
   */
  before?: GameState,
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
  let { turn, allyDefending, encounterRevealed, hurtBy, lastHits } = record;
  /**
   * Each instance's card as the events reach it: a card that flips to its other face in this command
   * (`cardFlippedToOtherFace`) was its `from` face until then, whatever `state` (after the command) says.
   */
  const faceNow = new Map<InstanceId, CardId>();
  for (const event of events) {
    if (event.type === "cardFlippedToOtherFace" && !faceNow.has(event.instanceId)) {
      faceNow.set(event.instanceId, event.from);
    }
  }
  const cardIdAt = (id: InstanceId): string | undefined => faceNow.get(id) ?? getInstance(state, id)?.cardId;
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

  const markHit = (target: InstanceId, mark: HitMark): void => {
    lastHits = { ...lastHits, [target]: mark };
  };
  /** The hit an Overkill spill from `target` came from, taken off the record: one hit spills once. */
  const takeHit = (target: InstanceId): HitMark | undefined => {
    const mark = lastHits?.[target];
    if (!lastHits || !mark) return undefined;
    const { [target]: _taken, ...rest } = lastHits;
    lastHits = rest;
    return mark;
  };

  /** Damage to an enemy from `source` (negative: an Overkill excess taken back), on its seat, its ally and its turn. */
  const enemyDamage = (source: InstanceId | null, amount: number): void => {
    const playerId = seatFor(state, source);
    const allyCardId = source && isAlly(state, source) ? cardIdAt(source) : undefined;
    onSeat(playerId, (seat) => ({
      ...seat,
      damage: seat.damage + amount,
      ...(allyCardId ? { allyDamage: bump(seat.allyDamage, allyCardId, amount) } : {}),
    }));
    if (turn && playerId === turn.playerId) turn = { ...turn, damage: turn.damage + amount };
  };
  /** Folds the turn so far into its seat's best: at the turn's end, and at a game's end during one. */
  const foldTurn = (): void => {
    const current = turn;
    if (!current) return;
    onSeat(current.playerId, (seat) => ({
      ...seat,
      bestTurn: {
        damage: Math.max(seat.bestTurn?.damage ?? 0, current.damage),
        thwart: Math.max(seat.bestTurn?.thwart ?? 0, current.thwart),
      },
    }));
  };
  /** Ends every ally defense whose attack has resolved: the next attack means it is over. */
  const endResolvedDefenses = (): void => {
    if (!allyDefending) return;
    allyDefending = Object.fromEntries(Object.entries(allyDefending).filter(([, defense]) => !defense.resolved));
  };
  /**
   * No attack is in progress as a turn or round begins, or as an encounter card is revealed: one that never resolved
   * (canceled) is over too. (Engine-specific reading: an effect revealing an encounter card in the middle of an attack
   * would end that attack's defense here early.)
   */
  const endAllDefenses = (): void => {
    allyDefending = undefined;
  };
  const patchDefense = (enemy: string, patch: (defense: AllyDefense) => AllyDefense | null): void => {
    const defense = allyDefending?.[enemy];
    if (!allyDefending || !defense) return;
    const { [enemy]: _old, ...rest } = allyDefending;
    const next = patch(defense);
    allyDefending = next ? { ...rest, [enemy]: next } : rest;
  };
  /** Damage to a player character: an encounter source's hurt, and the hit a defending ally takes from its attack. */
  const playerCharacterHurt = (event: Extract<GameEvent, { type: "damageDealt" }>): void => {
    const source = event.sourceInstanceId;
    const sourceCardId = source ? cardIdAt(source) : undefined;
    const hurt = !!source && !!sourceCardId && !playerCardOwnerOf(state, source);
    if (hurt) hurtBy = bump(hurtBy, sourceCardId!, event.amount);
    markHit(event.targetInstanceId, {
      sourceInstanceId: source,
      ...(sourceCardId ? { sourceCardId } : {}),
      ...(hurt ? { hurt: true as const } : {}),
    });
    for (const [enemy, defense] of Object.entries(allyDefending ?? {})) {
      // Damage before the attack resolved is not its damage (RRG 1.8 "Attack (Enemy Activation)" step 5, p. 9, comes
      // after step 4's `attackResolved`); after it, the attacker's damage is, and any other damage ends the defense.
      if (defense.allyInstanceId !== event.targetInstanceId || !defense.resolved) continue;
      patchDefense(enemy, (current) => (source === enemy ? { ...current, hit: true } : null));
    }
  };

  // A hand card spent paying is logged only as its discard, so the payment is read from the command (`Payment.fromHand`).
  const handSpent = spentFromHand(command);
  for (const id of handSpent) {
    const instance = getInstance(state, id);
    const card = instance ? state.cardPool[instance.cardId] : undefined;
    if (!instance || !card || !command) continue;
    // Who spent it, as the engine's `spentFromHandOf` reads it before the payment: the hand it was in (another player's
    // helping pay for an alliance card), or, for a card tucked under a `spendableFromTucked` host, the paying player
    // (a command's payment is one player's, so the group payment's "any player the rule names" does not arise). Without
    // that state, its owner, else the commanding player.
    const zone = before ? locateCard(before, id) : null;
    const spender =
      (zone?.kind === "hand" ? zone.playerId : zone?.kind === "tucked" ? command.playerId : null) ??
      playerCardOwnerOf(state, id) ??
      command.playerId;
    // Priced in hand before the payment, as `payPayment` priced it; without that state, its printed icons.
    const pool =
      before && deps
        ? handCardResources(before, deps, id, spender, payingForOf(command, deps))
        : printedResources(card);
    onSeat(spender, (seat) => ({
      ...seat,
      paidWith: bump(seat.paidWith, instance.cardId),
      discardedToPay: (seat.discardedToPay ?? 0) + 1,
      resources: addPool(seat.resources, pool),
    }));
  }

  for (const event of events) {
    switch (event.type) {
      case "roundStarted":
        round = event.round;
        endAllDefenses();
        // No spill waits across a round's start.
        lastHits = undefined;
        break;
      case "cardFlippedToOtherFace":
        faceNow.set(event.instanceId, event.to);
        break;
      // Overkill (RRG 1.8, p. 31): the defeated enemy took the whole hit, excess included, and the excess then lands
      // again where it spills. It counts where it lands, not twice, so it comes back off the first target here.
      case "overkillSpilled": {
        const hit = takeHit(event.fromInstanceId);
        // An enemy's Overkill through a defending ally: the excess counts where it lands (the identity), not twice.
        if (hit?.hurt && hit.sourceCardId && isPlayerCharacter(state, event.fromInstanceId)) {
          hurtBy = bump(hurtBy, hit.sourceCardId, -event.amount);
        }
        const countedFirst = isVillain(state, event.fromInstanceId) || isMinion(state, event.fromInstanceId);
        if (!countedFirst) break;
        damageToEnemies -= event.amount;
        enemyDamage(hit?.sourceInstanceId ?? null, -event.amount);
        if (isVillain(state, event.fromInstanceId)) {
          damageToVillain -= event.amount;
          onRound((entry) => ({ ...entry, damageToVillain: entry.damageToVillain - event.amount }));
        }
        break;
      }
      case "enemyActivated":
        activation = { enemyInstanceId: event.enemyInstanceId, playerId: event.playerId };
        endResolvedDefenses();
        break;
      case "damageDealt": {
        const villain = isVillain(state, event.targetInstanceId);
        if (!villain && !isMinion(state, event.targetInstanceId)) {
          if (isPlayerCharacter(state, event.targetInstanceId)) playerCharacterHurt(event);
          break;
        }
        damageToEnemies += event.amount;
        const sourceCardId = event.sourceInstanceId ? cardIdAt(event.sourceInstanceId) : undefined;
        markHit(event.targetInstanceId, {
          sourceInstanceId: event.sourceInstanceId,
          ...(sourceCardId ? { sourceCardId } : {}),
        });
        enemyDamage(event.sourceInstanceId, event.amount);
        if (villain) {
          damageToVillain += event.amount;
          lastVillainDamage = {
            targetInstanceId: event.targetInstanceId,
            amount: event.amount,
            sourceInstanceId: event.sourceInstanceId,
            ...(sourceCardId ? { sourceCardId } : {}),
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
      case "threatRemoved": {
        threatRemoved += event.amount;
        const playerId = seatFor(state, event.sourceInstanceId);
        onSeat(playerId, (seat) => ({ ...seat, thwart: seat.thwart + event.amount }));
        if (turn && playerId === turn.playerId) turn = { ...turn, thwart: turn.thwart + event.amount };
        onRound((entry) => ({ ...entry, threatRemoved: entry.threatRemoved + event.amount }));
        break;
      }
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
        // A player card revealed as if it were an encounter card is not one.
        if (!playerCardOwnerOf(state, event.instanceId)) encounterRevealed = bump(encounterRevealed, event.cardId);
        endAllDefenses();
        break;
      case "turnStarted":
        foldTurn();
        turn = { playerId: event.playerId, damage: 0, thwart: 0 };
        endAllDefenses();
        break;
      case "turnEnded":
        foldTurn();
        turn = undefined;
        break;
      case "cardDrawn":
        onSeat(event.playerId, (seat) => ({ ...seat, drawn: (seat.drawn ?? 0) + 1 }));
        break;
      case "resourcesGenerated": {
        // A card spent from hand with its own "when you spend this card" ability is already counted, as a hand card.
        const cardId = cardIdAt(event.instanceId);
        // A counter spent as if it were a resource pays but generates nothing (RRG 1.8 "Cost", p. 13). Without the
        // ability registry it cannot be told apart, and counts.
        const trigger = deps?.abilities[event.abilityId]?.trigger;
        const generates = !(trigger?.kind === "resource" && trigger.spentAsIfResource === true);
        onSeat(event.playerId, (seat) => ({
          ...seat,
          ...(generates ? { resources: addPool(seat.resources, event.pool) } : {}),
          ...(cardId && !handSpent.includes(event.instanceId) ? { paidWith: bump(seat.paidWith, cardId) } : {}),
        }));
        break;
      }
      case "defenderDeclared": {
        const allyCardId = isAlly(state, event.defenderInstanceId) ? cardIdAt(event.defenderInstanceId) : undefined;
        if (!allyCardId) break;
        const playerId = seatFor(state, event.defenderInstanceId) ?? event.playerId;
        onSeat(playerId, (seat) => ({ ...seat, allyBlocks: bump(seat.allyBlocks, allyCardId) }));
        allyDefending = {
          ...allyDefending,
          [event.attackInstanceId]: { allyInstanceId: event.defenderInstanceId, allyCardId, playerId },
        };
        break;
      }
      case "attackResolved":
        patchDefense(event.enemyInstanceId, (defense) => ({ ...defense, resolved: true }));
        break;
      case "defenderLeftPlay":
        patchDefense(event.enemyInstanceId, () => null);
        break;
      case "characterDefeated": {
        const found = Object.entries(allyDefending ?? {}).find(
          ([, defense]) => defense.allyInstanceId === event.instanceId && (!defense.resolved || defense.hit),
        );
        if (!found) break;
        const [enemy, defense] = found;
        onSeat(defense.playerId, (seat) => ({
          ...seat,
          allyDiedBlocking: bump(seat.allyDiedBlocking, defense.allyCardId),
        }));
        patchDefense(enemy, () => null);
        break;
      }
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
  if (state.outcome) foldTurn();

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
    ...(turn ? { turn } : {}),
    ...(allyDefending && Object.keys(allyDefending).length > 0 ? { allyDefending } : {}),
    ...(encounterRevealed ? { encounterRevealed } : {}),
    ...(hurtBy ? { hurtBy } : {}),
    ...(lastHits && Object.keys(lastHits).length > 0 ? { lastHits } : {}),
  };
}
