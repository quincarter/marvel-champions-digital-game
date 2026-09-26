/**
 * The `?screen=alliance` dev jump reaches the state it promises, and from there an alliance payment offers the other
 * seat's hand in the payment strip (`PaymentView.tableSources`), so the per-helper approval (docs/phase7-wave4.md §4
 * Q10) is reachable with a pointer. Before the strip carried them, the engine offered Star-Lord's cards but nothing
 * drew them, so no helper could ever be picked.
 */

import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { allianceHelpersOf, beginPayment, paymentView, togglePayment } from "../view/payment-model.js";
import { ALLIANCE_DEV_CARD, startAllianceDevGame } from "./dev-alliance-game.js";
import { SessionStore } from "./session-store.js";

describe("the alliance dev game", () => {
  test("stops on War Machine's turn, both heroes flipped, with Cosmic Alliance playable", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startAllianceDevGame(store);
    const game = store.state.game!;
    const [warMachine, starLord] = game.players;
    expect(store.state.perspectiveId).toBe(warMachine!.playerId);
    expect(game.players.map((player) => player.identity.form)).toEqual(["hero", "hero"]);
    expect(starLord!.hand.length).toBeGreaterThan(0);

    const actions = store.state.legal!.actions;
    expect(actions.kind).toBe("turn");
    if (actions.kind !== "turn") return;
    const play = actions.legal.find(
      (entry) =>
        entry.action.kind === "playCard" &&
        (game.instances[entry.action.instanceId]?.cardId as string) === ALLIANCE_DEV_CARD,
    );
    expect(play).toBeDefined();

    const payment = beginPayment(game, warMachine!.playerId, play!.action, null, POOL_DEPS)!;
    const view = paymentView(game, warMachine!.playerId, payment, "Cosmic Alliance", POOL_DEPS);
    const helperTiles = view.tableSources.filter((source) => source.helperName !== null);
    expect(helperTiles.map((source) => source.instanceId).sort()).toEqual([...starLord!.hand].sort());
    expect(new Set(helperTiles.map((source) => source.helperName))).toEqual(new Set(["Star-Lord"]));
    const ownSources = view.sources.filter((source) => warMachine!.hand.includes(source.instanceId));
    expect(ownSources).not.toHaveLength(0);
    expect(ownSources.map((source) => source.helperName)).toEqual(ownSources.map(() => null));

    const picked = togglePayment(payment, helperTiles[0]!.optionId);
    expect(allianceHelpersOf(game, warMachine!.playerId, picked)).toEqual([
      { playerId: starLord!.playerId, instanceIds: [helperTiles[0]!.instanceId] },
    ]);
  });
});
