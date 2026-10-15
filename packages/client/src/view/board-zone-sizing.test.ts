import { describe, expect, test } from "vitest";
import { boardLayout } from "./layout.js";
import { schemeListLayout } from "./scheme-list-layout.js";
import { areaLabelOf } from "./board-model.js";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";

describe("the hand on a very tall or wide screen", () => {
  test("1440x900 keeps its usual hand (24% of the height, under the 220 cap)", () => {
    const layout = boardLayout({ x: 0, y: 0, width: 1440, height: 900 }, { playerCount: 2 });
    expect(layout.zones.hand!.height).toBe(216);
  });

  test("an ultrawide 3440x1440 hand grows past 220 so its cards are not thumbnails beside the play area's", () => {
    const layout = boardLayout({ x: 0, y: 0, width: 3440, height: 1440 }, { playerCount: 3 });
    const hand = layout.zones.hand!;
    expect(hand.height).toBeGreaterThanOrEqual(300);
    // The hand's cards fill its height less a caption; the play area's card is its band less padding.
    expect(hand.height - 34).toBeGreaterThanOrEqual(layout.zones.playArea!.height * 0.6);
  });
});

describe("the schemes column on a tall panel", () => {
  test("the 1440x900 panel's rows are unchanged", () => {
    const list = schemeListLayout({ x: 0, y: 0, width: 420, height: 400 }, { mains: 1, sides: 0, tabbed: false });
    expect(list.rows[0]!.rect.height).toBe(150);
  });

  test("an ultrawide's tall panel lets the main scheme row grow past 150", () => {
    const list = schemeListLayout({ x: 0, y: 0, width: 1000, height: 490 }, { mains: 1, sides: 0, tabbed: false });
    expect(list.rows[0]!.rect.height).toBeGreaterThan(150);
    expect(list.rows[0]!.rect.height).toBeLessThanOrEqual(240);
  });
});

describe("areaLabelOf", () => {
  test("names the players of the game area a villain or scheme is in, and nothing outside one", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "kang",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
      seed: 3,
    });
    const state: GameState = store.state.game!;
    const [first, second] = state.players.map((player) => player.playerId as PlayerId);
    const kang = state.villains[0]!.instanceId;
    const stage = state.mainScheme.instanceId;
    expect(areaLabelOf(state, kang)).toBeNull();
    const withAreas: GameState = {
      ...state,
      gameAreas: [
        {
          areaId: "a0" as GameState["gameAreas"][number]["areaId"],
          playerIds: [first!],
          mainScheme: null,
          villainIds: [kang],
          activeVillainId: kang,
          sideSchemeIds: [],
          formerSchemeIds: [],
        },
        {
          areaId: "a1" as GameState["gameAreas"][number]["areaId"],
          playerIds: [second!],
          mainScheme: { ...state.mainScheme, instanceId: "area-stage" as InstanceId },
          villainIds: [],
          activeVillainId: null,
          sideSchemeIds: [],
          formerSchemeIds: [],
        },
      ],
    };
    expect(areaLabelOf(withAreas, kang)).toBe("vs Spider-Man");
    expect(areaLabelOf(withAreas, "area-stage" as InstanceId)).toBe("vs She-Hulk");
    expect(areaLabelOf(withAreas, stage)).toBeNull();
  });
});
