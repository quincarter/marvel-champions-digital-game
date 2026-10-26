import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { idleTriggerNotes } from "../view/ability-refusal.js";
import { logLine } from "../view/log-lines.js";
import { unofferedNoticesOf } from "../view/option-notice.js";
import { IRON_LAD, playIronLadAttack } from "./dev-iron-lad-game.js";
import { SessionStore } from "./session-store.js";

describe("the Iron Lad dev game (#431)", () => {
  test("Iron Lad attacks alone: his interrupt is not offered, and the notice and the log say why", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const events = (await playIronLadAttack(store))!;
    const game = store.state.game!;
    const lad = Object.values(game.instances).find((i) => i.cardId === IRON_LAD)!.instanceId;
    const notOffered = events.filter((e) => e.type === "abilityNotOffered");
    expect(notOffered).toEqual([expect.objectContaining({ instanceId: lad, reason: "cannotPay" })]);

    expect(unofferedNoticesOf(events, game, null, POOL_DEPS)).toEqual([
      {
        key: `${lad}:56052.iron-lad-interrupt`,
        notice: {
          title: "Iron Lad: interrupt not offered",
          lead: "It answers what just happened, but it cannot be used right now, so you were not asked.",
          rows: [
            {
              kind: "unavailable",
              label: "Iron Lad's interrupt",
              why: "you control no other ready Avenger ally",
            },
          ],
        },
      },
    ]);
    // Another seat's card is not this viewer's notice.
    expect(unofferedNoticesOf(events, game, "p9" as never, POOL_DEPS)).toEqual([]);

    const line = logLine(notOffered[0]!, game, game.players[0]!.playerId, POOL_DEPS);
    expect(line?.text).toBe("Iron Lad's interrupt was not offered: you control no other ready Avenger ally.");

    // Inspect's "Right now" says it before anything triggers it, and the other cards say nothing.
    expect(idleTriggerNotes(game, lad, POOL_DEPS)).toEqual([
      "Interrupt can't be used right now: you control no other ready Avenger ally",
    ]);
    expect(idleTriggerNotes(game, game.players[0]!.identity.instanceId, POOL_DEPS)).toEqual([]);
  }, 120_000);
});
