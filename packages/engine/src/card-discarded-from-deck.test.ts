/**
 * docs/phase7-wave7.md §3.55: `TriggerEvent cardDiscardedFromDeck`, a card discarded from the top of a player's deck as
 * an event the discarded card answers from where the discard left it (`AbilityDefinition.activeIn: "discard"`) and a
 * card in play hears. Synthetic cards only:
 *
 * - `back` / `hand` / `fox`: "Response: After this card is discarded from the top of your deck, shuffle it back into
 *   your deck" / "add it to your hand" / "put it into play under your control";
 * - `lady`: "Response: After you discard a card from the top of your deck, attach that card facedown here (to a maximum
 *   of 3)";
 * - `tally`: a forced "after you discard a card from the top of your deck" that counts what it hears;
 * - `batch`: a forced "after you discard cards from the top of your deck, … for each [justice] card discarded", which
 *   answers the whole discard once (`EventPattern.together`).
 *
 * Sources: RRG 1.8 "In Play and Out of Play" (p. 23), "Ownership and Control" (p. 31: "A player controls the cards in
 * their own out-of-play areas"), "Player Deck" (p. 33), "Triggering Condition" (p. 45); MC40 p. 21 FAQ ("Player decks
 * reset as soon as they are empty, so Domino's deck is reset with Jackpot shuffled into it"); ruling, April 30, 2026 -
 * Ruling 4, answer 1 ("if you do, it does not count for the mission attempt"); owner decisions §4.1 Q31 = A (any
 * effect or cost that discards from that deck), Q32 = B (a card a response took away is not counted by the ability
 * that discarded it), Q33 = A (on the deck's last card the response resolves where the reset put the card).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { TOGETHER_TARGETS_SLOT } from "./select.js";
import type { CardSelector, EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, type StubAbility, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubResource, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1 } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const def = (definition: AbilityDefinition) => definition;
const constant = (value: number) => ({ kind: "const", value }) as const;
const selfDiscarded = (extra: Partial<EventPattern> = {}): EventPattern => ({
  on: "cardDiscardedFromDeck",
  selfIs: "target",
  ...extra,
});
const youDiscard: EventPattern = { on: "cardDiscardedFromDeck", playerIs: "controller" };
const fromDiscard = (id: string, on: EventPattern, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(id, def({ trigger: { kind: "response", forced: false, on }, effects, activeIn: "discard" }));

// "… shuffle it back into your deck." Not when the deck's reset has just done that (MC40 p. 21).
const BACK_RESPONSE = fromDiscard("back.response", selfDiscarded({ eventIs: { at: "discard" } }), [
  { kind: "moveCards", cards: { kind: "ref", ref: self }, to: "deckShuffle" },
]);
const HAND_RESPONSE = fromDiscard("hand.response", selfDiscarded(), [
  { kind: "moveCards", cards: { kind: "ref", ref: self }, to: "hand" },
]);
const FOX_RESPONSE = fromDiscard("fox.response", selfDiscarded(), [
  { kind: "putIntoPlay", card: self, controller: you },
]);
const underThree = {
  kind: "compare",
  left: { kind: "refCount", of: { kind: "attachmentsOf", of: self } },
  op: "atMost",
  right: constant(2),
} as const;
const LADY_RESPONSE = stubAbility(
  "lady.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard, while: underThree },
    effects: [
      {
        kind: "if",
        condition: underThree,
        then: [{ kind: "attach", card: { kind: "eventTarget" }, to: self, facedown: true }],
      },
    ],
  }),
);
const TALLY_RESPONSE = stubAbility(
  "tally.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: youDiscard },
    effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: constant(1) }],
  }),
);
// One answer for every [justice] card of the discard: 1 "answers" counter, and 1 "cards" counter for each of them.
const BATCH_RESPONSE = stubAbility(
  "batch.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { ...youDiscard, targetIs: { aspect: "justice" }, together: true } },
    effects: [
      { kind: "addCounters", target: self, counterType: "answers", amount: constant(1) },
      {
        kind: "addCounters",
        target: self,
        counterType: "cards",
        amount: { kind: "refCount", of: { kind: "slot", slot: TOGETHER_TARGETS_SLOT } },
      },
    ],
  }),
);

const FILLER = stubEvent({ id: "filler", cost: 0 });
const MATCH = stubEvent({ id: "match", cost: 0, aspect: "justice" });
const BACK = stubResource({ id: "back", icons: 1, abilities: [BACK_RESPONSE.ref] });
const HAND = stubResource({ id: "hand", icons: 1, abilities: [HAND_RESPONSE.ref] });
const FOX = stubAlly({ id: "fox", cost: 2, atk: 1, thw: 1, hp: 2, abilities: [FOX_RESPONSE.ref] });
const LADY = stubSupport({ id: "lady", cost: 0, abilities: [LADY_RESPONSE.ref] });
const TALLY = stubSupport({ id: "tally", cost: 0, abilities: [TALLY_RESPONSE.ref] });
const BATCH = stubSupport({ id: "batch", cost: 0, abilities: [BATCH_RESPONSE.ref] });
const METER = stubSupport({ id: "meter", cost: 0 });
const GUARD = stubAlly({ id: "guard", cost: 0, atk: 1, thw: 1, hp: 2 });

const meter: TargetRef = { kind: "named", name: METER.name };
const slot = (name: string): CardSelector => ({ kind: "ref", ref: { kind: "slot", slot: name } });
const topOfDeck = (n: number): CardSelector => ({ kind: "zone", zone: "deck", player: you, top: constant(n) });
const measure = (counterType: string, name: string): EffectSpec => ({
  kind: "addCounters",
  target: meter,
  counterType,
  amount: { kind: "var", name },
});
/** Reads the bound set after the responses: its count and wild icons onto `meter`, its cards to the set-aside area. */
const readSet = (name: string): readonly EffectSpec[] => [
  measure("count", `${name}.count`),
  measure("wild", `${name}.wild`),
  { kind: "moveCards", cards: slot(name), to: "setAside" },
];
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const mill = (n: number) =>
  event(`mill-${n}`, [{ kind: "moveCards", cards: topOfDeck(n), to: "discard", bind: "milled" }, ...readSet("milled")]);
