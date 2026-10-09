/**
 * The enemy attack result `totalAtk` (`TOTAL_ATK_RESULT`; docs/phase7-wave8.md §3.81): "his total ATK for that attack".
 * Synthetic villain shaped like "Forced Response: After this enemy attacks you, place counters on it equal to its total
 * ATK for that attack."
 *
 * Sources: RRG 1.8 "Attack (Enemy Activation)" (p. 9): step 3 turns the boost cards faceup and adds their icons to the
 * ATK, step 4 subtracts a defending hero's DEF from the damage, not from the ATK; "Stunned" (p. 41): a stunned enemy's
 * attack is not made.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const self = { kind: "self" } as const;
// "Forced Response: After this enemy attacks you, place counters here equal to its total ATK for that attack."
const TALLY = stubAbility("tyrant.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "enemyAttack", selfIs: "source", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [
    { kind: "addCounters", target: self, counterType: "atk", amount: { kind: "eventResult", key: "totalAtk" } },
    { kind: "addCounters", target: self, counterType: "dealt", amount: { kind: "eventResult", key: "damage" } },
  ],
});
// "Forced Interrupt: When this enemy attacks, it gets +2 ATK for this attack."
const RAGE = stubAbility("tyrant.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [{ kind: "modifyAttack", atkBonus: { kind: "const", value: 2 } }],
});
const tyrant = (...abilities: readonly StubAbility[]) =>
  stubVillain({
    id: "tyrant",
    stages: [{ hp: flat(30), atk: 2, sch: 1, abilities: abilities.map((a) => a.ref) }],
  });
// Three boost icons each.
const SPIKE = stubTreachery({ id: "spike", boostIcons: 3 });

function villainPhase(abilities: readonly StubAbility[], opts: { defend?: boolean; stunned?: boolean } = {}) {
  const deps: EngineDeps = depsOf(...abilities);
  let state: GameState = gameAtFirstTurn({
    cards: [SPIKE],
    deps,
    villain: tyrant(...abilities),
    encounter: copiesOf(SPIKE.id, 30),
  });
  const villain = state.villains[0]!.instanceId;
  if (opts.stunned) {
    state = {
      ...state,
      instances: {
        ...state.instances,
        [villain]: { ...mustInstance(state, villain), statuses: { stunned: 1, confused: 0, tough: 0 } },
      },
    };
  }
  const hero = mustPlayer(state, P1).identity.instanceId;
  // An enemy attacks a hero and schemes against an alter-ego (RRG 1.8 "Villain Phase", p. 47): hero form (surgery).
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 } })),
  };
  const pick = (current: GameState): readonly string[] =>
    current.pendingChoice?.prompt.kind === "declareDefender" && opts.defend ? [hero] : defaultPick(current);
  const after = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick).session.state;
  return { counters: mustInstance(after, villain).counters, damage: mustInstance(after, hero).damage };
}

describe("an enemy attack reports its total ATK for that attack", () => {
  it("undefended: ATK 2 plus 3 boost icons is 5, and 5 damage is dealt", () => {
    const run = villainPhase([TALLY]);
    expect(run.counters).toMatchObject({ atk: 5, dealt: 5 });
    expect(run.damage).toBe(5);
  });

  it("defended by the hero (DEF 2): the total ATK is still 5, the damage dealt is 3", () => {
    const run = villainPhase([TALLY], { defend: true });
    expect(run.counters).toMatchObject({ atk: 5, dealt: 3 });
    expect(run.damage).toBe(3);
  });

  it("'+2 ATK for this attack' is part of it: 2 + 2 + 3 = 7", () => {
    const run = villainPhase([TALLY, RAGE], { defend: true });
    expect(run.counters).toMatchObject({ atk: 7, dealt: 5 });
  });

  it("a stunned enemy makes no attack: nothing is answered", () => {
    const run = villainPhase([TALLY], { stunned: true });
    expect(run.counters.atk ?? 0).toBe(0);
    expect(run.damage).toBe(0);
  });
});
