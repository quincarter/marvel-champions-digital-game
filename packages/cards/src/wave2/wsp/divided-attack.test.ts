/**
 * Giant Wasp's divided basic attack (13001c: "Damage you deal using your basic attack power (ATK) can be divided among
 * enemies as you choose") with Rapid Growth (13005: "Hero Interrupt: When you use a basic power, … +2 to that power for
 * this use"). Issue #1012 §5, owner decision A: the division is chosen once the power's interrupt window has closed,
 * from the final ATK. Replay 9c75786e #195-197: the command's 1 + 1 split stood and the +2 was lost (2 damage, not 4).
 *
 * Sources: RRG 1.8 FAQ "Wasp (#1C)" (p. 61): the targets are chosen when the power is used and each is attacked; RRG 1.8
 * "Interrupt" (p. 25).
 */
import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { forceMinionIntoPlay } from "../../wave1/thor/testing.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

const GIANT = { heroForm: 1 } as const;
const RAPID_GROWTH = "13005.rapid-growth-interrupt";

/** Giant Wasp (printed ATK 2) against Rhino with both Hydra Mercenaries (01101, 3 hit points) engaged with her. */
function table(): { readonly state: GameState; readonly first: InstanceId; readonly second: InstanceId } {
  const start = withForm(
    startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "wsp-aggression" }], seed: 2026 })),
    GIANT,
  );
  const [first, second] = instancesOf(start, "01101") as [InstanceId, InstanceId];
  return { state: forceMinionIntoPlay(forceMinionIntoPlay(start, first, P1), second, P1), first, second };
}

/** Plays Rapid Growth in the power's window when `rapidGrowth`, and answers a division with `shares` (id -> points). */
const picker =
  (rapidGrowth: boolean, shares: ReadonlyMap<InstanceId, number>, asked: string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") return [choice.options[0]!.optionId];
    if (choice.prompt.kind === "divide") {
      asked.push(`divide ${choice.prompt.amount}`);
      return [...shares].flatMap(([id, points]) => Array.from({ length: points }, (_, i) => `${id}#${i + 1}`));
    }
    if (rapidGrowth) {
      const hit = choice.options.find((o) => o.optionId.endsWith(`:${RAPID_GROWTH}`));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

function attack(rapidGrowth: boolean, shares: ReadonlyMap<InstanceId, number> = new Map()) {
  const { state, first, second } = table();
  const given = moveToHand(state, P1, "13005");
  const asked: string[] = [];
  const after = settle(
    runWave2(given.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(given.state),
      targetInstanceId: first,
      divide: [
        { targetInstanceId: first, amount: 1 },
        { targetInstanceId: second, amount: 1 },
      ],
    }),
    picker(rapidGrowth, shares, asked),
    undefined,
    WAVE2_DEPS,
  );
  return { before: given.state, after, first, second, asked };
}

describe("Giant Wasp's divided basic attack is divided from its final ATK (#1012 §5, decision A)", () => {
  it("Rapid Growth's +2 is divided too: the 4 damage is split 2 + 2 after the interrupt window, not the command's 1 + 1", () => {
    const { first, second } = table();
    const run = attack(
      true,
      new Map([
        [first, 2],
        [second, 2],
      ]),
    );
    // The split is asked once, for the final 4 (printed ATK 2 + 2 for this use).
    expect(run.asked).toEqual(["divide 4"]);
    expect(inst(run.after, first).damage - inst(run.before, first).damage).toBe(2);
    expect(inst(run.after, second).damage - inst(run.before, second).damage).toBe(2);
  });

  it("the player's new split stands: 3 to the first Hydra Mercenary (defeated) and 1 to the second", () => {
    const { first, second } = table();
    const run = attack(
      true,
      new Map([
        [first, 3],
        [second, 1],
      ]),
    );
    expect(run.asked).toEqual(["divide 4"]);
    expect(run.after.players[0]!.playArea).not.toContain(first);
    expect(inst(run.after, second).damage - inst(run.before, second).damage).toBe(1);
  });

  it("with no change to ATK the command's division stands and nothing more is asked", () => {
    const run = attack(false);
    expect(run.asked).toEqual([]);
    expect(inst(run.after, run.first).damage - inst(run.before, run.first).damage).toBe(1);
    expect(inst(run.after, run.second).damage - inst(run.before, run.second).damage).toBe(1);
  });
});
