import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { playWorkLifeWithAlly } from "../store/dev-work-life-game.js";
import { SessionStore } from "../store/session-store.js";
import { optionNoticesOf } from "./option-notice.js";

describe("optionNoticesOf (#412)", () => {
  test("Work-Life Balance with an ally while Jessica is stalwart: the remove option taken, confuse disabled with why", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const events = (await playWorkLifeWithAlly(store))!;
    const game = store.state.game!;
    const me = game.players[0]!.playerId;
    expect(optionNoticesOf(events, game, me, POOL_DEPS)).toEqual([
      {
        title: "Work-Life Balance: only one option",
        rows: [
          { kind: "taken", label: "Remove an ally you control from the game" },
          {
            kind: "unavailable",
            label: "Confuse your identity",
            why: "Jessica Jones is stalwart and cannot be confused",
          },
        ],
      },
    ]);
    // Another seat's choice is not this viewer's notice; with no viewer (one person at every seat) it is.
    expect(optionNoticesOf(events, game, "p9" as never, POOL_DEPS)).toEqual([]);
    expect(optionNoticesOf(events, game, null, POOL_DEPS)).toHaveLength(1);
  }, 120_000);

  test("a choice that asked, or took its only printed option, makes no notice", () => {
    const asked = { type: "optionChosen", label: "Draw 3 cards", index: 1 } as const;
    expect(optionNoticesOf([asked], {} as never, null, POOL_DEPS)).toEqual([]);
  });
});
