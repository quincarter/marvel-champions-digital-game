import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { cardInspectModel, inspectModel } from "./inspect-model.js";

describe("Inspect's Team-Up notice", () => {
  test("a sheet with no game shows only the neutral rule line, and only for a Team-Up card", () => {
    const beauty = POOL_CARDS.find((card) => (card.id as string) === "37019");
    const rogue = POOL_CARDS.find((card) => (card.id as string) === "37002");
    expect(cardInspectModel(beauty, { kind: "front" }).teamUpNotice?.text).toBe(
      "Team-Up: needs Gambit and Rogue both in play.",
    );
    expect(cardInspectModel(rogue, { kind: "front" }).teamUpNotice).toBeNull();
  });

  test("a card in a live game carries the notice for its pair's state", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "gambit-justice" }, { starterDeckId: "rogue-protection" }],
      seed: 5,
    });
    const game = store.state.game!;
    const viewer = store.state.perspectiveId!;
    const id = Object.values(game.instances).find((i) => i.cardId === "37019")!.instanceId;
    const model = inspectModel(game, id, store.state.legal?.actions ?? null, viewer, POOL_DEPS);
    // Both seats start in alter-ego form: both characters are present, neither is showing its hero side yet.
    expect(model.teamUpNotice?.kind).toBe("needs");
    expect(model.teamUpNotice?.text).toBe("Team-Up: needs Gambit and Rogue in hero form.");
  });
});
