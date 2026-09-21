import { describe, expect, it } from "vitest";
import type { GameEvent, InstanceId } from "@mc/engine";
import { threatFromValue, threatTicksFrom } from "./threat-motion.js";

const id = (value: string): InstanceId => value as InstanceId;

describe("threatTicksFrom", () => {
  it("is empty with no threat events", () => {
    expect(threatTicksFrom([])).toEqual([]);
  });

  it("threatPlaced ticks with a negative delta: the meter was lower before", () => {
    const events: readonly GameEvent[] = [
      { type: "threatPlaced", schemeInstanceId: id("scheme"), amount: 2, sourceInstanceId: null },
    ];
    expect(threatTicksFrom(events)).toEqual([{ schemeInstanceId: id("scheme"), delta: -2 }]);
  });

  it("threatRemoved ticks with a positive delta: the meter was higher before", () => {
    const events: readonly GameEvent[] = [
      { type: "threatRemoved", schemeInstanceId: id("scheme"), amount: 3, sourceInstanceId: null },
    ];
    expect(threatTicksFrom(events)).toEqual([{ schemeInstanceId: id("scheme"), delta: 3 }]);
  });

  it("drops zero-amount events", () => {
    const events: readonly GameEvent[] = [
      { type: "threatPlaced", schemeInstanceId: id("scheme"), amount: 0, sourceInstanceId: null },
    ];
    expect(threatTicksFrom(events)).toEqual([]);
  });
});

describe("threatFromValue", () => {
  it("recovers the pre-placement value", () => {
    expect(threatFromValue(5, { schemeInstanceId: id("s"), delta: -2 })).toBe(3);
  });

  it("recovers the pre-removal value", () => {
    expect(threatFromValue(1, { schemeInstanceId: id("s"), delta: 3 })).toBe(4);
  });

  it("never goes negative", () => {
    expect(threatFromValue(0, { schemeInstanceId: id("s"), delta: -5 })).toBe(0);
  });
});
