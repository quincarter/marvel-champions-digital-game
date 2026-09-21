import { describe, expect, it } from "vitest";
import type { GameEvent, InstanceId } from "@mc/engine";
import { defeatFlashesFrom, hpFromValue, hpTicksFrom } from "./hp-motion.js";

const id = (value: string): InstanceId => value as InstanceId;

describe("hpTicksFrom", () => {
  it("is empty with no HP events", () => {
    expect(hpTicksFrom([])).toEqual([]);
  });

  it("damageDealt/damagePlaced produce a nudging 'damage' tick with a positive delta", () => {
    const events: readonly GameEvent[] = [
      { type: "damageDealt", targetInstanceId: id("rhino"), amount: 4, sourceInstanceId: null },
      { type: "damagePlaced", targetInstanceId: id("minion"), amount: 2, sourceInstanceId: null },
    ];
    expect(hpTicksFrom(events)).toEqual([
      { instanceId: id("rhino"), kind: "damage", delta: 4, nudge: true },
      { instanceId: id("minion"), kind: "damage", delta: 2, nudge: true },
    ]);
  });

  it("damageHealed produces a non-nudging 'heal' tick with a negative delta", () => {
    const events: readonly GameEvent[] = [{ type: "damageHealed", targetInstanceId: id("hero"), amount: 3 }];
    expect(hpTicksFrom(events)).toEqual([{ instanceId: id("hero"), kind: "heal", delta: -3, nudge: false }]);
  });

  it("hitPointsSet produces a zero-delta 'set' tick", () => {
    const events: readonly GameEvent[] = [{ type: "hitPointsSet", instanceId: id("hero"), remaining: 1, damage: 10 }];
    expect(hpTicksFrom(events)).toEqual([{ instanceId: id("hero"), kind: "set", delta: 0, nudge: false }]);
  });

  it("drops zero-amount damage/heal events", () => {
    const events: readonly GameEvent[] = [
      { type: "damageDealt", targetInstanceId: id("rhino"), amount: 0, sourceInstanceId: null },
      { type: "damageHealed", targetInstanceId: id("rhino"), amount: 0 },
    ];
    expect(hpTicksFrom(events)).toEqual([]);
  });
});

describe("hpFromValue", () => {
  it("adds amount back for damage: the old value was higher", () => {
    expect(hpFromValue(6, { instanceId: id("x"), kind: "damage", delta: 4, nudge: true })).toBe(10);
  });

  it("subtracts amount for heal: the old value was lower", () => {
    expect(hpFromValue(9, { instanceId: id("x"), kind: "heal", delta: -3, nudge: false })).toBe(6);
  });

  it("is a no-op for 'set'", () => {
    expect(hpFromValue(1, { instanceId: id("x"), kind: "set", delta: 0, nudge: false })).toBe(1);
  });
});

describe("defeatFlashesFrom", () => {
  it("extracts instance ids from characterDefeated events only", () => {
    const events: readonly GameEvent[] = [
      { type: "characterDefeated", instanceId: id("minion"), cardId: "01094" as never },
      { type: "schemeDefeated", instanceId: id("scheme"), cardId: "01120" as never },
    ];
    expect(defeatFlashesFrom(events)).toEqual([id("minion")]);
  });
});
