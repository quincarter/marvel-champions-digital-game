/**
 * Issue #623: Captain America (hero form, Captain America's Shield: retaliate 1) did not defend Red Skull's Gang-Up
 * attack and Shield Block prevented the damage; no retaliate followed. The engine was right: the boost card was Red
 * Skull's Luger, whose Boost ability attached it to Red Skull, and "Red Skull's attacks gain piercing and ranged"
 * then applied to that attack, which ignores retaliate (RRG 1.8 "Ranged", p. 36; "Retaliate X", p. 38; FFG ruling 134,
 * January 11, 2024). The log said only "Boost: 0 icons", so it read as a bug. This replays the reporter's own game and
 * checks the log now names the boost card, its attaching, and the ignored retaliate.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { applyCommands, type Command, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { appendEvents, emptyLog } from "./log-lines.js";

const replay = JSON.parse(readFileSync(new URL("./fixtures/issue-623-replay.json", import.meta.url), "utf8")) as {
  readonly config: Parameters<EngineSessionCore["start"]>[0];
  readonly commands: readonly { readonly command: Command }[];
};

describe("issue #623: a boost card that makes the attack ranged", () => {
  test("the log names the Luger, its attaching, and the retaliate it made the attack ignore", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    await core.start(replay.config);
    let state = core.save().initialState;
    let log = emptyLog();
    for (const { command } of replay.commands) {
      const result = applyCommands(state, [command], POOL_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
      log = appendEvents(log, result.events, state, "p1" as PlayerId, POOL_DEPS);
    }
    const lines = log.lines.map((line) => line.text);
    const boost = lines.findIndex((text) => text === "Boost: Red Skull's Luger, 0 icons for Red Skull.");
    const attached = lines.indexOf("Red Skull's Luger attaches to Red Skull.");
    const ignored = lines.indexOf("Red Skull's attack is ranged, so it ignores Captain America's retaliate 1.");
    expect(boost, lines.join("\n")).toBeGreaterThanOrEqual(0);
    expect(attached).toBeGreaterThan(boost);
    expect(ignored).toBeGreaterThan(attached);
    // Retaliate really is ignored: Red Skull takes no damage from it.
    expect(state.instances[state.villains[0]!.instanceId]!.damage).toBe(0);
  });
});
