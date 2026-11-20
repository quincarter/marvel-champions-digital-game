/**
 * The cost pickers for an either/or *additional cost to play* (#890 item 11, PR #891 review): Sentinel's Rocket Punch
 * shape, "As an additional cost to play this event, exhaust an Arms (Intact) or destroy it" (flip it and take 2
 * unpreventable damage), with two Arms in play. The branch labels read the whole play cost (`playCostWith`: the
 * additional cost merged with the event's Action cost), and the in-play picker asks which Arms on the chosen branch, so
 * the player, not the engine's default, picks the card. The board is the engine's own test builder
 * (`engine/src/testing/either-flip-cost.ts`), loaded with `import.meta.glob` as `dev-shadowland-game.ts` loads its.
 */

import { beforeAll, describe, expect, test } from "vitest";
import {
  applyCommand,
  legalActions,
  type Command,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalAction,
} from "@mc/engine";
import { costChoicePromptFor } from "./cost-choice-model.js";
import { beginInPlayCostChoice, costChoicesOf, toggleInPlayPick, verbOf } from "./in-play-cost-choice.js";

const BUILDER = import.meta.glob("../../../engine/src/testing/either-flip-cost.ts");
interface EitherFlipTesting {
  readonly eitherFlipCostGame: () => {
    readonly state: GameState;
    readonly deps: EngineDeps;
    readonly punch: InstanceId;
    readonly arms: readonly InstanceId[];
  };
}

let game: GameState;
let deps: EngineDeps;
let punch: InstanceId;
let arms: readonly InstanceId[];
let entry: LegalAction;

beforeAll(async () => {
  const loader = Object.values(BUILDER)[0];
  if (!loader) throw new Error("the engine's either-flip-cost builder was not found");
  const built = ((await loader()) as EitherFlipTesting).eitherFlipCostGame();
  ({ state: game, deps, punch, arms } = built);
  const playerId = game.players[0]!.playerId;
  const legal = legalActions(game, playerId, deps);
  if (legal.kind !== "turn") throw new Error("expected a turn");
  const found = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === punch);
  // Two Arms in play: no pick is forced, yet the play is listed (each branch judged with its own default pick).
  if (!found) throw new Error("expected the event to be playable with two Arms in play");
  entry = found;
});

const withBranch = (command: Command, branch: number, picks: Record<string, readonly InstanceId[]>): Command =>
  ({ ...command, costSelection: { branch }, costChoices: picks }) as Command;
const instance = (state: GameState, id: InstanceId) => state.instances[id]!;

describe("an either/or additional cost to play (Rocket Punch's exhaust or destroy)", () => {
  test("flip has a verb in the in-play picker", () => {
    expect(verbOf("flip")).toBe("flip");
  });

  test("the branch prompt labels each branch from the additional cost, not 'option N'", () => {
    const prompt = costChoicePromptFor(game, deps, entry);
    expect(prompt?.kind).toBe("branch");
    const labels = prompt?.kind === "branch" ? prompt.options.map((o) => o.label) : [];
    expect(labels).toEqual(["exhaust Arms (Intact)", "flip Arms (Intact), take 2 unpreventable damage"]);
  });

  test("on the exhaust branch the player picks which Arms, and the engine exhausts that one", () => {
    const choice = beginInPlayCostChoice(game, deps, entry, 0)!;
    expect(choice).not.toBeNull();
    expect(choice.slots).toHaveLength(1);
    expect(choice.slots[0]).toMatchObject({ slot: "arms", mode: "exhaust", min: 1, max: 1 });
    expect([...choice.slots[0]!.candidates].sort()).toEqual([...arms].sort());
    const picked = toggleInPlayPick(choice, arms[1]!);
    const result = applyCommand(game, withBranch(entry.example, 0, costChoicesOf(picked)), deps);
    if (!result.ok) throw new Error(result.error.message);
    expect(instance(result.state, arms[1]!).exhausted).toBe(true);
    expect(instance(result.state, arms[0]!).exhausted).toBe(false);
  });

  test("on the destroy branch the player picks which Arms, and the engine flips that one", () => {
    const choice = beginInPlayCostChoice(game, deps, entry, 1)!;
    expect(choice.slots[0]).toMatchObject({ slot: "arms", mode: "flip", min: 1, max: 1 });
    expect([...choice.slots[0]!.candidates].sort()).toEqual([...arms].sort());
    const picked = toggleInPlayPick(choice, arms[1]!);
    const result = applyCommand(game, withBranch(entry.example, 1, costChoicesOf(picked)), deps);
    if (!result.ok) throw new Error(result.error.message);
    expect(instance(result.state, arms[1]!).flipped).toBe(true);
    expect(instance(result.state, arms[0]!).flipped).toBe(false);
  });
});
