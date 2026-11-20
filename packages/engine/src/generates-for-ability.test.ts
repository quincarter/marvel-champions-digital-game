/**
 * `AbilityDefinition.generatesForAbility` (#890 item 3), on a synthetic support shaped like With Great Firepower (the
 * `spider-punisher-tw` community pack): "Resource: … generate a [wild] resource for an upgrade ability". The resource
 * pays an upgrade's ability cost (an ability's payment is for its own card, docs/phase7-wave6.md §3.30), and never the
 * cost to play an upgrade, nor another card's ability.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const FIREPOWER_RESOURCE = stubAbility("firepower.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  generatesFor: { categories: ["upgrade"] },
  generatesForAbility: true,
  effects: [],
} satisfies AbilityDefinition);
const FIREPOWER = stubSupport({ id: "firepower", cost: 0, abilities: [FIREPOWER_RESOURCE.ref] });
/** An upgrade with "Action: Spend 1 resource → place 1 counter here." */
const GUN_ACTION = stubAbility("gun.action", {
  trigger: { kind: "action" },
  cost: { resources: 1 },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "shot", amount: { kind: "const", value: 1 } },
  ],
} satisfies AbilityDefinition);
const GUN = stubUpgrade({ id: "gun", cost: 1, abilities: [GUN_ACTION.ref] });
/** A support with the same Action: not an upgrade, so the resource does not pay it. */
const RADIO_ACTION = stubAbility("radio.action", {
  trigger: { kind: "action" },
  cost: { resources: 1 },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "call", amount: { kind: "const", value: 1 } },
  ],
} satisfies AbilityDefinition);
const RADIO = stubSupport({ id: "radio", cost: 0, abilities: [RADIO_ACTION.ref] });

const deps: EngineDeps = depsOf(FIREPOWER_RESOURCE, GUN_ACTION, RADIO_ACTION);

function start(): { state: GameState; firepower: InstanceId; gun: InstanceId; radio: InstanceId; spare: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [FIREPOWER, GUN, RADIO],
    deps,
    deck: [FIREPOWER.id, GUN.id, GUN.id, RADIO.id],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const firepower = playerCardIntoPlay(hero, FIREPOWER.id, P1);
  const gun = playerCardIntoPlay(firepower.state, GUN.id, P1);
  const radio = playerCardIntoPlay(gun.state, RADIO.id, P1);
  const spare = giveCard(radio.state, P1, GUN.id);
  return { state: spare.state, firepower: firepower.id, gun: gun.id, radio: radio.id, spare: spare.id };
}

const firepowerPays = (firepower: InstanceId) => [
  { ability: { instanceId: firepower, abilityId: FIREPOWER_RESOURCE.ref.id } },
];

describe("generatesForAbility: a resource for an upgrade ability (#890 item 3)", () => {
  it("pays an upgrade's ability cost", () => {
    const s = start();
    const command: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: s.gun,
      abilityId: GUN_ACTION.ref.id,
      payment: firepowerPays(s.firepower),
    };
    const result = applyCommand(s.state, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    expect(mustInstance(result.state, s.gun).counters.shot).toBe(1);
    expect(mustInstance(result.state, s.firepower).exhausted).toBe(true);
  });

  it("does not pay to play an upgrade", () => {
    const s = start();
    const result = applyCommand(
      s.state,
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: s.spare,
        payment: firepowerPays(s.firepower),
        attachToInstanceId: null,
      },
      deps,
    );
    expect(result.ok ? "" : result.error.message).toMatch(/only generates resources for a certain kind of card/);
  });

  it("does not pay another kind of card's ability", () => {
    const s = start();
    const result = applyCommand(
      s.state,
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: s.radio,
        abilityId: RADIO_ACTION.ref.id,
        payment: firepowerPays(s.firepower),
      },
      deps,
    );
    expect(result.ok ? "" : result.error.message).toMatch(/only generates resources for a certain kind of card/);
  });
});
