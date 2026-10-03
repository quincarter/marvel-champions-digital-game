/**
 * docs/phase7-wave6.md §3.78: `ValueSpec statusCount` (how many status cards of a type are on a card) and
 * `ResourceGeneration amount` (a resource ability generating a number the table gives). Titanium Muscles (`mut_gen`
 * 32005): "Hero Resource: Exhaust this card → generate a [physical] resource for each tough status card on Colossus",
 * and Colossus can hold two tough status cards.
 *
 * Sources: RRG 1.8 "Status Cards" (p. 42); "Resource Ability" (p. 37): it "can be triggered anytime the player who
 * controls the ability is generating resources to pay a cost"; "Cost" (p. 13): "While paying a cost, a player is
 * permitted to generate resources beyond the specified cost." So with no tough status card the ability may still be
 * used: its cost is paid and it generates nothing.
 *
 * Synthetic cards: Muscles ("Resource: Exhaust this card → generate a [physical] resource for each tough status card on
 * your identity"), a cost-2 support to pay for, and an action costing two [physical] resources.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps, ResourceGeneration } from "./abilities.js";
import { generatedResources } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { resolveValue } from "./select.js";
import type { ValueSpec } from "./spec.js";
import type { GameState, StatusCounts } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const YOUR_IDENTITY = { kind: "identityOf", player: { kind: "controller" } } as const;
const TOUGH_ON_YOU: ValueSpec = { kind: "statusCount", of: YOUR_IDENTITY, status: "tough" };
const PER_TOUGH: ResourceGeneration = { kind: "amount", resource: "physical", amount: TOUGH_ON_YOU };

const MUSCLES_RESOURCE = stubAbility("muscles.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: PER_TOUGH,
  effects: [],
});
/** Colossus's "can have 1 additional tough status card" (docs/phase7-wave6.md §3.7), so an identity holds two here. */
const TWO_TOUGH = stubAbility("muscles.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "statusLimit", target: { categories: ["identity"] }, status: "tough", max: 2 }],
  },
  effects: [],
});
const MUSCLES = stubSupport({ id: "muscles", cost: 0, abilities: [MUSCLES_RESOURCE.ref, TWO_TOUGH.ref] });
const GYM = stubSupport({ id: "gym", cost: 2 });
const FLYER = stubSupport({ id: "flyer", cost: 0 });
const PRESS = stubAbility("bench.action", {
  trigger: { kind: "action" },
  cost: { resources: { physical: 2 } },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 5 } }],
});
const BENCH = stubSupport({ id: "bench", cost: 0, abilities: [PRESS.ref] });
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 2 });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const deps: EngineDeps = depsOf(MUSCLES_RESOURCE, TWO_TOUGH, PRESS);

interface Table {
  readonly state: GameState;
  readonly muscles: InstanceId;
  readonly bench: InstanceId;
  readonly pal: InstanceId;
  readonly gym: InstanceId;
  readonly mental: InstanceId;
  readonly flyer: InstanceId;
  readonly identity: InstanceId;
}

/** Muscles, Bench and an ally in play; a hand of exactly Gym, Flyer and one [mental] card; `tough` tough cards on the identity. */
function table(tough: number, statuses: Partial<StatusCounts> = {}): Table {
  const cards = [MUSCLES, GYM, BENCH, PAL, MENTAL, FLYER];
  const start = gameAtFirstTurn({ cards, deps, deck: cards.map((c) => c.id) });
  const muscles = playerCardIntoPlay(start, MUSCLES.id);
  const bench = playerCardIntoPlay(muscles.state, BENCH.id);
  const pal = playerCardIntoPlay(bench.state, PAL.id);
  const gym = giveCard(pal.state, P1, GYM.id);
  const flyer = giveCard(gym.state, P1, FLYER.id);
  const mental = giveCard(flyer.state, P1, MENTAL.id);
  const identity = mustPlayer(mental.state, P1).identity.instanceId;
  const hand = [gym.id, flyer.id, mental.id];
  const state: GameState = {
    ...mental.state,
    players: mental.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand, deck: [...p.hand.filter((id) => !hand.includes(id)), ...p.deck] } : p,
    ),
    instances: {
      ...mental.state.instances,
      [identity]: {
        ...mustInstance(mental.state, identity),
        statuses: { ...mustInstance(mental.state, identity).statuses, ...statuses, tough },
      },
    },
  };
  return {
    state,
    muscles: muscles.id,
    bench: bench.id,
    pal: pal.id,
    gym: gym.id,
    mental: mental.id,
    flyer: flyer.id,
    identity,
  };
}

const viaMuscles = (t: Table): Payment => ({ ability: { instanceId: t.muscles, abilityId: MUSCLES_RESOURCE.ref.id } });
const playCard = (card: InstanceId, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
});
const playGym = (t: Table, payment: readonly Payment[]): Command => playCard(t.gym, payment);
const press = (t: Table, payment: readonly Payment[]): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: t.bench,
  abilityId: PRESS.ref.id,
  payment,
});
const valueOn = (state: GameState, self: InstanceId, value: ValueSpec) =>
  resolveValue(state, value, { selfInstanceId: self, controllerId: P1, event: null, bindings: {}, deps }, deps);
const generated = (t: Table) =>
  generatedResources(t.state, PER_TOUGH, null, { deps, sourceId: t.muscles, playerId: P1 });
