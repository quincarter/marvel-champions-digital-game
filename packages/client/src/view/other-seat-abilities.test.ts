import type { LegalActions } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf, nextTurn } from "../store/dev-game-steps.js";
import { startDeadpoolQaGame } from "../store/dev-qa-deadpool-game.js";
import { SessionStore } from "../store/session-store.js";
import { otherSeatAbilityCards } from "./other-seat-abilities.js";

describe("another seat's cards the viewer may use (any-player Action abilities)", () => {
  test("Plot Convenience in Deadpool's play area shows for Spider-Man only, and not for its own controller", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startDeadpoolQaGame(store, "plotConvenience");
    const game0 = store.state.game!;
    const [deadpool, spider] = game0.players;
    const turn = (await nextTurn(store))!;
    const hand = deadpool!.hand.find((id) => codeOf(game0, id) === "44050")!;
    // Nothing is in play yet: no other seat's card is usable.
    expect(otherSeatAbilityCards(game0, turn, deadpool!.playerId, POOL_DEPS)).toEqual([]);
    const play = turn.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === hand)!;
    await store.dispatch(play.example);
    await nextTurn(store);
    const end = store.state.legal!.actions as Extract<LegalActions, { kind: "turn" }>;
    // Deadpool's own legal list names his card, but it is not another seat's card from his side.
    expect(otherSeatAbilityCards(store.state.game!, end, deadpool!.playerId, POOL_DEPS)).toEqual([]);
    await store.dispatch(end.legal.find((e) => e.action.kind === "endTurn")!.example);
    const spidersTurn = (await nextTurn(store))!;
    const game = store.state.game!;
    expect(spidersTurn.legal.length).toBeGreaterThan(0);
    const cards = otherSeatAbilityCards(game, spidersTurn, spider!.playerId, POOL_DEPS);
    expect(
      cards.map((c) => ({ name: c.name, seatId: c.seatId, ownerName: c.ownerName, hasArt: c.art !== null })),
    ).toEqual([{ name: "Plot Convenience", seatId: deadpool!.playerId, ownerName: "Deadpool", hasArt: true }]);
    expect(codeOf(game, cards[0]!.instanceId)).toBe("44050");
  });

  test("no legal list, or one with no ability entries, gives an empty list", () => {
    expect(otherSeatAbilityCards({} as never, null, "p1" as never, POOL_DEPS)).toEqual([]);
  });
});
