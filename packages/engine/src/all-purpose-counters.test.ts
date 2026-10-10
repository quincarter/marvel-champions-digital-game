/**
 * docs/phase7-wave9.md §3.6 (a): all-purpose counters take the type of the card they are placed on, and "an all-purpose
 * counter" read or removed is a counter of any type.
 *
 * Sources. RRG 1.8 "All-Purpose Counter" (p. 6): "An ability that refers to an 'all-purpose counter' can refer to any
 * all-purpose counter, regardless of what other types that counter might have." MC50 rulebook p. 4: "When a card
 * effect places one or more 'all-purpose counters' on a card …, or moves them from one card to another …, those
 * counters lose any previously defined type and become the type defined by the new card. If the new card has no
 * defined type for all-purpose counters on it, any counters on it are considered 'all-purpose counters.'" Ruling of
 * Jan 26, 2026 (2): a counter placed on a card "gains the type of counter defined on the card it occupies". RRG 1.8
 * "Uses (X 'type')" (p. 46): "When the last all-purpose counter is removed from a card with uses, discard that card."
 *
 * Synthetic cards shaped like the Agents of S.H.I.E.L.D. ones: The Iliad (uses 3 mission), Support Staff (uses 3
 * staff), Sky-Destroyer (defines no type), Holding Cell (its text defines lock counters, no keyword), Nick Fury ("place
 * 1 all-purpose counter on a S.H.I.E.L.D. support"), Press Conference ("remove 1 all-purpose counter from each
 * S.H.I.E.L.D. support") and an Adaptoid ("remove 1 all-purpose counter from an environment").
 */

import type { SupportCard, Trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { ALL_PURPOSE_COUNTER, countersOfType, definedCounterType, definedCounterTypeOrNull } from "./counter-types.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const SHIELD = "S.H.I.E.L.D." as Trait;
const self: TargetRef = { kind: "self" };
const named = (name: string): TargetRef => ({ kind: "each", query: { categories: ["support"], name } });
const shieldSupports: TargetRef = { kind: "each", query: { categories: ["support"], trait: SHIELD } };
const one = { kind: "const", value: 1 } as const;
const place = (target: TargetRef, amount = 1, counterType = "allPurpose"): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: { kind: "const", value: amount },
});

/** "Action: Remove 1 mission counter from here → deal 1 damage to the villain." */
const ILIAD_ACTION = stubAbility("iliad.action", {
  trigger: { kind: "action" },
  cost: { spendCounters: { counterType: "mission", amount: 1 } },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: one }],
});
const ILIAD = stubSupport({
  id: "iliad",
  cost: 0,
  traits: [SHIELD],
  keywords: [{ name: "uses", count: 3, counterType: "mission" }],
  abilities: [ILIAD_ACTION.ref],
});
const STAFF = stubSupport({
  id: "staff",
  cost: 0,
  traits: [SHIELD],
  keywords: [{ name: "uses", count: 3, counterType: "staff" }],
});
const SKY = stubSupport({ id: "sky", cost: 0, traits: [SHIELD] });
/** "Forced Response: After the last lock counter is removed from here, place 1 `opened` counter on the tracker." */
const CELL_LAST = stubAbility("cell.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersRemoved", selfIs: "target", eventIs: { counterType: "lock" }, eventAtMost: { remaining: 0 } },
  },
  effects: [place(named("tracker"), 1, "opened")],
});
const CELL: SupportCard = {
  ...stubSupport({ id: "cell", cost: 0, abilities: [CELL_LAST.ref] }),
  definedCounterTypes: ["lock"],
};
const TRACKER = stubSupport({ id: "tracker", cost: 0 });

