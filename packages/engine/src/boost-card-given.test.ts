/**
 * docs/phase7-wave9.md §3.44: `TriggerEvent boostCardGiven`, and a look over a facedown boost card and the top card of
 * the encounter deck that may swap them (`EffectSpec lookAt` with `rearrange` and `bindAt`; `swapCards`). Synthetic
 * cards only, each test driving real commands:
 *
 * - `away`: Up, Up, and Away's shape (`falcon` 53005), "Response: After an attacking enemy is given a facedown boost
 *   card, look at that card and the top card of the encounter deck. You may swap those cards. Draw 1 card for each
 *   printed icon (★ and boost) in the (current) boost card's boost area";
 * - `trade`: the same in two steps, a plain look and then `swapCards`;
 * - `tally`: a forced "after an enemy is given a facedown boost card" that counts what it hears, by activation.
 *
 * Sources: RRG 1.8 "Attack (Enemy Activation)" (p. 8), step 1 "Give boost card", before a defender is declared and
 * before any boost card is turned up; "Boost, Boost Icon" (p. 11): a card dealt outside the enemy's activation waits
 * facedown, each boost card is turned up one at a time and a star is not a boost icon; "Look, Looked-At" (p. 27):
 * "only the player who is resolving the ability can look at those cards"; "'Swap'" (p. 42): the cards exchange
 * locations and "maintain the orientation … of the original card"; "Triggering Condition" (p. 45): once per
 * occurrence. §3.42 for the top card kept faceup.
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, type StubAbility, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard, withEncounterPiles } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";
import { faceVisible, lookedAtBy } from "./visibility.js";

const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const constant = (value: number): ValueSpec => ({ kind: "const", value });
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const def = (definition: AbilityDefinition) => definition;
const given = (extra: Partial<EventPattern> = {}): EventPattern => ({ on: "boostCardGiven", ...extra });

// --- Encounter cards: no Boost ability, so a boost card adds its icons and nothing else. ------------------------------
const ZERO = stubTreachery({ id: "zero", boostIcons: 0 });
const ONE = stubTreachery({ id: "one", boostIcons: 1 });
const THREE = stubTreachery({ id: "three", boostIcons: 3 });
/** One boost icon and a star: 2 printed icons in the boost area, 1 of them counted by the activation. */
const STARRED = stubTreachery({ id: "starred", boostIcons: 1, starIcon: true });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 9, keywords: [{ name: "villainous" }] });
const ENCOUNTER: readonly AnyCard[] = [ZERO, ONE, THREE, STARRED];

// --- The cards that make the enemies activate. ------------------------------------------------------------------------
const theVillain: TargetRef = { kind: "villain" };
const driver = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ATTACK = driver("strike", [{ kind: "enemyAttack", enemies: theVillain, against: you }]);
/** "The villain attacks you. Give the villain 1 additional boost card for that activation." */
const ASSAULT = driver("assault", [{ kind: "enemyAttack", enemies: theVillain, against: you, extraBoostCards: 1 }]);
const SCHEME = driver("plot", [{ kind: "enemyScheme", enemies: theVillain, against: you }]);
const SIC = driver("sic", [{ kind: "enemyAttack", enemies: { kind: "named", name: GOON.name }, against: you }]);
/** "Give the villain a facedown boost card": outside any activation. */
const GIFT = driver("gift", [{ kind: "giveBoostCard", enemy: theVillain }]);
const DRIVERS = [ATTACK, ASSAULT, SCHEME, SIC, GIFT];

