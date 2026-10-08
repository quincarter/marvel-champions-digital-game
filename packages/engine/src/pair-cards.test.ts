/**
 * docs/phase7-wave8.md §3.36: discarded cards paired one each with characters, matched by resource icon
 * (`EffectSpec pairCards`, `ChoicePrompt pairCards`, `RuleSpec pairLimit`, log `cardsPaired`).
 *
 * MC45 p. 6, steps 1 and 2 of a mission attempt: "Discard X cards from the top of their deck, where X is the number
 * of allies at the mission." / "Assign each of the discarded cards to a different ally at the mission." / "If a
 * resource icon on the ally matches a resource icon on the card assigned to it, that ally participates." / "Wild
 * resource icons ([wild]) on cards discarded for the mission attempt may be used to match any resource icon on an
 * ally at the mission" / "Any resource icon … may be used to match an ally with a wild resource icon". RRG 1.8
 * "Player Deck" (p. 33): when the deck runs out mid-discard it resets and "no further cards are discarded from the
 * newly shuffled deck". The engine knows no "mission": the fixture's "attempt" is a script. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { pairOptionId, pairSelectionFault, resourceIconsMatch } from "./resolve/pair-cards.js";
import type { EffectSpec, Predicate, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const THERE = { inScenarioPlayArea: AREA } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const find = (name: string): TargetRef => ({ kind: "find", query: { name } });
const ALLIES_THERE: TargetQuery = { categories: ["ally"], ...THERE };

const ERRAND = stubSideScheme({ id: "errand", startingThreat: 5, boostIcons: 0 });
const schemeThere: Predicate = { kind: "exists", query: { categories: ["sideScheme"], ...THERE } };
const RULES: readonly RuleSpec[] = [
  {
    kind: "playDestination",
    cards: { categories: ["ally"] },
    area: AREA,
    attachments: { categories: ["upgrade"] },
    while: schemeThere,
  },
  { kind: "blankTextBox", target: ALLIES_THERE },
];

/** The three allies of MC45 p. 6's example, by their icons. */
const RANDALL = stubAlly({ id: "randall", cost: 0, atk: 1, thw: 2, hp: 3, resourceIcons: { wild: 1 } });
const X23 = stubAlly({ id: "x23", cost: 0, atk: 3, thw: 1, hp: 3, resourceIcons: { physical: 1 } });
const MARROW = stubAlly({ id: "marrow", cost: 0, atk: 2, thw: 1, hp: 2, resourceIcons: { energy: 1 } });
/** The cards discarded. */
const CROWN = stubEvent({ id: "crown", cost: 0, resourceIcons: { mental: 1 } });
const CLOBBER = stubEvent({ id: "clobber", cost: 0, resourceIcons: { physical: 1 } });
const GEM = stubEvent({ id: "gem", cost: 0, resourceIcons: { wild: 1 } });
/** No resource icon at all. */
const BLANK = stubEvent({ id: "blank", cost: 0, resourceIcons: {} });
/** A card with two types. */
const DUAL = stubEvent({ id: "dual", cost: 0, resourceIcons: { physical: 1, mental: 1 } });

/** "Attached ally is considered to have a [wild] resource icon in addition to its printed one", written for the area. */
const ORDERS_RULE = stubAbility("orders.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "consideredResourceIcon", target: { categories: ["ally"], hostOfSelf: true }, resource: "wild" }],
  },
  reaches: INTO,
  effects: [],
});
const ORDERS = {
  ...stubUpgrade({ id: "orders", cost: 0, abilities: [ORDERS_RULE.ref] }),
  attachesTo: { kind: "ally" as const },
};
/** "Players cannot assign cards with the same resource icon to more than one ally." A minion in the area. */
const WARDEN_RULE = stubAbility("warden.constant", {
  trigger: { kind: "constant", rules: [{ kind: "pairLimit", area: AREA, limit: { distinctBy: "resourceIcon" } }] },
  effects: [],
});
const WARDEN = stubMinion({ id: "warden", atk: 0, sch: 0, hp: 10, boostIcons: 0, abilities: [WARDEN_RULE.ref] });
/** Where the test reads what the pairing bound. */
const METER = stubSupport({ id: "meter", cost: 0 });
const meter: TargetRef = { kind: "named", name: METER.name };

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const OPEN = action(
  "open",
  { kind: "createScenarioPlayArea", name: AREA, closed: true },
  { kind: "putIntoPlay", card: find(ERRAND.name), controller: you, into: INTO },
  { kind: "putIntoPlay", card: find(METER.name), controller: you },
);
const GUARD_AREA = action("guard-area", { kind: "putIntoPlay", card: find(WARDEN.name), controller: you, into: INTO });
/**
 * Steps 1 and 2: "Discard X cards from the top of your deck, where X is the number of allies there. Assign each to a
 * different ally there." Then the test's own read-out: a mark on each matched ally and the two counts on the meter.
 */