const event = (id: string, effects: readonly EffectSpec[], more: Partial<AbilityDefinition> = {}) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...more });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const removeAny = (target: TargetRef, amount?: number): EffectSpec => ({
  kind: "removeCounters",
  target,
  counterType: "any",
  ...(amount === undefined ? {} : { amount: { kind: "const", value: amount } }),
});
const FURY_ILIAD = event("fury-iliad", [place(named("iliad"))]);
const FURY_SKY = event("fury-sky", [place(named("sky"))]);
const FURY_CELL = event("fury-cell", [place(named("cell"), 2)]);
const FURY_ALL = event("fury-all", [place(shieldSupports)]);
const CAPPED = event("capped", [
  { ...place(named("iliad"), 5), upTo: { kind: "const", value: 4 }, bind: "placed" } as EffectSpec,
]);
const TOON_ILIAD = event("toon-iliad", [place(named("iliad"), 1, "toon")]);
const PRESS = event("press-conference", [removeAny(shieldSupports, 1)]);
const ADAPTOID = event("adaptoid", [removeAny(named("cell"), 1)]);
const TAKE_ONE = event("take-one", [removeAny(named("iliad"), 1)]);
const TAKE_TWO = event("take-two", [
  { ...removeAny(named("iliad"), 2), bind: "took" } as EffectSpec,
  {
    kind: "addCounters",
    target: named("tracker"),
    counterType: "took",
    amount: { kind: "var", name: "took.amount" },
  } as EffectSpec,
]);
const TAKE_ALL = event("take-all", [removeAny(named("iliad"))]);
const TAKE_ALL_CELL = event("take-all-cell", [removeAny(named("cell"))]);
/** Reads: the tracker gets as many `seen` counters as the Iliad holds of any type, and 1 `has` for each card with one. */
const COUNT = event("count", [
  {
    kind: "addCounters",
    target: named("tracker"),
    counterType: "seen",
    amount: { kind: "counters", of: named("iliad"), counterType: "any" },
  },
  {
    kind: "if",
    condition: { kind: "counterAtLeast", of: named("iliad"), counterType: "any", amount: 4 },
    then: [place(named("tracker"), 1, "four-or-more")],
  },
  {
    kind: "addCounters",
    target: named("tracker"),
    counterType: "has",
    amount: { kind: "count", query: { categories: ["support"], trait: SHIELD, hasCounter: "any" } },
  } as EffectSpec,
]);
const EVENTS = [
  FURY_ILIAD,
  FURY_SKY,
  FURY_CELL,
  FURY_ALL,
  CAPPED,
  TOON_ILIAD,
  PRESS,
  ADAPTOID,
  TAKE_ONE,
  TAKE_TWO,
  TAKE_ALL,
  TAKE_ALL_CELL,
  COUNT,
];
const deps: EngineDeps = depsOf(ILIAD_ACTION, CELL_LAST, ...EVENTS.map((e) => e.ability));

interface Board {
  readonly state: GameState;
  readonly iliad: InstanceId;
  readonly staff: InstanceId;
  readonly sky: InstanceId;
  readonly cell: InstanceId;
  readonly tracker: InstanceId;
}

