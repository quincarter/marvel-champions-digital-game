/**
 * Ultron (II) (01135): "When Ultron attacks you, put the top card of your deck into play facedown, engaged with you as a
 * Drone minion. Until the end of this attack, Ultron gets +1 ATK for each Drone minion engaged with you." (GitHub #1012,
 * section 4: one attack in a replay got no bonus; this pins the readings that do hold.)
 */
import { type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { CORE_DEPS } from "../index.js";
import { coreScenario } from "../setup.js";
import { endTurn, firstLegal, identityOf, P1, P2, stackEncounterDeck, startCoreGame } from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";

/** Both players in hero form against Ultron II, each starting with one Drone; the encounter deck topped with `top`. */
function ultronAttacks(top: readonly string[], defender: "none" | "other") {
  const start = startCoreGame(
    coreScenario("ultron", {
      players: [{ starterDeckId: "core-iron-man-aggression" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 8,
    }),
  );
  let state = withForm(withForm(start, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
  // Test surgery: Ultron at stage II.
  state = { ...state, villains: state.villains.map((v) => ({ ...v, stageIndex: 1, lastStageIndex: 1 })) };
  if (top.length > 0) state = stackEncounterDeck(state, ...top);
  const ultron = state.activeVillainId!;
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender" && choice.prompt.attack.enemyInstanceId === ultron) {
      if (defender === "none") return ["decline"];
      // The other player's hero defends.
      const id = identityOf(s, choice.playerId === P1 ? P2 : P1);
      return choice.options.some((o) => o.optionId === id) ? [id] : ["decline"];
    }
    return firstLegal(s);
  };
  const { events } = driveEventsPicking(CORE_DEPS, state, pick, endTurn(P1), endTurn(P2));
  const attacks = events.filter(
    (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
      e.type === "attackResolved" && e.enemyInstanceId === ultron,
  );
  return attacks;
}

describe("Ultron (II) forced interrupt: +1 ATK for each Drone engaged with the attacked player", () => {
  it("counts the Drone it just put into play (1 Drone + 1 new = ATK 2 + 2)", () => {
    expect(ultronAttacks([], "none")[0]).toMatchObject({ baseAtk: 4 });
  });

  it("still counts when another player's hero defends", () => {
    expect(ultronAttacks([], "other")[0]).toMatchObject({ baseAtk: 4 });
  });

  it("still counts when an Android Efficiency (01144a-c) is turned up as the boost card and puts another Drone into play", () => {
    for (const defender of ["none", "other"] as const) {
      const attacks = ultronAttacks(["01144a", "01144b", "01144c", "01186"], defender);
      // The bonus is read live, as the damage is dealt: with nobody else defending, the boost card's Drone is engaged
      // with the attacked player too (a boost card's "you" is the defending player), so it counts; with another
      // player defending it goes to them.
      expect(attacks[0]).toMatchObject({ baseAtk: defender === "none" ? 5 : 4 });
      // The second attack (on the other player) counts that player's Drones too, plus the ones added since.
      expect(attacks[1]!.baseAtk).toBeGreaterThanOrEqual(4);
    }
  });
});
