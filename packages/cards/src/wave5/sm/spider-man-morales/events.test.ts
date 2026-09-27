import { activeEncounterDeck } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
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
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { playFromHand, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { spiderManMoralesScenario } from "./support.js";

const milesVsRhino = (seed = 1) => startWave5Game(spiderManMoralesScenario("rhino", { seed }));

/** Answers any offered optional trigger window by accepting it, then defers to `firstLegal` for anything else —
 * enough for these tests, where the only optional windows are a single villain auto-bound as the target. */
const accepting: Picker = (state) => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return firstLegal(state);
};

/** Picks the `chooseOption` (`chooseOne`) whose label is `label`, and otherwise defers to `firstLegal`. */
const choosing =
  (label: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const found = choice.options.find((o) => o.label === label);
      if (found) return [found.optionId];
    }
    return firstLegal(state);
  };

describe("Spider-Man / Miles Morales's own events (27031, 27032, 27033, 27034)", () => {
  it("27031.arachnobatics-action: deals 2 damage to an enemy, +3 more each if it's stunned and/or confused", () => {
    const state = milesVsRhino();
    const villain = state.villains[0]!.instanceId;
    const given = moveToHand(run(state, toHero(P1)), P1, "27031");
    const [card] = given.ids as [never];
    const plain = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 1, [card]))),
      accepting,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(plain, villain).damage).toBe(2);
  });

  it("27031.arachnobatics-action: both bonuses apply at once (stunned and confused reads 2 + 3 + 3)", () => {
    const state = milesVsRhino();
    const villain = state.villains[0]!.instanceId;
    const withStatuses = patchInstance(state, villain, { statuses: { stunned: 1, confused: 1, tough: 0 } });
    const given = moveToHand(run(withStatuses, toHero(P1)), P1, "27031");
    const [card] = given.ids as [never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 1, [card]))),
      accepting,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(8);
  });

  it("27032.double-life-action: paid with a [physical] resource — changes form and readies the identity", () => {
    const state = milesVsRhino();
    const identity = identityOf(state);
    const exhausted = patchInstance(state, identity, { exhausted: true });
    // Web-Shooter (27039): printed [physical] resource icon, real precon data.
    const given = moveToHand(exhausted, P1, "27032", "27039");
    const [doubleLife, webShooter] = given.ids as [never, never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, doubleLife, [webShooter])),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(after.players[0]!.identity.form).toBe("hero"); // started alter-ego (RRG default opening form).
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("27032.double-life-action: paid without a [physical] resource — changes form, but the identity stays exhausted", () => {
    const state = milesVsRhino();
    const identity = identityOf(state);
    const exhausted = patchInstance(state, identity, { exhausted: true });
    // Defense Mechanism (27038): printed [mental] resource icon, not [physical].
    const given = moveToHand(exhausted, P1, "27032", "27038");
    const [doubleLife, defenseMechanism] = given.ids as [never, never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, doubleLife, [defenseMechanism])),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(after.players[0]!.identity.form).toBe("hero");
    expect(inst(after, identity).exhausted).toBe(true);
  });

  it("27033.swing-in-action: removes 4 threat and, paid with a [mental] resource, resolves Spider Camouflage", () => {
    const state = milesVsRhino();
    const identity = identityOf(state);
    const villain = state.villains[0]!.instanceId;
    const withThreat = patchInstance(run(state, toHero(P1)), state.mainScheme.instanceId, { threat: 10 });
    // Defense Mechanism (27038, [mental]) plus one filler card for the event's own cost of 2.
    const given = moveToHand(withThreat, P1, "27033", "27038");
    const [swingIn, defenseMechanism] = given.ids as [never, never];
    const payment = [defenseMechanism, ...payWith(given.state, P1, 1, [swingIn, defenseMechanism])];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, swingIn, payment)),
      accepting,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(after)).toBe(6); // 10 - 4.
    expect(inst(after, identity).statuses.tough).toBe(1); // "Give Spider-Man a tough status card."
    expect(inst(after, villain).statuses.confused).toBe(1); // "Confuse an enemy."
  });

  it("27033.swing-in-action: paid without a [mental] resource — removes threat, but Spider Camouflage never resolves", () => {
    const state = milesVsRhino();
    const identity = identityOf(state);
    const villain = state.villains[0]!.instanceId;
    const withThreat = patchInstance(run(state, toHero(P1)), state.mainScheme.instanceId, { threat: 10 });
    // Jefferson Davis (27036) and Web-Shooter (27039): both [physical], never [mental].
    const given = moveToHand(withThreat, P1, "27033", "27036", "27039");
    const [swingIn, jeffersonDavis, webShooter] = given.ids as [never, never, never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, swingIn, [jeffersonDavis, webShooter])),
      accepting,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(after)).toBe(6);
    expect(inst(after, identity).statuses.tough).toBe(0);
    expect(inst(after, villain).statuses.confused).toBe(0);
  });

  it("27034.web-shot-action: deals 4 damage and, paid with a [energy] resource, resolves Venom Blast", () => {
    const state = milesVsRhino();
    const identity = identityOf(state);
    const villain = state.villains[0]!.instanceId;
    // Field Agent (27044, [energy]) plus one filler card for the event's own cost of 2.
    const given = moveToHand(run(state, toHero(P1)), P1, "27034", "27044");
    const [webShot, fieldAgent] = given.ids as [never, never];
    const payment = [fieldAgent, ...payWith(given.state, P1, 1, [webShot, fieldAgent])];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, webShot, payment)),
      accepting,
      undefined,
      WAVE5_DEPS,
    );
    // 4 (Web-Shot) + 2 (Venom Blast).
    expect(inst(after, villain).damage).toBe(6);
    expect(inst(after, villain).statuses.stunned).toBe(1);
    expect(inst(after, identity).exhausted).toBe(false); // sanity: playing an event never exhausts the identity.
  });

  it("27034.web-shot-action: paid without a [energy] resource — deals its own damage, but Venom Blast never resolves", () => {
    const state = milesVsRhino();
    const villain = state.villains[0]!.instanceId;
    // Defense Mechanism (27038) and Surveillance Team... (27036 is [physical]): neither is [energy].
    const given = moveToHand(run(state, toHero(P1)), P1, "27034", "27038", "27036");
    const [webShot, defenseMechanism, jeffersonDavis] = given.ids as [never, never, never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, webShot, [defenseMechanism, jeffersonDavis])),
      accepting,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(4);
    expect(inst(after, villain).statuses.stunned).toBe(0);
  });
});

