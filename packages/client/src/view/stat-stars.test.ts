/** The printed star beside a stat, on the face that is up (issue #766). */

import { describe, expect, test } from "vitest";
import { villainStageOf } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { statStarsOf } from "./stat-stars.js";

async function klawGame() {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "klaw",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  return store;
}

describe("statStarsOf (#766)", () => {
  test("Klaw's stage prints a star beside ATK, and the board's ATK tile carries it", async () => {
    const store = await klawGame();
    const state = store.state.game!;
    const klaw = state.villains[0]!.instanceId;
    expect(villainStageOf(state, klaw).statStars).toContain("atk");
    expect(statStarsOf(state, klaw)).toContain("atk");
    const panel = boardModel(state, store.state.perspectiveId!, POOL_DEPS).villain!;
    expect(panel.stats.find((tile) => tile.label === "ATK")?.star).toBe(true);
    expect(panel.stats.find((tile) => tile.label === "SCH")?.star).toBeUndefined();
  });

  test("a facedown card shows no stars", async () => {
    const store = await klawGame();
    const state = store.state.game!;
    const klaw = state.villains[0]!.instanceId;
    const facedown = {
      ...state,
      instances: { ...state.instances, [klaw]: { ...state.instances[klaw]!, faceup: false } },
    };
    expect(statStarsOf(facedown, klaw)).toEqual([]);
  });
});
