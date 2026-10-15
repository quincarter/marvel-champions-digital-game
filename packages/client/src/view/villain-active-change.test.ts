import { describe, expect, test } from "vitest";
import type { InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { activeVillainWording } from "./villain-active-change.js";
import type { ActiveVillainChange } from "./villain-walkthrough.js";

async function breakout() {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "breakout",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    seed: 7,
  });
  return store.state.game!;
}

describe("activeVillainWording", () => {
  test("names the new active villain and the card that moved the counter", async () => {
    const game = await breakout();
    const [first, second] = game.villains.map((v) => v.instanceId) as [InstanceId, InstanceId];
    const change: ActiveVillainChange = { from: first, to: second, reason: "effect", via: first };
    const wording = activeVillainWording(change, game);
    expect(wording.headline).toMatch(/^Active villain → .+/);
    expect(wording.line).toBe(`${wording.headline} (${wording.cause})`);
  });

  test("with no card to name, says why the counter moved", async () => {
    const game = await breakout();
    const [first, second] = game.villains.map((v) => v.instanceId) as [InstanceId, InstanceId];
    const row = activeVillainWording({ from: first, to: second, reason: "nextInRow", via: null }, game);
    expect(row.cause).toBe("moves along the row");
    expect(row.detail).toBe("Moves along the row.");
    const bare = activeVillainWording({ from: first, to: second, reason: "effect", via: null }, game);
    expect(bare.line).toBe(bare.headline);
  });
});
