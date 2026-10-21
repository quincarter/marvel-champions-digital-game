import { describe, expect, test } from "vitest";
import { cardsInPlay, legalActions } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { beginPayment, paymentView, togglePayment } from "../view/payment-model.js";
import {
  COMMAND_TEAM_CARD,
  GRANT_WARD_CARD,
  ORG_SUPPORT_CARD,
  VICTORIA_HAND_CARD,
  startOrgSupportDevGame,
} from "./dev-org-support-game.js";
import { SessionStore } from "./session-store.js";

describe("the Organizational Support dev game (issues #279, #326)", () => {
  test("Maria Hill with Grant Ward and Command Team ready, and Organizational Support's ways to pay swap", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startOrgSupportDevGame(store);
    const game = store.state.game!;
    const me = game.players[0]!;
    const code = (id: string) => game.instances[id]?.cardId as string;
    expect(me.identity.form).toBe("hero");
    const played = cardsInPlay(game).filter((id) => [GRANT_WARD_CARD, COMMAND_TEAM_CARD].includes(code(id)));
    expect(played).toHaveLength(2);
    expect(played.every((id) => !game.instances[id]!.exhausted)).toBe(true);

    const org = me.hand.find((id) => code(id) === ORG_SUPPORT_CARD)!;
    const victoria = me.hand.find((id) => code(id) === VICTORIA_HAND_CARD)!;
    const legal = legalActions(game, me.playerId, POOL_DEPS);
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === victoria)!;
    const opened = beginPayment(game, me.playerId, entry.action, null, POOL_DEPS)!;
    const ways = opened.query.sources.filter((source) => source.instanceId === org);
    expect(ways.length).toBeGreaterThan(2); // spent plainly, and through its interrupt with one or both cards exhausted

    // The plain resource, then the most generous exhaust mode: the mode replaces it, and that alone pays for her.
    const plain = ways.find((source) => source.kind === "handCard")!;
    const richest = ways.reduce((best, source) =>
      Object.values(source.pool).reduce((a, b) => a + b, 0) > Object.values(best.pool).reduce((a, b) => a + b, 0)
        ? source
        : best,
    );
    const payment = togglePayment(togglePayment(opened, plain.optionId), richest.optionId);
    expect(payment.picked).toEqual([richest.optionId]);
    const view = paymentView(game, me.playerId, payment, "Victoria Hand", POOL_DEPS);
    expect(view.paid).toBe(3);
    expect(view.command).not.toBeNull();

    // The strip shows one tile per card the interrupt can exhaust, not one per set (issue #326), and tapping both
    // tiles picks the same way of spending as the richest set.
    const strip = paymentView(game, me.playerId, opened, "Victoria Hand", POOL_DEPS).tableSources;
    expect(strip.filter((tile) => tile.instanceId === org)).toEqual([]);
    const tiles = strip.filter((tile) => tile.exhaustFor === org);
    expect(tiles.map((tile) => code(tile.instanceId)).sort()).toEqual([COMMAND_TEAM_CARD, GRANT_WARD_CARD].sort());
    const tapped = tiles.reduce((state, tile) => togglePayment(state, tile.optionId), opened);
    expect(tapped.picked).toEqual([richest.optionId]);
    const after = paymentView(game, me.playerId, tapped, "Victoria Hand", POOL_DEPS);
    expect(after.tableSources.filter((tile) => tile.exhaustFor === org).every((tile) => tile.spent)).toBe(true);
    expect(after.paid).toBe(3);
  }, 120_000);
});
