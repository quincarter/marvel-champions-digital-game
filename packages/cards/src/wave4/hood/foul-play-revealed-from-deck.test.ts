import type { GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, instancesOf, mainThreat } from "../../testing/harness.js";
import { defeatWithAttack } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../testing.js";
import {
  cleanGame,
  dealt,
  heroified,
  minionEngagedWith,
  onStage,
  stackTop,
  villainPhaseWith,
  withHand,
} from "./testing.js";

/**
 * A card The Hood's Foul Play discards and deals to a player is "first dealt to the player", so it counts as revealed
 * from the encounter deck when it is revealed: Enhanced Spider-Sense (01004) is offered for it and cancels it.
 * Sources: ruling September 14, 2026 - Ruling 1 ("if the revealed encounter card was first dealt to the player");
 * the Adam Warlock ruling (docs/rulings/rrg-1-0-to-1-4/36-adam-warlock.md); owner answer Q35 A, 2026-10-20
 * (docs/phase7-wave6.md §4.1).
 */
const ESS = "01004.enhanced-spider-sense-interrupt";

describe("Foul Play cards are revealed from the encounter deck (Q35 A)", () => {
  it("24001.the-hood-constant: Enhanced Spider-Sense is offered for the Foul Play-dealt treachery and cancels its When Revealed", () => {
    // Advance (01186, Standard): "When Revealed: the villain schemes" would add threat to the main scheme.
    const base = onStage(cleanGame(), 0);
    const staged = minionEngagedWith(stackTop(base, "01186"), "24010", P1);
    const advance = instancesOf(staged.state, "01186")[0]!;
    const defeated = defeatWithAttack(WAVE4_DEPS, heroified(staged.state), staged.id, P1);
    expect(dealt(defeated, P1)).toContain(advance);
    // Spider-Man holds Enhanced Spider-Sense and a card to pay for it.
    const ready: GameState = withHand(defeated, ["01004", "01089"]);
    const threatBefore = mainThreat(ready);
    const offered: string[] = [];
    const { events, state } = villainPhaseWith(ready, [], {
      pick: (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "chooseTriggers" && choice.prompt.event.kind === "encounterCardRevealing") {
          if (choice.prompt.event.instanceId === advance) offered.push(...choice.options.map((o) => o.optionId));
          const mine = choice.options.find((o) => o.optionId.endsWith(ESS));
          return mine ? [mine.optionId] : [];
        }
        if (choice.prompt.kind === "payForCard")
          return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
        return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      },
    });
    expect(offered.some((o) => o.endsWith(ESS))).toBe(true);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === ESS)).toBe(true);
    // Advance was revealed but its When Revealed never resolved: only the villain phase\u2019s own +1 threat landed.
    expect(events.some((e) => e.type === "abilityResolved" && String(e.abilityId).startsWith("01186."))).toBe(false);
    expect(mainThreat(state)).toBe(threatBefore + 1);
  });
});
