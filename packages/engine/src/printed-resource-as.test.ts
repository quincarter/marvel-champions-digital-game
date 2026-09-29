/**
 * docs/phase7-wave5.md §3.20: treating printed resources as another type. Synthetic cards shaped like Haywire
 * (`ironheart` 29038: "Treat the printed resource of each card in your hand as if it were [energy]"), Zzzap! (29040:
 * "Take indirect damage equal to the total number of [energy] resources in your hand") and a card that may be paid for
 * only with [energy] resources.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const HAYWIRE_DEFINITION: AbilityDefinition = {
  trigger: { kind: "constant", rules: [{ kind: "printedResourceAs", player: { kind: "controller" }, as: "energy" }] },
  effects: [],
};
const HAYWIRE_CONSTANT = stubAbility("haywire.constant", HAYWIRE_DEFINITION);
const HAYWIRE = stubSupport({ id: "haywire", cost: 0, abilities: [HAYWIRE_CONSTANT.ref] });
const MUSCLE = stubResource({ id: "muscle", icons: 0, produces: { physical: 1 } });

const ZZZAP_ACTION = stubAbility("zzzap.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "selectCards", slot: "hand", cards: { kind: "zone", zone: "hand", player: { kind: "controller" } } },
    {
      kind: "dealDamage",
      target: { kind: "villain" },
      amount: { kind: "totalPrintedResources", cards: { kind: "slot", slot: "hand" }, types: ["energy"] },
    },
  ],
});
const ZZZAP = stubEvent({ id: "zzzap", cost: 0, abilities: [ZZZAP_ACTION.ref] });
const ENERGY_ONLY_CONSTANT = stubAbility("energy-only.constant", {
  trigger: { kind: "constant", paymentOnly: ["energy"] },
  effects: [],
});
const NOTHING = stubAbility("energy-only.action", { trigger: { kind: "action" }, effects: [] });
const ENERGY_ONLY = stubEvent({ id: "energy-only", cost: 1, abilities: [ENERGY_ONLY_CONSTANT.ref, NOTHING.ref] });

const deps: EngineDeps = depsOf(HAYWIRE_CONSTANT, ZZZAP_ACTION, ENERGY_ONLY_CONSTANT, NOTHING);

function start(haywire: boolean): GameState {
  const state = gameAtFirstTurn({
    cards: [HAYWIRE, MUSCLE, ZZZAP, ENERGY_ONLY],
    deps,
    deck: [HAYWIRE.id, ...copiesOf(MUSCLE.id, 3), ZZZAP.id, ENERGY_ONLY.id],
  });
  // Test surgery: a hand of exactly the cards under test.
  const cleared = { ...state, players: state.players.map((p) => ({ ...p, hand: [] as InstanceId[] })) };
  return haywire ? playerCardIntoPlay(cleared, HAYWIRE.id).state : cleared;
}

const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;
const playWith = (state: GameState, card: string, payment: readonly InstanceId[]) => {
  const played = giveCard(state, P1, card as never);
  return {
    played,
    command: {
      type: "playCard" as const,
      playerId: P1,
      cardInstanceId: played.id,
      payment: payment.map((id) => ({ fromHand: id })),
      attachToInstanceId: null,
    },
  };
};

describe("§3.20 'Treat the printed resource of each card in your hand as if it were [energy]'", () => {
  it("a [physical] card in hand counts as [energy] for a count of energy resources in hand; replay deep-equal", () => {
    const withMuscle = giveCard(start(true), P1, MUSCLE.id).state;
    const { played, command } = playWith(withMuscle, ZZZAP.id, []);
    const { session } = driveSession(startSession(played.state), deps, [command]);
    expect(villainDamage(session.state)).toBe(villainDamage(withMuscle) + 1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);

    const plain = giveCard(start(false), P1, MUSCLE.id).state;
    const noHaywire = playWith(plain, ZZZAP.id, []);
    const after = driveSession(startSession(noHaywire.played.state), deps, [noHaywire.command]).session.state;
    expect(villainDamage(after)).toBe(villainDamage(plain));
  });

  it("and pays as [energy] for a card that takes only [energy]", () => {
    const withHaywire = giveCard(start(true), P1, MUSCLE.id);
    const paid = playWith(withHaywire.state, ENERGY_ONLY.id, [withHaywire.id]);
    const result = applyCommand(paid.played.state, paid.command, deps);
    expect(result.ok).toBe(true);
    if (result.ok) expect(mustPlayer(result.state, P1).discard).toContain(withHaywire.id);

    const plain = giveCard(start(false), P1, MUSCLE.id);
    const refused = playWith(plain.state, ENERGY_ONLY.id, [plain.id]);
    expect(applyCommand(refused.played.state, refused.command, deps).ok).toBe(false);
  });
});
