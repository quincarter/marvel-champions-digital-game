/**
 * docs/phase7-wave9.md §3.43 (b) and (c): `TriggerEvent cardDiscardedFromDeck` announced for the encounter deck
 * (`deck: "encounter"`), and `abilityResolved` carrying the resolved ability's slots (`moment.<slot>`). Synthetic cards
 * only, each test driving real commands:
 *
 * - `solutions`: Serpent Solutions' shape (`falcon` 53031), "Forced Response: After a Serpent Society minion is
 *   discarded from the top of the encounter deck, deal that minion to the first player as a facedown encounter card";
 * - `watch`: a forced "after a card is discarded from the top of the encounter deck" that counts what it hears, by an
 *   effect and by a cost apart;
 * - `mine`: a forced "after you discard a card from the top of your deck", which must never hear the encounter deck;
 * - `eye`: Eagle-Eyed's shape, "discard the top card of the encounter deck → …", and `talon`: Talon Line's (53012),
 *   "Response: After you resolve [eye's] ability, discard this card → for each icon in the discarded card's boost
 *   area, …".
 *
 * Sources: RRG 1.8 "Triggering Condition" (p. 45): the conditions one occurrence creates "are handled with … a single
 * response window"; "Encounter Deck" (p. 17): an emptied deck is reset at once, and the discard is not continued with
 * the new deck; "Look, Looked-At" (p. 27): looked-at cards "are still considered part of that deck"; "Boost, Boost
 * Icon" (p. 11): a boost card is discarded after it is applied, from the enemy it was given to, and a star is not a
 * boost icon; "Resolve" (p. 37). Owner decisions docs/phase7-wave7.md §4.1 Q32 (a card a response took away is not
 * counted by the ability that discarded it) and Q33 (a card the reset shuffled away is answered where it now is).
 */

import type { AnyCard } from "@mc/content";
import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, type StubAbility, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard, withEncounterPiles } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const SERPENT = trait("SERPENT SOCIETY");
const self: TargetRef = { kind: "self" };
const constant = (value: number): ValueSpec => ({ kind: "const", value });
const v = (name: string): ValueSpec => ({ kind: "var", name }) as ValueSpec;
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const def = (definition: AbilityDefinition) => definition;

const fromEncounterDeck = (extra: Partial<EventPattern> = {}): EventPattern => ({
  on: "cardDiscardedFromDeck",
  ...extra,
  eventIs: { deck: "encounter", ...extra.eventIs },
});

// --- Encounter cards. -------------------------------------------------------------------------------------------------
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const PIP = stubTreachery({ id: "pip", boostIcons: 1 });
/** Two boost icons and a star: 3 icons in the boost area. */
const STARRED = stubTreachery({ id: "starred", boostIcons: 2, starIcon: true });
/** A Serpent Society minion whose boost area is a star alone. */
const SOLDIER = stubMinion({ id: "soldier", atk: 1, sch: 1, hp: 2, boostIcons: 0, starIcon: true, traits: [SERPENT] });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 2, boostIcons: 1 });
const SOLUTIONS_RESPONSE = stubAbility(
  "solutions.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: fromEncounterDeck({ targetIs: { categories: ["minion"], trait: SERPENT } }),
    },
    effects: [{ kind: "dealAsEncounterCard", cards: { kind: "eventTarget" }, player: { kind: "firstPlayer" } }],
  }),
);
const SOLUTIONS = stubSideScheme({ id: "solutions", startingThreat: 6, abilities: [SOLUTIONS_RESPONSE.ref] });
// "When Revealed: Discard the top 2 cards of the encounter deck."
const DRAIN_REVEALED = stubAbility(
  "drain.when-revealed",
  def({ trigger: { kind: "whenRevealed" }, effects: [{ kind: "discardEncounterCards", count: constant(2) }] }),
);
const DRAIN = stubTreachery({ id: "drain", boostIcons: 0, abilities: [DRAIN_REVEALED.ref] });