const ATTEMPT = action(
  "attempt",
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "deck", player: you, top: { kind: "count", query: ALLIES_THERE } },
    to: "discard",
    bind: "discarded",
  },
  {
    kind: "pairCards",
    cards: { kind: "slot", slot: "discarded" },
    with: ALLIES_THERE,
    chooser: you,
    match: "resourceIcon",
    wild: "either",
    bind: "pairing",
  },
  { kind: "addCounters", target: { kind: "slot", slot: "pairing.matched" }, counterType: "in", amount: n(1) },
  { kind: "addCounters", target: meter, counterType: "pairs", amount: { kind: "var", name: "pairing.pairs" } },
  { kind: "addCounters", target: meter, counterType: "matched", amount: { kind: "var", name: "pairing.count" } },
);
const EVENTS = [OPEN, GUARD_AREA, ATTEMPT];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(ORDERS_RULE, WARDEN_RULE, ...EVENTS.map((e) => e.ability));

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const heroForm = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
});
type Pick = (state: GameState) => readonly string[];
function playCard(state: GameState, card: CardId, opts: { into?: boolean; host?: InstanceId; pick?: Pick } = {}) {
  const given = giveCard(state, P1, card);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: opts.host ?? null,
    ...(opts.into ? { into: INTO } : {}),
  };
  const run = driveSession(startSession(given.state), deps, [command], opts.pick ?? defaultPick);
  return { state: run.session.state, events: run.events, session: run.session, id: given.id };
}

/** The area open with its scheme, the meter in play, and the three allies there. */
function start(): { state: GameState; randall: InstanceId; x23: InstanceId; marrow: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [ERRAND, RANDALL, X23, MARROW, CROWN, CLOBBER, GEM, BLANK, DUAL, ORDERS, WARDEN, METER, NOISE].concat(
      EVENTS.map((e) => e.card),
    ),
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    encounter: [ERRAND.id, WARDEN.id, ...copiesOf(NOISE.id, 14)],
    deck: [
      RANDALL.id,
      X23.id,
      MARROW.id,
      CROWN.id,
      ...copiesOf(CLOBBER.id, 2),
      GEM.id,
      ...copiesOf(BLANK.id, 2),
      DUAL.id,
      ORDERS.id,
      METER.id,
      ...EVENTS.map((e) => e.card.id),
    ],
    scenarioRuleSpecs: RULES,
  });
  const opened = heroForm(playCard(base, OPEN.card.id).state);
  const randall = playCard(opened, RANDALL.id, { into: true });
  const x23 = playCard(randall.state, X23.id, { into: true });
  const marrow = playCard(x23.state, MARROW.id, { into: true });
  return { state: marrow.state, randall: randall.id, x23: x23.id, marrow: marrow.id };
}

/** Puts these cards on top of P1's deck, the first on top, taking each from wherever P1 holds it. */
function stack(state: GameState, ...cards: readonly CardId[]): { state: GameState; ids: readonly InstanceId[] } {
  const seat = mustPlayer(state, P1);
  const pool = [...seat.deck, ...seat.hand, ...seat.discard];
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const id = pool.find((candidate) => state.instances[candidate]?.cardId === card && !ids.includes(candidate));
    if (!id) throw new Error(`no ${card}`);
    ids.push(id);
  }
  const without = (zone: readonly InstanceId[]) => zone.filter((id) => !ids.includes(id));
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? { ...p, deck: [...ids, ...without(p.deck)], hand: without(p.hand), discard: without(p.discard) }
          : p,
      ),
    },
  };
}
/** Answers the pairing with these pairs, and everything else by default. */
const pairing =
  (...pairs: readonly (readonly [InstanceId, InstanceId])[]): Pick =>
  (state) =>
    state.pendingChoice?.prompt.kind === "pairCards"
      ? pairs.map(([card, character]) => pairOptionId(card, character))
      : defaultPick(state);
const marked = (state: GameState, ...ids: readonly InstanceId[]) =>
  ids.filter((id) => (mustInstance(state, id).counters.in ?? 0) > 0);
const meterOf = (state: GameState) => {
  const id = mustPlayer(state, P1).playArea.find((candidate) => state.instances[candidate]?.cardId === METER.id);
  return mustInstance(state, id!).counters;
};

