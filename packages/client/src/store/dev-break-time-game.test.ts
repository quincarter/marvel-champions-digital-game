import { describe, expect, test } from "vitest";
import { reportNumberEntryOf, reportAnswerOf } from "../view/report-fact-entry.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { BREAK_TIME_CARD, startBreakTimeDevGame } from "./dev-break-time-game.js";
import { SessionStore } from "./session-store.js";
import { codeOf } from "./dev-game-steps.js";

describe("the Break Time dev game", () => {
  test("Deadpool in alter-ego form with Break Time in hand; playing it asks for the minutes, and a stepper answer plays on", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startBreakTimeDevGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const me = game.players[0]!;
    expect(me.identity.form).toBe("alterEgo");
    const card = me.hand.find((id) => codeOf(game, id) === BREAK_TIME_CARD)!;
    expect(card).toBeDefined();

    const play = store.state.legal?.actions.kind === "turn" ? store.state.legal.actions.legal : [];
    const entry = play.find((e) => e.action.kind === "playCard" && e.action.instanceId === card);
    expect(entry, "Break Time is playable").toBeDefined();
    const filler = me.hand.filter((id) => id !== card).slice(0, 3);
    await store.dispatch({ ...entry!.example, payment: filler.map((fromHand) => ({ fromHand })) } as never);

    const choice = store.state.game!.pendingChoice!;
    expect(choice.prompt.kind).toBe("reportFact");
    const stepper = reportNumberEntryOf(choice)!;
    expect(stepper).not.toBeNull();
    expect(await store.resolveChoice([...reportAnswerOf(stepper, 7)])).toBe(true);
    expect(store.state.game!.pendingChoice).toBeFalsy();
  });
});
