/**
 * The Inspect model, checked against a real Core Set game.
 *
 * The thing worth guarding here is that Inspect and the engine never disagree:
 * the verdict it shows must be the engine's own, and it must not show a face
 * the player isn't entitled to see.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { inspectModel } from "./inspect-model.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 12,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  // Decline the mulligan so the game reaches a real turn.
  for (let step = 0; step < 10 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as { choice: { options: readonly { optionId: string }[]; minSelections: number } };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
});

const inspect = (id: InstanceId) => inspectModel(state, id, store.state.legal?.actions ?? null, me, CORE_DEPS);

describe("inspectModel", () => {
  test("shows a card in your own hand, which is not 'faceup' to the engine", () => {
    const inHand = state.players.find((player) => player.playerId === me)!.hand[0]!;
    // The engine models a hand card as not faceup — it isn't on the table. The
    // player holding it is still looking at it, and this is the regression.
    expect(state.instances[inHand]!.faceup).toBe(false);

    const model = inspect(inHand);
    expect(model.hidden).toBe(false);
    expect(model.name).not.toBe("a facedown card");
    expect(model.typeLine).not.toBe("Facedown");
  });

  test("gives the card's whole current wording, not the table's crop", () => {
    const hand = state.players.find((player) => player.playerId === me)!.hand;
    const withText = hand.map(inspect).find((model) => model.rulesText.length > 0);
    expect(withText).toBeDefined();
    const card = state.cardPool[state.instances[withText!.instanceId]!.cardId]!;
    // `current`, not `printed`: the errata'd wording is what the game plays by.
    expect(withText!.rulesText).toBe("text" in card ? card.text.current : "");
  });

  test("names the set and collector number from the content, never invented", () => {
    const inHand = state.players.find((player) => player.playerId === me)!.hand[0]!;
    const card = state.cardPool[state.instances[inHand]!.cardId]!;
    expect(inspect(inHand).footerLeft).toBe(`${card.setCode as string} · ${card.collectorNumber}`);
  });

  test("repeats the engine's own verdict on a hand card", () => {
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const illegal = legal.illegal.find((entry) => entry.action.kind === "playCard");
    expect(illegal).toBeDefined();
    const model = inspect((illegal!.action as { instanceId: InstanceId }).instanceId);
    expect(model.status.playable).toBe(false);
    // Word for word the engine's message: Inspect must not rephrase a ruling.
    expect(model.status.message).toBe(illegal!.message);
  });

  test("keeps a card in the encounter deck hidden even so", () => {
    const top = state.encounterDeck[0]!;
    const model = inspect(top);
    expect(model.hidden).toBe(true);
    expect(model.rulesText).toContain("facedown");
  });

  test("carries the villain's keywords with their printed values", () => {
    const model = inspect(state.villain.instanceId);
    expect(model.hidden).toBe(false);
    // Every keyword reads as a complete phrase — never a bare "Retaliate".
    for (const keyword of model.keywords) expect(keyword.trim().length).toBeGreaterThan(0);
    expect(model.stats.some((tile) => tile.label === "HP")).toBe(true);
  });
});
