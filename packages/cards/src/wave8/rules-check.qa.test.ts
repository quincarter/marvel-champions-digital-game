import { type GameEvent, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { firstLegal, P1, putOnTopOfDeck, use, type Picker } from "../testing/harness.js";
import { driveEventsPicking } from "../testing/staging.js";
import {
  atMission,
  attempting,
  CAMPAIGN_DEPS,
  campaignGame,
  MISSION_TEAM,
  MISSION_TEAM_ACTION,
  theCard,
} from "./aoa/campaign/testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 8 rules check (docs/phase7-wave8-rules-check.md): one pin for each behavior the check found to contradict a
 * primary source. Each pin is a pair: an `it.fails` that states what the source says should happen (so it turns green
 * when the game is fixed, and the owner flips it to a plain `it`), and a companion that states what the game does today
 * (so a change of behavior in either direction shows up here, on purpose).
 *
 * The engine-rule pin of the same check is in `packages/engine/src/rules-check.qa.test.ts`.
 *
 * Staging: the one-player Evacuate Survivors table of `aoa/campaign/mission-responses.test.ts` (Randall [wild], X-23
 * [physical] and Marrow [energy] at the mission, the Overseer beside them, Mission Team in front of the player, the
 * top of the deck stacked with the cards the attempt discards).
 */
const RANDALL = "45003";
const X23 = "45012";
const MARROW = "45021";
const CROWN = "45033";
const CLOBBER = "45046";
const BLOODGEM = "45050";
const DIGGING_DEEP = "40060";
const ENERGY = "01088"; // Energy: two [energy] resource icons.
const MIKHAIL = "45183a";

/** Mikhail Rasputin's Mission Response, which the check found built as one choice for each [energy] icon. */
function mikhailAttempt() {
  const game = campaignGame({
    deck: [RANDALL, X23, MARROW, CROWN, CLOBBER, CLOBBER, BLOODGEM, DIGGING_DEEP],
    mission: { mission: "45167a", overseer: MIKHAIL, team: true },
  });
  const allies = atMission(game, P1, RANDALL, X23, MARROW);
  const stacked = putOnTopOfDeck(allies.state, P1, ENERGY, CLOBBER, BLOODGEM);
  const [randall, x23, marrow] = allies.ids as [InstanceId, InstanceId, InstanceId];
  const team = theCard(stacked.state, MISSION_TEAM);
  const choices: string[][] = [];
  const pick = attempting(
    () => [],
    (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTarget" && choice.options.some((o) => o.optionId === marrow)) {
        choices.push(choice.options.map((o) => o.optionId));
        return [marrow];
      }
      return firstLegal(state);
    },
  );
  const run = driveEventsPicking(CAMPAIGN_DEPS, stacked.state, pick as Picker, use(P1, team, MISSION_TEAM_ACTION));
  const hits = run.events
    .filter((e): e is Extract<GameEvent, { type: "damageDealt" }> => e.type === "damageDealt")
    .filter((e) => e.targetInstanceId === marrow)
    .map((e) => e.amount);
  return { choices: choices.length, options: [randall, x23, marrow], hits };
}

describe("rules check: Mikhail Rasputin's Mission Response against RRG 1.8 'For Each' (p. 20)", () => {
  // Card text (45183a): "Mission Response: After you discard cards, deal 1 damage to an ally at the mission for each
  // energy resource ([energy]) discarded." RRG p. 20: "If an effect with 'for each' requires a target, that effect
  // applies to a single target unless the 'for each' clause includes a 'choose' instruction", and "a 'for each' effect
  // without a 'choose' instruction ... is considered a single instance of damage dealt". The card prints no "choose",
  // so Energy's two [energy] icons choose one ally once and deal it one instance of 2 damage.
  it.fails("expected: one ally is chosen once and takes one instance of 2 damage", () => {
    const run = mikhailAttempt();
    expect(run.choices).toBe(1);
    expect(run.hits).toEqual([2]);
  });

  it("today: the player is asked once for each [energy] icon and the ally takes two separate instances of 1", () => {
    const run = mikhailAttempt();
    expect(run.choices).toBe(2);
    expect(run.hits).toEqual([1, 1]);
  });
});
