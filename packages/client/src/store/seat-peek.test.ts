import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { boardModel } from "../view/board-model.js";
import { POOL_DEPS } from "../content/pool.js";
import { startOffTurnDevGame } from "./dev-off-turn-game.js";
import { SessionStore } from "./session-store.js";

describe("looking at a teammate's side of the table (peekSeat)", () => {
  test("shows the seat to read, keeps the acting seat's perspective and legal actions, and ends on Back or an update", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startOffTurnDevGame(store);
    const game = store.state.game!;
    const [p1, p2] = game.players;
    const legal = store.state.legal;
    expect(store.state.perspectiveId).toBe(p1!.playerId);

    expect(store.peekAtSeat(p2!.playerId)).toBe(true);
    expect(store.state.peekSeat).toBe(p2!.playerId);
    // Nothing else moves: the board still belongs to P1, and P1's moves are still the ones on offer.
    expect(store.state.perspectiveId).toBe(p1!.playerId);
    expect(store.state.legal).toBe(legal);
    // The board drawn for the looked-at seat has P2's hand, card for card, and P1 in the team rail.
    const model = boardModel(game, store.state.peekSeat!, POOL_DEPS);
    expect(model.hand.map((card) => card.instanceId)).toEqual(p2!.hand);
    expect(model.team.map((seat) => seat.playerId)).toEqual([p1!.playerId]);

    // Back.
    store.endSeatPeek();
    expect(store.state.peekSeat).toBeNull();

    // Peeking at the board's own seat is Back.
    store.peekAtSeat(p2!.playerId);
    expect(store.peekAtSeat(p1!.playerId)).toBe(true);
    expect(store.state.peekSeat).toBeNull();

    // A seat that is not in the game is refused.
    expect(store.peekAtSeat("nobody" as never)).toBe(false);

    // The next update puts the table back on the seat that acts.
    store.peekAtSeat(p2!.playerId);
    const end = store.state.legal!.actions;
    const endTurn = end.kind === "turn" ? end.legal.find((entry) => entry.action.kind === "endTurn") : undefined;
    expect(endTurn).toBeDefined();
    await store.dispatch(endTurn!.example);
    expect(store.state.error).toBeNull();
    expect(store.state.peekSeat).toBeNull();
  });

  test("acting for an off-turn seat ends a peek", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startOffTurnDevGame(store);
    const [, p2] = store.state.game!.players;
    for (let i = 0; i < 50 && store.state.offTurnSeats.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    store.peekAtSeat(p2!.playerId);
    expect(await store.takeOffTurnSeat(p2!.playerId)).toBe(true);
    expect(store.state.peekSeat).toBeNull();
    expect(store.state.perspectiveId).toBe(p2!.playerId);
  });
});
