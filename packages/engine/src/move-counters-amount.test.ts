/**
 * docs/phase7-wave9.md §3.6 (b): a move of N all-purpose counters, retyped by the card they arrive on, placed there,
 * and a uses card the move empties.
 *
 * Sources. RRG 1.8 "All-Purpose Counter" (p. 6): "When an all-purpose counter is moved from one card to another, it
 * loses any previous type it had and gains the type defined on the new card it occupies. If the new card does not
 * define a type, it is considered only an 'all-purpose counter.'" The MC50 rulebook (p. 4) says the same. RRG 1.8
 * "Uses (X 'type')" (p. 46): the keyword "is equivalent to the following constant ability: 'This card enters play with
 * X all-purpose counters. These are "type counters." If there are no all-purpose counters on this card, discard this
 * card.'" RRG 1.8 FAQ (p. 62, Battery Pack): "The card that an all-purpose counter is on defines the type of that
 * counter".
 *
 * Synthetic cards shaped like Maria Hill's Reassignment ("Action: Move 1 all-purpose counter from a S.H.I.E.L.D.
 * support to another S.H.I.E.L.D. support. (Limit once per round.)"), The Iliad (uses 3 mission), Support Staff (uses
 * 3 staff), Command Team (uses, 1 command counter left) and Sky-Destroyer (defines no type).
 */

import type { SupportCard, Trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const SHIELD = "S.H.I.E.L.D." as Trait;
type Name = "iliad" | "staff" | "command" | "sky" | "cell" | "trophy" | "desk";
const named = (name: Name): TargetRef => ({ kind: "each", query: { categories: ["support"], name } });
const move = (from: Name, to: Name, counterType?: string, amount?: number): EffectSpec => ({
  kind: "moveCounters",
  from: named(from),
  to: named(to),
  ...(counterType === undefined ? {} : { counterType }),
  ...(amount === undefined ? {} : { amount: { kind: "const", value: amount } }),
});
const uses = (count: number, counterType: string) => ({ name: "uses", count, counterType }) as const;

const ILIAD = stubSupport({ id: "iliad", cost: 0, traits: [SHIELD], keywords: [uses(3, "mission")] });
const STAFF = stubSupport({ id: "staff", cost: 0, traits: [SHIELD], keywords: [uses(3, "staff")] });
const COMMAND = stubSupport({ id: "command", cost: 0, traits: [SHIELD], keywords: [uses(3, "command")] });
const SKY = stubSupport({ id: "sky", cost: 0, traits: [SHIELD] });
const CELL: SupportCard = { ...stubSupport({ id: "cell", cost: 0 }), definedCounterTypes: ["lock"] };
const TROPHY = stubSupport({
  id: "trophy",
  cost: 0,
  keywords: [uses(2, "prize"), { name: "victory", value: 1 }],
});

/** One action per route on a desk the player controls; `REASSIGN` is the one with Maria Hill's limit. */
const action = (id: string, effect: EffectSpec, limited = false) =>
  stubAbility(`desk.${id}`, {
    trigger: { kind: "action" },
    effects: [effect],
    ...(limited ? { limit: { count: 1, period: "round" } as const } : {}),
  });
const REASSIGN = action("reassign", move("iliad", "staff", "any", 1), true);
const STAFF_TO_SKY = action("staff-to-sky", move("staff", "sky", "any", 1));
const SKY_TO_ILIAD = action("sky-to-iliad", move("sky", "iliad", "any", 1));
const COMMAND_TO_ILIAD = action("command-to-iliad", move("command", "iliad", "any", 1));
const ILIAD_TO_CELL_TWO = action("iliad-to-cell", move("iliad", "cell", "any", 2));
const ILIAD_TO_STAFF_TWO = action("iliad-to-staff-2", move("iliad", "staff", "any", 2));
const ILIAD_TO_STAFF_FIVE = action("iliad-to-staff-5", move("iliad", "staff", "any", 5));
const ILIAD_TO_STAFF_ALL = action("iliad-to-staff-all", move("iliad", "staff", "any"));
const NAMED_TO_SKY = action("named-to-sky", move("iliad", "sky", "mission", 2));
const NAMED_TO_STAFF = action("named-to-staff", move("iliad", "staff", "mission", 1));
const WHOLE_TO_SKY = action("whole-to-sky", move("iliad", "sky"));
const TROPHY_TO_SKY = action("trophy-to-sky", move("trophy", "sky", "any"));
const SKY_TO_SKY = action("sky-to-sky", move("sky", "sky", "any", 1));
/** "After a staff counter is placed here": the destination hears a counter that arrives by a move. */
const STAFF_HEARS = stubAbility("desk.staff-placed", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersPlaced", eventIs: { counterType: "staff" } },
  },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "heard", amount: { kind: "eventAmount" } }],
});
const ACTIONS = [
  REASSIGN,
  STAFF_TO_SKY,
  SKY_TO_ILIAD,
  COMMAND_TO_ILIAD,
  ILIAD_TO_CELL_TWO,
  ILIAD_TO_STAFF_TWO,
  ILIAD_TO_STAFF_FIVE,
  ILIAD_TO_STAFF_ALL,
  NAMED_TO_SKY,
  NAMED_TO_STAFF,
  WHOLE_TO_SKY,
  TROPHY_TO_SKY,
  SKY_TO_SKY,
];
const DESK = stubSupport({ id: "desk", cost: 0, abilities: [...ACTIONS.map((a) => a.ref), STAFF_HEARS.ref] });
const CARDS = [ILIAD, STAFF, COMMAND, SKY, CELL, TROPHY, DESK];
const deps: EngineDeps = depsOf(...ACTIONS, STAFF_HEARS);

