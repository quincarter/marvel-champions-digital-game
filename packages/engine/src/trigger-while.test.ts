/**
 * `while` on an interrupt or response trigger (docs/phase7-wave6.md §3.57): a condition on the ability apart from its
 * triggering condition. Med Lab (`rogue` 38028): "Response: After an ally is defeated by consequential damage, exhaust
 * Med Lab → place it here. (Limit 1 ally at a time.)" is the response "while nothing is tucked here". RRG 1.8 "Play
 * Restrictions and Permissions" (p. 33); "Initiating Abilities" (p. 24): restrictions are checked at step 2, the cost
 * paid at step 5, so a false condition spends nothing.
 *
 * Synthetic cards: Blaster ("Action: attack the villain for 2") and four supports answering that attack, each "while
 * there is no counter here".
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const one = { kind: "const", value: 1 } as const;
const BLAST = stubAbility("blast.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
});
const onBlast = { on: "attack", sourceAbility: "blast.action" } as const;
const EMPTY: Predicate = {
  kind: "compare",
  left: { kind: "counters", of: self, counterType: "held" },
  op: "equalTo",
  right: { kind: "const", value: 0 },
};
const plus = (value: number): AbilityDefinition["effects"] => [
  { kind: "modifyAttack", extraDamage: { kind: "const", value } },
];
const hold: AbilityDefinition["effects"] = [{ kind: "addCounters", target: self, counterType: "held", amount: one }];

/** "Interrupt: When you blast, exhaust this card → +1 damage and place a counter here. (Limit 1 counter at a time.)" */
const GATED = stubAbility("gated.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast, while: EMPTY },
  cost: { exhaustSelf: true },
  effects: [...plus(1), ...hold],
});
/** The same as a response: the damage is dealt, so it only places its counter. */
const GATED_RESPONSE = stubAbility("gated.response", {
  trigger: { kind: "response", forced: false, on: onBlast, while: EMPTY },
  cost: { exhaustSelf: true },
  effects: hold,
});
const FORCED = stubAbility("forced.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: onBlast, while: EMPTY },
  effects: [...plus(10), ...hold],
});
/** The same ability with no `while`: today's behavior. */
const PLAIN = stubAbility("plain.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast },
  cost: { exhaustSelf: true },
  effects: [...plus(100), ...hold],
});
/** "Any player may trigger this ability" with the same condition (`triggerableBy`, read through `offeredTo`). */
const SHARED = stubAbility("shared.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast, while: EMPTY, triggerableBy: { kind: "each" } },
  effects: [...plus(1000), ...hold],
});
/** "Forced Interrupt: When you blast, place a counter on Gated": makes Gated's condition false inside the window. */
const FILLER = stubAbility("filler.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: onBlast },
  effects: [
    { kind: "addCounters", target: { kind: "each", query: { name: "gated" } }, counterType: "held", amount: one },
  ],
});

const BLASTER = stubSupport({ id: "blaster", cost: 0, abilities: [BLAST.ref] });
const cards = {
  gated: stubSupport({ id: "gated", cost: 0, abilities: [GATED.ref] }),
  gatedResponse: stubSupport({ id: "gatedresponse", cost: 0, abilities: [GATED_RESPONSE.ref] }),
  forced: stubSupport({ id: "forced", cost: 0, abilities: [FORCED.ref] }),
  plain: stubSupport({ id: "plain", cost: 0, abilities: [PLAIN.ref] }),
  shared: stubSupport({ id: "shared", cost: 0, abilities: [SHARED.ref] }),
  filler: stubSupport({ id: "filler", cost: 0, abilities: [FILLER.ref] }),
};
type CardKey = keyof typeof cards;
const deps: EngineDeps = depsOf(BLAST, GATED, GATED_RESPONSE, FORCED, PLAIN, SHARED, FILLER);

interface Table {
  readonly state: GameState;
  readonly blaster: InstanceId;
  readonly ids: Readonly<Partial<Record<CardKey, InstanceId>>>;
}

/** Blaster and the named cards in play; `held` counters already on each of them. */
function table(inPlay: readonly CardKey[], held = 0): Table {
  const all = [BLASTER, ...Object.values(cards)];
  const blaster = playerCardIntoPlay(gameAtFirstTurn({ cards: all, deps, deck: all.map((c) => c.id) }), BLASTER.id);
  let state = blaster.state;
  const ids: Partial<Record<CardKey, InstanceId>> = {};
  for (const key of inPlay) {
    const placed = playerCardIntoPlay(state, cards[key].id);
    ids[key] = placed.id;
    state = {
      ...placed.state,
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), counters: held > 0 ? { held } : {} },
      },
    };
  }
  return { state, blaster: blaster.id, ids };
}

