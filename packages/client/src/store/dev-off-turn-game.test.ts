import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf } from "./dev-game-steps.js";
import { MULLIGAN_CARD, startOffTurnDevGame } from "./dev-off-turn-game.js";
import { SessionStore } from "./session-store.js";

describe("the off-turn Action dev game and the store's off-turn seat", () => {
  test("round 2, P1's turn, P2 offered Mulligan; taking the seat, then playing it sends P2's command", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startOffTurnDevGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const [p1, p2] = game.players;
    expect(game.round).toBe(2);
    expect(store.state.perspectiveId).toBe(p1!.playerId);
    expect(p2!.identity.form).toBe("hero");
    const card = p2!.hand.find((id) => codeOf(game, id) === MULLIGAN_CARD)!;
    expect(card).toBeDefined();

    // The offer arrives a moment after the update.
    for (let i = 0; i < 50 && store.state.offTurnSeats.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    expect(store.state.offTurnSeats).toEqual([p2!.playerId]);

    expect(await store.takeOffTurnSeat(p2!.playerId)).toBe(true);
    expect(store.state.perspectiveId).toBe(p2!.playerId);
    expect(store.state.legal!.playerId).toBe(p2!.playerId);
    const actions = store.state.legal!.actions;
    expect(actions.kind).toBe("notYourTurn");

    const entry = actions.kind === "notYourTurn" ? actions.legal.find((e) => e.action.kind === "playCard") : undefined;
    expect(entry, "Mulligan is offered").toBeDefined();
    expect(
      actions.kind === "notYourTurn" && actions.legal.every((e) => !String(e.action.kind).startsWith("basic")),
    ).toBe(true);

    store.leaveOffTurnSeat();
    expect(store.state.perspectiveId).toBe(p1!.playerId);
    expect(store.state.legal!.actions.kind).toBe("turn");

    // Back on P2's side, the command is P2's own.
    await store.takeOffTurnSeat(p2!.playerId);
    const other = p2!.hand.filter((id) => id !== card && codeOf(game, id) !== MULLIGAN_CARD).slice(0, 3);
    const played = await store.dispatch({
      ...entry!.example,
      payment: other.map((fromHand) => ({ fromHand })),
    } as never);
    expect(store.state.error).toBeNull();
    expect(played).toBe(true);
    expect(store.state.commandTrail.at(-1)!.playerId).toBe(p2!.playerId);
    expect(store.state.game!.players[1]!.discard).toContain(card);
    expect(store.state.perspectiveId).toBe(p1!.playerId);
    expect(store.state.offTurnSeat).toBeNull();
  });
});
