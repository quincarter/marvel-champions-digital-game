/**
 * Issue #678: in the reporter's Nebula game, No Quarter dealt Nebula 4 damage and the Power Stone moved to Gamora, but
 * her ATK did not go up. The stone prints "+1 SCH/THW" and "+1 ATK" stat boxes that our card data was missing, so it
 * gave nothing to whoever held it, Nebula included. This replays the reporter's game and checks Gamora's panel shows
 * the stone's +1 ATK and +1 THW and Nebula's no longer does.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { applyCommands, type Command, type GameState, type InstanceId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { characterPanel } from "./board-model.js";

const replay = JSON.parse(readFileSync(new URL("./fixtures/issue-678-replay.json", import.meta.url), "utf8")) as {
  readonly config: Parameters<EngineSessionCore["start"]>[0];
  readonly commands: readonly { readonly command: Command }[];
};

/** The reporter's game: every command, or the first `count`. */
async function played(count = replay.commands.length): Promise<GameState> {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  await core.start(replay.config);
  let state = core.save().initialState;
  for (const { command } of replay.commands.slice(0, count)) {
    const result = applyCommands(state, [command], POOL_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

const stoneOf = (state: GameState): InstanceId =>
  Object.values(state.instances).find((instance) => instance.cardId === "16149")!.instanceId;
const bonusOf = (state: GameState, id: InstanceId, label: string): number | undefined =>
  characterPanel(state, id, POOL_DEPS).stats.find((tile) => tile.label === label)?.bonus;

describe("issue #678: the Power Stone's stat boxes", () => {
  test("before No Quarter, the stone on Nebula gives her +1 ATK and +1 SCH", async () => {
    // The command before No Quarter is played (the flip to Gamora's hero form).
    const state = await played(10);
    const nebula = state.villains[0]!.instanceId;
    expect(state.instances[stoneOf(state)]!.attachedTo).toBe(nebula);
    expect(bonusOf(state, nebula, "ATK")).toBe(1);
    expect(bonusOf(state, nebula, "SCH")).toBe(1);
  });

  test("after No Quarter moves the stone to Gamora, she gets +1 ATK and +1 THW and Nebula loses hers", async () => {
    const state = await played();
    const gamora = state.players[0]!.identity.instanceId;
    const nebula = state.villains[0]!.instanceId;
    expect(state.instances[stoneOf(state)]!.attachedTo).toBe(gamora);
    expect(bonusOf(state, gamora, "ATK")).toBe(1);
    expect(bonusOf(state, gamora, "THW")).toBe(1);
    expect(bonusOf(state, nebula, "ATK")).toBe(0);
    expect(bonusOf(state, nebula, "SCH")).toBe(0);
  });
});