/** Blasts `times` times, recording every ability a window offers and taking those `accept` names. */
function blast(t: Table, accept: readonly string[] = [], times = 1) {
  const offered: string[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
    offered.push(...choice.options.map((o) => o.optionId));
    return choice.options.filter((o) => accept.some((a) => o.optionId.includes(a))).map((o) => o.optionId);
  };
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: t.blaster,
    abilityId: BLAST.ref.id,
    payment: [],
  };
  const { session } = driveSession(
    startSession(t.state),
    deps,
    Array.from({ length: times }, () => command),
    pick,
  );
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  const state = session.state;
  return {
    state,
    offers: (abilityId: string) => offered.filter((id) => id.includes(abilityId)).length,
    damage: mustInstance(state, state.villains[0]!.instanceId).damage,
    card: (key: CardKey) => mustInstance(state, t.ids[key]!),
  };
}

describe("`while` on an interrupt or response trigger", () => {
  it("an optional interrupt is offered while its condition holds, and resolves with its cost paid", () => {
    const result = blast(table(["gated"]), [GATED.ref.id]);
    expect(result.offers(GATED.ref.id)).toBe(1);
    expect(result.damage).toBe(3);
    expect(result.card("gated").exhausted).toBe(true);
    expect(result.card("gated").counters.held).toBe(1);
  });

  it("is not offered while the condition is false, and its cost is not paid", () => {
    const result = blast(table(["gated"], 1), [GATED.ref.id]);
    expect(result.offers(GATED.ref.id)).toBe(0);
    expect(result.damage).toBe(2);
    expect(result.card("gated").exhausted).toBe(false);
    expect(result.card("gated").counters.held).toBe(1);
  });

  it("a response is gated the same way", () => {
    const open = blast(table(["gatedResponse"]), [GATED_RESPONSE.ref.id]);
    expect(open.offers(GATED_RESPONSE.ref.id)).toBe(1);
    expect(open.card("gatedResponse").counters.held).toBe(1);
    const full = blast(table(["gatedResponse"], 1), [GATED_RESPONSE.ref.id]);
    expect(full.offers(GATED_RESPONSE.ref.id)).toBe(0);
    expect(full.card("gatedResponse").exhausted).toBe(false);
  });

  it("a forced interrupt resolves while its condition holds and not once it is false", () => {
    const first = blast(table(["forced"]));
    expect(first.damage).toBe(12);
    expect(first.card("forced").counters.held).toBe(1);
    // The second blast finds the counter the first one placed: 12, then a plain 2.
    const twice = blast(table(["forced"]), [], 2);
    expect(twice.damage).toBe(14);
    expect(twice.card("forced").counters.held).toBe(1);
    expect(blast(table(["forced"], 1)).damage).toBe(2);
  });

  it("an ability every player may trigger (`triggerableBy`) is gated for each of them", () => {
    const open = blast(table(["shared"]), [SHARED.ref.id]);
    expect(open.offers(SHARED.ref.id)).toBe(1);
    expect(open.damage).toBe(1002);
    expect(blast(table(["shared"], 1), [SHARED.ref.id]).offers(SHARED.ref.id)).toBe(0);
  });

  it("is read again after the window's forced abilities: one that makes it false withdraws the offer", () => {
    const result = blast(table(["gated", "filler"]), [GATED.ref.id]);
    expect(result.offers(GATED.ref.id)).toBe(0);
    expect(result.damage).toBe(2);
    expect(result.card("gated").exhausted).toBe(false);
  });

  it("a trigger without `while` is offered whatever the counters say", () => {
    for (const held of [0, 1]) {
      const result = blast(table(["plain"], held), [PLAIN.ref.id]);
      expect(result.offers(PLAIN.ref.id)).toBe(1);
      expect(result.damage).toBe(102);
      expect(result.card("plain").counters.held).toBe(held + 1);
    }
  });

  it("the condition reads its own card: a counter on another card does not close it", () => {
    const t = table(["gated", "plain"]);
    const plain = t.ids.plain!;
    const state: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [plain]: { ...mustInstance(t.state, plain), counters: { held: 3 } } },
    };
    expect(blast({ ...t, state }, [GATED.ref.id]).offers(GATED.ref.id)).toBe(1);
  });
});
