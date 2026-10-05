/** A keyword a card does not print but has (Storm's Hurricane: "each character gains retaliate 1") is on the panel. */
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { characterPanel } from "./board-model.js";

describe("granted keywords on the board panel", () => {
  test("with Hurricane in play every character shows 'retaliate 1'; a printed keyword is not repeated", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "sabretooth",
      difficulty: "standard",
      players: [{ starterDeckId: "storm-leadership" }],
      seed: 1,
    });
    for (let guard = 0; guard < 12 && store.state.legal?.actions.kind === "choice"; guard++) {
      const { choice } = store.state.legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
    }
    const game = store.state.game!;
    const inPlay = game.players[0]!.playArea.map((id) => game.cardPool[game.instances[id]!.cardId]?.name);
    expect(inPlay, "Hurricane starts in play").toContain("Hurricane");
    const mine = characterPanel(game, game.players[0]!.identity.instanceId, POOL_DEPS);
    expect(mine.grantedKeywords).toContain("retaliate 1");
    const villain = characterPanel(game, game.villains[0]!.instanceId, POOL_DEPS);
    expect(villain.grantedKeywords.filter((text) => text === "retaliate 1").length).toBeLessThanOrEqual(1);
  });
});
