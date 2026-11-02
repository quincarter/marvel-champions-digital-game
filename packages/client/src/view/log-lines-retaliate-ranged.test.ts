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
import { applyCommands, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { appendEvents, emptyLog, logLine } from "./log-lines.js";

const replay = JSON.parse(readFileSync(new URL("./fixtures/issue-623-replay.json", import.meta.url), "utf8")) as {
  readonly config: Parameters<EngineSessionCore["start"]>[0];
  readonly commands: readonly { readonly command: Command }[];
};

const P1 = "p1" as PlayerId;

/** The reporter's game: the state before each command, and the state after the last. */
async function replayed(): Promise<readonly GameState[]> {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  await core.start(replay.config);
  const states = [core.save().initialState];
  for (const { command } of replay.commands) {
    const result = applyCommands(states.at(-1)!, [command], POOL_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    states.push(result.state);
  }
  return states;
}

describe("issue #623: a boost card that makes the attack ranged", () => {
  test("the boost card keeps its name when the state the log reads has it hidden again", async () => {
    const states = await replayed();
    // Before the defense is declined the Luger is still a facedown boost card, as it would be back in a deck after a
    // reshuffle later in the same command: the log names it all the same, as it was seen when flipped.
    const hidden = states.at(-3)!;
    const flipped = {
      type: "boostCardFlipped",
      enemyInstanceId: "i1" as InstanceId,
      instanceId: "i55" as InstanceId,
      boostIcons: 0,
    } as const;
    expect(logLine(flipped, hidden, P1, POOL_DEPS)?.text).toBe("Boost: Red Skull's Luger, 0 icons for Red Skull.");
  });

  test("a player's ranged attack ignoring an enemy's retaliate reads as the player's", async () => {
    const after = (await replayed()).at(-1)!;
    const event = (attacker: string, target: string) =>
      ({
        type: "retaliateIgnoredByRanged",
        attackerInstanceId: attacker as InstanceId,
        targetInstanceId: target as InstanceId,
        amount: 1,
      }) as const;
    expect(logLine(event("i3", "i1"), after, P1, POOL_DEPS)?.voice).toBe("player");
    expect(logLine(event("i1", "i3"), after, P1, POOL_DEPS)?.voice).toBe("villain");
  });

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