// --- Player cards. ----------------------------------------------------------------------------------------------------
const count = (counterType: string, on: EventPattern): StubAbility =>
  stubAbility(
    `watch.${counterType}`,
    def({
      trigger: { kind: "response", forced: true, on },
      effects: [{ kind: "addCounters", target: self, counterType, amount: constant(1) }],
    }),
  );
const WATCH_ALL = count("seen", fromEncounterDeck());
const WATCH_COST = count("cost", fromEncounterDeck({ eventIs: { how: "cost" } }));
const WATCH_EFFECT = count("effect", fromEncounterDeck({ eventIs: { how: "effect" } }));
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_ALL.ref, WATCH_COST.ref, WATCH_EFFECT.ref] });
// A pattern written for a player's deck (wave 7): it must not hear the encounter deck's discards, with or without
// `playerIs`.
const MINE_YOURS = stubAbility(
  "mine.yours",
  def({
    trigger: { kind: "response", forced: true, on: { on: "cardDiscardedFromDeck", playerIs: "controller" } },
    effects: [{ kind: "addCounters", target: self, counterType: "yours", amount: constant(1) }],
  }),
);
const MINE_ANY = stubAbility(
  "mine.any",
  def({
    trigger: { kind: "response", forced: true, on: { on: "cardDiscardedFromDeck" } },
    effects: [{ kind: "addCounters", target: self, counterType: "any", amount: constant(1) }],
  }),
);
const MINE = stubSupport({ id: "mine", cost: 0, abilities: [MINE_YOURS.ref, MINE_ANY.ref] });
const METER = stubSupport({ id: "meter", cost: 0 });
const meter: TargetRef = { kind: "named", name: METER.name };
const measure = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: meter,
  counterType,
  amount,
});
/** The icons (★ and boost) in the boost area of the cards in `name`, read from the cards where they now are. */
const iconsOf = (name: string): ValueSpec => ({
  kind: "sum",
  values: [
    { kind: "boostIcons", of: slot(name) },
    { kind: "starIcons", cards: slot(name) },
  ],
});

// Eagle-Eyed's shape: "discard the top card of the encounter deck → …", measuring what its own effects read.
const EYE_ACTION = stubAbility(
  "eye.action",
  def({
    trigger: { kind: "action" },
    cost: { discardFromEncounterDeck: { amount: 1, slot: "discarded" } },
    effects: [
      measure("uses", constant(1)),
      measure("count", v("discarded.count")),
      measure("stars", v("discarded.starIcons")),
    ],
  }),
);
const EYE = stubUpgrade({ id: "eye", cost: 0, abilities: [EYE_ACTION.ref] });
const HAS_ICONS: Predicate = { kind: "compare", left: iconsOf("moment.discarded"), op: "atLeast", right: constant(1) };
// Talon Line's shape. Not offered when the discarded card has no icon (§3.43, the last bullet of the plan).
const TALON_RESPONSE = stubAbility(
  "talon.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      on: { on: "abilityResolved", playerIs: "controller", eventIs: { abilityId: EYE_ACTION.ref.id } },
      while: HAS_ICONS,
    },
    cost: { discardSelf: true },
    effects: [measure("talon", iconsOf("moment.discarded"))],
  }),
);
const TALON = stubUpgrade({ id: "talon", cost: 0, abilities: [TALON_RESPONSE.ref] });

