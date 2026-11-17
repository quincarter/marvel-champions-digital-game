/** What removing an encounter attachment costs, on its chip (issue #767). */

import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { attachmentChipText, boardModel } from "./board-model.js";
import { inspectModel } from "./inspect-model.js";
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
    expect(cost).toEqual({ phrase: "spend 1 energy, 1 mental, 1 physical", free: false, heroOnly: true, icons: "pme" });
    expect(removalCostText(cost)).toBe("remove: spend 1 energy, 1 mental, 1 physical");
  });

  test("Vibranium Armor: exhaust your hero and spend 2 physical, shown on Klaw's chip", async () => {
    const { state, id, viewer } = await withAttachment("01152");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(removalCostText(cost)).toBe("remove: exhaust your identity, spend 2 physical");
    expect(cost.icons).toBe("ppg");
    const chip = boardModel(state, viewer, POOL_DEPS).villain!.attachments.find((a) => a.instanceId === id)!;
    expect(chip.removalCost).toEqual(cost);
  });

  test("Crown of the Enchantress: every player exhausts and takes 1 damage, never 'free'", async () => {
    const { state, id } = await withAttachment("55016");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(cost.free).toBe(false);
    expect(removalCostText(cost)).toBe("remove: each player exhausts, takes 1 damage");
    expect(cost.icons).toBeUndefined();
  });

  test("Haywire: its moveCards removal is recognised, and its energy-only discard is never worded as any card", async () => {
    const { state, id } = await withAttachment("29038");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    // "Discard a card you control with a printed [energy] resource or take 2 indirect damage": no words here for the
    // energy-only discard, so the chip points at the card instead of offering an unrestricted one.
    expect(removalCostText(cost)).toBe("remove: see card");
  });

  test("Love Triangle: exhausting the attached ally has no words here, so the chip says see card, not just the mental", async () => {
    const { state, id } = await withAttachment("55062");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(cost.heroOnly).toBe(false);
    expect(removalCostText(cost)).toBe("remove: see card");
  });

  test("Armored Rhino Suit, with no such ability, has no removal cost", async () => {
    const { state, id } = await withAttachment("01098");
    expect(removalCostOf(state, POOL_DEPS, id)).toBeNull();
  });

  test('an owed attachment\'s "must use" comes before its removal cost, so a narrow chip clips the cost first', async () => {
    const { state, id, viewer } = await withAttachment("01152");
    const chip = boardModel(state, viewer, POOL_DEPS).villain!.attachments.find((a) => a.instanceId === id)!;
    const text = attachmentChipText(chip, " · must use");
    expect(text.indexOf("must use")).toBeLessThan(text.indexOf("remove:"));
    expect(text.endsWith("remove: exhaust your identity, spend 2 physical")).toBe(true);
    // With the icons drawn beside it, the chip's words say only "remove".
    const withIcons = attachmentChipText(chip, " · must use", true);
    expect(withIcons.endsWith("must use · remove")).toBe(true);
  });

  test("Psychic Inertia: a removal with a prerequisite (attacked and thwarted this phase) reads see card, never free", async () => {
    const { state, id } = await withAttachment("40173");
    const cost = removalCostOf(state, POOL_DEPS, id)!;
    expect(cost.conditional).toBe(true);
    expect(removalCostText(cost)).toBe("remove: see card");
  });

  test("Inspect states the cost in words beside the chip's icons", async () => {
    const { state, id, viewer } = await withAttachment("01152");
    const model = inspectModel(state, id, null, viewer, POOL_DEPS);
    expect(model.areaNotes).toContain("To remove: exhaust your identity, spend 2 physical");
  });
});
