/**
 * docs/phase7-wave6.md §3.84: `EventPattern.sourceAbility`, the ability that made an attack. Synthetic cards shaped like
 * Full Blast (33008: "When you use your 'Optic Blast' ability, … this attack deals 8 additional damage"), Optic Blast
 * (33001a, an "(attack)" action) and Ricochet Beam (33009, another "(attack)" ability by the same identity): only the
 * named ability's attack is heard. The attack event carries `sourceAbilityId` from the effects frame, carried into
 * branches (`then`).
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

const attackVillain = { kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 2 } } as const;
const BLAST = stubAbility("blast.action", { trigger: { kind: "action" }, label: ["attack"], effects: [attackVillain] });
const RICOCHET = stubAbility("ricochet.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [attackVillain],
});
/** Its attack sits in a `then` branch, so the frame's ability must be carried into it. */
const BRANCH = stubAbility("branch.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "then", effects: [attackVillain] }],
});
const FULL_BLAST = stubAbility("fullblast.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "attack", sourceAbility: ["blast.action", "branch.action"] },
  },
  effects: [{ kind: "modifyAttack", extraDamage: { kind: "const", value: 5 } }],
});
const BLASTER = stubSupport({ id: "blaster", cost: 0, abilities: [BLAST.ref] });
const RICOCHETER = stubSupport({ id: "ricocheter", cost: 0, abilities: [RICOCHET.ref] });
const BRANCHER = stubSupport({ id: "brancher", cost: 0, abilities: [BRANCH.ref] });
const BOOSTER = stubSupport({ id: "booster", cost: 0, abilities: [FULL_BLAST.ref] });
const deps: EngineDeps = depsOf(BLAST, RICOCHET, BRANCH, FULL_BLAST);
const VILLAIN = stubVillain({ id: "target-villain", stages: [{ hp: flat(30), atk: 1, sch: 0 }] });

function start(): { state: GameState; cards: Record<"blaster" | "ricocheter" | "brancher", InstanceId> } {
  const supports = [BLASTER, RICOCHETER, BRANCHER, BOOSTER];
  let state = gameAtFirstTurn({
    cards: [...supports, VILLAIN],
    deps,
    villain: VILLAIN,
    deck: [...supports.map((s) => s.id), ...copiesOf(RESOURCE.id, 10)],
  });
  const ids: InstanceId[] = [];
  for (const support of supports) {
    const placed = playerCardIntoPlay(state, support.id);
    state = placed.state;
    ids.push(placed.id);
  }
  if (mustPlayer(state, P1).identity.form !== "hero") {
    state = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
  }
  return { state, cards: { blaster: ids[0]!, ricocheter: ids[1]!, brancher: ids[2]! } };
}

const use = (card: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: abilityId as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("§3.84 `EventPattern.sourceAbility`: 'When you use your \"Optic Blast\" ability'", () => {
  it("hears the named ability's attack, and the attack event names it", () => {
    const { state, cards } = start();
    const { session, events } = driveSession(startSession(state), deps, [use(cards.blaster, BLAST.ref.id)]);
    expect(villainDamage(session.state)).toBe(7);
    expect(events).toContainEqual(expect.objectContaining({ type: "abilityResolved", abilityId: FULL_BLAST.ref.id }));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("does not hear another attack ability's attack by the same player", () => {
    const { state, cards } = start();
    const { session, events } = driveSession(startSession(state), deps, [use(cards.ricocheter, RICOCHET.ref.id)]);
    expect(villainDamage(session.state)).toBe(2);
    expect(events).not.toContainEqual(
      expect.objectContaining({ type: "abilityResolved", abilityId: FULL_BLAST.ref.id }),
    );
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("an attack made inside a branch of the ability still names it", () => {
    const { state, cards } = start();
    const { session } = driveSession(startSession(state), deps, [use(cards.brancher, BRANCH.ref.id)]);
    expect(villainDamage(session.state)).toBe(7);
  });

  it("never matches a basic attack", () => {
    const { state } = start();
    const identity = mustPlayer(state, P1).identity.instanceId;
    const { session } = driveSession(startSession(state), deps, [
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: state.villains[0]!.instanceId,
      },
    ]);
    expect(villainDamage(session.state)).toBeLessThan(7);
    expect(villainDamage(session.state)).toBeGreaterThan(0);
  });
});
