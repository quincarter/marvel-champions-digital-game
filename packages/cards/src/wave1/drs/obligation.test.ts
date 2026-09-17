import { playCostOf } from "@mc/engine";
import { activeEncounterDeck, activeVillain, remainingHitPoints } from "@mc/engine";
import { answer, endTurn, firstLegal, identityOf, inst, moveToHand, P1, patchInstance, payWith, play, playerOf, settle, settleUntil, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { DRS_DEPS, runDrs, startDrsGame } from "./testing.js";

const drsVsRhino = (seed = 3301) => startDrsGame(wave1Scenario("rhino", { players: [{ starterDeckId: "drs-protection" }], seed }));

const ADVANCE = "01186"; // a neutral 0-icon card, drawn as the villain's boost ahead of the stacked obligation

describe("Physical Toll (Doctor Strange's obligation)", () => {
  it("the alternative increases the next event's cost by 3, then discards itself once that event is played", () => {
    const start = drsVsRhino();
    const hero = runDrs(start, toHero());
    const stacked = stackEncounterDeck(hero, ADVANCE, "09027");
    const atFlip = settleUntil(runDrs(stacked, endTurn()), "chooseOption", firstLegal, DRS_DEPS);
    // In hero form the obligation first offers "You may flip to alter-ego form"; stay a hero.
    const stayLabel = atFlip.pendingChoice!.options.findIndex((o) => o.label === "Stay in hero form");
    // Staying a hero, "Exhaust Stephen Strange → remove this obligation from the game" can't be paid (he is the
    // alter ego), so the alternative is the only legal choice and resolves without a further prompt.
    const after = settle(answer(atFlip, [String(stayLabel)], DRS_DEPS), firstLegal, (s) => s.step.kind === "turn", DRS_DEPS);

    const physicalToll = playerOf(after, P1).playArea.find((id) => after.instances[id]?.cardId === ("09027" as never));
    expect(physicalToll).toBeDefined();

    // Momentum Shift/Warning (the two events under test) plus enough guaranteed single-value filler to pay a cost
    // of 5 in cards, regardless of how much of the starting hand this round's own discard-to-hand-size already used.
    const given = moveToHand(after, P1, "09016", "09021", "09003", "09005", "09007", "09010", "09022");
    const [momentumShift, warning] = given.ids as [never, never];
    // Whichever event is played first pays the +3 tax; a second event afterward is back to its printed cost.
    expect(playCostOf(given.state, P1, momentumShift, DRS_DEPS)?.current).toBe(5); // printed 2 + 3
    expect(playCostOf(given.state, P1, warning, DRS_DEPS)?.current).toBe(3); // printed 0 + 3

    const identity = identityOf(given.state);
    const damaged = patchInstance(given.state, identity, { damage: 2 }); // to pay Momentum Shift's own heal-2 cost
    const villain = activeVillain(damaged).instanceId;
    const hpBefore = remainingHitPoints(damaged, villain);
    const paid = payWith(damaged, P1, 5, [momentumShift, warning]);
    const played = settle(runDrs(damaged, play(P1, momentumShift, paid)), firstLegal, undefined, DRS_DEPS);
    // Momentum Shift's own effect still resolved normally — the tax is on the *cost*, not the card's own text.
    expect(remainingHitPoints(played, villain)).toBe(hpBefore! - 2);
    expect(inst(played, identity).damage).toBe(0);
    // "Discard this obligation after you play an event" — fires once Momentum Shift's own play has finished.
    expect(activeEncounterDeck(played).discard).toContain(physicalToll);
    expect(playerOf(played, P1).playArea).not.toContain(physicalToll);

    // The tax is gone with the obligation: Warning is back to its printed cost of 0.
    expect(playCostOf(played, P1, warning, DRS_DEPS)?.current).toBe(0);
  });

  it("exhausting Stephen Strange removes it from the game instead, while in alter-ego form", () => {
    const start = drsVsRhino();
    const stacked = stackEncounterDeck(start, ADVANCE, "09027"); // still alter-ego at the start of the game
    const atFlip = settleUntil(runDrs(stacked, endTurn()), "chooseOption", firstLegal, DRS_DEPS);
    // Already alter-ego: "You may flip to alter-ego form" only offers when in hero form (`isHero()`'s `when`), so
    // this first `chooseOption` is already the exhaust-vs-alternative choice.
    const exhaustLabel = atFlip.pendingChoice!.options.findIndex((o) => o.label.startsWith("Exhaust Stephen Strange"));
    expect(exhaustLabel).toBeGreaterThanOrEqual(0);
    const identity = identityOf(atFlip);
    const after = settle(answer(atFlip, [String(exhaustLabel)], DRS_DEPS), firstLegal, (s) => s.step.kind === "turn", DRS_DEPS);
    expect(inst(after, identity).exhausted).toBe(true);
    // Removed from the game, not merely discarded: absent from both the encounter discard and the player's play area.
    const stillInDiscard = activeEncounterDeck(after).discard.some((id) => after.instances[id]?.cardId === ("09027" as never));
    expect(stillInDiscard).toBe(false);
    expect(playerOf(after, P1).playArea.some((id) => after.instances[id]?.cardId === ("09027" as never))).toBe(false);
  });
});
