import type { InstanceId, LegalAction, LegalActions, PlayerId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf } from "../store/dev-game-steps.js";
import { MULLIGAN_CARD, startOffTurnDevGame } from "../store/dev-off-turn-game.js";
import { SessionStore } from "../store/session-store.js";
import { abilityActionsFor, hasOffTurnAction, highlights, legalEntriesOf } from "./highlights.js";

describe("an off-turn seat's highlights (RRG 1.8 'Player Turn', pp. 34-35)", () => {
  test("P2's Action event is offered during P1's turn, a basic power is not, and the play is P2's command", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startOffTurnDevGame(store);
    const game = store.state.game!;
    const p2 = game.players[1]!;
    for (let i = 0; i < 50 && store.state.offTurnSeats.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    await store.takeOffTurnSeat(p2.playerId);
    const actions = store.state.legal!.actions;
    expect(hasOffTurnAction(actions)).toBe(true);

    const marks = highlights(actions);
    const mulligan = p2.hand.find((id) => codeOf(game, id) === MULLIGAN_CARD)!;
    expect(marks.yourTurn).toBe(false);
    expect(marks.playable.has(mulligan)).toBe(true);
    // Nothing but Actions: no other hand card is playable, and every basic button is off.
    expect(marks.playable.size).toBeGreaterThan(0);
    for (const basic of marks.basics) expect(basic.enabled).toBe(false);
    expect(legalEntriesOf(actions).some((entry) => entry.action.kind.startsWith("basic"))).toBe(false);

    const entry = legalEntriesOf(actions).find((e) => e.action.kind === "playCard")!;
    expect(entry.example).toMatchObject({ type: "playCard", playerId: p2.playerId, cardInstanceId: mulligan });
  });

  test("an Action ability on an off-turn seat's card is listed like an own-turn one", () => {
    const card = "i1" as InstanceId;
    const entry: LegalAction = {
      action: { kind: "useAbility", instanceId: card, abilityId: "x.action" },
      example: { type: "useAbility", playerId: "p2" as PlayerId, instanceId: card, abilityId: "x.action" },
      targets: [],
      blockedTargets: [],
      needsPayment: false,
    } as unknown as LegalAction;
    const actions: LegalActions = {
      kind: "notYourTurn",
      activePlayerId: "p1" as PlayerId,
      legal: [entry],
      illegal: [],
    };
    expect(abilityActionsFor(actions, card)).toHaveLength(1);
    expect(highlights(actions).usableAbilities.has(card)).toBe(true);
    // A seat with nothing to offer gets the empty highlights, as before.
    const none: LegalActions = { kind: "notYourTurn", activePlayerId: "p1" as PlayerId, legal: [], illegal: [] };
    expect(hasOffTurnAction(none)).toBe(false);
    expect(highlights(none).usableAbilities.size).toBe(0);
  });
});
