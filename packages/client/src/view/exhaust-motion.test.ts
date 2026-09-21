import { describe, expect, it } from "vitest";
import type { GameEvent, InstanceId } from "@mc/engine";
import { exhaustMotionsFrom } from "./exhaust-motion.js";

const id = (value: string): InstanceId => value as InstanceId;

describe("exhaustMotionsFrom", () => {
  it("is empty with no exhaust/ready events", () => {
    expect(exhaustMotionsFrom([])).toEqual([]);
  });

  it("maps cardExhausted to 'exhausting' and cardReadied to 'readying'", () => {
    const events: readonly GameEvent[] = [
      { type: "cardExhausted", instanceId: id("c1") },
      { type: "cardReadied", instanceId: id("c2") },
    ];
    expect(exhaustMotionsFrom(events)).toEqual([
      { instanceId: id("c1"), direction: "exhausting" },
      { instanceId: id("c2"), direction: "readying" },
    ]);
  });

  it("ignores unrelated events", () => {
    expect(
      exhaustMotionsFrom([{ type: "damageDealt", targetInstanceId: id("c1"), amount: 2, sourceInstanceId: null }]),
    ).toEqual([]);
  });
});
