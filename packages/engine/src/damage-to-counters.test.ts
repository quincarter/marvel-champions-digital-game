/**
 * docs/phase7-wave5.md §3.29: replacing damage with counters on another card, with no excess damage. A synthetic
 * environment shaped like Bell Tower's Quiet side (`sm` 27077a: "Interrupt: When any amount of damage would be dealt to
 * Venom by an attack, (you may) place that many chime counters here instead."), built from existing parts: an optional
 * interrupt to `dealDamage` from an attack, `replaceTriggeringEvent` with `addCounters` of `eventAmount`.
 *
 * Sources: MC27 p. 21 FAQ (Scenario #2, Venom): "no damage is actually dealt … excess damage effects do not apply";
 * RRG 1.8 "Overkill" (p. 31): excess is the damage taken beyond remaining hit points, which a replaced event never
 * reaches. §4 Q8 (proposed default): the player whose attack it is chooses; the first player when none controls it.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };

const QUIET: AbilityDefinition = {
  trigger: {
    kind: "interrupt",
    forced: false,
    on: { on: "dealDamage", targetIs: { categories: ["villain"], name: "Venom" }, fromAttack: true },
  },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "addCounters", target: { kind: "self" }, counterType: "chime", amount: { kind: "eventAmount" } }],
    },
  ],
};
const QUIET_INTERRUPT = stubAbility("tower.interrupt", QUIET);
const TOWER = stubEnvironment({ id: "tower", abilities: [QUIET_INTERRUPT.ref] });
// Stage I has 3 hit points, so an attack of 5 would deal 2 excess; stage II keeps the game going when it falls.
const VENOM = stubVillain({
  id: "venom",
  name: "Venom",
  stages: [
    { hp: flat(3), atk: 1, sch: 1 },
    { hp: flat(40), atk: 1, sch: 1 },
  ],
});

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const OVERKILL_5 = actionEvent("overkill-5", [{ kind: "attack", target: theVillain, amount: n(5), overkill: true }]);
const ZAP_2 = actionEvent("zap-2", [{ kind: "dealDamage", target: theVillain, amount: n(2) }]);
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const EVENTS = [OVERKILL_5, ZAP_2, TOUGHEN];

const deps: EngineDeps = depsOf(QUIET_INTERRUPT, ...EVENTS.map((e) => e.ability));

function start(players: 1 | 2 = 1): { readonly state: GameState; readonly tower: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [TOWER, ...EVENTS.map((e) => e.card)],
    deps,
    villain: VENOM,
    players,
    encounter: [TOWER.id, ...copiesOf(TREACHERY.id, 29)],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
  const hero = { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
  const placed = encounterCardInVillainArea(hero as GameState, TOWER.id);
  return { state: placed.state, tower: placed.id };
}

/** Takes Bell Tower's "(you may)" when offered (`accept`), recording who was asked; otherwise the default picks. */
function picker(accept: boolean, askedOf: PlayerId[]) {
  return (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (
      choice?.prompt.kind === "chooseTriggers" &&
      choice.options.some((o) => o.optionId.endsWith(":tower.interrupt"))
    ) {
      askedOf.push(choice.playerId);
      return accept ? choice.options.map((o) => o.optionId) : [];
    }
    return defaultPick(state);
  };
}

function play(state: GameState, card: string, accept: boolean, player: PlayerId = P1) {
  const askedOf: PlayerId[] = [];
  const given = giveCard(state, player, card);
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    picker(accept, askedOf),
  );
  return { session, state: session.state, events, askedOf };
}

const venom = (state: GameState) => state.villains[0]!;
const venomDamage = (state: GameState): number => mustInstance(state, venom(state).instanceId).damage;
const chimes = (state: GameState, tower: InstanceId): number => mustInstance(state, tower).counters.chime ?? 0;
const resolvedAttack = (events: readonly GameEvent[]) =>
  events.find((e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack") as
    | Extract<GameEvent, { type: "triggerEvent" }>
    | undefined;

describe("§3.29 'place that many chime counters here instead' (no damage dealt, no excess)", () => {
  it("an attack of 5 with overkill on a 3-hit-point Venom places 5 counters and deals nothing; replay deep-equal", () => {
    const { state: begin, tower } = start();
    const { state, events, session, askedOf } = play(begin, OVERKILL_5.card.id, true);
    expect(askedOf).toEqual([P1]);
    expect(chimes(state, tower)).toBe(5);
    expect(venomDamage(state)).toBe(0);
    expect(venom(state).stageIndex).toBe(0);
    expect(events.some((e) => e.type === "damageDealt")).toBe(false);
    expect(events.some((e) => e.type === "overkillSpilled")).toBe(false);
    // The attack reports no damage and no excess, so "after you deal excess damage" / "attacks and damages" miss it.
    const results = resolvedAttack(events)?.event.results ?? {};
    expect(results.damage ?? 0).toBe(0);
    expect(results.excessDealt ?? 0).toBe(0);
    expect(results.defeated ?? 0).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("declined, the same attack deals its damage and reports 2 excess", () => {
    const { state: begin, tower } = start();
    const { state, events, askedOf } = play(begin, OVERKILL_5.card.id, false);
    expect(askedOf).toEqual([P1]);
    expect(chimes(state, tower)).toBe(0);
    expect(venom(state).stageIndex).toBe(1);
    expect(resolvedAttack(events)?.event.results?.excessDealt).toBe(2);
  });

  it("is not offered for damage that is not from an attack", () => {
    const { state: begin, tower } = start();
    const { state, askedOf } = play(begin, ZAP_2.card.id, true);
    expect(askedOf).toEqual([]);
    expect(chimes(state, tower)).toBe(0);
    expect(venomDamage(state)).toBe(2);
  });

  it("a tough status on Venom resolves first, so the interrupt gets no window", () => {
    const { state: begin, tower } = start();
    const tough = play(begin, TOUGHEN.card.id, true).state;
    const { state, askedOf } = play(tough, OVERKILL_5.card.id, true);
    expect(askedOf).toEqual([]);
    expect(chimes(state, tower)).toBe(0);
    expect(venomDamage(state)).toBe(0);
    expect(mustInstance(state, venom(state).instanceId).statuses.tough).toBe(0);
  });

  it("§4 Q8: the player whose attack it is chooses, not the first player", () => {
    const { state: begin, tower } = start(2);
    const p2Turn = driveSession(startSession(begin), deps, [{ type: "endTurn", playerId: P1 }]).session.state;
    expect(p2Turn.step).toMatchObject({ kind: "turn", activePlayerId: P2 });
    expect(p2Turn.firstPlayerId).toBe(P1);
    const { state, askedOf } = play(p2Turn, OVERKILL_5.card.id, true, P2);
    expect(askedOf).toEqual([P2]);
    expect(chimes(state, tower)).toBe(5);
    expect(venomDamage(state)).toBe(0);
  });
});
