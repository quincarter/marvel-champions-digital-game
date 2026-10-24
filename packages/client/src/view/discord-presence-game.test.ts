import { describe, expect, test } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { SessionStore } from "../store/session-store.js";
import { screenOf } from "./discord-presence-screen.js";
import { campaignNameOf } from "./discord-campaign-name.js";
import { difficultyLabelOf, presenceGameOf } from "./discord-presence-game.js";
import { presenceOf } from "./discord-presence.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "expert",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

describe("presenceGameOf", () => {
  test("reads a real Rhino game", async () => {
    const store = new SessionStore(new LocalEngineHost(new MemoryGameStorage()));
    await store.start(CONFIG);
    const game = presenceGameOf(store.state.game!, store.state.config);
    expect(game).toMatchObject({ kind: "oneOff", villain: "Rhino", difficulty: "Expert" });
    expect(game.heroes).toHaveLength(1);
    // Expert starts Rhino on stage II; the identity shows its hero face.
    expect(game.villainArt).toBe("/card-art/bundles/cards/01095.png");
    expect(game.heroArt).toBe("/card-art/bundles/cards/01001b.png");
    const activity = presenceOf({ screen: "game", startedAt: 1, game });
    expect(activity?.details).toMatch(/^One-off game · .+ vs Rhino$/);
    expect(activity?.state).toMatch(/^(Setting up the table|Round \d+) · .*Expert$/);
  });
});

describe("labels", () => {
  test("difficulty", () => {
    expect(difficultyLabelOf(null)).toBeNull();
    expect(difficultyLabelOf({ ...CONFIG, difficulty: "standard" })).toBe("Standard");
    expect(difficultyLabelOf({ ...CONFIG, difficulty: "standard", modes: { heroic: 2 } })).toBe("Heroic 2");
    expect(difficultyLabelOf({ ...CONFIG, modes: { expert: true, heroic: 1 } })).toBe("Expert Heroic 1");
  });
  test("campaign names", () => {
    expect(campaignNameOf("mts")).toBe("The Mad Titan's Shadow");
    expect(campaignNameOf("nope")).toBeNull();
  });
  test("screens", () => {
    expect(screenOf(["Title"])).toBe("menus");
    expect(screenOf(["Board", "Pause"])).toBe("game");
    expect(screenOf(["GameOver"])).toBe("gameOver");
    expect(screenOf(["CampaignRun"])).toBe("campaign");
    expect(screenOf(["DeckBuilder"])).toBe("deck");
    expect(screenOf(["Seats"])).toBe("setup");
  });
});
