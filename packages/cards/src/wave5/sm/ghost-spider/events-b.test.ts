import { cardsInPlay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  runWith,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { moveToDiscard, withDamage } from "../../../testing/staging.js";
import { playFromHand, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "./support.js";

const ghostSpiderVsRhino = (seed = 1) => startWave5Game(ghostSpiderScenario("rhino", { seed }));

describe("Ghost-Spider's events, part B (27013–27019)", () => {
  it("27013.bait-and-switch-action: the villain attacks you (undefended), then removes 4 threat from the main scheme", () => {
    const state = ghostSpiderVsRhino();
    const given = moveToHand(run(state, toHero(P1)), P1, "27013");
    const [card] = given.ids as [never];
    const identity = identityOf(given.state);
    const mainScheme = given.state.mainScheme.instanceId;
    const staged = patchInstance(given.state, mainScheme, { threat: 8 });
    const damageBefore = inst(staged, identity).damage;
    const atDeclare = settleUntil(
      runWith(WAVE5_DEPS, staged, play(P1, card, payWith(staged, P1, 1, [card]))),
      "declareDefender",
      firstLegal,
      WAVE5_DEPS,
    );
    const declined = answer(atDeclare, ["decline"], WAVE5_DEPS); // undefended: Rhino's printed ATK 2 lands in full.
    const after = settle(declined, firstLegal, undefined, WAVE5_DEPS);
    expect(inst(after, identity).damage).toBe(damageBefore + 2);
    expect(mainThreat(after)).toBe(8 - 4);
  });

  it("27014.jump-flip-interrupt: prevents 2 damage, and removes 2 threat from the main scheme when paid with an [energy] resource", () => {
    const state = ghostSpiderVsRhino();
    // Jump Flip itself, and Bait and Switch (27013, an [energy] resource icon) to pay with.
    const given = moveToHand(run(state, toHero(P1)), P1, "27014", "27013");
    const [jumpFlip, payment] = given.ids as [never, never];
    const identity = identityOf(given.state);
    const mainScheme = given.state.mainScheme.instanceId;
    // Below the main scheme's own target threat (7 at 1 player) — high enough to observe the full 2-point removal,
    // low enough that reaching the villain phase doesn't complete it and end the game first.
    const staged = patchInstance(given.state, mainScheme, { threat: 5 });
    // Advance (0 boost icons): Rhino attacks with its printed ATK 2 only (the same neutral stack
    // `wave2/scw/kit.test.ts`'s own "Magic Shield" test uses for an undefended Rhino attack).
    const stacked = stackEncounterDeck(staged, "01186");
    const damageBefore = inst(stacked, identity).damage;
    const option = `${jumpFlip}:27014.jump-flip-interrupt`;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      if (choice.options.some((o) => o.optionId === option)) return [option];
      if (choice.prompt.kind === "payForCard" && choice.prompt.instanceId === jumpFlip) return [`hand:${payment}`];
      return firstLegal(s);
    };
    const atDeclare = settleUntil(runWith(WAVE5_DEPS, stacked, endTurn(P1)), "declareDefender", firstLegal, WAVE5_DEPS);
    const declined = answer(atDeclare, ["decline"], WAVE5_DEPS); // undefended: Rhino's printed ATK 2 lands in full.
    // Advance's own "When Revealed: the villain schemes" resolves too (RRG 1.8 "Boost Card", p. 11: a boost card's
    // own text resolves same as any other reveal) — measured here, right before Jump Flip's own interrupt fires,
    // rather than assumed, since it lands Rhino's SCH (1) on the main scheme before the attack finishes.
    const threatBefore = mainThreat(declined);
    const after = settle(declined, pick, undefined, WAVE5_DEPS);
    // Rhino's printed ATK 2, undefended, minus Jump Flip's 2 prevented = 0.
    expect(inst(after, identity).damage).toBe(damageBefore);
    expect(mainThreat(after)).toBe(threatBefore - 2);
    expect(playerOf(after, P1).discard).toContain(jumpFlip);
  });

  it("27015.return-the-favor-action: discards from the top of the encounter deck until a treachery, then deals 5 damage to the villain", () => {
    const state = ghostSpiderVsRhino();
    const given = moveToHand(run(state, toHero(P1)), P1, "27015");
    const [card] = given.ids as [never];
    const villain = given.state.villains[0]!.instanceId;
    // Advance (01186) is itself a treachery (0 boost icons, "the villain schemes"): stacked on top, it is both the
    // first card discarded and the treachery that ends the search, so no other card needs staging beneath it.
    const stacked = stackEncounterDeck(given.state, "01186");
    const damageBefore = inst(stacked, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, stacked, play(P1, card, payWith(stacked, P1, 0, [card]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(damageBefore + 5);
    expect(playerOf(after, P1).discard).toContain(card);
  });

  it("27016.what-doesnt-kill-me-action: heals 2 damage from your hero, then readies it", () => {
    const state = ghostSpiderVsRhino();
    // Strength (27022, [physical][physical]) pays the printed Requirement ([physical]) in one card.
    const given = moveToHand(run(state, toHero(P1)), P1, "27016", "27022");
    const [card, strength] = given.ids as [never, never];
    const identity = identityOf(given.state);
    const damaged = withDamage(given.state, identity, 4);
    const exhausted = patchInstance(damaged, identity, { exhausted: true });
    const after = settle(runWith(WAVE5_DEPS, exhausted, play(P1, card, [strength])), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(after, identity).damage).toBe(2);
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("27018.across-the-spider-verse-action: exhausts a Web-Warrior card, finds an ally in the discard pile, and may repeat for a chosen player", () => {
    const state = ghostSpiderVsRhino();
    const hero = run(state, toHero(P1));
    const identity = identityOf(hero);
    // Spider-Man (Miles Morales, 27011): a Web-Warrior ally, discarded so the search has something to find.
    const withMilesDiscarded = moveToDiscard(hero, P1, "27011");
    const miles = withMilesDiscarded.id;
    const given = moveToHand(withMilesDiscarded.state, P1, "27018");
    const [card] = given.ids as [never];
    let repeats = 0;
    // Repeat exactly once: the repeat's own exhaust step falls to Miles Morales (Ghost-Spider is already
    // exhausted from the first sentence), and its own search finds nothing (he's already in play) — proving the
    // loop actually re-runs the whole "exhaust / search / put into play" sentence, not just the "choose a player"
    // tail, matching the FAQ's "repeating the ability … includes the repeat effect itself" (RRG 1.8 p. 62/63).
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      const prompt = choice.prompt;
      if (prompt.kind === "chooseCards" && prompt.slot === "found") {
        return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
      }
      if (prompt.kind === "chooseOption") {
        const wantsRepeat = repeats < 1;
        const label = wantsRepeat ? "Spend 3 resources of any type to repeat" : "Do not repeat";
        const found = choice.options.find((o) => o.label === label);
        if (found) {
          if (wantsRepeat) repeats++;
          return [found.optionId];
        }
      }
      // "Spend 3 resources of any type" — pay it in full (`firstLegal`'s own `minSelections: 0` here would
      // otherwise decline the spend for free, the same `payForCard` pitfall `events-a.test.ts`'s own `accepting`
      // works around).
      if (prompt.kind === "spendResources") {
        return choice.options.slice(0, 3).map((o) => o.optionId);
      }
      return firstLegal(s);
    };
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 2, [card]))),
      pick,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(true); // the printed sentence's own exhaust
    expect(cardsInPlay(after)).toContain(miles); // found in the discard pile and put into play
    expect(inst(after, miles).exhausted).toBe(true); // exhausted again for the one repeat
    expect(repeats).toBe(1);
  });

  it("27018.across-the-spider-verse-action: the exhaust is a cost, so with no ready Web-Warrior card the event is not playable", () => {
    const hero = run(ghostSpiderVsRhino(), toHero(P1));
    const identity = identityOf(hero);
    const given = moveToHand(moveToDiscard(hero, P1, "27011").state, P1, "27018");
    const [card] = given.ids as [never];
    const spent = patchInstance(given.state, identity, { exhausted: true });
    expect(() => runWith(WAVE5_DEPS, spent, play(P1, card, payWith(spent, P1, 2, [card])))).toThrow();
  });

  it("27018.across-the-spider-verse-action: the chosen Web-Warrior card is exhausted as the cost (an ally in play, the identity stays ready)", () => {
    const hero = run(ghostSpiderVsRhino(), toHero(P1));
    const identity = identityOf(hero);
    const { state: withAlly, id: ally } = playFromHand(hero, "27011", 4); // Spider-Man (Miles Morales), a Web-Warrior ally.
    const given = moveToHand(withAlly, P1, "27018");
    const [card] = given.ids as [never];
    const after = settle(
      runWith(
        WAVE5_DEPS,
        given.state,
        play(P1, card, payWith(given.state, P1, 2, [card]), { costChoices: { exhausted: [ally] } }),
      ),
      (s) =>
        s.pendingChoice?.prompt.kind === "chooseOption" ? [s.pendingChoice.options.at(-1)!.optionId] : firstLegal(s),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, ally).exhausted).toBe(true);
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("27019.young-love-action: heals 3 damage each from Gwen Stacy (the identity) and Miles Morales", () => {
    const state = ghostSpiderVsRhino();
    const { state: withMiles, id: miles } = playFromHand(state, "27011", 4); // Spider-Man (Miles Morales).
    const identity = identityOf(withMiles);
    const damaged = withDamage(withDamage(withMiles, identity, 5), miles, 2);
    const given = moveToHand(damaged, P1, "27019");
    const [card] = given.ids as [never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 1, [card]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).damage).toBe(2); // 5 - 3
    expect(inst(after, miles).damage).toBe(0); // 2 - 3, floored at 0
  });
});
