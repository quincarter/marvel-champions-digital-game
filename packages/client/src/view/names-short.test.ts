import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { playerName, shortFaceUpName, shortSeatName } from "./names.js";

async function table(decks: readonly string[]) {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: decks.map((starterDeckId) => ({ starterDeckId })),
    seed: 7,
  });
  return store.state.game!;
}

describe("short seat names", () => {
  test("a shared hero name loses its qualifier in a headline when nobody else at the table shares it", async () => {
    const game = await table(["core-spider-man-justice", "core-she-hulk-aggression"]);
    const [spider, shehulk] = game.players;
    expect(playerName(game, spider!.playerId)).toBe("Spider-Man (Peter Parker)");
    expect(shortSeatName(game, spider!.playerId, null)).toBe("Spider-Man");
    expect(shortSeatName(game, shehulk!.playerId, null)).toBe("She-Hulk");
    expect(shortSeatName(game, spider!.playerId, spider!.playerId)).toBe("You");
  });

  test("an identity's hero side is short; its alter-ego side keeps its own name", async () => {
    const game = await table(["core-spider-man-justice"]);
    const name = shortFaceUpName(game, game.players[0]!.identity.instanceId);
    expect(["Spider-Man", "Peter Parker"]).toContain(name);
  });
});
