/**
 * docs/phase7-wave6.md §3.84: an optional interrupt or response whose cost cannot be paid is not offered (RRG 1.8
 * "Cost", p. 13; "Initiating Abilities", p. 24, step 2). Synthetic cards shaped like Nightcrawler (`mut_gen` 32011, an
 * ability in play costing an [energy] resource) and Full Blast (`cyclops` 33008, an event played in the window whose
 * ability costs "exhaust Cyclops"), plus an event whose printed cost must be paid.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const BLAST = stubAbility("blast.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
});
const onBlast = { on: "attack", sourceAbility: "blast.action" } as const;
const plus = (value: number) => [{ kind: "modifyAttack", extraDamage: { kind: "const", value } }] as const;
const ENERGY_INTERRUPT = stubAbility("crawler.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast },
  cost: { resources: { energy: 1 } },
  effects: plus(1),
});
const EXHAUST_INTERRUPT = stubAbility("fullblast.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast },
  cost: { exhaustIdentity: true },
  effects: plus(10),
});
const PRICEY_INTERRUPT = stubAbility("pricey.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onBlast },
  effects: plus(100),
});
/** A resource "for" Crawler's ability only (Ruby Quartz Visor's shape: an ability's payment is for its own card). */
const LENS_RESOURCE = stubAbility("lens.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { energy: 1 },
  generatesFor: { name: "crawler" },
  effects: [],
});
const LENS = stubSupport({ id: "lens", cost: 0, abilities: [LENS_RESOURCE.ref] });
const BLASTER = stubSupport({ id: "blaster", cost: 0, abilities: [BLAST.ref] });
const CRAWLER = stubSupport({ id: "crawler", cost: 0, abilities: [ENERGY_INTERRUPT.ref] });
const FULL_BLAST = stubEvent({ id: "fullblast", cost: 0, abilities: [EXHAUST_INTERRUPT.ref] });
const PRICEY = stubEvent({ id: "pricey", cost: 1, abilities: [PRICEY_INTERRUPT.ref] });
const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 1 } });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const deps: EngineDeps = depsOf(BLAST, ENERGY_INTERRUPT, EXHAUST_INTERRUPT, PRICEY_INTERRUPT, LENS_RESOURCE);

interface Table {
  readonly state: GameState;
  readonly blaster: InstanceId;
  readonly crawler: InstanceId;
  readonly fullBlast: InstanceId;
  readonly pricey: InstanceId;
  readonly payWith: InstanceId | null;
  /** A Lens in play, the only source of resources, generating only for Crawler's ability. */
  readonly lens: InstanceId | null;
}

/** Blaster and Crawler in play; a hand of exactly Full Blast, Pricey and (optionally) one resource card. */
function table(resource: "energy" | "mental" | "lens" | null, identityExhausted = false): Table {
  const cards = [BLASTER, CRAWLER, FULL_BLAST, PRICEY, ENERGY, MENTAL, LENS];
  let state = gameAtFirstTurn({ cards, deps, deck: cards.map((c) => c.id) });
  const blaster = playerCardIntoPlay(state, BLASTER.id);
  const crawler = playerCardIntoPlay(blaster.state, CRAWLER.id);
  const fullBlast = giveCard(crawler.state, P1, FULL_BLAST.id);
  const pricey = giveCard(fullBlast.state, P1, PRICEY.id);
  state = pricey.state;
  let payWith: InstanceId | null = null;
  let lens: InstanceId | null = null;
  if (resource === "lens") {
    const placed = playerCardIntoPlay(state, LENS.id);
    state = placed.state;
    lens = placed.id;
  } else if (resource) {
    const given = giveCard(state, P1, resource === "energy" ? ENERGY.id : MENTAL.id);
    state = given.state;
    payWith = given.id;
  }
  const seat = mustPlayer(state, P1);
  const hand = [fullBlast.id, pricey.id, ...(payWith ? [payWith] : [])];
  const identity = seat.identity.instanceId;
  state = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand, discard: [...p.discard, ...p.hand.filter((id) => !hand.includes(id))] } : p,
    ),
    instances: {
      ...state.instances,
      [identity]: { ...mustInstance(state, identity), exhausted: identityExhausted },
    },
  };
  return { state, blaster: blaster.id, crawler: crawler.id, fullBlast: fullBlast.id, pricey: pricey.id, payWith, lens };
}

