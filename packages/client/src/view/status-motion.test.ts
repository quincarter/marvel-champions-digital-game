import { describe, expect, it } from "vitest";
import type { GameEvent, InstanceId } from "@mc/engine";
import { statusGhostsFrom, statusStampsFrom } from "./status-motion.js";

const id = (value: string): InstanceId => value as InstanceId;

describe("statusStampsFrom", () => {
  it("is empty with no statusGiven events", () => {
    expect(statusStampsFrom([])).toEqual([]);
    expect(statusStampsFrom([{ type: "cardExhausted", instanceId: id("c1") }])).toEqual([]);
  });

  it("extracts one entry per statusGiven event, in order", () => {
    const events: readonly GameEvent[] = [
      { type: "statusGiven", instanceId: id("villain"), status: "stunned" },
      { type: "statusGiven", instanceId: id("minion"), status: "confused" },
    ];
    expect(statusStampsFrom(events)).toEqual([
      { instanceId: id("villain"), status: "stunned" },
      { instanceId: id("minion"), status: "confused" },
    ]);
  });

  it("ignores statusRemoved", () => {
    expect(
      statusStampsFrom([{ type: "statusRemoved", instanceId: id("c1"), status: "tough", reason: "effect" }]),
    ).toEqual([]);
  });
});

describe("statusGhostsFrom", () => {
  it("extracts one entry per statusRemoved event", () => {
    const events: readonly GameEvent[] = [
      { type: "statusRemoved", instanceId: id("c1"), status: "tough", reason: "preventedDamage" },
    ];
    expect(statusGhostsFrom(events)).toEqual([{ instanceId: id("c1"), status: "tough" }]);
  });

  it("ignores statusGiven", () => {
    expect(statusGhostsFrom([{ type: "statusGiven", instanceId: id("c1"), status: "stunned" }])).toEqual([]);
  });
});
