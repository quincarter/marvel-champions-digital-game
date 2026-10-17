/**
 * Common Criminal (27131): "Alter-ego Action: Spend a [physical] resource -> deal 3 damage to Common Criminal. If this
 * minion is defeated this way, choose to either draw 1 card or remove 3 threat from a side scheme." RRG 1.8 "Choose
 * (Option)" (p. 12): a player card's option that requires a target with no valid target cannot be chosen. With no side
 * scheme in play, only "Draw 1 card" may be offered.
 */
import { encounterSetId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, moveToHand, P1, playerOf, settle, use, type Picker } from "../testing/harness.js";
import { encounterCardInVillainArea } from "../testing/staging.js";
import { ghostSpiderScenario } from "../wave5/sm/ghost-spider/support.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../wave5/testing.js";

const game = () =>
  startWave5Game(ghostSpiderScenario("sandman", { seed: 1, modularSetIds: [encounterSetId("down_to_earth")] }));

/** Common Criminal engaged with P1 (a minion must sit in a player's play area to be defeated). */
function engagedCriminal(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const placed = encounterCardInVillainArea(state, "27131");
  return {
    id: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      players: placed.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: [...p.playArea, placed.id] } : p,
      ),
    },
  };
}

describe("Common Criminal (27131): an option with no valid target cannot be chosen", () => {
  it("with no side scheme in play, 'Remove 3 threat from a side scheme' is not offered", () => {
    const placed = engagedCriminal(game());
    const paid = moveToHand(placed.state, P1, "27022"); // Strength: a [physical] resource.
    const [strength] = paid.ids;
    const offered: string[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") offered.push(...choice.options.map((o) => o.label ?? ""));
      return firstLegal(s);
    };
    const handBefore = playerOf(paid.state, P1).hand.length;
    const after = settle(
      runWave5(paid.state, use(P1, placed.id, "27131.common-criminal-constant", [{ fromHand: strength! }])),
      pick,
      undefined,
      WAVE5_DEPS,
    );
    expect(offered).not.toContain("Remove 3 threat from a side scheme");
    // The one option left resolves without asking: the card is drawn.
    expect(playerOf(after, P1).hand.length).toBe(handBefore);
  });
});
