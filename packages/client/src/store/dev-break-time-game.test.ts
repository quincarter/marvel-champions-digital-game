import { describe, expect, test } from "vitest";
import { reportNumberEntryOf, reportAnswerOf } from "../view/report-fact-entry.js";
import { breakAnswerAt, isBreakChoice } from "../view/break-timer.js";
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

describe("the break timer's answer", () => {
  test("ending a 3:20 break dispatches 3, and each identity heals 3", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startBreakTimeDevGame(store);
    const me = store.state.game!.players[0]!;
    const card = me.hand.find((id) => codeOf(store.state.game!, id) === BREAK_TIME_CARD)!;
    const play = store.state.legal?.actions.kind === "turn" ? store.state.legal.actions.legal : [];
    const entry = play.find((e) => e.action.kind === "playCard" && e.action.instanceId === card)!;
    const filler = me.hand.filter((id) => id !== card).slice(0, 3);
    await store.dispatch({ ...entry.example, payment: filler.map((fromHand) => ({ fromHand })) } as never);
    const choice = store.state.game!.pendingChoice!;
    expect(isBreakChoice(choice)).toBe(true);
    const startedAt = 1_700_000_000_000;
    const answer = breakAnswerAt(startedAt, startedAt + 3 * 60_000 + 20_000);
    expect(answer).toEqual(["3"]);
    expect(await store.resolveChoice([...answer])).toBe(true);
    const reported = store.state.commandTrail.flatMap((e) => e.events).filter((e) => e.type === "factReported");
    expect(reported.map((e) => (e as { amount?: number }).amount)).toEqual([3]);
  });
});