describe("§3.36 the match", () => {
  it("a shared type matches; a [wild] on either side matches any icon; a side with no icon matches nothing", () => {
    expect(resourceIconsMatch(["physical"], ["physical"])).toBe(true);
    expect(resourceIconsMatch(["physical"], ["energy"])).toBe(false);
    expect(resourceIconsMatch(["wild"], ["energy"])).toBe(true);
    expect(resourceIconsMatch(["mental"], ["wild"])).toBe(true);
    expect(resourceIconsMatch(["physical", "mental"], ["mental"])).toBe(true);
    expect(resourceIconsMatch([], ["wild"])).toBe(false);
    expect(resourceIconsMatch(["wild"], [])).toBe(false);
  });
});

describe("§3.36 cards paired one each with characters", () => {
  it("test 1 (MC45 p. 6): Crown [mental] to the [wild] ally, Clobber [physical] to the [physical] ally, Gem [wild] to the [energy] ally: three matched; the cards stay in the discard pile", () => {
    const t = start();
    const top = stack(t.state, CROWN.id, CLOBBER.id, GEM.id);
    const [crown, clobber, gem] = top.ids as [InstanceId, InstanceId, InstanceId];
    const run = playCard(top.state, ATTEMPT.card.id, {
      pick: pairing([crown, t.randall], [clobber, t.x23], [gem, t.marrow]),
    });
    expect(marked(run.state, t.randall, t.x23, t.marrow)).toEqual([t.randall, t.x23, t.marrow]);
    expect(meterOf(run.state)).toMatchObject({ pairs: 3, matched: 3 });
    for (const id of top.ids) expect(mustPlayer(run.state, P1).discard).toContain(id);
    expect(of(run.events, "cardsPaired")).toEqual([
      {
        type: "cardsPaired",
        playerId: P1,
        sourceInstanceId: run.id,
        pairs: [
          { cardInstanceId: crown, characterInstanceId: t.randall, matched: true },
          { cardInstanceId: clobber, characterInstanceId: t.x23, matched: true },
          { cardInstanceId: gem, characterInstanceId: t.marrow, matched: true },
        ],
      },
    ]);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("the choice lays out every pairing: nine options, the six that match listed, each side's icons, from none to three selections", () => {
    const t = start();
    const top = stack(t.state, CROWN.id, CLOBBER.id, GEM.id);
    const [crown, clobber, gem] = top.ids as [InstanceId, InstanceId, InstanceId];
    const given = giveCard(top.state, P1, ATTEMPT.card.id);
    const applied = sessionApply(
      startSession(given.state),
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!applied.ok) throw new Error(applied.error.message);
    const choice = applied.session.state.pendingChoice!;
    expect(choice).toMatchObject({ playerId: P1, minSelections: 0, maxSelections: 3, authority: "player" });
    if (choice.prompt.kind !== "pairCards") throw new Error(choice.prompt.kind);
    expect(choice.prompt.cards).toEqual([crown, clobber, gem]);
    expect(choice.prompt.with).toEqual([t.randall, t.x23, t.marrow]);
    expect(choice.options).toHaveLength(9);
    expect(choice.prompt.icons).toMatchObject({
      [crown]: ["mental"],
      [clobber]: ["physical"],
      [gem]: ["wild"],
      [t.randall]: ["wild"],
      [t.x23]: ["physical"],
      [t.marrow]: ["energy"],
    });
    expect([...choice.prompt.matching].sort()).toEqual(
      [
        pairOptionId(crown, t.randall),
        pairOptionId(clobber, t.randall),
        pairOptionId(clobber, t.x23),
        pairOptionId(gem, t.randall),
        pairOptionId(gem, t.x23),
        pairOptionId(gem, t.marrow),
      ].sort(),
    );
    expect(choice.prompt.limit).toBeUndefined();
    // One card to two characters, or two cards to one character, is refused and the choice stays open.
    const answer = (...optionIds: string[]) =>
      sessionApply(
        applied.session,
        { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: optionIds },
        deps,
      );
    expect(answer(pairOptionId(crown, t.randall), pairOptionId(crown, t.x23)).ok).toBe(false);
    expect(answer(pairOptionId(crown, t.randall), pairOptionId(gem, t.randall)).ok).toBe(false);
    expect(answer(pairOptionId(crown, t.randall)).ok).toBe(true);
  });

  it("test 2: the same cards paired worse, Clobber to the [energy] ally and Gem to the [physical] one: two matched", () => {
    const t = start();
    const top = stack(t.state, CROWN.id, CLOBBER.id, GEM.id);
    const [crown, clobber, gem] = top.ids as [InstanceId, InstanceId, InstanceId];
    const run = playCard(top.state, ATTEMPT.card.id, {
      pick: pairing([clobber, t.marrow], [gem, t.x23], [crown, t.randall]),
    });
    expect(marked(run.state, t.randall, t.x23, t.marrow)).toEqual([t.randall, t.x23]);
    expect(meterOf(run.state)).toMatchObject({ pairs: 3, matched: 2 });
    expect(of(run.events, "cardsPaired")[0]?.pairs.map((p) => p.matched)).toEqual([false, true, true]);
  });

  it("test 3: Clobber, Clobber, Gem with no limit: three matched. With the limit in force the second Clobber cannot be assigned: two at most", () => {
    const t = start();
    const top = stack(t.state, CLOBBER.id, CLOBBER.id, GEM.id);
    const [first, second, gem] = top.ids as [InstanceId, InstanceId, InstanceId];
    const all = pairing([first, t.x23], [second, t.randall], [gem, t.marrow]);
    const free = playCard(top.state, ATTEMPT.card.id, { pick: all });
    expect(meterOf(free.state)).toMatchObject({ pairs: 3, matched: 3 });

    const guarded = stack(playCard(t.state, GUARD_AREA.card.id).state, CLOBBER.id, CLOBBER.id, GEM.id);
    const given = giveCard(guarded.state, P1, ATTEMPT.card.id);
    const applied = sessionApply(
      startSession(given.state),
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!applied.ok) throw new Error(applied.error.message);
    const choice = applied.session.state.pendingChoice!;
    if (choice.prompt.kind !== "pairCards") throw new Error(choice.prompt.kind);
    expect(choice.prompt.limit).toEqual({ distinctBy: "resourceIcon" });
    const [a, b, g] = guarded.ids as [InstanceId, InstanceId, InstanceId];
    const refused = sessionApply(
      applied.session,
      {
        type: "resolveChoice",
        playerId: P1,
        choiceId: choice.choiceId,
        selectedOptionIds: [pairOptionId(a, t.x23), pairOptionId(b, t.randall), pairOptionId(g, t.marrow)],
      },
      deps,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("invalid_choice");
    expect(pairSelectionFault(choice.prompt, [pairOptionId(a, t.x23), pairOptionId(b, t.randall)])).toMatch(
      /same resource icon/,
    );
    const accepted = sessionApply(
      applied.session,
      {
        type: "resolveChoice",
        playerId: P1,
        choiceId: choice.choiceId,
        selectedOptionIds: [pairOptionId(a, t.x23), pairOptionId(g, t.marrow)],
      },
      deps,
    );
    if (!accepted.ok) throw new Error(accepted.error.message);
    const done = driveSession(accepted.session, deps).session.state;
    expect(meterOf(done)).toMatchObject({ pairs: 2, matched: 2 });
    expect(marked(done, t.randall, t.x23, t.marrow)).toEqual([t.x23, t.marrow]);
  });

  it("the limit reads printed types, [wild] a type of its own: a two-type card shares with either of its types, and a [wild] card with neither", () => {
    const prompt = {
      kind: "pairCards",
      cards: ["a", "b", "c", "d"],
      with: ["x", "y", "z"],
      icons: { a: ["physical", "mental"], b: ["mental"], c: ["wild"], d: ["wild"] },
      matching: [],
      limit: { distinctBy: "resourceIcon" },
      sourceInstanceId: null,
    } as unknown as Parameters<typeof pairSelectionFault>[0];
    expect(pairSelectionFault(prompt, ["a>x", "b>y"])).toMatch(/same resource icon/);
    expect(pairSelectionFault(prompt, ["a>x", "c>y"])).toBeNull();
    expect(pairSelectionFault(prompt, ["c>x", "d>y"])).toMatch(/same resource icon/);
    const { limit: _limit, ...unlimited } = prompt;
    expect(pairSelectionFault(unlimited, ["c>x", "d>y"])).toBeNull();
  });

  it("test 4: a deck of 2 cards with three allies: 2 are discarded, the deck resets and no third card is discarded; two pairs at most", () => {
    const t = start();
    const top = stack(t.state, CLOBBER.id, GEM.id);
    const [clobber, gem] = top.ids as [InstanceId, InstanceId];
    const seat = mustPlayer(top.state, P1);
    // Everything else of the deck is already in the discard pile: the deck is those two cards.
    const short: GameState = {
      ...top.state,
      players: top.state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [clobber, gem], discard: [...seat.discard, ...seat.deck.slice(2)] } : p,
      ),
    };
    const given = giveCard(short, P1, ATTEMPT.card.id);
    const applied = sessionApply(
      startSession(given.state),
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!applied.ok) throw new Error(applied.error.message);
    const driven = driveSession(applied.session, deps, [], (state) => {
      const choice = state.pendingChoice!;
      if (choice.prompt.kind !== "pairCards") return defaultPick(state);
      expect(choice.prompt.cards).toEqual([clobber, gem]);
      expect(choice.maxSelections).toBe(2);
      return [pairOptionId(clobber, t.x23), pairOptionId(gem, t.marrow)];
    });
    const events = [...applied.events, ...driven.events];
    expect(of(events, "playerDeckReset")).toHaveLength(1);
    expect(meterOf(driven.session.state)).toMatchObject({ pairs: 2, matched: 2 });
    expect(marked(driven.session.state, t.randall, t.x23, t.marrow)).toEqual([t.x23, t.marrow]);
  });

  it("test 5: with no ally there nothing is discarded and no choice is offered; the pairing is logged empty", () => {
    const base = gameAtFirstTurn({
      cards: [ERRAND, METER, NOISE, ...EVENTS.map((e) => e.card)],
      deps,
      villain: TYRANT,
      mainScheme: SCHEME,
      encounter: [ERRAND.id, ...copiesOf(NOISE.id, 14)],
      deck: [METER.id, ...EVENTS.map((e) => e.card.id)],
      scenarioRuleSpecs: RULES,
    });
    const opened = playCard(base, OPEN.card.id).state;
    const before = mustPlayer(opened, P1);
    const run = playCard(opened, ATTEMPT.card.id);
    expect(of(run.events, "choiceRequested").filter((e) => e.choice.prompt.kind === "pairCards")).toEqual([]);
    expect(of(run.events, "cardsPaired")).toEqual([
      { type: "cardsPaired", playerId: P1, sourceInstanceId: run.id, pairs: [] },
    ]);
    // Only the played event left the hand for the discard pile.
    expect(mustPlayer(run.state, P1).deck).toEqual(before.deck.filter((id) => id !== run.id));
    expect(meterOf(run.state)).toEqual({});
  });

  it("test 6: the [energy] ally with an upgrade that gives it a considered [wild], paired with Crown [mental]: matched. Without it: not", () => {
    const t = start();
    const top = stack(t.state, CROWN.id, BLANK.id, BLANK.id);
    const plain = playCard(top.state, ATTEMPT.card.id, { pick: pairing([top.ids[0]!, t.marrow]) });
    expect(marked(plain.state, t.marrow)).toEqual([]);
    expect(meterOf(plain.state)).toMatchObject({ pairs: 1 });
    expect(meterOf(plain.state).matched ?? 0).toBe(0);

    const upgraded = stack(playCard(t.state, ORDERS.id, { host: t.marrow }).state, CROWN.id, BLANK.id, BLANK.id);
    const run = playCard(upgraded.state, ATTEMPT.card.id, { pick: pairing([upgraded.ids[0]!, t.marrow]) });
    expect(marked(run.state, t.marrow)).toEqual([t.marrow]);
    expect(meterOf(run.state)).toMatchObject({ pairs: 1, matched: 1 });
  });

  it("a card with no resource icon can be assigned and matches nothing, even a [wild] ally; a card may be left unassigned", () => {
    const t = start();
    const top = stack(t.state, BLANK.id, CLOBBER.id, GEM.id);
    const [blank, clobber] = top.ids as [InstanceId, InstanceId, InstanceId];
    const run = playCard(top.state, ATTEMPT.card.id, { pick: pairing([blank, t.randall], [clobber, t.x23]) });
    expect(of(run.events, "cardsPaired")[0]?.pairs).toEqual([
      { cardInstanceId: blank, characterInstanceId: t.randall, matched: false },
      { cardInstanceId: clobber, characterInstanceId: t.x23, matched: true },
    ]);
    expect(meterOf(run.state)).toMatchObject({ pairs: 2, matched: 1 });
    // Nothing assigned at all is a legal answer.
    const none = playCard(top.state, ATTEMPT.card.id, { pick: pairing() });
    expect(of(none.events, "cardsPaired")[0]?.pairs).toEqual([]);
  });

  it("a two-type card matches an ally of either type", () => {
    const t = start();
    const top = stack(t.state, DUAL.id, BLANK.id, BLANK.id);
    const run = playCard(top.state, ATTEMPT.card.id, { pick: pairing([top.ids[0]!, t.x23]) });
    expect(marked(run.state, t.x23)).toEqual([t.x23]);
  });
});