const MILL_1 = mill(1);
const MILL_3 = mill(3);
const MILL_5 = mill(5);
// "Discard cards from the top of your deck until you discard a [justice] card."
const UNTIL = event("until", [
  { kind: "discardDeckUntil", player: you, filter: { aspect: "justice" }, bind: "found" },
  measure("count", "found.count"),
]);
// Discards that are not from a player's deck: from the hand, from play, from the encounter deck.
const ELSEWHERE = event("elsewhere", [
  { kind: "moveCards", cards: { kind: "zone", zone: "hand", player: you, filter: { name: HAND.name } }, to: "discard" },
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "named", name: GUARD.name } }, to: "discard" },
  { kind: "discardEncounterCards", count: constant(2) },
]);
const EVENTS = [MILL_1, MILL_3, MILL_5, UNTIL, ELSEWHERE];
// "Action: Discard the top 2 cards of your deck → …", the discarded cards bound for its effects.
const COSTLY_ACTION = stubAbility(
  "costly.action",
  def({
    trigger: { kind: "action" },
    cost: { discardFromDeck: 2, discardFromDeckSlot: "paid" },
    effects: [
      {
        kind: "addCounters",
        target: meter,
        counterType: "count",
        amount: { kind: "refCount", of: { kind: "slot", slot: "paid" } },
      },
      { kind: "moveCards", cards: slot("paid"), to: "setAside" },
    ],
  }),
);
const COSTLY = stubUpgrade({ id: "costly", cost: 0, abilities: [COSTLY_ACTION.ref] });
// An encounter card: "When Revealed: Discard the top 5 cards of your deck."
const DRAIN_REVEALED = stubAbility(
  "drain.when-revealed",
  def({ trigger: { kind: "whenRevealed" }, effects: [{ kind: "moveCards", cards: topOfDeck(5), to: "discard" }] }),
);
const DRAIN = stubTreachery({ id: "drain", boostIcons: 0, abilities: [DRAIN_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const ACTIONS = [...EVENTS.map((e) => e.ability), COSTLY_ACTION, DRAIN_REVEALED];
const deps: EngineDeps = depsOf(
  BACK_RESPONSE,
  HAND_RESPONSE,
  FOX_RESPONSE,
  LADY_RESPONSE,
  TALLY_RESPONSE,
  BATCH_RESPONSE,
  ...ACTIONS,
);
/** The same cards with no ability that hears a deck discard. */
const silentDeps: EngineDeps = depsOf(...ACTIONS);

type Name = "filler" | "match" | "back" | "hand" | "fox";
type InPlay = "lady" | "tally" | "batch" | "costly" | "guard";
interface Table {
  readonly state: GameState;
  /** The deck's top cards, in order. */
  readonly top: readonly InstanceId[];
  readonly inPlay: Readonly<Record<string, InstanceId>>;
}

/**
 * p1 in hero form with `inPlay` (and the meter) in play; the deck is `top` (in order) then `rest` fillers, the discard
 * pile `discard` fillers; every other card p1 owns is in hand (surgery before the session starts).
 */
function start(
  top: readonly Name[],
  options: {
    readonly rest?: number;
    readonly discard?: number;
    readonly inPlay?: readonly InPlay[];
    readonly using?: EngineDeps;
  } = {},
): Table {
  const base = gameAtFirstTurn({
    deps: options.using ?? deps,
    cards: [
      FILLER,
      MATCH,
      BACK,
      HAND,
      FOX,
      LADY,
      TALLY,
      BATCH,
      METER,
      GUARD,
      COSTLY,
      DRAIN,
      BLANK,
      ...EVENTS.map((e) => e.card),
    ],
    encounter: [DRAIN.id, ...copiesOf(BLANK.id, 30)],
    deck: [
      ...copiesOf(FILLER.id, 12),
      ...copiesOf(MATCH.id, 2),
      ...copiesOf(BACK.id, 2),
      ...copiesOf(HAND.id, 3),
      ...copiesOf(FOX.id, 2),
      LADY.id,
      TALLY.id,
      BATCH.id,
      METER.id,
      GUARD.id,
      COSTLY.id,
      ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    ],
  });
  const seat = mustPlayer(base, P1);
  const pool = [...seat.hand, ...seat.deck, ...seat.discard];
  const taken = new Set<InstanceId>();
  const take = (cardId: string): InstanceId => {
    const id = pool.find((candidate) => !taken.has(candidate) && base.instances[candidate]?.cardId === cardId);
    if (!id) throw new Error(`no ${cardId} copy left`);
    taken.add(id);
    return id;
  };
  const topIds = top.map(take);
  const restIds = Array.from({ length: options.rest ?? 6 }, () => take(FILLER.id));
  const discardIds = Array.from({ length: options.discard ?? 0 }, () => take(FILLER.id));
  const inPlay: Record<string, InstanceId> = {};
  for (const name of ["meter", ...(options.inPlay ?? [])]) inPlay[name] = take(name);
  const played = Object.values(inPlay);
  const instances = { ...base.instances };
  for (const id of played) instances[id] = { ...mustInstance(base, id), controllerId: P1, faceup: true };
  const villain = base.villains[0]!.instanceId;
  // A stunned villain's attack is cancelled before a boost card is dealt, so the encounter deck's top card is the one
  // dealt to p1.
  instances[villain] = { ...instances[villain]!, statuses: { ...instances[villain]!.statuses, stunned: 1 } };
  const state: GameState = {
    ...base,
    instances,
    players: base.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: pool.filter((id) => !taken.has(id)),
            deck: [...topIds, ...restIds],
            discard: discardIds,
            playArea: [...p.playArea, ...played],
            identity: { ...p.identity, form: "hero" as const },
          }
        : p,
    ),
  };
  return { state, top: topIds, inPlay };
}

type Pick = (state: GameState) => readonly string[];
/** Triggers the optional responses of these abilities, in this order, whenever they are offered; else the default. */
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

function run(table: Table, pick: Pick, command: Command, using: EngineDeps = deps) {
  return runCommandsPicking(table.state, using, pick, command);
}
function play(table: Table, card: { readonly card: { readonly id: string } }, pick: Pick = defaultPick, using = deps) {
  const id = mustPlayer(table.state, P1).hand.find((held) => table.state.instances[held]?.cardId === card.card.id);
  if (!id) throw new Error(`no ${card.card.id} in hand`);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  };
  return { ...run(table, pick, command, using), played: id };
}
function expectReplays(result: ReturnType<typeof run>, using: EngineDeps = deps): void {
  const replayed = replay(result.session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

const heardDiscards = (events: readonly GameEvent[]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardDiscardedFromDeck" ? [e.event] : [],
  );
const logged = (events: readonly GameEvent[]) => events.flatMap((e) => (e.type === "cardDiscardedFromDeck" ? [e] : []));
const notCounted = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "deckDiscardNotCounted" ? [e.instanceId] : []));
/** The response windows opened for deck discards, each as its candidates' ability ids. */
const windows = (events: readonly GameEvent[]): readonly (readonly string[])[] =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.timing === "response" && e.event.kind === "cardDiscardedFromDeck"
      ? [e.candidates.map((c) => `${c.abilityId}`)]
      : [],
  );