// --- The cards that answer. -------------------------------------------------------------------------------------------
const THAT_CARD_AND_THE_TOP: CardSelector = {
  kind: "anyOf",
  of: [
    { kind: "ref", ref: { kind: "eventTarget" } },
    { kind: "encounter", zones: ["deck"], top: constant(1) },
  ],
};
/** "Each printed icon (★ and boost)" of the cards in a slot. */
const printedIcons = (name: string): ValueSpec => ({
  kind: "sum",
  values: [
    { kind: "boostIcons", of: slot(name), printed: true },
    { kind: "starIcons", cards: slot(name) },
  ],
});
const AWAY_RESPONSE = stubAbility(
  "away.response",
  def({
    trigger: { kind: "response", forced: false, on: given({ activation: "attack" }) },
    effects: [
      {
        kind: "lookAt",
        cards: THAT_CARD_AND_THE_TOP,
        viewer: you,
        rearrange: true,
        bind: "seen",
        bindAt: ["boost", "top"],
      },
      { kind: "draw", player: you, amount: printedIcons("boost") },
    ],
  }),
);
const AWAY = stubEvent({ id: "away", cost: 0, abilities: [AWAY_RESPONSE.ref] });
/** The same event with the card's "(defense)" label. */
const GUARD_RESPONSE = stubAbility("guard.response", def({ ...AWAY_RESPONSE.definition, label: ["defense"] }));
const GUARD = stubEvent({ id: "guard", cost: 0, abilities: [GUARD_RESPONSE.ref] });
/** The two-step form, on a card in play: look at both, then swap them. */
const TRADE_RESPONSE = stubAbility(
  "trade.response",
  def({
    trigger: { kind: "response", forced: false, on: given({ activation: "attack" }) },
    effects: [
      { kind: "lookAt", cards: THAT_CARD_AND_THE_TOP, viewer: you, bind: "seen" },
      { kind: "selectCards", slot: "top", cards: { kind: "encounter", zones: ["deck"], top: constant(1) } },
      { kind: "swapCards", a: { kind: "eventTarget" }, b: slot("top") },
    ],
  }),
);
const TRADE = stubSupport({ id: "trade", cost: 0, abilities: [TRADE_RESPONSE.ref] });
const tally = (counterType: string, on: EventPattern): StubAbility =>
  stubAbility(
    `tally.${counterType}`,
    def({
      trigger: { kind: "response", forced: true, on },
      effects: [{ kind: "addCounters", target: self, counterType, amount: constant(1) }],
    }),
  );
const TALLY_ALL = tally("all", given());
const TALLY_ATTACK = tally("attack", given({ activation: "attack" }));
const TALLY_SCHEME = tally("scheme", given({ activation: "scheme" }));
const TALLY_YOURS = tally("yours", given({ playerIs: "controller" }));
const TALLY = stubSupport({
  id: "tally",
  cost: 0,
  abilities: [TALLY_ALL.ref, TALLY_ATTACK.ref, TALLY_SCHEME.ref, TALLY_YOURS.ref],
});
/** Falcon's hero face (§3.42): the top card of the encounter deck faceup during the player phase. */
const EAGLE_CONSTANT = stubAbility(
  "eagle.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "topOfDeckFaceup", deck: "encounter", while: { kind: "gameStep", phase: "player" } }],
    },
    effects: [],
  }),
);
const EAGLE = stubSupport({ id: "eagle", cost: 0, abilities: [EAGLE_CONSTANT.ref] });

const DRIVER_ABILITIES = DRIVERS.map((d) => d.ability);
const deps: EngineDeps = depsOf(
  AWAY_RESPONSE,
  GUARD_RESPONSE,
  TRADE_RESPONSE,
  TALLY_ALL,
  TALLY_ATTACK,
  TALLY_SCHEME,
  TALLY_YOURS,
  EAGLE_CONSTANT,
  ...DRIVER_ABILITIES,
);
/** The same cards with no ability that hears a boost card being given. */
const silentDeps: EngineDeps = depsOf(EAGLE_CONSTANT, ...DRIVER_ABILITIES);

type InPlay = typeof TRADE | typeof TALLY | typeof EAGLE;
interface Table {
  readonly state: GameState;
  /** The encounter deck's top cards, in order. */
  readonly top: readonly InstanceId[];
  readonly inPlay: Readonly<Record<string, InstanceId>>;
  /** p1's copies of the event, in hand. */
  readonly away: readonly InstanceId[];
  readonly goon: InstanceId;
}

/**
 * Two players at p1's first turn, p1 in hero form with every driver and `inPlay` in play and `away` copies of the
 * event in hand; a villainous minion engaged with p1; the encounter deck `top` (in order) then `rest` cards of 1 icon,
 * every other encounter card out of the game (surgery before the session starts, so the log replays).
 */
