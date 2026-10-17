/**
 * Rules audit, chunk 21 (RRG 1.8 Appendix IV: FAQ, HEX BOLT ... LABOR CARDS). Every `it.fails` below is a bug proof:
 * it asserts what the RRG says and fails today. When the bug is fixed the test flips and `it.fails` must be dropped.
 * Real cards from the playable pool.
 */
import type { InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, inst, P1, use, type Picker } from "../testing/harness.js";
import { drive, intoPlay, rhino } from "../testing/qa-bench.js";

import { novaScenarioWithExtras } from "../wave5/nova/support.js";
import { startWave5Game } from "../wave5/testing.js";

const _novaVsRhino = (seed = 1, extraCodes: readonly string[] = []) =>
  startWave5Game(novaScenarioWithExtras("rhino", { seed, extraCodes }));

/** Accepts the named optional Interrupt/Response/target option; declines everything else. */
const _accepting =
  (wanted: string, want: readonly InstanceId[] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseCards") return want;
    const hits = choice.options
      .filter((o) => o.optionId === wanted || o.optionId.endsWith(`:${wanted}`) || o.label === wanted)
      .map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("21.7 BATTERY PACK (#34), RRG 1.8 Appendix IV FAQ p. 62", () => {
  // "Q: Can Battery Pack move a charge counter to a Tech card that does not use 'charge counters'? A: Yes. The card that
  // an all-purpose counter is on defines the type of that counter, so Battery Pack can move a counter to any Tech card
  // and that counter will take on the type defined by that card (if any)."
  it.fails("a counter moved to Energy Barrier (Tech, Uses 3 reflection counters) becomes a reflection counter", () => {
    const battery = intoPlay(rhino(), "16034", { charge: 2 }, 2);
    const barrier = intoPlay(battery.state, "05017", { reflection: 3 }, 3);
    const done = drive(barrier.state, use(P1, battery.id, "16034.battery-pack-action"), { target: barrier.id });
    expect(done.accepted).toBe(true);
    expect(inst(done.state, battery.id).counters.charge).toBe(1);
    // 3 printed reflection counters + the one moved, which takes the type Energy Barrier defines.
    expect(inst(done.state, barrier.id).counters.reflection).toBe(4);
  });
});
