/** What removing an encounter attachment costs, on its chip (issue #767). */

import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
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
  const card = POOL_CARDS.find((candidate) => candidate.id === cardId(code))!;
  const state: GameState = {
    ...game,
    cardPool: { ...game.cardPool, [card.id]: card },
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
    expect(cost).toEqual({ phrase: "spend 1 energy, 1 mental, 1 physical", free: false, heroOnly: true });
    expect(removalCostText(cost)).toBe("remove: spend 1 energy, 1 mental, 1 physical");
  });

  test("Vibranium Armor: exhaust your hero and spend 2 physical, shown on Klaw's chip", async () => {
    const { state, id, viewer } = await withAttachment("01152");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(removalCostText(cost)).toBe("remove: exhaust your identity, spend 2 physical");
    const chip = boardModel(state, viewer, POOL_DEPS).villain!.attachments.find((a) => a.instanceId === id)!;
    expect(chip.removalCost).toEqual(cost);
  });

  test("Crown of the Enchantress: every player exhausts and takes 1 damage, never 'free'", async () => {
    const { state, id } = await withAttachment("55016");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(cost.free).toBe(false);
    expect(removalCostText(cost)).toBe("remove: each player exhausts, takes 1 damage");
  });

  test("Haywire: removed by moving itself to the discard pile, its either-or cost said in full", async () => {
    const { state, id } = await withAttachment("29038");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(removalCostText(cost)).toBe(
      "remove: discard 1 card or discard a card you control or take 2 indirect damage",
    );
  });

  test("Armored Rhino Suit, with no such ability, has no removal cost", async () => {
    const { state, id } = await withAttachment("01098");
    expect(removalCostOf(state, POOL_DEPS, id)).toBeNull();
  });
});
