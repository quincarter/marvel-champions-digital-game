/**
 * A forced ability on an encounter card heard from an event no player is a subject of (here, a minion attacked by
 * another enemy: `enemyAttacksEnemy`, heard by "when this card is attacked", `patternHearsKind`) has no controller.
 * It still pays its cost before its effects resolve (RRG 1.8 "Cost", p. 13), and the first player determines and pays
 * all of it, resources and picks included: RRG 1.8 "First Player" (p. 19), "If an encounter card requires a card
 * ability to be resolved … but does not specify which player should act, the first player does so." That a playerless
 * event's forced ability is one the encounter card requires resolved is the engine's reading (`costPayerOf`,
 * resolve/window.ts). The first player is seat 2 here, so the player whose action made the attack is not the one asked.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const mark: EffectSpec = {
  kind: "addCounters",
  target: named("recorder"),
  counterType: "shielded",
  amount: { kind: "const", value: 1 },
};

/** "Forced Interrupt: When this minion is attacked, spend 1 resource → …" */
const PAID_INTERRUPT = stubAbility("paid.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target" } },
  cost: { resources: 1 },
  effects: [mark],
});
/** "Forced Interrupt: When this minion is attacked, exhaust a gadget → …" */
const PICKED_INTERRUPT = stubAbility("picked.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target" } },
  cost: { exhaustCards: { slot: "gadget", query: { name: "gadget" }, min: 1, max: 1 } },
  effects: [mark],
});

const BRUTE = stubMinion({ id: "brute", atk: 2, sch: 1, hp: 30 });
const PAID = stubMinion({ id: "paid", atk: 1, sch: 1, hp: 30, abilities: [PAID_INTERRUPT.ref] });
const PICKED = stubMinion({ id: "picked", atk: 1, sch: 1, hp: 30, abilities: [PICKED_INTERRUPT.ref] });
const RECORDER = stubSupport({ id: "recorder", cost: 0 });
const GADGET = stubSupport({ id: "gadget", cost: 0 });
const MINIONS = [BRUTE, PAID, PICKED];

const actionEvent = (id: string, target: string) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "enemyAttacksEnemy", attacker: named("brute"), target: named(target) }],
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const BRUTE_HITS_PAID = actionEvent("brute-hits-paid", "paid");
const BRUTE_HITS_PICKED = actionEvent("brute-hits-picked", "picked");
const EVENTS = [BRUTE_HITS_PAID, BRUTE_HITS_PICKED];

const deps: EngineDeps = depsOf(PAID_INTERRUPT, PICKED_INTERRUPT, ...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly ids: Readonly<Record<string, InstanceId>>;
  readonly recorder: InstanceId;
  readonly gadgets: readonly InstanceId[];
}

/** Two seats, P1 active, P2 the first player (surgery), each minion engaged with P1, two gadgets in P2's play. */
function table(): Table {
  const base = gameAtFirstTurn({
    players: 2,
    cards: [RECORDER, GADGET, ...MINIONS, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...MINIONS.map((m) => m.id), ...copiesOf(BRUTE.id, 10)],
    deck: [RECORDER.id, ...copiesOf(GADGET.id, 2), ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  let state: GameState = {
    ...base,
    firstPlayerId: P2,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = playerCardIntoPlay(state, RECORDER.id);
  state = placed.state;
  const gadgets: InstanceId[] = [];
  for (let i = 0; i < 2; i++) {
    const gadget = playerCardIntoPlay(state, GADGET.id, P2);
    state = gadget.state;
    gadgets.push(gadget.id);
  }
  const ids: Record<string, InstanceId> = {};
  for (const minion of MINIONS) {
    const engaged = minionEngagedWith(state, minion.id);
    state = engaged.state;
    ids[minion.id] = engaged.id;
  }
  return { state, ids, recorder: placed.id, gadgets };
}

interface Asked {
  readonly kind: string;
  readonly playerId: PlayerId;
}

/** Plays `card` for 0 as P1, answering each choice with `answer` (or the default) and recording who was asked what. */
function play(state: GameState, card: string, answer: (s: GameState) => readonly string[] | null) {
  const given = giveCard(state, P1, card as never);
  const asked: Asked[] = [];
  const run = runCommandsPicking(
    given.state,
    deps,
    (s) => {
      const choice = s.pendingChoice;
      if (choice) asked.push({ kind: choice.prompt.kind, playerId: choice.playerId });
      return answer(s) ?? defaultPick(s);
    },
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  );
  return { ...run, asked };
}

const shields = (state: GameState, recorder: InstanceId): number =>
  mustInstance(state, recorder).counters.shielded ?? 0;

describe("an encounter card's forced ability with no controller: the first player pays its cost (RRG 1.8 p. 19)", () => {
  it("a resource cost: the first player is asked to pay, pays from their hand, and the ability resolves", () => {
    const t = table();
    const handBefore = t.state.players.find((p) => p.playerId === P2)!.hand.length;
    let spent: InstanceId | null = null;
    const run = play(t.state, BRUTE_HITS_PAID.card.id, (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "payForAbility") return null;
      // One of P2's 1-resource stand-ins (`RESOURCE`, "res"), from their own hand.
      const option = choice.options.find((o) => o.label === "res")!;
      spent = option.ref.kind === "card" ? option.ref.instanceId : null;
      return [option.optionId];
    });
    expect(run.asked.filter((a) => a.kind === "payForAbility")).toEqual([{ kind: "payForAbility", playerId: P2 }]);
    expect(shields(run.state, t.recorder)).toBe(1);
    const p2 = run.state.players.find((p) => p.playerId === P2)!;
    expect(p2.hand.length).toBe(handBefore - 1);
    expect(p2.discard).toContain(spent);
    expect(mustInstance(run.state, t.ids.paid!).damage).toBe(2);
  });

  it("a resource cost the first player declines to pay: the ability does not resolve", () => {
    const t = table();
    const run = play(t.state, BRUTE_HITS_PAID.card.id, (s) =>
      s.pendingChoice!.prompt.kind === "payForAbility" ? [] : null,
    );
    expect(run.asked.filter((a) => a.kind === "payForAbility")).toEqual([{ kind: "payForAbility", playerId: P2 }]);
    expect(shields(run.state, t.recorder)).toBe(0);
  });

  it("a pick cost: the first player is asked which of their cards pays, and the ability resolves", () => {
    const t = table();
    const chosen = t.gadgets[1]!;
    const run = play(t.state, BRUTE_HITS_PICKED.card.id, (s) =>
      s.pendingChoice!.prompt.kind === "chooseCostCards" ? [chosen] : null,
    );
    expect(run.asked.filter((a) => a.kind === "chooseCostCards")).toEqual([{ kind: "chooseCostCards", playerId: P2 }]);
    expect(mustInstance(run.state, chosen).exhausted).toBe(true);
    expect(mustInstance(run.state, t.gadgets[0]!).exhausted).toBe(false);
    expect(shields(run.state, t.recorder)).toBe(1);
  });
});
