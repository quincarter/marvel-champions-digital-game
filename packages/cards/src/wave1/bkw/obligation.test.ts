import { activeEncounterDeck } from "@mc/engine";
import {
  answer,
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
  settleUntil,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { BKW_DEPS, runBkw, startBkwGame } from "./testing.js";

const ADVANCE = "01186"; // a neutral 0-icon card, drawn as the villain's boost ahead of the stacked obligation

describe("Burn Notice (Black Widow's obligation)", () => {
  it("the alternative discards the Preparation card with the highest cost and discards the obligation", () => {
    const start = startBkwGame(wave1Scenario("rhino", { players: [{ starterDeckId: "bkw-justice" }], seed: 2101 }));
    const given = moveToHand(start, P1, "08018", "08008"); // Spycraft (cost 1), Grappling Hook (cost 2)
    const [spycraft, hook] = given.ids as [never, never];
    // Spycraft is "Play only if you control a SPY character": Black Widow is a Spy, Natasha Romanoff is not.
    const hero = runBkw(given.state, toHero());
    const withSpycraft = runBkw(hero, play(P1, spycraft, payWith(hero, P1, 1, [spycraft, hook])));
    const withBoth = settle(
      runBkw(withSpycraft, play(P1, hook, payWith(withSpycraft, P1, 2, [hook]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    expect(inst(withBoth, hook).attachedTo ?? playerOf(withBoth, P1).playArea.includes(hook)).toBeTruthy();

    const stacked = stackEncounterDeck(withBoth, ADVANCE, "08025");
    const atFlip = settleUntil(runBkw(stacked, endTurn()), "chooseOption", firstLegal, BKW_DEPS);
    // In hero form the obligation first offers "You may flip to alter-ego form"; stay a hero.
    const stay = atFlip.pendingChoice!.options.findIndex((o) => o.label === "Stay in hero form");
    // Staying a hero, "Exhaust Natasha Romanoff → remove this card from the game" can't be paid (she is the alter
    // ego), so discarding is the only legal choice and resolves without a prompt.
    const after = settle(answer(atFlip, [String(stay)], BKW_DEPS), firstLegal, undefined, BKW_DEPS);

    expect(playerOf(after, P1).discard).toContain(hook);
    expect(playerOf(after, P1).discard).not.toContain(spycraft);
    expect(activeEncounterDeck(after).discard).toContain(instancesOf(after, "08025")[0]);
  });
});
