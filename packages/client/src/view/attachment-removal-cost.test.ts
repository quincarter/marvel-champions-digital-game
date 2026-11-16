/** What removing an encounter attachment costs, on its chip (issue #767). */

import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { removalCostOf, removalCostText } from "./attachment-removal-cost.js";

/** A Klaw game with `code` attached to Klaw, standing in on a copy of the main scheme's instance. */
async function withAttachment(code: string) {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "klaw",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  const game = store.state.game!;
  const klaw = game.villains[0]!.instanceId;
  const id = "test-attachment" as InstanceId;
  const base = game.instances[game.mainScheme.instanceId]!;
  const state: GameState = {
    ...game,
    instances: {
      ...game.instances,
      [id]: {
        ...base,
        instanceId: id,
        cardId: cardId(code),
        threat: 0,
        faceup: true,
        attachments: [],
        attachedTo: klaw,
      },
      [klaw]: { ...game.instances[klaw]!, attachments: [...game.instances[klaw]!.attachments, id] },
    },
  };
  return { state, id, viewer: store.state.perspectiveId! };
}

describe("removalCostOf (#767)", () => {
  test("Solid-Sound Body: spend energy, mental and physical", async () => {
    const { state, id } = await withAttachment("01119");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(cost).toMatchObject({ exhaustHero: false, heroOnly: true });
    expect([...cost.resources].sort()).toEqual(["energy", "mental", "physical"]);
    expect(removalCostText(cost)).toBe("remove: physical, mental, energy");
  });

  test("Vibranium Armor: exhaust your hero and spend 2 physical, shown on Klaw's chip", async () => {
    const { state, id, viewer } = await withAttachment("01152");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(cost).toEqual({ resources: ["physical", "physical"], exhaustHero: true, heroOnly: true });
    expect(removalCostText(cost)).toBe("remove: 2 physical, exhaust hero");
    const chip = boardModel(state, viewer, POOL_DEPS).villain!.attachments.find((a) => a.instanceId === id)!;
    expect(chip.removalCost).toEqual(cost);
  });

  test("Armored Rhino Suit, with no such ability, has no removal cost", async () => {
    const { state, id } = await withAttachment("01098");
    expect(removalCostOf(state, POOL_DEPS, id)).toBeNull();
  });
});
