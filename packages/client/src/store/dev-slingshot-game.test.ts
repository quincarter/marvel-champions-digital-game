import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf } from "./dev-game-steps.js";
import { ENERGY_CARD, SLINGSHOT_ACTION, SLINGSHOT_CARD, startSlingshotDevGame } from "./dev-slingshot-game.js";
import { SessionStore } from "./session-store.js";

describe("the Slingshot dev game", () => {
  test("stops on a turn with Slingshot and Energy in hand, both her play and her Action listed", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startSlingshotDevGame(store);
    const game = store.state.game!;
    const codes = game.players[0]!.hand.map((id) => codeOf(game, id));
    expect(codes).toEqual(expect.arrayContaining([SLINGSHOT_CARD, ENERGY_CARD]));
    const actions = store.state.legal?.actions;
    const legal = actions?.kind === "turn" ? actions.legal : [];
    const sling = game.players[0]!.hand.find((id) => codeOf(game, id) === SLINGSHOT_CARD)!;
    expect(legal.some((e) => e.action.kind === "playCard" && e.action.instanceId === sling)).toBe(true);
    expect(
      legal.some(
        (e) =>
          e.action.kind === "useAbility" && e.action.instanceId === sling && e.action.abilityId === SLINGSHOT_ACTION,
      ),
    ).toBe(true);
  });
});