const action = (id: string, definition: Omit<AbilityDefinition, "trigger">) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, ...definition }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Discard the top 3 cards of the encounter deck. … for each card discarded this way." */
const MILL_3 = action("mill-3", {
  effects: [{ kind: "discardEncounterCards", count: constant(3), bind: "gone" }, measure("count", v("gone.count"))],
});
/** Infiltration's shape with a fixed number: "discard the top 3 cards of the encounter deck → … for each". */
const COST_3 = action("cost-3", {
  cost: { discardFromEncounterDeck: { amount: 3, slot: "paid" } },
  effects: [measure("count", v("paid.count"))],
});
/** Thief Extraordinaire's shape: "look at the top 2 cards of the encounter deck, discard 1 of those cards → …". */
const LOOK = action("look", {
  cost: { encounterLookDiscard: { look: 2, discard: 1, slot: "picked" } },
  effects: [measure("count", v("picked.count"))],
});
/** "Discard cards from the top of the encounter deck until a minion is discarded." */
const UNTIL = action("until", {
  effects: [
    { kind: "discardEncounterUntil", filter: { categories: ["minion"] }, bind: "found" },
    measure("found", v("found.count")),
  ],
});
/** "Discard each [pip] from the encounter deck": a `moveCards` out of the deck. */
const SWEEP = action("sweep", {
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "encounter", zones: ["deck"], filter: { name: PIP.name } },
      to: "discard",
    },
  ],
});
const EVENTS = [MILL_3, COST_3, LOOK, UNTIL, SWEEP];

const SHARED = [EYE_ACTION, TALON_RESPONSE, DRAIN_REVEALED, MINE_YOURS, MINE_ANY, ...EVENTS.map((e) => e.ability)];
const deps: EngineDeps = depsOf(SOLUTIONS_RESPONSE, WATCH_ALL, WATCH_COST, WATCH_EFFECT, ...SHARED);
/** The same cards with no ability that hears the encounter deck's discards (a player deck's are still heard). */
const silentDeps: EngineDeps = depsOf(...SHARED);

const ENCOUNTER: readonly AnyCard[] = [BLANK, PIP, STARRED, SOLDIER, THUG, DRAIN];
type InPlay = typeof WATCH | typeof MINE | typeof EYE | typeof TALON;
interface Table {
  readonly state: GameState;
  /** The encounter deck's top cards, in order. */
  readonly top: readonly InstanceId[];
  readonly inPlay: Readonly<Record<string, InstanceId>>;
}

/**
 * p1 at the first turn with the meter and `inPlay` in play, Serpent Solutions in the villain's area when asked, the
 * encounter deck `top` (in order) then `rest` blanks, its discard pile `discard` blanks, and every other encounter
 * card out of the game (surgery before the session starts, so the log replays).
 */
function start(
  top: readonly AnyCard[],
  options: {
    readonly rest?: number;
    readonly discard?: number;
    readonly inPlay?: readonly InPlay[];
    readonly solutions?: boolean;
    readonly using?: EngineDeps;
  } = {},
): Table {
  let state = gameAtFirstTurn({
    deps: options.using ?? deps,
    cards: [...ENCOUNTER, SOLUTIONS, WATCH, MINE, METER, EYE, TALON, ...EVENTS.map((e) => e.card)],
    encounter: [SOLUTIONS.id, ...ENCOUNTER.flatMap((card) => copiesOf(card.id, 8))],
    deck: [WATCH.id, MINE.id, METER.id, EYE.id, TALON.id, ...EVENTS.map((e) => e.card.id)],
  });
  if (options.solutions) state = encounterCardInVillainArea(state, SOLUTIONS.id, 6).state;
  const inPlay: Record<string, InstanceId> = {};
  for (const card of [METER, ...(options.inPlay ?? [])]) {
    const put = playerCardIntoPlay(state, card.id);
    state = put.state;
    inPlay[card.id] = put.id;
  }
  const piles = activeEncounterDeck(state);
  const pool = [...piles.deck, ...piles.discard];
  const take = (card: AnyCard): InstanceId => {
    const at = pool.findIndex((id) => state.instances[id]!.cardId === card.id);
    if (at < 0) throw new Error(`no spare ${card.id} in the encounter deck`);
    return pool.splice(at, 1)[0]!;
  };
  const topIds = top.map(take);
  const rest = Array.from({ length: options.rest ?? 6 }, () => take(BLANK));
  const discard = Array.from({ length: options.discard ?? 0 }, () => take(BLANK));
  state = withEncounterPiles(state, { deck: [...topIds, ...rest], discard });
  return { state: { ...state, removedFromGame: [...state.removedFromGame, ...pool] }, top: topIds, inPlay };
}