/** The five supports in play, holding `counters` (surgery: a card put into play this way gets no uses counters). */
function board(counters: Partial<Record<"iliad" | "staff" | "sky" | "cell", Record<string, number>>> = {}): Board {
  let state = gameAtFirstTurn({
    deps,
    cards: [ILIAD, STAFF, SKY, CELL, TRACKER, ...EVENTS.map((e) => e.card)],
    deck: [ILIAD.id, STAFF.id, SKY.id, CELL.id, TRACKER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const ids: Record<string, InstanceId> = {};
  for (const card of [ILIAD, STAFF, SKY, CELL, TRACKER]) {
    const put = playerCardIntoPlay(state, card.id);
    ids[card.id] = put.id;
    const held = counters[card.id as "iliad"] ?? {};
    state = {
      ...put.state,
      instances: { ...put.state.instances, [put.id]: { ...mustInstance(put.state, put.id), counters: held } },
    };
  }
  return {
    state,
    iliad: ids["iliad"]!,
    staff: ids["staff"]!,
    sky: ids["sky"]!,
    cell: ids["cell"]!,
    tracker: ids["tracker"]!,
  };
}

const counters = (state: GameState, id: InstanceId): Readonly<Record<string, number>> =>
  Object.fromEntries(Object.entries(mustInstance(state, id).counters).filter(([, amount]) => amount > 0));
const inPlay = (state: GameState, id: InstanceId): boolean => mustPlayer(state, P1).playArea.includes(id);
const discarded = (state: GameState, id: InstanceId): boolean => mustPlayer(state, P1).discard.includes(id);
const heardEvents = (events: readonly GameEvent[], kind: TriggerEvent["kind"]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === kind ? [e.event] : [],
  );
function expectReplays(result: ReturnType<typeof playFree>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

describe("§3.6 definedCounterType", () => {
  it("is the uses keyword's type, else the type the card's text defines, else allPurpose", () => {
    const b = board();
    expect(definedCounterType(b.state, b.iliad, deps)).toBe("mission");
    expect(definedCounterType(b.state, b.staff, deps)).toBe("staff");
    expect(definedCounterType(b.state, b.cell, deps)).toBe("lock");
    expect(definedCounterType(b.state, b.sky, deps)).toBe(ALL_PURPOSE_COUNTER);
    expect(definedCounterTypeOrNull(b.state, b.sky, deps)).toBeNull();
    expect(definedCounterType(b.state, b.state.mainScheme.instanceId, deps)).toBe("allPurpose");
  });
});

describe('§3.6 addCounters counterType "allPurpose" lands as the destination\'s type', () => {
  it("1 counter on a uses card with 3 mission counters makes 4 mission counters, usable four times", () => {
    const b = board({ iliad: { mission: 3 } });
    const placed = playFree(b.state, deps, FURY_ILIAD.card.id);
    expect(counters(placed.state, b.iliad)).toEqual({ mission: 4 });
    expectReplays(placed);

    const use: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: b.iliad,
      abilityId: ILIAD_ACTION.ref.id,
      payment: [],
    };
    let state = placed.state;
    const villainDamage = (s: GameState): number => mustInstance(s, s.villains[0]!.instanceId).damage;
    const before = villainDamage(state);
    for (let used = 1; used <= 4; used++) {
      const result = applyCommand(state, use, deps);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
      expect(villainDamage(state)).toBe(before + used);
      expect(inPlay(state, b.iliad)).toBe(used < 4);
    }
    expect(discarded(state, b.iliad)).toBe(true);
    expect(applyCommand(state, use, deps).ok).toBe(false);
  });

  it("a card that defines no type holds it as an allPurpose counter; a text-defined type is taken without the keyword", () => {
    const b = board();
    const sky = playFree(b.state, deps, FURY_SKY.card.id);
    expect(counters(sky.state, b.sky)).toEqual({ allPurpose: 1 });
    const cell = playFree(sky.state, deps, FURY_CELL.card.id);
    expect(counters(cell.state, b.cell)).toEqual({ lock: 2 });
  });

  it("one effect on several cards gives each its own type", () => {
    const b = board({ iliad: { mission: 3 }, staff: { staff: 1 } });
    const result = playFree(b.state, deps, FURY_ALL.card.id);
    expect(counters(result.state, b.iliad)).toEqual({ mission: 4 });
    expect(counters(result.state, b.staff)).toEqual({ staff: 2 });
    expect(counters(result.state, b.sky)).toEqual({ allPurpose: 1 });
    expect(counters(result.state, b.cell)).toEqual({});
  });

  it("the log and countersPlaced carry the type the counters landed as", () => {
    const b = board({ iliad: { mission: 3 } });
    const withListener = stubAbility("tracker.heard", {
      trigger: { kind: "response", forced: true, on: { on: "countersPlaced", eventIs: { counterType: "mission" } } },
      effects: [{ kind: "addCounters", target: self, counterType: "heard", amount: { kind: "eventAmount" } }],
    });
    const listening: EngineDeps = depsOf(ILIAD_ACTION, CELL_LAST, withListener, ...EVENTS.map((e) => e.ability));
    const state: GameState = {
      ...b.state,
      cardPool: { ...b.state.cardPool, [TRACKER.id]: { ...TRACKER, abilities: [withListener.ref] } },
    };
    const result = playFree(state, listening, FURY_ILIAD.card.id);
    expect(result.events.filter((e) => e.type === "counterAdded" && e.instanceId === b.iliad)).toEqual([
      { type: "counterAdded", instanceId: b.iliad, counterType: "mission", amount: 1 },
    ]);
    expect(heardEvents(result.events, "countersPlaced")).toEqual([
      { kind: "countersPlaced", targetInstanceId: b.iliad, counterType: "mission", amount: 1, playerId: P1 },
    ]);
    expect(counters(result.state, b.tracker)).toEqual({ heard: 1 });
  });

  it('"to a maximum of 4" counts the type the counters land as: 5 offered to a card at 3 places 1', () => {
    const b = board({ iliad: { mission: 3 } });
    const result = playFree(b.state, deps, CAPPED.card.id);
    expect(counters(result.state, b.iliad)).toEqual({ mission: 4 });
  });

  it("a counter placed by name keeps its name (older cards are unchanged)", () => {
    const b = board({ iliad: { mission: 3 } });
    const result = playFree(b.state, deps, TOON_ILIAD.card.id);
    expect(counters(result.state, b.iliad)).toEqual({ mission: 3, toon: 1 });
  });
});

describe('§3.6 counterType "any" on removal', () => {
  it("1 from each S.H.I.E.L.D. support: Support Staff at 1 is discarded, The Iliad goes 3 to 2, Sky-Destroyer at 0 is untouched", () => {
    const b = board({ iliad: { mission: 3 }, staff: { staff: 1 }, cell: { lock: 4 } });
    const result = playFree(b.state, deps, PRESS.card.id);
    expect(discarded(result.state, b.staff)).toBe(true);
    expect(inPlay(result.state, b.staff)).toBe(false);
    expect(counters(result.state, b.iliad)).toEqual({ mission: 2 });
    expect(inPlay(result.state, b.iliad)).toBe(true);
    expect(counters(result.state, b.sky)).toEqual({});
    expect(inPlay(result.state, b.sky)).toBe(true);
    // Holding Cell is not a S.H.I.E.L.D. support: nothing else changes.
    expect(counters(result.state, b.cell)).toEqual({ lock: 4 });
    expect(result.events.filter((e) => e.type === "counterRemoved")).toEqual([
      { type: "counterRemoved", instanceId: b.iliad, counterType: "mission", amount: 1 },
      { type: "counterRemoved", instanceId: b.staff, counterType: "staff", amount: 1 },
    ]);
    expectReplays(result);
  });

  it("an Adaptoid's removal takes a Holding Cell from 4 lock counters to 3", () => {
    const b = board({ cell: { lock: 4 } });
    const result = playFree(b.state, deps, ADAPTOID.card.id);
    expect(counters(result.state, b.cell)).toEqual({ lock: 3 });
    expect(counters(result.state, b.tracker)).toEqual({});
  });

  it('removes by stored name, so "after the last lock counter is removed" hears it', () => {
    const b = board({ cell: { lock: 1 } });
    const result = playFree(b.state, deps, ADAPTOID.card.id);
    expect(counters(result.state, b.cell)).toEqual({});
    expect(counters(result.state, b.tracker)).toEqual({ opened: 1 });
    expect(heardEvents(result.events, "countersRemoved")).toMatchObject([
      { kind: "countersRemoved", instanceId: b.cell, counterType: "lock", amount: 1, remaining: 0 },
    ]);
  });

  it("a card with no counters loses nothing and stays", () => {
    const b = board();
    const result = playFree(b.state, deps, ADAPTOID.card.id);
    expect(counters(result.state, b.cell)).toEqual({});
    expect(result.events.some((e) => e.type === "counterRemoved")).toBe(false);
  });

  it("acceleration tokens are not all-purpose counters: none is taken, and none is counted", () => {
    const b = board({ cell: { acceleration: 2, lock: 1 } });
    expect(countersOfType(b.state, b.cell, "any")).toBe(1);
    const result = playFree(b.state, deps, TAKE_ALL_CELL.card.id);
    expect(counters(result.state, b.cell)).toEqual({ acceleration: 2 });
  });

  it("one type on the card, or every counter taken, asks nothing", () => {
    const single = board({ iliad: { mission: 3 } });
    const asked: string[] = [];
    const pick = (state: GameState) => {
      if (state.pendingChoice) asked.push(state.pendingChoice.prompt.kind);
      return defaultPick(state);
    };
    const given = playerHolding(single.state, TAKE_ONE.card.id);
    const first = runCommandsPicking(given.state, deps, pick, given.play);
    expect(counters(first.state, single.iliad)).toEqual({ mission: 2 });
    const mixed = board({ iliad: { mission: 2, toon: 1 } });
    const all = playerHolding(mixed.state, TAKE_ALL.card.id);
    const second = runCommandsPicking(all.state, deps, pick, all.play);
    expect(discarded(second.state, mixed.iliad)).toBe(true);
    expect(asked).not.toContain("chooseCounters");
  });

  it("two types on the card and fewer taken than it holds: the player picks which, one option per counter", () => {
    const b = board({ iliad: { mission: 2, toon: 1 } });
    const prompts: unknown[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "chooseCounters") return defaultPick(state);
      prompts.push({
        prompt: choice.prompt,
        options: choice.options.map((o) => o.optionId),
        min: choice.minSelections,
        max: choice.maxSelections,
        playerId: choice.playerId,
      });
      return ["toon#1"];
    };
    const given = playerHolding(b.state, TAKE_ONE.card.id);
    const result = runCommandsPicking(given.state, deps, pick, given.play);
    expect(prompts).toEqual([
      {
        prompt: {
          kind: "chooseCounters",
          instanceId: b.iliad,
          amount: 1,
          reason: "remove",
          byType: { mission: 2, toon: 1 },
        },
        options: ["mission#1", "toon#1"],
        min: 1,
        max: 1,
        playerId: P1,
      },
    ]);
    expect(counters(result.state, b.iliad)).toEqual({ mission: 2 });
    expect(inPlay(result.state, b.iliad)).toBe(true);
    const replayed = replay(result.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(result.state);
  });

  it("2 of 3 picked across types: 1 mission and 1 toon go, the last mission counter's removal discards the uses card", () => {
    const b = board({ iliad: { mission: 1, toon: 2 } });
    const pick = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "chooseCounters" ? ["mission#1", "toon#2"] : defaultPick(state);
    const given = playerHolding(b.state, TAKE_TWO.card.id);
    const result = runCommandsPicking(given.state, deps, pick, given.play);
    expect(discarded(result.state, b.iliad)).toBe(true);
    // `bind`: 2 removed in all. The uses type goes last, so the toon counter is off before the card is discarded.
    expect(counters(result.state, b.tracker)).toEqual({ took: 2 });
  });
});

describe('§3.6 counterType "any" on values and queries', () => {
  it("counts every type on the card: 3 mission and 1 toon are 4, and two S.H.I.E.L.D. supports hold a counter", () => {
    const b = board({ iliad: { mission: 3, toon: 1 }, staff: { staff: 2 }, cell: { lock: 4 } });
    const result = playFree(b.state, deps, COUNT.card.id);
    expect(counters(result.state, b.tracker)).toEqual({ seen: 4, "four-or-more": 1, has: 2 });
  });

  it("3 counters are not at least 4, and a card with none has no counter", () => {
    const b = board({ iliad: { mission: 3 } });
    const result = playFree(b.state, deps, COUNT.card.id);
    expect(counters(result.state, b.tracker)).toEqual({ seen: 3, has: 1 });
  });
});

/** `card` in hand and the command that plays it for nothing, for a run with its own choice picker. */
function playerHolding(state: GameState, card: string): { readonly state: GameState; readonly play: Command } {
  const player = mustPlayer(state, P1);
  const id = [...player.hand, ...player.deck].find((candidate) => state.instances[candidate]?.cardId === card);
  if (!id) throw new Error(`no ${card}`);
  const held: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? { ...p, deck: p.deck.filter((x) => x !== id), hand: [...p.hand.filter((x) => x !== id), id] }
        : p,
    ),
  };
  return {
    state: held,
    play: { type: "playCard", playerId: P1, cardInstanceId: id, payment: [], attachToInstanceId: null },
  };
}