describe("The precon's own aspect/basic events (27042, 27043, 27050)", () => {
  it("27042.homeland-intervention-action: exhausts the chosen S.H.I.E.L.D. cards and removes 2 threat per card", () => {
    const state = milesVsRhino();
    // Jefferson Davis (27036, support) and Field Agent (27044, support): both the exact [S.H.I.E.L.D.] trait.
    const withJefferson = playFromHand(state, "27036", 2);
    const withField = playFromHand(withJefferson.state, "27044", 1);
    const withThreat = patchInstance(withField.state, withField.state.mainScheme.instanceId, { threat: 10 });
    const given = moveToHand(withThreat, P1, "27042");
    const [card] = given.ids as [never];
    const pickBoth: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "exhausted") {
        return choice.options.map((o) => o.optionId); // Both S.H.I.E.L.D. cards in play.
      }
      return firstLegal(s);
    };
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 0, [card]))),
      pickBoth,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, withJefferson.id).exhausted).toBe(true);
    expect(inst(after, withField.id).exhausted).toBe(true);
    expect(mainThreat(after)).toBe(6); // 10 - (2 cards * 2 threat each).
  });

  it('27042.homeland-intervention-action: exhausting none is legal ("up to 3") and removes no threat', () => {
    const state = milesVsRhino();
    const withThreat = patchInstance(state, state.mainScheme.instanceId, { threat: 10 });
    const given = moveToHand(withThreat, P1, "27042");
    const [card] = given.ids as [never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 0, [card]))),
      firstLegal, // `min: 0` — declines the exhaust choice.
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(after)).toBe(10);
  });

  it("27043.global-logistics-action: the encounter deck — looks at the top 4, discards some, keeps the rest in that deck", () => {
    const state = milesVsRhino();
    const withJefferson = playFromHand(state, "27036", 2);
    const stacked = stackEncounterDeck(withJefferson.state, "01101", "01102", "01103", "01104");
    const given = moveToHand(stacked, P1, "27043");
    const [card] = given.ids as [never];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "discarded") {
        // Discard the first 2 looked-at cards, keep the other 2.
        return choice.options.slice(0, 2).map((o) => o.optionId);
      }
      return choosing("The encounter deck")(s);
    };
    const after = settle(
      runWith(
        WAVE5_DEPS,
        given.state,
        play(P1, card, payWith(given.state, P1, 0, [card]), { costChoices: { exhausted: [withJefferson.id] } }),
      ),
      pick,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, withJefferson.id).exhausted).toBe(true);
    const decks = activeEncounterDeck(after);
    // The 2 discarded ones are in the encounter discard pile...
    expect(decks.discard.length).toBeGreaterThanOrEqual(2);
    // ...and the deck (top and/or bottom) still has 40 cards total between it and its discard pile: nothing vanished.
    expect(decks.deck.length + decks.discard.length).toBe(
      activeEncounterDeck(stackEncounterDeck(state, "01101", "01102", "01103", "01104")).deck.length +
        activeEncounterDeck(state).discard.length,
    );
  });

  it("27043.global-logistics-action: a player deck — looks at the top 4 of that player's own deck, discards some", () => {
    const state = milesVsRhino();
    const withJefferson = playFromHand(state, "27036", 2);
    const given = moveToHand(withJefferson.state, P1, "27043");
    const [card] = given.ids as [never];
    const before = playerOf(given.state, P1).deck.slice(0, 4);
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "choosePlayer") return [P1];
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "discarded") {
        return choice.options.slice(0, 2).map((o) => o.optionId);
      }
      return choosing("A player deck")(s);
    };
    const after = settle(
      runWith(
        WAVE5_DEPS,
        given.state,
        play(P1, card, payWith(given.state, P1, 0, [card]), { costChoices: { exhausted: [withJefferson.id] } }),
      ),
      pick,
      undefined,
      WAVE5_DEPS,
    );
    const discarded = before.slice(0, 2);
    const kept = before.slice(2, 4);
    for (const id of discarded) expect(playerOf(after, P1).discard).toContain(id);
    for (const id of kept) expect(playerOf(after, P1).deck).toContain(id);
  });

  // docs/phase7-wave5.md §4.1 Q60: `reorderCards` to `"playerDeckTopOrBottom"`.
  it("27043.global-logistics-action: a player deck — a kept card can be sent to the bottom instead of the top", () => {
    const state = milesVsRhino();
    const withJefferson = playFromHand(state, "27036", 2);
    const given = moveToHand(withJefferson.state, P1, "27043");
    const [card] = given.ids as [never];
    const before = playerOf(given.state, P1).deck.slice(0, 4);
    const kept = before[0]!; // Discard nothing; ask for this one to go to the bottom.
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "choosePlayer") return [P1];
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "discarded") return [];
      if (choice?.prompt.kind === "chooseBottomCards") {
        expect(choice.prompt).toEqual({ kind: "chooseBottomCards", deck: "playerDeck", deckOwner: P1 });
        return [kept];
      }
      return choosing("A player deck")(s);
    };
    const after = settle(
      runWith(
        WAVE5_DEPS,
        given.state,
        play(P1, card, payWith(given.state, P1, 0, [card]), { costChoices: { exhausted: [withJefferson.id] } }),
      ),
      pick,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).deck.at(-1)).toBe(kept);
    // The other 3 stay on top, in whichever order was chosen.
    expect([...playerOf(after, P1).deck.slice(0, 3)].sort()).toEqual([...before.slice(1, 4)].sort());
  });

  it("27050.young-love-action: heals 3 damage each from Gwen Stacy (an ally) and Miles Morales (the identity)", () => {
    // Ghost-Spider (27048, ally, subtitle "Gwen Stacy"): "Play only if you control a Web-Warrior card" — Miles's hero
    // side (Spider-Man) is the Web-Warrior; his alter-ego side is Civilian only, so flip to hero first.
    const state = run(milesVsRhino(), toHero(P1));
    const { state: withGwenAsHero, id: gwen } = playFromHand(state, "27048", 3);
    // Young Love is an Alter-Ego Action: back to Miles Morales (test surgery; a second real change this round would
    // hit the once-per-round limit).
    const withGwen = withForm(withGwenAsHero, "alterEgo");
    const identity = identityOf(withGwen);
    const damaged = patchInstance(patchInstance(withGwen, identity, { damage: 5 }), gwen, { damage: 2 });
    const given = moveToHand(damaged, P1, "27050");
    const [card] = given.ids as [never];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, card, payWith(given.state, P1, 1, [card]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identity).damage).toBe(2); // 5 - 3.
    expect(inst(after, gwen).damage).toBe(0); // 2 - 3, floored at 0.
  });
});