type Pick = (state: GameState) => readonly string[];
/** Triggers the optional responses of these abilities whenever they are offered; else the default pick. */
const triggering =
  (...abilities: readonly StubAbility[]): Pick =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
    return abilities.flatMap((ability) =>
      choice.options
        .filter((option) => option.ref.kind === "ability" && option.ref.abilityId === ability.ref.id)
        .map((option) => option.optionId),
    );
  };

function run(table: Table, command: (state: GameState) => Command, pick: Pick = defaultPick, using = deps) {
  const result = runCommandsPicking(table.state, using, pick, command(table.state));
  const replayed = replay(result.session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
  return result;
}
/** Hands p1 the event (surgery) and plays it. */
function play(table: Table, event: { readonly card: AnyCard }, pick: Pick = defaultPick, using = deps) {
  const given = giveCard(table.state, P1, event.card.id);
  return run(
    { ...table, state: given.state },
    () => ({ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }),
    pick,
    using,
  );
}
const useEye = (table: Table, pick: Pick = defaultPick, using = deps) =>
  run(
    table,
    () => ({
      type: "useAbility",
      playerId: P1,
      cardInstanceId: table.inPlay[EYE.id]!,
      abilityId: EYE_ACTION.ref.id,
      payment: [],
    }),
    pick,
    using,
  );

const heard = (events: readonly GameEvent[]): readonly Extract<TriggerEvent, { kind: "cardDiscardedFromDeck" }>[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardDiscardedFromDeck" ? [e.event] : [],
  );
const logged = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "cardDiscardedFromEncounterDeck" ? [e] : []));
const notCounted = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "deckDiscardNotCounted" ? [e.instanceId] : []));
/** The response windows opened for deck discards, each as its candidates' ability ids. */
const windows = (events: readonly GameEvent[]): readonly (readonly string[])[] =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.timing === "response" && e.event.kind === "cardDiscardedFromDeck"
      ? [e.candidates.map((c) => `${c.abilityId}`)]
      : [],
  );
const counters = (state: GameState, id: InstanceId | undefined, type: string): number =>
  (id ? mustInstance(state, id).counters[type] : undefined) ?? 0;
const metered = (table: Table, state: GameState, type: string) => counters(state, table.inPlay[METER.id], type);
const watched = (table: Table, state: GameState, type: string) => counters(state, table.inPlay[WATCH.id], type);
const zoneOf = (state: GameState, id: InstanceId | undefined) => locateCard(state, id!)?.kind;

