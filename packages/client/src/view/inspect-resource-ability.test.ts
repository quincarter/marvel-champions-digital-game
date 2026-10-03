/**
 * A card in play with a resource ability the player can use while paying says so in Inspect's RULES & STATE (owner,
 * 2026-10-03: "the inspect panel should show that the player can use it as a resource"). Titanium Muscles
 * (`mut_gen` 32005) is the case: "Hero Resource: Exhaust this card -> generate a [physical] resource for each tough
 * status card on Colossus". The sentence is built from the registry's ability definition, so the amount is the live one.
 */
import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { MECHANIC_TRYIT_CONFIGS } from "../guide/mechanic-tryit-config.js";
import { SessionStore } from "../store/session-store.js";
import { inspectModel, type InspectPayment } from "./inspect-model.js";

async function colossusWithMuscles(): Promise<{ store: SessionStore; muscles: InstanceId }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(MECHANIC_TRYIT_CONFIGS.colossus.config);
  const game = (): GameState => store.state.game!;
  const answer = async (pick: (labels: string[]) => number): Promise<void> => {
    for (let c = game().pendingChoice; c; c = game().pendingChoice) {
      const index = pick(c.options.map((o) => o.label));
      const ids =
        c.prompt.kind === "chooseTriggers"
          ? c.options.map((o) => o.optionId)
          : c.minSelections > 0
            ? [c.options[index]!.optionId]
            : [];
      expect(await store.resolveChoice(ids)).toBe(true);
    }
  };
  await answer(() => 0);
  const me = () => game().players[0]!;
  const handId = (code: string) => me().hand.find((id) => game().instances[id]!.cardId === code)!;
  const play = async (code: string, payment: { fromHand: InstanceId }[]) =>
    expect(
      await store.dispatch({
        type: "playCard",
        playerId: me().playerId,
        cardInstanceId: handId(code),
        payment,
        attachToInstanceId: null,
      }),
    ).toBe(true);
  await store.dispatch({ type: "changeForm", playerId: me().playerId });
  await answer(() => 0);
  await play("32009", []);
  await answer((labels) => labels.findIndex((l) => /2 tough/.test(l)));
  await play("32005", [{ fromHand: handId("32022") }, { fromHand: handId("32023") }]);
  await answer(() => 0);
  const muscles = Object.values(game().instances).find((i) => i.cardId === "32005")!.instanceId;
  return { store, muscles };
}

describe("Inspect on a card in play with a resource ability", () => {
  test("says it can be used as a resource, and what it generates right now", async () => {
    const { store, muscles } = await colossusWithMuscles();
    const state = store.state.game!;
    const model = inspectModel(state, muscles, null, state.players[0]!.playerId, POOL_DEPS);
    expect(model.resourceNote).toContain("Can be used as a resource in hero form while you pay for a card");
    expect(model.resourceNote).toContain("exhaust it to generate");
    expect(model.resourceNote).toContain("2 physical right now (the amount follows the table)");
    expect(model.resourceNote).not.toContain("Available right now");
  });

  test("says it is available right now while a payment is open that could spend it", async () => {
    const { store, muscles } = await colossusWithMuscles();
    const state = store.state.game!;
    const payment: InspectPayment = {
      subjectInstanceId: null,
      paid: 0,
      required: 2,
      spendableInstanceIds: new Set([muscles]),
    };
    const model = inspectModel(state, muscles, null, state.players[0]!.playerId, POOL_DEPS, { payment });
    expect(model.resourceNote).toContain("Available right now: tap it in the payment row.");
    expect(model.canPayAsResource).toBe(true);
  });

  test("is silent on a card with no resource ability (the villain)", async () => {
    const { store } = await colossusWithMuscles();
    const state = store.state.game!;
    const villain = state.villains[0]!.instanceId;
    expect(inspectModel(state, villain, null, state.players[0]!.playerId, POOL_DEPS).resourceNote).toBeNull();
  });

  test("notes an exhausted resource ability instead of calling it available", async () => {
    const { store, muscles } = await colossusWithMuscles();
    const state = store.state.game!;
    const tired = {
      ...state,
      instances: { ...state.instances, [muscles]: { ...state.instances[muscles]!, exhausted: true } },
    };
    const model = inspectModel(tired, muscles, null, state.players[0]!.playerId, POOL_DEPS);
    expect(model.resourceNote).toContain("exhausted right now");
  });
});