type Board = { readonly state: GameState } & Readonly<Record<Name, InstanceId>>;

/** Every support in play holding `counters` (surgery: a card put into play this way gets no uses counters). */
function board(counters: Partial<Record<Name, Record<string, number>>>): Board {
  let state = gameAtFirstTurn({ deps, cards: CARDS, deck: CARDS.map((card) => card.id) });
  const ids: Partial<Record<Name, InstanceId>> = {};
  for (const card of CARDS) {
    const put = playerCardIntoPlay(state, card.id);
    ids[card.id as Name] = put.id;
    state = {
      ...put.state,
      instances: {
        ...put.state.instances,
        [put.id]: { ...mustInstance(put.state, put.id), counters: counters[card.id as Name] ?? {} },
      },
    };
  }
  return { state, ...(ids as Record<Name, InstanceId>) };
}

const use = (b: Board, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: b.desk,
  abilityId: ability.ref.id,
  payment: [],
});
const counters = (state: GameState, id: InstanceId): Readonly<Record<string, number>> =>
  Object.fromEntries(Object.entries(mustInstance(state, id).counters).filter(([, amount]) => amount > 0));
const inPlay = (state: GameState, id: InstanceId): boolean => mustPlayer(state, P1).playArea.includes(id);
const discarded = (state: GameState, id: InstanceId): boolean => mustPlayer(state, P1).discard.includes(id);
const movedEvents = (events: readonly GameEvent[]) => events.filter((e) => e.type === "countersMoved");
const placedEvents = (events: readonly GameEvent[]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "countersPlaced" ? [e.event] : [],
  );