describe("§3.43 (b): a card discarded from the top of the encounter deck is announced", () => {
  it("a cost's discard: the card, no player, the deck, the discarding card, its side and 'cost'", () => {
    const table = start([PIP], { inPlay: [WATCH, EYE] });
    const { state, events } = useEye(table);
    expect(heard(events)).toEqual([
      {
        kind: "cardDiscardedFromDeck",
        instanceId: table.top[0],
        playerId: null,
        deck: "encounter",
        fromTop: true,
        sourceInstanceId: table.inPlay[EYE.id],
        at: "discard",
        encounterDeckId: activeEncounterDeckId(table.state),
        by: "playerCard",
        how: "cost",
      },
    ]);
    expect(logged(events)).toEqual([
      {
        type: "cardDiscardedFromEncounterDeck",
        deckId: activeEncounterDeckId(table.state),
        instanceId: table.top[0],
        by: table.inPlay[EYE.id],
        how: "cost",
        at: "discard",
      },
    ]);
    expect([watched(table, state, "seen"), watched(table, state, "cost"), watched(table, state, "effect")]).toEqual([
      1, 1, 0,
    ]);
    // The response resolved before the ability's effects, which still count the card.
    const answered = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === WATCH_ALL.ref.id);
    const resolved = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === EYE_ACTION.ref.id);
    expect(answered).toBeGreaterThan(-1);
    expect(answered).toBeLessThan(resolved);
    expect(metered(table, state, "count")).toBe(1);
  });

  it("an effect's discard of 3: three events in discard order, 'effect', in one response window", () => {
    const table = start([PIP, STARRED, THUG], { inPlay: [WATCH] });
    const { state, events } = play(table, MILL_3);
    expect(heard(events).map((e) => [e.instanceId, e.how, e.by])).toEqual(
      table.top.map((id) => [id, "effect", "playerCard"]),
    );
    expect(windows(events)).toHaveLength(1);
    expect([watched(table, state, "seen"), watched(table, state, "cost"), watched(table, state, "effect")]).toEqual([
      3, 0, 3,
    ]);
    expect(metered(table, state, "count")).toBe(3);
  });

  it("a cost that discards 3: one response window for the three, before the ability's effects", () => {
    const table = start([PIP, STARRED, THUG], { inPlay: [WATCH] });
    const { state, events } = play(table, COST_3);
    expect(heard(events).map((e) => [e.instanceId, e.how])).toEqual(table.top.map((id) => [id, "cost"]));
    expect(windows(events)).toHaveLength(1);
    expect(watched(table, state, "cost")).toBe(3);
    expect(metered(table, state, "count")).toBe(3);
  });

  it("a look-and-discard cost: the card picked from the top 2 is one", () => {
    const table = start([PIP, STARRED], { inPlay: [WATCH] });
    const { state, events } = play(table, LOOK);
    expect(heard(events).map((e) => [e.instanceId, e.how])).toEqual([[table.top[0], "cost"]]);
    expect(watched(table, state, "seen")).toBe(1);
    expect(activeEncounterDeck(state).deck[0]).toBe(table.top[1]);
  });

  it("a 'discard until a minion' loop: every card passed over and the minion", () => {
    const table = start([PIP, BLANK, THUG, STARRED], { inPlay: [WATCH] });
    const { state, events } = play(table, UNTIL);
    expect(heard(events).map((e) => e.instanceId)).toEqual(table.top.slice(0, 3));
    expect(windows(events)).toHaveLength(1);
    expect(watched(table, state, "effect")).toBe(3);
    expect(metered(table, state, "found")).toBe(1);
  });

  it("a moveCards from the encounter deck to its discard pile", () => {
    const table = start([BLANK, PIP, BLANK, PIP], { inPlay: [WATCH] });
    const { state, events } = play(table, SWEEP);
    expect(heard(events).map((e) => [e.instanceId, e.how])).toEqual([
      [table.top[1], "effect"],
      [table.top[3], "effect"],
    ]);
    expect(watched(table, state, "seen")).toBe(2);
  });

  it("an encounter card's discard is the encounter side's; a boost card and a revealed card are not from the deck", () => {
    // The villain attacks (a boost card dealt, turned up and discarded), then Drain is dealt and revealed and
    // discards 2: only those 2 are heard.
    const table = start([BLANK, DRAIN, PIP, STARRED], { inPlay: [WATCH] });
    const { state, events } = run(table, () => ({ type: "endTurn", playerId: P1 }));
    expect(events.some((e) => e.type === "boostCardDealt")).toBe(true);
    expect(heard(events).map((e) => [e.instanceId, e.by, e.how])).toEqual([
      [table.top[2], "encounterCard", "effect"],
      [table.top[3], "encounterCard", "effect"],
    ]);
    expect(watched(table, state, "seen")).toBe(2);
  });

  it("a discard that empties the deck: every card is answered where the reset left it, in the new deck", () => {
    // 2 cards in the deck, 3 owed: both are discarded, the second empties the deck, the reset shuffles both into the
    // new deck with the discard pile's 4 blanks, and the discarding stops (RRG 1.8 p. 17).
    const table = start([PIP, STARRED], { rest: 0, discard: 4, inPlay: [WATCH] });
    const { state, events } = play(table, MILL_3);
    expect(heard(events).map((e) => [e.instanceId, e.at])).toEqual([
      [table.top[0], "deck"],
      [table.top[1], "deck"],
    ]);
    expect(windows(events)).toHaveLength(1);
    expect(watched(table, state, "seen")).toBe(2);
    expect(metered(table, state, "count")).toBe(2);
    expect(activeEncounterDeck(state).deck).toHaveLength(6);
    expect(activeEncounterDeck(state).discard).toEqual([]);
    expect(state.mainScheme.accelerationTokens).toBe(1);
  });

  it("the deck's last card, a Serpent Society minion: dealt to the first player from the new deck", () => {
    const table = start([PIP, SOLDIER], { rest: 0, discard: 4, solutions: true });
    const { state, events } = play(table, MILL_3);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([table.top[1]]);
    expect(mustInstance(state, table.top[1]!).faceup).toBe(false);
    expect(notCounted(events)).toEqual([table.top[1]]);
    expect(metered(table, state, "count")).toBe(1);
    expect(activeEncounterDeck(state).deck).toHaveLength(5);
  });
});

