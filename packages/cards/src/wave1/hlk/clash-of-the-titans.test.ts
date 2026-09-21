import { activeEncounterDeck } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { HLK_DEPS, runHlk, stackFromSetAside, startHlkGame } from "./testing.js";

const ADVANCE = "01186"; // a neutral 0-icon card, drawn as the villain's boost ahead of the stacked treachery

describe("Clash of the Titans (Hulk's nemesis set)", () => {
  it("makes the enemy with the highest ATK attack the ally with the highest ATK when no hero is in play", () => {
    const start = startHlkGame(wave1Scenario("rhino", { players: [{ starterDeckId: "hlk-aggression" }], seed: 2026 }));
    const given = moveToHand(start, P1, "10011"); // Brawn (ATK 1)
    const [brawn] = given.ids as [never];
    const withBrawn = settle(
      runHlk(given.state, play(P1, brawn, payWith(given.state, P1, 3, [brawn]))),
      firstLegal,
      undefined,
      HLK_DEPS,
    );
    expect(playerOf(withBrawn, P1).playArea).toContain(brawn);
    expect(playerOf(withBrawn, P1).identity.form).toBe("alterEgo");

    // In alter-ego form Rhino only schemes against this player, so any damage on Brawn comes from Clash of the Titans.
    // Clash of the Titans is in Hulk's nemesis set, set aside at setup until an effect brings it in.
    const stacked = stackEncounterDeck(stackFromSetAside(withBrawn, P1, "10028"), ADVANCE, "10028");
    const after = settle(
      runHlk(stacked, endTurn()),
      firstLegal,
      (s) => activeEncounterDeck(s).discard.includes(instancesOf(s, "10028")[0]!),
      HLK_DEPS,
    );

    const brawnHurt = inst(after, brawn).damage > 0 || playerOf(after, P1).discard.includes(brawn);
    expect(brawnHurt).toBe(true);
    expect(activeEncounterDeck(after).discard).toContain(instancesOf(after, "10028")[0]);
  });
});