const resolved = (events: readonly GameEvent[], ability: StubAbility): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "abilityResolved" && e.abilityId === ability.ref.id ? [e.instanceId] : []));
const shuffles = (events: readonly GameEvent[]): number =>
  events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "deck").length;
const seat = (state: GameState) => mustPlayer(state, P1);
const counters = (state: GameState, id: InstanceId | undefined, type: string): number =>
  (id ? mustInstance(state, id).counters[type] : undefined) ?? 0;
const discarded = (id: InstanceId | undefined, by: InstanceId, at: "discard" | "deck" = "discard"): TriggerEvent => ({
  kind: "cardDiscardedFromDeck",
  instanceId: id!,
  playerId: P1,
  deck: "player",
  fromTop: true,
  sourceInstanceId: by,
  at,
});

describe("`EventPattern.together`: 'after you discard cards' answers the whole discard once", () => {
  it("two matching cards of one discard: one candidate, one resolution, both cards in its slot", () => {
    const table = start(["match", "filler", "match"], { inPlay: ["batch", "tally"] });
    const result = play(table, MILL_3);
    // The per-card ability is a candidate for each of the three; the batch one once, for its two [justice] cards.
    const [candidates] = windows(result.events);
    expect(candidates?.filter((id) => id === BATCH_RESPONSE.ref.id)).toHaveLength(1);
    expect(candidates?.filter((id) => id === TALLY_RESPONSE.ref.id)).toHaveLength(3);
    expect(resolved(result.events, BATCH_RESPONSE)).toHaveLength(1);
    expect(counters(result.state, table.inPlay.batch, "answers")).toBe(1);
    expect(counters(result.state, table.inPlay.batch, "cards")).toBe(2);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(3);
    expectReplays(result);
  });

  it("one matching card is a batch of one, and none is no answer", () => {
    const one = start(["filler", "match", "filler"], { inPlay: ["batch"] });
    const single = play(one, MILL_3);
    expect(counters(single.state, one.inPlay.batch, "answers")).toBe(1);
    expect(counters(single.state, one.inPlay.batch, "cards")).toBe(1);
    const none = start(["filler", "filler", "filler"], { inPlay: ["batch"] });
    const silent = play(none, MILL_3);
    expect(resolved(silent.events, BATCH_RESPONSE)).toEqual([]);
    expect(counters(silent.state, none.inPlay.batch, "answers")).toBe(0);
  });
});