describe("§3.43 (b): Serpent Solutions' shape, and the card a response took away", () => {
  it("2 Serpent Society minions in the top 3: both dealt facedown to the first player, and not counted", () => {
    const table = start([SOLDIER, PIP, SOLDIER], { solutions: true });
    const { state, events } = play(table, MILL_3);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([table.top[0], table.top[2]]);
    expect([table.top[0], table.top[2]].map((id) => mustInstance(state, id!).faceup)).toEqual([false, false]);
    expect(activeEncounterDeck(state).discard).toEqual([table.top[1]]);
    expect(notCounted(events)).toEqual([table.top[0], table.top[2]]);
    // "For each card discarded this way": the one card left in the set.
    expect(metered(table, state, "count")).toBe(1);
  });

  it("a minion that is not Serpent Society is not dealt, and no window opens", () => {
    const table = start([THUG, PIP, BLANK], { solutions: true });
    const { state, events } = play(table, MILL_3);
    expect(windows(events)).toEqual([]);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([]);
    expect(metered(table, state, "count")).toBe(3);
  });

  it("a cost of 3 with a Serpent Society minion second: 2 cards counted by the ability it paid for", () => {
    const table = start([PIP, SOLDIER, STARRED], { solutions: true });
    const { state, events } = play(table, COST_3);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([table.top[1]]);
    expect(notCounted(events)).toEqual([table.top[1]]);
    expect(metered(table, state, "count")).toBe(2);
  });

  it("'discard until a minion' that finds a Serpent Society minion: the minion is gone from what it found", () => {
    const table = start([PIP, SOLDIER], { solutions: true });
    const { state } = play(table, UNTIL);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([table.top[1]]);
    expect(metered(table, state, "found")).toBe(0);
  });

  it("once Serpent Solutions has dealt the minion away, no other ability answers its discard", () => {
    // All forced, ordered by the first player (RRG 1.8 "Simultaneous Timing Priority", p. 5): Serpent Solutions first.
    const solutionsFirst: Pick = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "orderTriggers") return defaultPick(state);
      const first = (option: (typeof choice.options)[number]) =>
        option.ref.kind === "ability" && option.ref.abilityId === SOLUTIONS_RESPONSE.ref.id ? 0 : 1;
      return [...choice.options].sort((a, b) => first(a) - first(b)).map((option) => option.optionId);
    };
    const table = start([SOLDIER], { solutions: true, inPlay: [WATCH, EYE] });
    const { state, events } = useEye(table, solutionsFirst);
    const order = events.flatMap((e) => (e.type === "abilityResolved" ? [`${e.abilityId}`] : []));
    expect(order).toEqual([SOLUTIONS_RESPONSE.ref.id, EYE_ACTION.ref.id]);
    expect(watched(table, state, "seen")).toBe(0);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([table.top[0]]);
  });
});

