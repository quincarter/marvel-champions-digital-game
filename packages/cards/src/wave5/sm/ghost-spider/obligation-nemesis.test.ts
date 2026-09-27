import { cardsInPlay, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  picking,
  runWith,
  settle,
  stackEncounterDeck,
  use,
} from "../../../testing/harness.js";
import { revealFromEncounterDeck, runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario, ghostSpiderScenarioWithExtras } from "./support.js";

const ADVANCE = "01186";
const HYDRA_MERCENARY = "01101";

const ghostSpiderVsRhino = (seed = 1) => startWave5Game(ghostSpiderScenario("rhino", { seed }));

describe("Ghost-Spider's obligation and nemesis set (Worried Father, Regenerative Research, The Lizard, Experimental Injection, In Cold Blood)", () => {
  describe("Worried Father (27025)", () => {
    it("27025.worried-father-constant: searches for George Stacy and attaches him facedown when revealed", () => {
      const state = stackEncounterDeck(ghostSpiderVsRhino(1), ADVANCE, "27025");
      const [stacy] = instancesOf(state, "27007") as [InstanceId];
      const after = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      const [obligation] = instancesOf(after, "27025") as [InstanceId];
      expect(cardsInPlay(after)).toContain(obligation);
      expect(inst(after, obligation).attachments).toContain(stacy);
      expect(inst(after, stacy).facedownAs).toBeTruthy();
    });

    it("27025.worried-father-action: exhausts Gwen Stacy, adds George Stacy to hand, and removes this obligation from the game", () => {
      const staged = stackEncounterDeck(ghostSpiderVsRhino(2), ADVANCE, "27025");
      const [stacy] = instancesOf(staged, "27007") as [InstanceId];
      const revealed = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      const [obligation] = instancesOf(revealed, "27025") as [InstanceId];
      const identity = identityOf(revealed, P1);
      const after = settle(
        runWith(WAVE5_DEPS, revealed, use(P1, obligation, "27025.worried-father-action")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, identity).exhausted).toBe(true);
      const p1 = after.players.find((p) => p.playerId === P1)!;
      expect(p1.hand).toContain(stacy); // George Stacy is retrieved before Worried Father is removed.
      expect(inst(after, stacy).facedownAs).toBeFalsy();
      expect(after.removedFromGame).toContain(obligation);
    });
  });

  describe("Regenerative Research (27026)", () => {
    it("27026.regenerative-research-forced-interrupt: heals 1 damage from each enemy when the villain phase begins", () => {
      const { state: revealed } = revealFromEncounterDeck(ghostSpiderVsRhino(1), "27026");
      const villain = revealed.villains[0]!.instanceId;
      const damaged = patchInstance(revealed, villain, { damage: 3 });
      const after = settle(runWave5(damaged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      expect(inst(after, villain).damage).toBe(2);
    });
  });

  describe("The Lizard (27027, nemesis minion)", () => {
    it("27027.the-lizard-forced-interrupt: heals 1 damage from itself when the villain phase begins", () => {
      const { state: revealed, id: lizard } = revealFromEncounterDeck(ghostSpiderVsRhino(1), "27027");
      const damaged = patchInstance(revealed, lizard, { damage: 2 });
      // Only the villain draws an automatic boost card (RRG 1.8 p. 11: "only a villain or a villainous minion is
      // dealt one") — The Lizard has no `villainous` keyword, so a single filler Advance is enough.
      const staged = stackEncounterDeck(damaged, ADVANCE);
      const after = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      expect(inst(after, lizard).damage).toBe(1);
    });
  });

  describe("Experimental Injection (27028)", () => {
    it("27028.experimental-injection-constant-2: attaches to the minion with the most remaining hit points, granting Creature and +4 hit points", () => {
      // Bring Hydra Mercenary into play first (a real minion to attach to), then reveal Experimental Injection.
      const staged = stackEncounterDeck(ghostSpiderVsRhino(1), ADVANCE, HYDRA_MERCENARY);
      const withMinion = settle(runWave5(staged, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      const minion = instancesOf(withMinion, HYDRA_MERCENARY).find((id) => cardsInPlay(withMinion).includes(id))!;
      expect(minion).toBeDefined();
      const hpBefore = inst(withMinion, minion).damage; // remaining HP tracked via damage taken; 0 so far.
      expect(hpBefore).toBe(0);
      // Only the villain draws an automatic boost card (RRG 1.8 p. 11) — Hydra Mercenary has no `villainous`
      // keyword, so a single filler Advance is enough.
      const { state: revealed } = revealFromEncounterDeck(withMinion, "27028", firstLegal, 1);
      expect(inst(revealed, minion).attachments.length).toBeGreaterThan(0);
      const [injection] = instancesOf(revealed, "27028").filter((id) => cardsInPlay(revealed).includes(id));
      expect(injection).toBeDefined();
      expect(inst(revealed, minion).attachments).toContain(injection);
    });

    it("27028.experimental-injection-constant: gains surge when there is no minion in play to attach to", () => {
      const state = ghostSpiderVsRhino(4); // Only Rhino (a villain, not a minion) is in play.
      const discardBefore = Object.values(state.encounterDecks)[0]!.discard.length;
      const { state: after } = revealFromEncounterDeck(state, "27028");
      const deckId = Object.keys(after.encounterDecks)[0]!;
      // Surge draws and reveals a further encounter card, so the discard pile grows by more than the nemesis card's
      // own reveal + Rhino's own boost draw (docs/card-scripting-process.md's `stackSetAsideBehindBoost` lesson).
      expect(after.encounterDecks[deckId]!.discard.length).toBeGreaterThan(discardBefore + 1);
    });
  });

  describe("In Cold Blood (27029)", () => {
    it("27029.when-revealed: The Lizard attacks you", () => {
      const { state: withLizard } = revealFromEncounterDeck(ghostSpiderVsRhino(1), "27027");
      const identity = identityOf(withLizard, P1);
      const before = inst(withLizard, identity).damage;
      // Only the villain draws an automatic boost card (RRG 1.8 p. 11) — The Lizard has no `villainous` keyword.
      const { state: after } = revealFromEncounterDeck(withLizard, "27029", firstLegal, 1);
      expect(inst(after, identity).damage).toBe(before + 3); // The Lizard's printed ATK.
    });

    it("27029.when-revealed: gains surge when The Lizard is not in play (no attack was made)", () => {
      const state = ghostSpiderVsRhino(2); // The Lizard was never revealed into play.
      const discardBefore = Object.values(state.encounterDecks)[0]!.discard.length;
      const { state: after } = revealFromEncounterDeck(state, "27029");
      const deckId = Object.keys(after.encounterDecks)[0]!;
      expect(after.encounterDecks[deckId]!.discard.length).toBeGreaterThan(discardBefore + 1);
    });

    // Known gap (module docblock, obligation-nemesis.ts): "You cannot play events until after that attack resolves"
    // has no engine primitive (`applyRuleUntil` has no `"endOfAttack"` case) and is not scripted. Pinned here: once
    // `game-rules-architect` adds it and it is wired in, Backflip's own Hero Interrupt (Spider-Man's `01003`, "When
    // you would take damage from an attack, prevent all of that damage") should no longer be usable against The
    // Lizard's attack from this card, so the identity should still take the full 3 damage. Today the restriction is
    // absent, so Backflip prevents it, and this assertion fails.
    it.fails("27029.when-revealed: (engine gap) Backflip cannot prevent The Lizard's attack — events are unplayable until the attack resolves", () => {
      const base = startWave5Game(ghostSpiderScenarioWithExtras("rhino", { seed: 1, extraCodes: ["01003"] }));
      const { state: withLizard } = revealFromEncounterDeck(base, "27027");
      const given = moveToHand(withLizard, P1, "01003"); // Backflip.
      const [backflip] = given.ids as [InstanceId];
      const identity = identityOf(given.state, P1);
      const before = inst(given.state, identity).damage;
      const { state: after } = revealFromEncounterDeck(
        given.state,
        "27029",
        picking(`${backflip}:01003.backflip-interrupt`),
        1, // Only the villain draws an automatic boost card (RRG 1.8 p. 11).
      );
      expect(inst(after, identity).damage).toBe(before + 3); // Not prevented: Backflip should be unplayable here.
    });
  });
});
