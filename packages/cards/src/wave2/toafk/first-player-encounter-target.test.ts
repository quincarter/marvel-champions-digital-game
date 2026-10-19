import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, P2, endTurn, firstLegal, playerOf, settle } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

/**
 * E32 (docs/phase7-wave11-scenarios.md §S7 item 37; RRG 1.8 "First Player", p. 19): an encounter card's target among
 * several eligible cards, where the card does not print "choose", is selected by the first player, and so is a tie on
 * "highest-cost".
 *
 * Time-Travel Hijinks (11021) "Discard the highest-cost card you control": revealed to P2, who controls two tied
 * supports (both Med Team, cost 3), P1 (the first player) is asked which of them goes.
 */
describe("E32: encounter-side targets go to the first player", () => {
  it("11021.when-revealed: a tie on the highest-cost card P2 controls is broken by P1", () => {
    let state = startWave2Game(
      wave2Scenario("kang", {
        players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "core-black-panther-protection" }],
        seed: 2026,
      }),
    );
    const medTeams = playerOf(state, P2)
      .deck.filter((i) => state.instances[i]!.cardId === "01080")
      .slice(0, 2);
    expect(medTeams).toHaveLength(2);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P2
          ? { ...p, deck: p.deck.filter((i) => !medTeams.includes(i)), playArea: [...p.playArea, ...medTeams] }
          : p,
      ),
      instances: Object.fromEntries(
        Object.entries(state.instances).map(([id, v]) => [
          id,
          medTeams.includes(id as InstanceId) ? { ...v, faceup: true, controllerId: P2 } : v,
        ]),
      ) as GameState["instances"],
    };
    // Both heroes stay in alter-ego form (so neither is attacked and eliminated); the deck is relabelled at index 3, the card P2 reveals.
    const deckId = Object.keys(state.encounterDecks)[0]!;
    const fillerId = state.encounterDecks[deckId]!.deck[3]!;
    state = {
      ...state,
      instances: { ...state.instances, [fillerId]: { ...state.instances[fillerId]!, cardId: "11021" as never } },
    };
    const asked = settle(
      runWave2(state, endTurn(P1), endTurn(P2)),
      firstLegal,
      (s) =>
        s.pendingChoice?.prompt.kind === "chooseTarget" &&
        (s.pendingChoice.prompt as { slot?: string }).slot === "pick",
      WAVE2_DEPS,
    );
    const choice = asked.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual([...medTeams].sort());
  });
});