describe("§3.55 every discard from a player's deck is announced once per card (§4.1 Q31)", () => {
  it("a player card's effect: one event per card in discard order, in one shared window, and a log line each", () => {
    const table = start(["filler", "match", "filler"], { inPlay: ["tally"] });
    const result = play(table, MILL_3);
    const [first, second, third] = table.top;
    expect(heardDiscards(result.events)).toEqual([
      discarded(first, result.played),
      discarded(second, result.played),
      discarded(third, result.played),
    ]);
    expect(logged(result.events)).toEqual(
      table.top.map((instanceId) => ({
        type: "cardDiscardedFromDeck",
        playerId: P1,
        instanceId,
        by: result.played,
        at: "discard",
      })),
    );
    // One window for the three conditions of the one effect (RRG 1.8 "Triggering Condition", p. 45).
    expect(windows(result.events)).toEqual([Array.from({ length: 3 }, () => TALLY_RESPONSE.ref.id)]);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(3);
    // Nothing answered them by moving a card: all three are still the cards "discarded this way".
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(3);
    expect(seat(result.state).setAside).toEqual(expect.arrayContaining([...table.top]));
    expect(notCounted(result.events)).toEqual([]);
    expectReplays(result);
  });

  it("a 'discard the top 2 cards of your deck →' cost: one event per card, discarded by the card whose cost it is", () => {
    const table = start(["filler", "filler", "filler"], { inPlay: ["tally", "costly"] });
    const costly = table.inPlay.costly!;
    const result = run(table, defaultPick, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: costly,
      abilityId: COSTLY_ACTION.ref.id,
      payment: [],
    });
    expect(heardDiscards(result.events)).toEqual([discarded(table.top[0], costly), discarded(table.top[1], costly)]);
    expect(windows(result.events)).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(2);
    expect(seat(result.state).deck[0]).toBe(table.top[2]);
    expectReplays(result);
  });

  it("an encounter card's 'discard the top 5 cards of your deck': five events, whoever's card it is", () => {
    const table = start(["filler", "filler", "filler", "filler", "filler"], { inPlay: ["tally"] });
    const state = onTopOfEncounterDeck(table.state, DRAIN.id);
    const drain = state.encounterDecks[state.encounterDeckOrder[0]!]!.deck[0]!;
    const result = run({ ...table, state }, defaultPick, { type: "endTurn", playerId: P1 });
    expect(heardDiscards(result.events)).toEqual(table.top.map((id) => discarded(id, drain)));
    expect(windows(result.events)).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(5);
    expectReplays(result);
  });

  it("a 'discard until' loop: each card passed over and the match, and no card after it", () => {
    const table = start(["filler", "filler", "match", "filler"], { inPlay: ["tally"] });
    const result = play(table, UNTIL);
    expect(heardDiscards(result.events)).toEqual(table.top.slice(0, 3).map((id) => discarded(id, result.played)));
    expect(windows(result.events)).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(3);
    expect(seat(result.state).deck[0]).toBe(table.top[3]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
    expectReplays(result);
  });

  it("a discard from the hand, from play or from the encounter deck is not one, and the card's response stays off", () => {
    const table = start(["filler"], { inPlay: ["tally", "lady", "guard"] });
    const held = seat(table.state).hand.filter((id) => table.state.instances[id]?.cardId === HAND.id);
    expect(held.length).toBeGreaterThan(0);
    const result = play(table, ELSEWHERE, triggering(HAND_RESPONSE, LADY_RESPONSE));
    expect(heardDiscards(result.events)).toEqual([]);
    expect(logged(result.events)).toEqual([]);
    expect(windows(result.events)).toEqual([]);
    expect(seat(result.state).discard).toEqual(expect.arrayContaining([...held, table.inPlay.guard!]));
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(0);
    expect(mustInstance(result.state, table.inPlay.lady!).attachments).toEqual([]);
    expectReplays(result);
  });
});