function start(
  top: readonly AnyCard[],
  options: {
    readonly rest?: number;
    readonly inPlay?: readonly InPlay[];
    readonly away?: number;
    readonly using?: EngineDeps;
  } = {},
): Table {
  const kit = [AWAY, GUARD, TRADE, TALLY, EAGLE, ...DRIVERS.map((d) => d.card)];
  let state = gameAtFirstTurn({
    deps: options.using ?? deps,
    players: 2,
    cards: [...ENCOUNTER, GOON, ...kit],
    encounter: [GOON.id, ...ENCOUNTER.flatMap((card) => copiesOf(card.id, 8))],
    deck: [AWAY.id, AWAY.id, ...kit.slice(1).map((card) => card.id)],
  });
  const engaged = minionEngagedWith(state, GOON.id);
  state = engaged.state;
  const inPlay: Record<string, InstanceId> = {};
  for (const card of [...DRIVERS.map((d) => d.card), ...(options.inPlay ?? [])]) {
    const put = playerCardIntoPlay(state, card.id);
    state = put.state;
    inPlay[card.id] = put.id;
  }
  // No copy of the event in an opening hand: only the ones a test asks for, in p1's.
  const isAway = (id: InstanceId) => [AWAY.id, GUARD.id].includes(state.instances[id]!.cardId);
  state = {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.filter((id) => !isAway(id)),
      deck: [...p.deck, ...p.hand.filter(isAway)],
    })),
  };
  const away: InstanceId[] = [];
  for (let i = 0; i < (options.away ?? 0); i++) {
    const held = giveCard(state, P1, AWAY.id, away);
    state = held.state;
    away.push(held.id);
  }
  const piles = activeEncounterDeck(state);
  const pool = [...piles.deck, ...piles.discard];
  const take = (card: AnyCard): InstanceId => {
    const at = pool.findIndex((id) => state.instances[id]!.cardId === card.id);
    if (at < 0) throw new Error(`no spare ${card.id} in the encounter deck`);
    return pool.splice(at, 1)[0]!;
  };
  const topIds = top.map(take);
  const rest = Array.from({ length: options.rest ?? 5 }, () => take(ONE));
  state = withEncounterPiles(state, { deck: [...topIds, ...rest], discard: [] });
  state = {
    ...state,
    removedFromGame: [...state.removedFromGame, ...pool],
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "hero" as const } } : p,
    ),
  };
  return { state, top: topIds, inPlay, away, goon: engaged.id };
}

type Pick = (state: GameState) => readonly string[];
type Arrange = (offered: readonly string[]) => readonly string[];
const kept: Arrange = (offered) => offered;
const swapped: Arrange = (offered) => [...offered].reverse();
/**
 * Answers each prompt that offers one of these optional responses from `plays`, in turn: an arrangement triggers one
 * copy and answers its `rearrange` prompt with it; "decline" passes. Once `plays` is used up every such prompt is
 * declined. Every other choice gets the default pick. One picker per run (it counts the prompts it has answered).
 */
function answering(abilities: readonly StubAbility[], ...plays: readonly (Arrange | "decline")[]): Pick {
  let asked = 0;
  let arrange: Arrange = kept;
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "rearrange") return arrange(choice.options.map((option) => option.optionId));
    if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
    const ids: readonly string[] = abilities.map((ability) => ability.ref.id);
    const offered = choice.options.filter(
      (option) => option.ref.kind === "ability" && ids.includes(option.ref.abilityId),
    );
    if (offered.length === 0) return defaultPick(state);
    const play = plays[asked++] ?? "decline";
    if (play === "decline") return [];
    arrange = play;
    return [offered[0]!.optionId];
  };
}