/** Applies the command through a session; the log replays to the same state. */
function drive(t: Table, command: Command) {
  const { session, events } = driveSession(startSession(t.state), deps, [command], defaultPick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

describe("§3.78 `statusCount`: the status cards of one type on a card", () => {
  it("reads 0, 1 and 2 tough status cards on the identity", () => {
    for (const tough of [0, 1, 2]) {
      const t = table(tough);
      expect(valueOn(t.state, t.muscles, TOUGH_ON_YOU)).toBe(tough);
    }
  });

  it("counts only the named type: a stunned and confused identity with no tough card reads 0", () => {
    const t = table(0, { stunned: 1, confused: 1 });
    expect(valueOn(t.state, t.muscles, TOUGH_ON_YOU)).toBe(0);
    expect(valueOn(t.state, t.muscles, { kind: "statusCount", of: YOUR_IDENTITY, status: "stunned" })).toBe(1);
  });

  it("reads the card the ref names, and totals several: an ally's tough card is not the identity's", () => {
    const t = table(2);
    const state: GameState = {
      ...t.state,
      instances: {
        ...t.state.instances,
        [t.pal]: { ...mustInstance(t.state, t.pal), statuses: { ...mustInstance(t.state, t.pal).statuses, tough: 1 } },
      },
    };
    expect(valueOn(state, t.muscles, TOUGH_ON_YOU)).toBe(2);
    const allies: ValueSpec = {
      kind: "statusCount",
      of: { kind: "each", query: { categories: ["ally"] } },
      status: "tough",
    };
    expect(valueOn(state, t.muscles, allies)).toBe(1);
    const everyone: ValueSpec = {
      kind: "statusCount",
      of: { kind: "each", query: { categories: ["ally", "identity"] } },
      status: "tough",
    };
    expect(valueOn(state, t.muscles, everyone)).toBe(3);
    expect(
      valueOn(state, t.muscles, { kind: "statusCount", of: { kind: "slot", slot: "nobody" }, status: "tough" }),
    ).toBe(0);
  });
});

describe("§3.78 `ResourceGeneration amount`: a resource for each tough status card", () => {
  it("generates 0, 1 and 2 [physical] with 0, 1 and 2 tough status cards", () => {
    for (const tough of [0, 1, 2]) {
      expect(generated(table(tough))).toEqual({ energy: 0, mental: 0, physical: tough, wild: 0 });
    }
  });

  it("`max` caps it, and a negative amount generates nothing", () => {
    const t = table(2);
    const from = { deps, sourceId: t.muscles, playerId: P1 };
    expect(generatedResources(t.state, { ...PER_TOUGH, max: 1 }, null, from).physical).toBe(1);
    const negative: ResourceGeneration = { kind: "amount", resource: "wild", amount: { kind: "const", value: -2 } };
    expect(generatedResources(t.state, negative, null, from).wild).toBe(0);
  });

  it("two tough cards: the ability alone pays a cost of 2, exhausting its card; replay deep-equal", () => {
    const t = table(2);
    const { state } = drive(t, playGym(t, [viaMuscles(t)]));
    expect(mustPlayer(state, P1).playArea).toContain(t.gym);
    expect(mustInstance(state, t.muscles).exhausted).toBe(true);
    expect(mustPlayer(state, P1).hand).toEqual([t.flyer, t.mental]);
    // Generating resources uses no status card: both are still there.
    expect(mustInstance(state, t.identity).statuses.tough).toBe(2);
  });

  it("the resources are [physical]: two tough cards pay an ability costing two [physical] resources, one does not", () => {
    const two = table(2);
    const { state } = drive(two, press(two, [viaMuscles(two)]));
    expect(mustInstance(state, state.villains[0]!.instanceId).damage).toBe(5);
    const one = table(1);
    expect(applyCommand(one.state, press(one, [viaMuscles(one)]), deps).ok).toBe(false);
    // A [mental] card does not make up the missing [physical].
    expect(applyCommand(one.state, press(one, [viaMuscles(one), { fromHand: one.mental }]), deps).ok).toBe(false);
  });

  it("one tough card: 1 resource, so a cost of 2 needs a second resource", () => {
    const t = table(1);
    const short = applyCommand(t.state, playGym(t, [viaMuscles(t)]), deps);
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error.code).toBe("insufficient_resources");
    const { state } = drive(t, playGym(t, [viaMuscles(t), { fromHand: t.mental }]));
    expect(mustPlayer(state, P1).playArea).toContain(t.gym);
    expect(mustInstance(state, t.muscles).exhausted).toBe(true);
  });

  it("no tough card: it generates nothing, so it pays for nothing on its own", () => {
    const t = table(0);
    const alone = applyCommand(t.state, playGym(t, [viaMuscles(t)]), deps);
    expect(alone.ok).toBe(false);
    if (!alone.ok) expect(alone.error.code).toBe("insufficient_resources");
    expect(mustInstance(t.state, t.muscles).exhausted).toBe(false);
  });

  it("no tough card: it may still be used in a payment (RRG pp. 13, 37); its cost is paid for nothing", () => {
    const t = table(0);
    // Flyer costs 0: Muscles joins its payment, exhausts, and adds no resource.
    const { state, events } = drive(t, playCard(t.flyer, [viaMuscles(t)]));
    expect(mustPlayer(state, P1).playArea).toContain(t.flyer);
    expect(mustInstance(state, t.muscles).exhausted).toBe(true);
    const made = events.filter((e) => e.type === "resourcesGenerated");
    expect(made).toMatchObject([{ instanceId: t.muscles, amount: 0 }]);
    // With a card that does pay, a cost of 2 is still short by one: nothing came from Muscles.
    expect(applyCommand(t.state, playGym(t, [viaMuscles(t), { fromHand: t.mental }]), deps).ok).toBe(false);
  });
});