describe("§3.55 the discarded card answers from the discard pile (activeIn: discard)", () => {
  it("is optional and offered to the card's owner; declined, the card stays in the discard pile", () => {
    const table = start(["hand"]);
    let asked: string | undefined;
    const result = play(table, MILL_1, (state) => {
      if (state.pendingChoice?.prompt.kind === "chooseTriggers") asked = state.pendingChoice.playerId;
      return defaultPick(state);
    });
    expect(asked).toBe(P1);
    expect(windows(result.events)).toEqual([[HAND_RESPONSE.ref.id]]);
    expect(resolved(result.events, HAND_RESPONSE)).toEqual([]);
    // Left where it was, it is still one of the cards discarded this way.
    expect(seat(result.state).setAside).toEqual([table.top[0]]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
  });

  it("'shuffle it back into your deck' takes it from the discard pile into a shuffled deck", () => {
    const table = start(["back", "filler"]);
    const result = play(table, MILL_1, triggering(BACK_RESPONSE));
    expect(resolved(result.events, BACK_RESPONSE)).toEqual([table.top[0]]);
    expect(seat(result.state).deck).toContain(table.top[0]);
    expect(seat(result.state).deck).toHaveLength(8);
    expect(seat(result.state).discard).not.toContain(table.top[0]);
    expect(shuffles(result.events)).toBe(1);
    expectReplays(result);
  });

  it("'add it to your hand' takes it from the discard pile", () => {
    const table = start(["hand", "filler"]);
    const result = play(table, MILL_1, triggering(HAND_RESPONSE));
    expect(seat(result.state).hand).toContain(table.top[0]);
    expect(seat(result.state).discard).not.toContain(table.top[0]);
    expectReplays(result);
  });

  it("'put it into play under your control' takes it from the discard pile", () => {
    const table = start(["fox", "filler"]);
    const result = play(table, MILL_1, triggering(FOX_RESPONSE));
    const fox = table.top[0]!;
    expect(seat(result.state).playArea).toContain(fox);
    expect(mustInstance(result.state, fox)).toMatchObject({ controllerId: P1, faceup: true });
    expect(seat(result.state).discard).not.toContain(fox);
    expectReplays(result);
  });

  it("two such cards discarded by one effect are offered together, and each answers its own discard", () => {
    const table = start(["hand", "filler", "hand"]);
    const result = play(table, MILL_3, triggering(HAND_RESPONSE));
    expect(windows(result.events)).toEqual([[HAND_RESPONSE.ref.id, HAND_RESPONSE.ref.id]]);
    expect(resolved(result.events, HAND_RESPONSE)).toEqual([table.top[0], table.top[2]]);
    expect(seat(result.state).hand).toEqual(expect.arrayContaining([table.top[0], table.top[2]]));
    expectReplays(result);
  });
});

describe("§3.55 'attach that card facedown here (to a maximum of 3)'", () => {
  const attached = (state: GameState, table: Table) => mustInstance(state, table.inPlay.lady!).attachments;

  it("attaches each card discarded from your deck facedown, out of the discard pile", () => {
    const table = start(["filler", "match", "filler"], { inPlay: ["lady"] });
    const result = play(table, MILL_3, triggering(LADY_RESPONSE));
    expect([...attached(result.state, table)].sort()).toEqual([...table.top].sort());
    for (const id of table.top) expect(mustInstance(result.state, id).faceup).toBe(false);
    expect(seat(result.state).discard.filter((id) => table.top.includes(id))).toEqual([]);
    expectReplays(result);
  });

  it("stops at 3: a fourth and fifth card of the same effect stay in the discard pile", () => {
    const table = start(["filler", "filler", "filler", "filler", "filler"], { inPlay: ["lady"] });
    const result = play(table, MILL_5, triggering(LADY_RESPONSE));
    expect(attached(result.state, table)).toHaveLength(3);
    expect(seat(result.state).setAside).toHaveLength(2);
    expectReplays(result);
  });

  it("holding 3, it is not offered a later discard", () => {
    const table = start(["filler", "filler", "filler", "filler"], { inPlay: ["lady"] });
    const first = play(table, MILL_3, triggering(LADY_RESPONSE));
    const second = play({ ...table, state: first.state }, MILL_1, triggering(LADY_RESPONSE));
    expect(windows(second.events)).toEqual([]);
    expect(attached(second.state, table)).toHaveLength(3);
  });

  it("the card's own response first leaves it nothing to act on, and the other way round", () => {
    const table = start(["hand", "filler"], { inPlay: ["lady"] });
    const hand = table.top[0]!;
    const own = play(table, MILL_1, triggering(HAND_RESPONSE, LADY_RESPONSE));
    expect(seat(own.state).hand).toContain(hand);
    expect(resolved(own.events, LADY_RESPONSE)).toEqual([]);
    expect(attached(own.state, table)).toEqual([]);
    const lady = play(table, MILL_1, triggering(LADY_RESPONSE, HAND_RESPONSE));
    expect(attached(lady.state, table)).toEqual([hand]);
    expect(resolved(lady.events, HAND_RESPONSE)).toEqual([]);
    expect(seat(lady.state).hand).not.toContain(hand);
    expectReplays(own);
    expectReplays(lady);
  });
});

describe("§4.1 Q32 = B: a card a response took away is not counted by the ability that discarded it", () => {
  it("an effect's bound set drops the cards taken to hand and shuffled back, before its next effect reads it", () => {
    const table = start(["hand", "filler", "back"]);
    const [hand, filler, back] = table.top;
    const result = play(table, MILL_3, triggering(HAND_RESPONSE, BACK_RESPONSE));
    expect(seat(result.state).setAside).toEqual([filler]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
    // `filler` prints no icon; the two resource cards, 1 wild icon each, are no longer counted.
    expect(counters(result.state, table.inPlay.meter, "wild")).toBe(0);
    expect(notCounted(result.events)).toEqual([hand, back]);
    expect(seat(result.state).hand).toContain(hand);
    expect(seat(result.state).deck).toContain(back);
    expectReplays(result);
  });

  it("with no response used, every card discarded is counted, icons included", () => {
    const table = start(["hand", "filler", "back"]);
    const result = play(table, MILL_3);
    expect([...seat(result.state).setAside].sort()).toEqual([...table.top].sort());
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(3);
    expect(counters(result.state, table.inPlay.meter, "wild")).toBe(2);
    expect(notCounted(result.events)).toEqual([]);
  });

  it("a card another card's response took away is not counted either", () => {
    const table = start(["filler", "filler"], { inPlay: ["lady"] });
    const result = play(table, MILL_1, triggering(LADY_RESPONSE));
    expect(seat(result.state).setAside).toEqual([]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(0);
    expect(notCounted(result.events)).toEqual([table.top[0]]);
  });

  it("a cost's slot drops the card before the ability's effects resolve", () => {
    const table = start(["hand", "filler", "filler"], { inPlay: ["costly"] });
    const result = run(table, triggering(HAND_RESPONSE), {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: table.inPlay.costly!,
      abilityId: COSTLY_ACTION.ref.id,
      payment: [],
    });
    expect(seat(result.state).hand).toContain(table.top[0]);
    expect(seat(result.state).setAside).toEqual([table.top[1]]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
    expect(notCounted(result.events)).toEqual([table.top[0]]);
    expectReplays(result);
  });

  it("a 'discard until' match taken away is no longer the card found", () => {
    const found = start(["match", "filler"], { inPlay: ["lady"] });
    const result = play(found, UNTIL, triggering(LADY_RESPONSE));
    expect(mustInstance(result.state, found.inPlay.lady!).attachments).toEqual([found.top[0]]);
    expect(counters(result.state, found.inPlay.meter, "count")).toBe(0);
    expect(notCounted(result.events)).toEqual([found.top[0]]);
  });
});

describe("§4.1 Q33 = A: the deck's last card resets the deck, and the response resolves on it there", () => {
  /** The deck is one card; the discard pile holds 4 fillers, which the reset shuffles into the new deck with it. */
  const lastCard = (name: Name, inPlay: readonly InPlay[] = []) => start([name], { rest: 0, discard: 4, inPlay });

  it("the event says the reset put the card in the new deck, and the player was dealt an encounter card", () => {
    const table = lastCard("filler", ["tally"]);
    const result = play(table, MILL_1);
    expect(heardDiscards(result.events)).toEqual([discarded(table.top[0], result.played, "deck")]);
    expect(logged(result.events)).toMatchObject([{ at: "deck" }]);
    expect(seat(result.state).dealtEncounter).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(1);
    // Unanswered, it is still the card discarded this way, wherever the reset put it (docs/phase7-wave3.md §4 Q18).
    expect(seat(result.state).setAside).toEqual([table.top[0]]);
    expect(notCounted(result.events)).toEqual([]);
    expectReplays(result);
  });

  it("'add it to your hand' takes it from the new deck, with no further shuffle", () => {
    const table = lastCard("hand");
    const result = play(table, MILL_1, triggering(HAND_RESPONSE));
    expect(seat(result.state).hand).toContain(table.top[0]);
    expect(seat(result.state).deck).toHaveLength(4);
    expect(seat(result.state).discard).toEqual([result.played]);
    expect(shuffles(result.events)).toBe(1);
    expect(notCounted(result.events)).toEqual([table.top[0]]);
    expectReplays(result);
  });

  it("'put it into play' takes it from the new deck, with no further shuffle", () => {
    const table = lastCard("fox");
    const result = play(table, MILL_1, triggering(FOX_RESPONSE));
    expect(seat(result.state).playArea).toContain(table.top[0]);
    expect(seat(result.state).deck).toHaveLength(4);
    expect(shuffles(result.events)).toBe(1);
    expectReplays(result);
  });

  it("'shuffle it back into your deck' is not offered: the reset has already done it (MC40 p. 21)", () => {
    const table = lastCard("back");
    const result = play(table, MILL_1, triggering(BACK_RESPONSE));
    expect(windows(result.events)).toEqual([]);
    expect(resolved(result.events, BACK_RESPONSE)).toEqual([]);
    // The discarding effect then set it aside as the card discarded this way; the reset was the only shuffle.
    expect(seat(result.state).setAside).toEqual([table.top[0]]);
    expect(shuffles(result.events)).toBe(1);
    expectReplays(result);
  });

  it("'attach that card facedown here' takes it from the new deck", () => {
    const table = lastCard("filler", ["lady"]);
    const result = play(table, MILL_1, triggering(LADY_RESPONSE));
    expect(mustInstance(result.state, table.inPlay.lady!).attachments).toEqual([table.top[0]]);
    expect(seat(result.state).deck).toHaveLength(4);
    expect(shuffles(result.events)).toBe(1);
  });
});

describe("§3.55 a game with no ability that hears a deck discard is unchanged", () => {
  it("records, logs and announces nothing; its log has only the moves it always had", () => {
    const table = start(["hand", "filler", "back"], { using: silentDeps });
    const result = play(table, MILL_3, defaultPick, silentDeps);
    expect(heardDiscards(result.events)).toEqual([]);
    expect(logged(result.events)).toEqual([]);
    expect(windows(result.events)).toEqual([]);
    expect(result.events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardDiscardedFromDeck")).toBe(
      false,
    );
    expect(result.state.pendingDeckDiscards).toBeUndefined();
    expect(result.state.deckDiscardWindows).toBeUndefined();
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(3);
    expect(counters(result.state, table.inPlay.meter, "wild")).toBe(2);
    expectReplays(result, silentDeps);
  });

  it("the same play with listeners in the registry differs only by the new log lines when nothing answers", () => {
    const silent = play(start(["filler", "filler", "filler"], { using: silentDeps }), MILL_3, defaultPick, silentDeps);
    const table = start(["filler", "filler", "filler"]);
    const heard = play(table, MILL_3);
    // No card in play or in the discard pile answers a filler: nothing is announced, only logged.
    expect(heardDiscards(heard.events)).toEqual([]);
    expect(heard.events.filter((e) => e.type !== "cardDiscardedFromDeck")).toEqual(silent.events);
    expect(logged(heard.events)).toHaveLength(3);
    expect(heard.state.pendingDeckDiscards).toBeUndefined();
  });
});
