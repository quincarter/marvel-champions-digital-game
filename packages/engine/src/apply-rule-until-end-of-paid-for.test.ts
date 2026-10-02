/**
 * docs/phase7-wave6.md §3.30: `applyRuleUntil` with `until: "endOfPaidFor"`. Synthetic cards shaped like Ruby Quartz
 * Visor (33003: "Exhaust this card → generate a [energy] resource for your 'Optic Blast' ability. That attack gains
 * piercing and ranged.") and an "(attack)" action that costs 1 resource, standing in for Optic Blast.
 *
 * Sources: the card's own text; RRG 1.8 "Resource Ability" (p. 37), "Initiating Abilities" (p. 24, steps 5–6: the
 * resource ability's effects resolve with the payment, before the ability paid for), "Piercing" (p. 32), "Ranged"
 * (p. 35), "Lasting Effects" (p. 26).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { RESOURCE } from "./testing/scenario.js";

const VISOR_RESOURCE = stubAbility("visor.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { energy: 1 },
  effects: [
    {
      kind: "applyRuleUntil",
      rule: { kind: "attackKeywords", keywords: ["piercing", "ranged"], via: { inSlot: "paidFor" } },
      until: "endOfPaidFor",
    },
  ],
});
const VISOR = stubSupport({ id: "visor", cost: 0, abilities: [VISOR_RESOURCE.ref] });
const BLAST_ACTION = stubAbility("blast.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  cost: { resources: 1 },
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
});
const BLASTER = stubSupport({ id: "blaster", cost: 0, abilities: [BLAST_ACTION.ref] });
const deps: EngineDeps = depsOf(VISOR_RESOURCE, BLAST_ACTION);
const VILLAIN = stubVillain({
  id: "retaliator",
  stages: [{ hp: flat(30), atk: 1, sch: 0, keywords: [{ name: "retaliate", value: 1 }] }],
});

function start(): { state: GameState; visor: InstanceId; blaster: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [VISOR, BLASTER, VILLAIN],
    deps,
    villain: VILLAIN,
    deck: [VISOR.id, BLASTER.id, ...copiesOf(RESOURCE.id, 10)],
  });
  const withVisor = playerCardIntoPlay(base, VISOR.id);
  const withBlaster = playerCardIntoPlay(withVisor.state, BLASTER.id);
  const hero = mustPlayer(withBlaster.state, P1).identity.form === "hero";
  const state = hero
    ? withBlaster.state
    : driveSession(startSession(withBlaster.state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
  const villain = villainId(state);
  // A tough villain, so piercing shows.
  const patched = withTough(state, villain);
  return { state: patched, visor: withVisor.id, blaster: withBlaster.id };
}

const villainId = (state: GameState) => state.villains[0]!.instanceId;
const withTough = (state: GameState, id: InstanceId): GameState => {
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, tough: 1 } } },
  };
};

const use = (blaster: InstanceId, payment: Extract<Command, { type: "useAbility" }>["payment"]): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: blaster,
  abilityId: BLAST_ACTION.ref.id,
  payment,
});

describe("§3.30 `applyRuleUntil` until `endOfPaidFor`: 'that attack gains piercing and ranged'", () => {
  it("the attack the Visor paid for gains both; the next use, paid without it, gains neither", () => {
    const { state, visor, blaster } = start();
    const identity = mustPlayer(state, P1).identity.instanceId;
    const villain = villainId(state);
    const hand = mustPlayer(state, P1).hand;
    const { session } = driveSession(startSession(state), deps, [
      use(blaster, [{ ability: { instanceId: visor, abilityId: VISOR_RESOURCE.ref.id } }]),
    ]);
    // Piercing: tough discarded and the damage still dealt. Ranged: no retaliate.
    expect(mustInstance(session.state, villain).statuses.tough ?? 0).toBe(0);
    expect(mustInstance(session.state, villain).damage).toBe(2);
    expect(mustInstance(session.state, identity).damage).toBe(0);
    // The rule ended with the ability it paid for.
    expect(session.state.lastingEffects.filter((e) => e.duration.kind === "endOfPaidFor")).toEqual([]);

    // Tough again, and a second use paid from hand: neither keyword.
    const again = withTough(session.state, villain);
    const spare = hand.find((id) => mustPlayer(again, P1).hand.includes(id))!;
    const second = driveSession(startSession(again), deps, [use(blaster, [{ fromHand: spare }])]).session;
    // No piercing: tough stops the whole attack (villain damage stays at the first use's 2). No ranged: retaliate 1.
    expect(mustInstance(second.state, villain).statuses.tough ?? 0).toBe(0);
    expect(mustInstance(second.state, villain).damage).toBe(2);
    expect(mustInstance(second.state, identity).damage).toBe(1);

    for (const run of [session, second]) {
      const replayed = replay(run.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(run.state);
    }
  });

  it("the rule is retimed onto the ability's effects frame and expires there, both logged", () => {
    const { state, visor, blaster } = start();
    const { events } = driveSession(startSession(state), deps, [
      use(blaster, [{ ability: { instanceId: visor, abilityId: VISOR_RESOURCE.ref.id } }]),
    ]);
    const types = events.map((e) => e.type);
    const retimed = types.indexOf("lastingEffectRetimed");
    expect(retimed).toBeGreaterThan(-1);
    expect(types.indexOf("lastingEffectEnded", retimed)).toBeGreaterThan(retimed);
  });
});