describe("§3.6 moveCounters.amount, retyped on arrival", () => {
  it("Reassignment: The Iliad (3 mission) to Support Staff (3 staff) leaves 2 mission and makes 4 staff", () => {
    const b = board({ iliad: { mission: 3 }, staff: { staff: 3 } });
    const result = runCommands(b.state, deps, use(b, REASSIGN));
    expect(counters(result.state, b.iliad)).toEqual({ mission: 2 });
    expect(counters(result.state, b.staff)).toEqual({ staff: 4 });
    expect(movedEvents(result.events)).toEqual([
      { type: "countersMoved", from: b.iliad, to: b.staff, counterType: "mission", amount: 1, toCounterType: "staff" },
    ]);
    const replayed = replay(result.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(result.state);
  });

  it("the destination hears countersPlaced with the type the counter arrived as", () => {
    const b = board({ iliad: { mission: 3 }, staff: { staff: 3 } });
    const result = runCommands(b.state, deps, use(b, REASSIGN));
    expect(placedEvents(result.events)).toEqual([
      { kind: "countersPlaced", targetInstanceId: b.staff, counterType: "staff", amount: 1, playerId: P1 },
    ]);
    expect(counters(result.state, b.desk)).toEqual({ heard: 1 });
  });

  it('"Limit once per round": Reassignment is refused a second time, and nothing moves', () => {
    const b = board({ iliad: { mission: 3 }, staff: { staff: 3 } });
    const once = runCommands(b.state, deps, use(b, REASSIGN));
    const again = applyCommand(once.state, use(b, REASSIGN), deps);
    expect(again.ok).toBe(false);
    expect(counters(once.state, b.iliad)).toEqual({ mission: 2 });
    expect(counters(once.state, b.staff)).toEqual({ staff: 4 });
  });

  it("to a card that defines no type it is 1 allPurpose counter, which a second move makes a mission counter", () => {
    const b = board({ iliad: { mission: 2 }, staff: { staff: 4 } });
    const toSky = runCommands(b.state, deps, use(b, STAFF_TO_SKY));
    expect(counters(toSky.state, b.staff)).toEqual({ staff: 3 });
    expect(counters(toSky.state, b.sky)).toEqual({ allPurpose: 1 });
    expect(movedEvents(toSky.events)).toEqual([
      { type: "countersMoved", from: b.staff, to: b.sky, counterType: "staff", amount: 1, toCounterType: "allPurpose" },
    ]);
    const back = runCommands(toSky.state, deps, use(b, SKY_TO_ILIAD));
    expect(counters(back.state, b.sky)).toEqual({});
    expect(counters(back.state, b.iliad)).toEqual({ mission: 3 });
    // Sky-Destroyer has no uses keyword: emptied, it stays.
    expect(inPlay(back.state, b.sky)).toBe(true);
  });

  it("a type defined in the card's text, without the keyword, is taken too: 2 of 3 mission become 2 lock", () => {
    const b = board({ iliad: { mission: 3 }, cell: { lock: 4 } });
    const result = runCommands(b.state, deps, use(b, ILIAD_TO_CELL_TWO));
    expect(counters(result.state, b.iliad)).toEqual({ mission: 1 });
    expect(counters(result.state, b.cell)).toEqual({ lock: 6 });
  });

  it("an amount past what the card holds moves what it holds; no amount moves them all", () => {
    for (const ability of [ILIAD_TO_STAFF_FIVE, ILIAD_TO_STAFF_ALL]) {
      const b = board({ iliad: { mission: 3 }, staff: { staff: 1 } });
      const result = runCommands(b.state, deps, use(b, ability));
      expect(counters(result.state, b.staff)).toEqual({ staff: 4 });
      expect(discarded(result.state, b.iliad)).toBe(true);
    }
  });

  it("a card has no counter to move: nothing happens, and a card is not moved onto itself", () => {
    const b = board({ staff: { staff: 3 }, sky: { allPurpose: 1 } });
    const none = runCommands(b.state, deps, use(b, REASSIGN));
    expect(counters(none.state, b.staff)).toEqual({ staff: 3 });
    expect(movedEvents(none.events)).toEqual([]);
    const same = runCommands(b.state, deps, use(b, SKY_TO_SKY));
    expect(counters(same.state, b.sky)).toEqual({ allPurpose: 1 });
  });

  it("several types on the source, fewer moved than it holds: the player picks, and both arrive as the new type", () => {
    const b = board({ iliad: { mission: 2, toon: 2 }, staff: { staff: 1 } });
    const prompts: unknown[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "chooseCounters") return defaultPick(state);
      prompts.push(choice.prompt);
      return ["mission#1", "toon#1"];
    };
    const result = runCommandsPicking(b.state, deps, pick, use(b, ILIAD_TO_STAFF_TWO));
    expect(prompts).toEqual([
      { kind: "chooseCounters", instanceId: b.iliad, amount: 2, reason: "move", byType: { mission: 2, toon: 2 } },
    ]);
    expect(counters(result.state, b.iliad)).toEqual({ mission: 1, toon: 1 });
    expect(counters(result.state, b.staff)).toEqual({ staff: 3 });
    // Two types that both became staff counters are one placement of 2.
    expect(placedEvents(result.events)).toEqual([
      { kind: "countersPlaced", targetInstanceId: b.staff, counterType: "staff", amount: 2, playerId: P1 },
    ]);
    expect(counters(result.state, b.desk)).toEqual({ heard: 2 });
    expect(movedEvents(result.events)).toEqual([
      { type: "countersMoved", from: b.iliad, to: b.staff, counterType: "toon", amount: 1, toCounterType: "staff" },
      { type: "countersMoved", from: b.iliad, to: b.staff, counterType: "mission", amount: 1, toCounterType: "staff" },
    ]);
  });
});

