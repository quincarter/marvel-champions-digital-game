import { activeEncounterDeck, type GameState, type PlayerId } from "@mc/engine";
import { endTurn, firstLegal, P1, P2, settle } from "../testing/harness.js";
import { wave2Scenario } from "./setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "./testing.js";

/**
 * "Each player must choose …": every player picks their own option (RRG 1.8 "Each Player", p. 17; "Choose (Option)",
 * p. 12), not the player who revealed the card. Found replaying a two-player Absorbing Man game, where the revealing
 * player chose Avalanche!'s option for both.
 */
const ADVANCE = "01186"; // no boost icons, no boost ability

/**
 * Two players in alter-ego form, the two boost cards neutral, and `code` the next card dealt. Whoever reveals it,
 * "each player" then runs in player order, so both players must be asked.
 */
function dealtToFirstPlayer(scenario: string, code: string): GameState {
  const start = startWave2Game(
    wave2Scenario(scenario, {
      players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }],
      seed: 2026,
    }),
  );
  const [first, second, third] = activeEncounterDeck(start).deck;
  const relabel = (id: string | undefined, as: string) => ({
    [id!]: { ...start.instances[id!]!, cardId: as as never },
  });
  return {
    ...start,
    instances: { ...start.instances, ...relabel(first, ADVANCE), ...relabel(second, ADVANCE), ...relabel(third, code) },
  };
}

/** Who was asked to choose between the card's two options, in order. */
function choosers(state: GameState, label: string): PlayerId[] {
  const asked: PlayerId[] = [];
  settle(
    runWave2(state, endTurn(P1), endTurn(P2)),
    (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption" && s.pendingChoice.options.some((o) => o.label === label))
        asked.push(s.pendingChoice.playerId);
      return firstLegal(s);
    },
    (s) => s.round > state.round,
    WAVE2_DEPS,
  );
  return asked;
}

describe("each player makes their own choice", () => {
  it("Avalanche! (04091): both players are asked", () => {
    expect(choosers(dealtToFirstPlayer("absorbing-man", "04091"), "Take indirect damage")).toEqual([P1, P2]);
  });

  it("Corrupted Timestream (11022): both players are asked", () => {
    expect(choosers(dealtToFirstPlayer("kang", "11022"), "Place 2 threat here")).toEqual([P1, P2]);
  });
});