const blast = (blaster: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: blaster,
  abilityId: BLAST.ref.id,
  payment: [],
});

/** Uses Blaster, recording every ability the interrupt window offers; `accept` names the ones to take. */
function offersFor(t: Table, accept: readonly string[] = []) {
  const offered = new Set<string>();
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      for (const option of choice.options) offered.add(option.optionId);
      return choice.options.filter((o) => accept.some((a) => o.optionId.includes(a))).map((o) => o.optionId);
    }
    if (choice?.prompt.kind === "payForAbility" || choice?.prompt.kind === "payForCard") {
      if (t.lens) return [`ability:${t.lens}:${LENS_RESOURCE.ref.id}`];
      return t.payWith ? [`hand:${t.payWith}`] : [];
    }
    return defaultPick(state);
  };
  const { session } = driveSession(startSession(t.state), deps, [blast(t.blaster)], pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  const has = (abilityId: string) => [...offered].some((id) => id.includes(abilityId));
  const villain = session.state.villains[0]!.instanceId;
  return { has, state: session.state, villainDamage: mustInstance(session.state, villain).damage };
}

describe("§3.84 an optional interrupt whose cost can't be paid is not offered", () => {
  it("an ability in play costing an [energy] resource: not offered with no card that can pay it", () => {
    expect(offersFor(table(null)).has(ENERGY_INTERRUPT.ref.id)).toBe(false);
    expect(offersFor(table("mental")).has(ENERGY_INTERRUPT.ref.id)).toBe(false);
  });

  it("offered with an [energy] card in hand, and paid with it when taken", () => {
    const t = table("energy");
    const result = offersFor(t, [ENERGY_INTERRUPT.ref.id]);
    expect(result.has(ENERGY_INTERRUPT.ref.id)).toBe(true);
    expect(result.villainDamage).toBe(3);
    expect(mustPlayer(result.state, P1).discard).toContain(t.payWith);
  });

  it("an event whose ability costs 'exhaust your identity': offered while it is ready, not once exhausted", () => {
    const ready = offersFor(table(null), [EXHAUST_INTERRUPT.ref.id]);
    expect(ready.has(EXHAUST_INTERRUPT.ref.id)).toBe(true);
    expect(ready.villainDamage).toBe(12);
    const identity = mustPlayer(ready.state, P1).identity.instanceId;
    expect(mustInstance(ready.state, identity).exhausted).toBe(true);
    expect(offersFor(table(null, true)).has(EXHAUST_INTERRUPT.ref.id)).toBe(false);
  });

  it("an event with a printed cost of 1: not offered with nothing to pay it, offered with a resource", () => {
    expect(offersFor(table(null)).has(PRICEY_INTERRUPT.ref.id)).toBe(false);
    const paid = offersFor(table("mental"), [PRICEY_INTERRUPT.ref.id]);
    expect(paid.has(PRICEY_INTERRUPT.ref.id)).toBe(true);
    expect(paid.villainDamage).toBe(102);
  });

  it("a resource that generates only for the ability's own card counts: offered, and paid with it when taken", () => {
    const t = table("lens");
    const result = offersFor(t, [ENERGY_INTERRUPT.ref.id]);
    expect(result.has(ENERGY_INTERRUPT.ref.id)).toBe(true);
    expect(result.villainDamage).toBe(3);
    expect(mustInstance(result.state, t.lens!).exhausted).toBe(true);
  });
});