describe("§3.6 a move by name", () => {
  it("N of a named type move, and take the type of a destination that defines one", () => {
    const b = board({ iliad: { mission: 3, toon: 1 }, staff: { staff: 3 } });
    const result = runCommands(b.state, deps, use(b, NAMED_TO_STAFF));
    expect(counters(result.state, b.iliad)).toEqual({ mission: 2, toon: 1 });
    expect(counters(result.state, b.staff)).toEqual({ staff: 4 });
  });

  it("onto a card that defines no type they keep their name, as before (a glider counter between main schemes)", () => {
    const b = board({ iliad: { mission: 3, toon: 1 } });
    const result = runCommands(b.state, deps, use(b, NAMED_TO_SKY));
    expect(counters(result.state, b.iliad)).toEqual({ mission: 1, toon: 1 });
    expect(counters(result.state, b.sky)).toEqual({ mission: 2 });
    expect(movedEvents(result.events)).toEqual([
      { type: "countersMoved", from: b.iliad, to: b.sky, counterType: "mission", amount: 2 },
    ]);
  });

  it("a whole move with no type keeps every name on such a card", () => {
    const b = board({ iliad: { mission: 3, toon: 1 } });
    const result = runCommands(b.state, deps, use(b, WHOLE_TO_SKY));
    expect(counters(result.state, b.sky)).toEqual({ mission: 3, toon: 1 });
    expect(discarded(result.state, b.iliad)).toBe(true);
  });
});

describe("§3.6 a uses card emptied by a move is discarded", () => {
  it("Command Team with 1 command counter: moving it away discards Command Team; The Iliad has 4 mission", () => {
    const b = board({ command: { command: 1 }, iliad: { mission: 3 } });
    const result = runCommands(b.state, deps, use(b, COMMAND_TO_ILIAD));
    expect(discarded(result.state, b.command)).toBe(true);
    expect(inPlay(result.state, b.command)).toBe(false);
    expect(counters(result.state, b.iliad)).toEqual({ mission: 4 });
    expect(inPlay(result.state, b.iliad)).toBe(true);
    const replayed = replay(result.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(result.state);
  });

  it("a uses card that keeps a counter stays", () => {
    const b = board({ command: { command: 2 }, iliad: { mission: 3 } });
    const result = runCommands(b.state, deps, use(b, COMMAND_TO_ILIAD));
    expect(inPlay(result.state, b.command)).toBe(true);
    expect(counters(result.state, b.command)).toEqual({ command: 1 });
  });

  it("with Victory 1 it goes to the victory display instead", () => {
    const b = board({ trophy: { prize: 2 } });
    const result = runCommands(b.state, deps, use(b, TROPHY_TO_SKY));
    expect(counters(result.state, b.sky)).toEqual({ allPurpose: 2 });
    expect(result.state.victoryDisplay).toContain(b.trophy);
    expect(discarded(result.state, b.trophy)).toBe(false);
  });
});
