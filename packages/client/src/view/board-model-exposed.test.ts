/**
 * Exposed (Sentinel's Expose insert, the `sentinel-tw` community pack; #890 item 10): carried by the engine as
 * `exposed` counters, shown on the board as a status ("EXPOSED ×N" in the tag row, in the red of its status card), and
 * not listed again among the card's counters.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import type { GameState } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { characterPanel, countersOf } from "./board-model.js";

const RHINO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 3,
};

describe("Exposed counters on the board", () => {
  let state: GameState;

  beforeAll(async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(RHINO);
    for (let step = 0; step < 40; step++) {
      const legal = store.state.legal;
      if (legal?.actions.kind !== "choice") break;
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
    state = store.state.game!;
  }, 60_000);

  test("3 exposed counters on the villain read as the Exposed status ×3, not as counters", () => {
    const villain = state.villains[0]!.instanceId;
    const exposed: GameState = {
      ...state,
      instances: { ...state.instances, [villain]: { ...state.instances[villain]!, counters: { exposed: 3 } } },
    };
    const panel = characterPanel(exposed, villain, CORE_DEPS);
    expect(panel.statuses).toContainEqual({ status: "exposed", count: 3 });
    expect(countersOf(exposed, villain)).toEqual([]);
  });
});
