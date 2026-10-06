import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { DEADPOOL_QA, startDeadpoolQaGame, type DeadpoolQaCard } from "./dev-qa-deadpool-game.js";
import { codeOf } from "./dev-game-steps.js";
import { SessionStore } from "./session-store.js";

describe("the Deadpool QA dev games", () => {
  test.each(Object.keys(DEADPOOL_QA) as DeadpoolQaCard[])("%s", async (which) => {
    const store = new SessionStore(new LocalEngineHost());
    await startDeadpoolQaGame(store, which);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const me = game.players[0]!;
    const code = DEADPOOL_QA[which].code;
    const where = which === "merc" ? me.playArea : me.hand;
    expect(where.some((id) => codeOf(game, id) === code)).toBe(true);
    if (which !== "merc") expect(me.identity.form).not.toBe("alterEgo");
  });
});