describe("§3.43 (b): opened only when an ability listens", () => {
  it("no listener in the registry: nothing recorded, logged or announced, and the same game", () => {
    const table = start([PIP, STARRED, THUG], { using: silentDeps });
    const { state, events } = play(table, MILL_3, defaultPick, silentDeps);
    expect(logged(events)).toEqual([]);
    expect(heard(events)).toEqual([]);
    expect(windows(events)).toEqual([]);
    expect(state.pendingDeckDiscards).toBeUndefined();
    expect(state.deckDiscardWindows).toBeUndefined();
    expect(metered(table, state, "count")).toBe(3);
    // The listening registry, with no listening card in play, plays the same game but for the log lines.
    const loud = play(start([PIP, STARRED, THUG]), MILL_3);
    expect(loud.events.filter((e) => e.type !== "cardDiscardedFromEncounterDeck")).toEqual(events);
    expect(loud.state).toEqual(state);
  });

  it("a pattern written for a player's deck never hears the encounter deck, listener or not", () => {
    for (const using of [deps, silentDeps]) {
      const table = start([PIP, STARRED, THUG], { inPlay: [MINE], using });
      const { state, events } = play(table, MILL_3, defaultPick, using);
      expect(windows(events)).toEqual([]);
      expect(counters(state, table.inPlay[MINE.id], "yours")).toBe(0);
      expect(counters(state, table.inPlay[MINE.id], "any")).toBe(0);
    }
  });
});

describe("§3.43 (c): abilityResolved carries the resolved ability's slots", () => {
  const talon = triggering(TALON_RESPONSE);

  it("a card of 2 boost icons and a star: the response reads 3 icons from the card the cost discarded", () => {
    const table = start([STARRED], { inPlay: [EYE, TALON] });
    const { state, events } = useEye(table, talon);
    const carried = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "abilityResolved" ? [e.event] : [],
    );
    expect(carried).toHaveLength(1);
    expect(carried[0]!.abilityId).toBe(EYE_ACTION.ref.id);
    expect(carried[0]!.carried?.discarded).toEqual([table.top[0]]);
    expect(metered(table, state, "talon")).toBe(3);
    // Its cost was paid: the card is in its owner's discard pile.
    expect(zoneOf(state, table.inPlay[TALON.id])).toBe("discard");
  });

  it("a card of 0 icons: the response is not offered", () => {
    const table = start([BLANK], { inPlay: [EYE, TALON] });
    const { state, events } = useEye(table, talon);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === TALON_RESPONSE.ref.id)).toBe(false);
    expect(metered(table, state, "uses")).toBe(1);
    expect(zoneOf(state, table.inPlay[TALON.id])).toBe("playArea");
  });

  it("a Serpent Society minion (a star) dealt away by Serpent Solutions: not counted by the ability, 1 icon for the response", () => {
    const table = start([SOLDIER], { solutions: true, inPlay: [EYE, TALON] });
    const { state, events } = useEye(table, talon);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([table.top[0]]);
    expect(notCounted(events)).toEqual([table.top[0]]);
    // The discarding ability reads what the response left (Q32) …
    expect([metered(table, state, "uses"), metered(table, state, "count"), metered(table, state, "stars")]).toEqual([
      1, 0, 0,
    ]);
    // … and "the discarded card" is still that card, read where it is now.
    expect(metered(table, state, "talon")).toBe(1);
  });

  it("no ability answers the resolution: no event is made", () => {
    const table = start([STARRED], { inPlay: [EYE] });
    const { events } = useEye(table);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "abilityResolved")).toBe(false);
  });
});
