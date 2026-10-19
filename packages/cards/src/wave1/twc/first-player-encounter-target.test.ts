import { maxHitPoints, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { withActive } from "../../testing/staging.js";
import { wave1Scenario } from "../setup.js";
import { runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

/**
 * E32 (docs/phase7-wave11-scenarios.md §S7 item 37; RRG 1.8 "First Player", p. 19): an encounter card's target among
 * several eligible cards, where the card does not print "choose", is selected by the first player; "you control"
 * defines the pool, not the chooser, and so does a tie on "highest" or "fewest".
 *
 * P2 controls two supports (both Med Team, cost 3), a cost tie; the card is revealed to or boosts an attack on P2, yet
 * P1, the first player, is the one asked.
 */
const twoPlayersWithTiedSupports = () => {
  let state = startTwcGame(
    wave1Scenario("breakout", {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-black-panther-protection" }],
      seed: 41,
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
  return { state, medTeams };
};

const askedFor = (state: GameState, slot: string, ...commands: Parameters<typeof runTwc>[1][]) =>
  settle(
    runTwc(state, ...commands),
    firstLegal,
    (s) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" && (s.pendingChoice.prompt as { slot?: string }).slot === slot,
    TWC_DEPS,
  );

describe("E32: encounter-side targets go to the first player", () => {
  it("07042.boost: boosting an attack on P2, the first player (P1) picks which of P2's supports is discarded", () => {
    const { state, medTeams } = twoPlayersWithTiedSupports();
    const staged = stackEncounterDeck(withActive(state, state.villains[2]!.instanceId), "07042", "07043");
    const asked = askedFor(staged, "oversized-hands-support", toHero(P1), endTurn(P1), toHero(P2), endTurn(P2));
    const choice = asked.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual([...medTeams].sort());
  });

  it("07042.when-revealed: revealed to P2, a tie on the highest-cost support is broken by P1", () => {
    const { state, medTeams } = twoPlayersWithTiedSupports();
    const staged = stackEncounterDeck(withActive(state, state.villains[2]!.instanceId), "07037", "07043", "07042");
    const asked = askedFor(staged, "oversized-hands-tied", endTurn(P1), endTurn(P2));
    const choice = asked.pendingChoice!;
    expect((asked.step as { remainingPlayerIds?: readonly string[] }).remainingPlayerIds).toEqual([P2]);
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual([...medTeams].sort());
  });

  it("07016.when-revealed: a tie on the fewest remaining hit points between the heroes is broken by P1", () => {
    let { state } = twoPlayersWithTiedSupports();
    // Both heroes stay in alter-ego form, so the villain's activation does not touch their damage; both have 5 left.
    for (const player of [P1, P2]) {
      const id = identityOf(state, player);
      state = patchInstance(state, id, { damage: maxHitPoints(state, id, TWC_DEPS)! - 5 });
    }
    const staged = stackEncounterDeck(
      withActive(state, state.villains[0]!.instanceId),
      "07015",
      "07007",
      "07012",
      "07016",
    );
    const asked = askedFor(staged, "dead-meat-pick", endTurn(P1), endTurn(P2));
    const choice = asked.pendingChoice!;
    // The card is being revealed to P2, the last player to reveal.
    expect((asked.step as { remainingPlayerIds?: readonly string[] }).remainingPlayerIds).toEqual([P2]);
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual([identityOf(state, P1), identityOf(state, P2)].sort());
  });
});