interface Run {
  readonly session: GameSession;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
/** Applies `command`, then answers choices with `pick` until `until` holds for the open choice or none is open. */
function run(
  from: GameState | Run,
  command: Command | null,
  pick: Pick = defaultPick,
  using: EngineDeps = deps,
  until: (state: GameState) => boolean = () => false,
): Run {
  let session = "session" in from ? from.session : startSession(from);
  const events: GameEvent[] = [];
  const apply = (next: Command): void => {
    const result = sessionApply(session, next, using);
    if (!result.ok) throw new Error(`${next.type} rejected: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  if (command) apply(command);
  for (let guard = 0; session.state.pendingChoice && !until(session.state); guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = session.state.pendingChoice;
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: pick(session.state),
    });
  }
  const replayed = replay(session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { session, state: session.state, events };
}
const use = (table: Table, card: { readonly card: AnyCard; readonly ability: StubAbility }): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: table.inPlay[card.card.id]!,
  abilityId: card.ability.ref.id,
  payment: [],
});
const atLook = (state: GameState): boolean =>
  state.pendingChoice?.prompt.kind === "rearrange" || state.pendingChoice?.prompt.kind === "lookAt";

const heard = (events: readonly GameEvent[]): readonly Extract<TriggerEvent, { kind: "boostCardGiven" }>[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "boostCardGiven" ? [e.event] : [],
  );
/** The log's order of boost cards dealt, boost cards announced as given, and boost cards turned up. */
const beats = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) =>
    e.type === "boostCardDealt"
      ? ["dealt"]
      : e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "boostCardGiven"
        ? ["given"]
        : e.type === "boostCardFlipped"
          ? ["flipped"]
          : [],
  );
const flipped = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "boostCardFlipped" ? [e.instanceId] : []));
const resolvedCount = (events: readonly GameEvent[], ability: StubAbility): number =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === ability.ref.id).length;
const counters = (state: GameState, id: InstanceId | undefined, type: string): number =>
  (id ? mustInstance(state, id).counters[type] : undefined) ?? 0;
const tallied = (table: Table, state: GameState) =>
  ["all", "attack", "scheme", "yours"].map((type) => counters(state, table.inPlay[TALLY.id], type));
const hand = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).hand;
const villainOf = (state: GameState) => state.villains[0]!.instanceId;
const boostOn = (state: GameState, id: InstanceId) => mustInstance(state, id).boostCards;
const deckOf = (state: GameState) => activeEncounterDeck(state).deck;
const sees = (state: GameState, id: InstanceId, viewer: PlayerId, using = deps) =>
  faceVisible(state, id, { viewer, deps: using });
const damageTo = (state: GameState, player: PlayerId = P1) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;

describe("§3.44: a facedown boost card given to an enemy is announced", () => {
  it("the villain attacking: one event after the card is dealt and before it is turned up", () => {
    const table = start([ONE], { inPlay: [TALLY] });
    const { state, events } = run(table.state, use(table, ATTACK));
    expect(heard(events)).toEqual([
      {
        kind: "boostCardGiven",
        enemyInstanceId: villainOf(table.state),
        boostInstanceId: table.top[0],
        activation: "attack",
        playerId: P1,
      },
    ]);
    expect(beats(events)).toEqual(["dealt", "given", "flipped"]);
    expect(tallied(table, state)).toEqual([1, 1, 0, 1]);
  });

  it("a Villainous minion attacking: its own boost card", () => {
    const table = start([ONE], { inPlay: [TALLY] });
    const { state, events } = run(table.state, use(table, SIC));
    expect(heard(events).map((e) => [e.enemyInstanceId, e.boostInstanceId, e.activation])).toEqual([
      [table.goon, table.top[0], "attack"],
    ]);
    expect(tallied(table, state)).toEqual([1, 1, 0, 1]);
  });

  it("the villain scheming: the activation is the scheme, and a response to an attacking enemy is not offered", () => {
    const table = start([ONE], { inPlay: [TALLY], away: 1 });
    const { state, events } = run(table.state, use(table, SCHEME), answering([AWAY_RESPONSE], kept));
    expect(heard(events).map((e) => [e.activation, e.playerId])).toEqual([["scheme", P1]]);
    expect(tallied(table, state)).toEqual([1, 0, 1, 1]);
    expect(resolvedCount(events, AWAY_RESPONSE)).toBe(0);
    expect(hand(state)).toContain(table.away[0]);
  });

  it("2 boost cards for one attack: the second is dealt after the first one's window, with a window of its own", () => {
    const table = start([ONE, THREE], { inPlay: [TALLY] });
    const { state, events } = run(table.state, use(table, ASSAULT));
    expect(heard(events).map((e) => e.boostInstanceId)).toEqual([table.top[0], table.top[1]]);
    expect(beats(events)).toEqual(["dealt", "given", "dealt", "given", "flipped", "flipped"]);
    expect(tallied(table, state)).toEqual([2, 2, 0, 2]);
    expect(state.stack).toEqual([]);
  });

  it("a card ability gives the villain a boost card outside its activation: no activation and no player", () => {
    const table = start([ONE], { inPlay: [TALLY], away: 1 });
    const { state, events } = run(table.state, use(table, GIFT), answering([AWAY_RESPONSE], kept));
    expect(heard(events)).toEqual([
      {
        kind: "boostCardGiven",
        enemyInstanceId: villainOf(table.state),
        boostInstanceId: table.top[0],
        activation: null,
        playerId: null,
      },
    ]);
    expect(tallied(table, state)).toEqual([1, 0, 0, 0]);
    expect(resolvedCount(events, AWAY_RESPONSE)).toBe(0);
    // It waits facedown on the villain (RRG 1.8 p. 11).
    expect(boostOn(state, villainOf(state))).toEqual([table.top[0]]);
  });
});

describe("§3.44: Up, Up, and Away's shape", () => {
  it("the look shows the boost card and the deck's top card to the looking player alone", () => {
    const table = start([ZERO, THREE], { away: 1 });
    const { state, events } = run(table.state, use(table, ATTACK), answering([AWAY_RESPONSE], kept), deps, atLook);
    const [boost, top] = table.top as [InstanceId, InstanceId];
    expect(state.pendingChoice).toMatchObject({
      playerId: P1,
      prompt: {
        kind: "rearrange",
        positions: [
          { zone: { kind: "boost", hostInstanceId: villainOf(state) }, index: 0 },
          { zone: { kind: "encounterDeck", deckId: activeEncounterDeckId(state) }, index: 0 },
        ],
      },
    });
    expect(state.pendingChoice!.options.map((option) => option.optionId)).toEqual([boost, top]);
    expect(events).toContainEqual({ type: "cardsLookedAt", playerId: P1, instanceIds: [boost, top] });
    expect([sees(state, boost, P1), sees(state, top, P1)]).toEqual([true, true]);
    expect([sees(state, boost, P2), sees(state, top, P2)]).toEqual([false, false]);
    expect(lookedAtBy(state, P1)).toEqual([boost, top]);
    expect(lookedAtBy(state, P2)).toEqual([]);
    // Both are still facedown where they are.
    expect([mustInstance(state, boost).faceup, mustInstance(state, top).faceup]).toEqual([false, false]);
    // The announcement and the look name the two cards by instance and nothing else. (The engine's log is the
    // authority's trace: `cardMoved` has always carried a moved card's id, a boost card's included, and the prompt
    // its option labels. What a seat is shown of them is `faceVisible`'s answer.)
    const said = JSON.stringify(
      events.filter(
        (e) =>
          e.type === "cardsLookedAt" ||
          ((e.type === "triggerEvent" || e.type === "windowOpened") && e.event.kind === "boostCardGiven"),
      ),
    );
    expect(said).toContain(boost);
    expect(said).not.toContain(`"${ZERO.id}"`);
    expect(said).not.toContain(`"${THREE.id}"`);
  });

  it("a boost card of 0 icons swapped with a top card of 3: 3 cards drawn, and the attack turns up the 3-icon card", () => {
    const table = start([ZERO, THREE], { away: 1 });
    const [boost, top] = table.top as [InstanceId, InstanceId];
    const before = hand(table.state).length;
    const { state, events } = run(table.state, use(table, ATTACK), answering([AWAY_RESPONSE], swapped));
    expect(events).toContainEqual(
      expect.objectContaining({ type: "cardsRearranged", playerId: P1, instanceIds: [top, boost], moved: 2 }),
    );
    // The event left the hand and 3 cards came in.
    expect(hand(state).length).toBe(before - 1 + 3);
    expect(flipped(events)).toEqual([top]);
    // The old boost card was the top of the deck; no other boost card was dealt for it.
    expect(beats(events)).toEqual(["dealt", "given", "flipped"]);
    expect(deckOf(state)[0]).toBe(boost);
    expect(mustInstance(state, boost).faceup).toBe(false);
    expect(zoneOf(state, top)).toBe("encounterDiscard");
    // ATK 2 + 3 boost icons, undefended.
    expect(damageTo(state)).toBe(5);
    expect(heard(events)).toHaveLength(1);
  });

  it("a top card that came back from the discard pile still marked faceup is a facedown boost card once swapped in", () => {
    // A deck reset shuffles discarded cards in as they are, and a deck's cards carry no orientation of their own; the
    // card that takes the boost card's place takes its orientation (RRG 1.8 "'Swap'", p. 42), so the attack turns it up.
    const table = start([ZERO, THREE], { away: 1 });
    const [boost, top] = table.top as [InstanceId, InstanceId];
    const stale: GameState = {
      ...table.state,
      instances: { ...table.state.instances, [top]: { ...mustInstance(table.state, top), faceup: true } },
    };
    const looking = run(
      stale,
      use(table, ATTACK),
      answering([AWAY_RESPONSE], swapped),
      deps,
      (state) => state.pendingChoice?.prompt.kind === "declareDefender",
    );
    expect(mustInstance(looking.state, top).faceup).toBe(false);
    const { state, events } = run(looking, null);
    expect(flipped(events)).toEqual([top]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "boostCardFlipped", instanceId: top, boostIcons: 3 }),
    );
    expect(deckOf(state)[0]).toBe(boost);
    expect(damageTo(state)).toBe(5);
  });

  it("not swapped: 0 cards drawn, and the attack turns up the card it was given", () => {
    const table = start([ZERO, THREE], { away: 1 });
    const [boost, top] = table.top as [InstanceId, InstanceId];
    const before = hand(table.state).length;
    const { state, events } = run(table.state, use(table, ATTACK), answering([AWAY_RESPONSE], kept));
    expect(events).toContainEqual(
      expect.objectContaining({ type: "cardsRearranged", instanceIds: [boost, top], moved: 0 }),
    );
    expect(hand(state).length).toBe(before - 1);
    expect(flipped(events)).toEqual([boost]);
    expect(deckOf(state)[0]).toBe(top);
    expect(damageTo(state)).toBe(2);
  });

  it("kept, a boost card of 1 icon and a star: 2 cards drawn for its printed icons, 1 icon counted by the attack", () => {
    const table = start([STARRED, ZERO], { away: 1 });
    const before = hand(table.state).length;
    const { state, events } = run(table.state, use(table, ATTACK), answering([AWAY_RESPONSE], kept));
    expect(hand(state).length).toBe(before - 1 + 2);
    expect(flipped(events)).toEqual([table.top[0]]);
    expect(damageTo(state)).toBe(3);
  });

  it("the response declined: nothing is looked at and nothing moves", () => {
    const table = start([ZERO, THREE], { away: 1 });
    const { state, events } = run(table.state, use(table, ATTACK));
    expect(events.some((e) => e.type === "cardsLookedAt")).toBe(false);
    expect(resolvedCount(events, AWAY_RESPONSE)).toBe(0);
    expect(flipped(events)).toEqual([table.top[0]]);
    expect(hand(state)).toContain(table.away[0]);
  });

  it("2 copies for one boost card: the second looks at the card that is the boost card now, and draws for it again", () => {
    // Given ZERO: the first copy swaps it with THREE (3 drawn). In the same window (RRG 1.8 p. 45: "multiple copies
    // … can each be triggered by the same triggering condition") the second looks at THREE, now the boost card, and
    // ZERO on top of the deck, swaps nothing, and draws 3 for the current boost card.
    const table = start([ZERO, THREE], { away: 2 });
    const [zero, three] = table.top as [InstanceId, InstanceId];
    const before = hand(table.state).length;
    const { state, events } = run(table.state, use(table, ATTACK), answering([AWAY_RESPONSE], swapped, kept));
    expect(heard(events)).toHaveLength(1);
    expect(events.flatMap((e) => (e.type === "cardsLookedAt" ? [e.instanceIds] : []))).toEqual([
      [zero, three],
      [three, zero],
    ]);
    expect(hand(state).length).toBe(before - 2 + 3 + 3);
    expect(flipped(events)).toEqual([three]);
    expect(damageTo(state)).toBe(5);
  });

  it("2 boost cards: a copy for each, and the card swapped onto the deck is the second boost card given", () => {
    // Given ZERO: swapped with THREE (3 drawn), the second copy held back. The second card given is then ZERO again,
    // off the top: swapped with STARRED (2 drawn). The attack turns up THREE and STARRED: ATK 2 + 3 + 1.
    const table = start([ZERO, THREE, STARRED], { away: 2 });
    const [zero, three, starred] = table.top as [InstanceId, InstanceId, InstanceId];
    const before = hand(table.state).length;
    const { state, events } = run(
      table.state,
      use(table, ASSAULT),
      answering([AWAY_RESPONSE], swapped, "decline", swapped),
    );
    expect(heard(events).map((e) => e.boostInstanceId)).toEqual([zero, zero]);
    expect(resolvedCount(events, AWAY_RESPONSE)).toBe(2);
    expect(hand(state).length).toBe(before - 2 + 3 + 2);
    expect(flipped(events)).toEqual([three, starred]);
    expect(deckOf(state)[0]).toBe(zero);
    expect(damageTo(state)).toBe(6);
  });

  it("with the (defense) label: the hero is the attack's defender from the give-boost step, before the declare-defender step", () => {
    const table = start([ZERO, THREE]);
    const held = giveCard(table.state, P1, GUARD.id);
    const hero = mustPlayer(held.state, P1).identity.instanceId;
    const { state, events } = run(held.state, use(table, ATTACK), answering([GUARD_RESPONSE], swapped));
    expect(flipped(events)).toEqual([table.top[1]]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "triggerEvent",
        event: expect.objectContaining({ kind: "defended", defenderInstanceId: hero, basic: false }),
      }),
    );
    // The declare-defender step still follows, and offers that hero alone a basic defense (declined here).
    const asked = events.flatMap((e) =>
      e.type === "choiceRequested" && e.choice.prompt.kind === "declareDefender"
        ? [e.choice.options.map((option) => option.optionId)]
        : [],
    );
    expect(asked).toEqual([["decline", hero]]);
    // Not a basic defense: the hero is not exhausted and DEF is not subtracted. ATK 2 + 3.
    expect(mustInstance(state, hero).exhausted).toBe(false);
    expect(damageTo(state)).toBe(5);
  });

  it("a Villainous minion's boost card can be swapped too", () => {
    const table = start([ZERO, THREE], { away: 1 });
    const { state, events } = run(table.state, use(table, SIC), answering([AWAY_RESPONSE], swapped));
    expect(flipped(events)).toEqual([table.top[1]]);
    // ATK 1 + 3 boost icons.
    expect(damageTo(state)).toBe(4);
  });
});

describe("§3.44: with the top card of the encounter deck kept faceup (§3.42)", () => {
  it("the swapped-in card is a facedown boost card; the card swapped out is the deck's top card, showing", () => {
    const table = start([ZERO, THREE], { away: 1, inPlay: [EAGLE] });
    const [boost, top] = table.top as [InstanceId, InstanceId];
    // Before the attack the top card (ZERO) shows; once it is given as a boost card it is facedown and THREE shows.
    expect(sees(table.state, boost, P2)).toBe(true);
    const looking = run(table.state, use(table, ATTACK), answering([AWAY_RESPONSE], kept), deps, atLook);
    expect(sees(looking.state, boost, P2)).toBe(false);
    expect(sees(looking.state, top, P2)).toBe(true);
    const done = run(
      looking,
      null,
      (state) => (state.pendingChoice?.prompt.kind === "rearrange" ? swapped(defaultPick(state)) : defaultPick(state)),
      deps,
      (state) => state.pendingChoice?.prompt.kind === "declareDefender",
    );
    // THREE, which every player had seen on top of the deck, is now the facedown boost card …
    expect(boostOn(done.state, villainOf(done.state))).toEqual([top]);
    expect(mustInstance(done.state, top).faceup).toBe(false);
    expect(sees(done.state, top, P2)).toBe(false);
    // … and ZERO is the deck's top card, shown as the rule says.
    expect(deckOf(done.state)[0]).toBe(boost);
    expect(sees(done.state, boost, P2)).toBe(true);
    expect(done.events).toContainEqual(expect.objectContaining({ type: "encounterTopShown", instanceId: boost }));
  });
});

describe("§3.44: a plain look, then swapCards", () => {
  it("swaps the facedown boost card with the deck's top card, each facedown in the other's place", () => {
    const table = start([ZERO, THREE], { inPlay: [TRADE] });
    const [boost, top] = table.top as [InstanceId, InstanceId];
    const looking = run(table.state, use(table, ATTACK), answering([TRADE_RESPONSE], kept), deps, atLook);
    expect(looking.state.pendingChoice).toMatchObject({ playerId: P1, prompt: { kind: "lookAt" } });
    expect([sees(looking.state, boost, P1), sees(looking.state, top, P1)]).toEqual([true, true]);
    expect([sees(looking.state, boost, P2), sees(looking.state, top, P2)]).toEqual([false, false]);
    const { state, events } = run(looking, null);
    expect(events).toContainEqual(expect.objectContaining({ type: "cardsSwapped", how: "outOfPlay" }));
    expect(flipped(events)).toEqual([top]);
    expect(deckOf(state)[0]).toBe(boost);
    expect(mustInstance(state, boost).faceup).toBe(false);
    expect(damageTo(state)).toBe(5);
  });
});

describe("§3.44: a deck of one card", () => {
  it("the swap leaves the deck with one card: no reset and no acceleration token, by either form", () => {
    for (const [inPlay, away, pick] of [
      [[], 1, answering([AWAY_RESPONSE], swapped)],
      [[TRADE], 0, answering([TRADE_RESPONSE], kept)],
    ] as const) {
      // 2 cards: the boost card, and the one card left in the deck when it is looked at.
      const table = start([ZERO, THREE], { rest: 0, inPlay, away });
      const [boost, top] = table.top as [InstanceId, InstanceId];
      const { state, events } = run(
        table.state,
        use(table, ATTACK),
        pick,
        deps,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      );
      expect(boostOn(state, villainOf(state))).toEqual([top]);
      expect(deckOf(state)).toEqual([boost]);
      expect(events.some((e) => e.type === "deckShuffled")).toBe(false);
      expect(state.mainScheme.accelerationTokens).toBe(0);
    }
  });
});

describe("§3.44: opened only when an ability listens", () => {
  it("no listener in the registry: the same log and the same game as a listening registry nobody answers in", () => {
    const silent = start([ONE, THREE], { using: silentDeps });
    const quiet = run(silent.state, use(silent, ASSAULT), defaultPick, silentDeps);
    expect(heard(quiet.events)).toEqual([]);
    expect(beats(quiet.events)).toEqual(["dealt", "dealt", "flipped", "flipped"]);
    expect(quiet.state.pendingBoostGiven).toBeUndefined();
    const loud = start([ONE, THREE]);
    const listening = run(loud.state, use(loud, ASSAULT));
    expect(heard(listening.events)).toEqual([]);
    expect(listening.events.filter((e) => e.type !== "framePushed" && e.type !== "framePopped")).toEqual(
      quiet.events.filter((e) => e.type !== "framePushed" && e.type !== "framePopped"),
    );
    expect(listening.state).toEqual(quiet.state);
  });
});

function zoneOf(state: GameState, id: InstanceId): string | undefined {
  return locateCard(state, id)?.kind;
}
