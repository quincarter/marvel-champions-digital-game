import { cardId } from "@mc/content";
import { cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { revealFromEncounterDeck, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { COLOSSUS_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { colossusGame } from "./support.js";

const ADVANCE = "01186";
/** Colossus starts in alter-ego form; the tough-card cases need hero form (the two-card limit is his hero side). */
const inHeroForm = () => withForm(colossusGame(), { heroForm: 0 });
const hero = (state: GameState) => identityOf(state, P1);
const tough = (state: GameState) => inst(state, hero(state)).statuses.tough;
const withTough = (state: GameState, n: number) =>
  patchInstance(state, hero(state), { statuses: { ...inst(state, hero(state)).statuses, tough: n } });
const withStatuses = (state: GameState, statuses: Partial<ReturnType<typeof inst>["statuses"]>) =>
  patchInstance(state, hero(state), { statuses: { ...inst(state, hero(state)).statuses, ...statuses } });
const optionsNamed =
  (...fragments: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      for (const fragment of fragments) {
        const hit = choice.options.find((o) => o.label.includes(fragment));
        if (hit) return [hit.optionId];
      }
    }
    return firstLegal(state);
  };
const pass = (state: GameState, pick: Picker = firstLegal) =>
  settle(runWith(WAVE6_DEPS, state, endTurn(P1)), pick, undefined, WAVE6_DEPS);
const encounterDeckCount = (state: GameState) => Object.values(state.encounterDecks)[0]!.deck.length;
const inEncounterDiscard = (state: GameState, id: InstanceId) =>
  Object.values(state.encounterDecks).some((pile) => pile.discard.includes(id));

describe("Colossus's obligation and nemesis set (32025-32029)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(COLOSSUS_OBLIGATION_NEMESIS).sort()).toEqual([
      "32025.obligation",
      "32026.boost",
      "32027.when-revealed",
      "32028.unstoppable-constant",
      "32028.unstoppable-forced-interrupt",
      "32029.boost",
      "32029.when-revealed",
    ]);
    for (const definition of Object.values(COLOSSUS_OBLIGATION_NEMESIS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Homesick (32025)", () => {
    const revealObligation = (state: GameState, pick: Picker) =>
      pass(stackEncounterDeck(state, ADVANCE, "32025"), pick);
    const homesick = (state: GameState) => instancesOf(state, "32025")[0]!;

    it("flip, then exhaust Piotr Rasputin: removes Homesick from the game", () => {
      const after = revealObligation(colossusGame(), optionsNamed("Flip to alter-ego", "Exhaust Piotr"));
      expect(after.removedFromGame).toContain(homesick(after));
      expect(inst(after, hero(after)).exhausted).toBe(true);
      expect(cardsInPlay(after)).not.toContain(homesick(after));
    });

    const discardChoice = optionsNamed("Stay in hero form", "Discard this card");
    it("the other choice discards each tough status card from his identity and Homesick, with no surge", () => {
      const state = withTough(inHeroForm(), 2);
      const after = revealObligation(state, discardChoice);
      expect(tough(after)).toBe(0);
      expect(inEncounterDiscard(after, homesick(after))).toBe(true);
      expect(after.removedFromGame).not.toContain(homesick(after));
    });

    it("discarding no tough status card makes Homesick gain surge (one more encounter card is revealed)", () => {
      const withCards = revealObligation(withTough(inHeroForm(), 2), discardChoice);
      const withoutCards = revealObligation(inHeroForm(), discardChoice);
      expect(inEncounterDiscard(withoutCards, homesick(withoutCards))).toBe(true);
      // Tough 2 is spent by the villain's attack (1) and Homesick (1 left): no surge; none left: surge reveals a card.
      expect(encounterDeckCount(withoutCards)).toBeLessThan(encounterDeckCount(withCards));
    });
  });

  describe("Juggernaut (32026, nemesis minion)", () => {
    it("is revealed from the set-aside nemesis cards into play", () => {
      const { state, id } = revealFromEncounterDeck(WAVE6_DEPS, colossusGame(), "32026");
      expect(cardsInPlay(state)).toContain(id);
    });

    it("as a boost card, the attack gains piercing: both tough cards are discarded and the damage lands", () => {
      const state = withTough(inHeroForm(), 2);
      const staged = stackSetAside(state, "32026");
      const after = pass(staged);
      expect(tough(after)).toBe(0);
      expect(inst(after, hero(after)).damage).toBeGreaterThan(0);
    });

    it("control: without the boost one tough card absorbs the attack alone", () => {
      const state = withTough(inHeroForm(), 2);
      const after = pass(stackEncounterDeck(state, ADVANCE));
      expect(tough(after)).toBe(1);
      expect(inst(after, hero(after)).damage).toBe(0);
    });
  });

  describe("Rampaging Juggernaut (32027)", () => {
    const threatOf = (state: GameState, id: InstanceId) => inst(state, id).threat;
    it("discards each tough card from friendly characters and places 2 threat per card discarded", () => {
      // The villain is stunned so its attack (before the reveal) does not use up a tough card first.
      const calm = (state: GameState) =>
        patchInstance(state, state.villains[0]!.instanceId, {
          statuses: { ...inst(state, state.villains[0]!.instanceId).statuses, stunned: 1 },
        });
      const none = revealFromEncounterDeck(WAVE6_DEPS, calm(inHeroForm()), "32027", firstLegal, 0);
      const two = revealFromEncounterDeck(WAVE6_DEPS, calm(withTough(inHeroForm(), 2)), "32027", firstLegal, 0);
      expect(tough(two.state)).toBe(0);
      expect(threatOf(two.state, two.id)).toBe(threatOf(none.state, none.id) + 4);
    });
  });

  describe("Unstoppable (32028)", () => {
    it("attaches to the enemy with the highest printed ATK", () => {
      const { state, id } = revealFromEncounterDeck(WAVE6_DEPS, inHeroForm(), "32028");
      const villain = state.villains[0]!.instanceId;
      expect(inst(state, villain).attachments).toContain(id);
    });

    it("forced interrupt: the attached enemy's next attack gains piercing, and Unstoppable is discarded after it", () => {
      const { state: attached, id } = revealFromEncounterDeck(WAVE6_DEPS, inHeroForm(), "32028");
      const ready = withTough(attached, 2);
      const after = pass(stackEncounterDeck(ready, ADVANCE));
      expect(tough(after)).toBe(0);
      expect(inEncounterDiscard(after, id)).toBe(true);
    });

    it("gains surge when every enemy already has a copy attached", () => {
      const { state: first } = revealFromEncounterDeck(WAVE6_DEPS, inHeroForm(), "32028");
      const villain = first.villains[0]!.instanceId;
      const advancesDiscarded = (state: GameState) =>
        instancesOf(state, ADVANCE).filter((id) => inEncounterDiscard(state, id)).length;
      // The stunned villain skips its attack (and boost), so the first copy is still attached when the second is
      // revealed. Top to bottom: the second Unstoppable, then a marker Advance that only a surge reveal reaches.
      const staged = stackSetAside(stackEncounterDeck(first, ADVANCE), "32028");
      const stunnedVillain = patchInstance(staged, villain, {
        statuses: { ...inst(staged, villain).statuses, stunned: 1 },
      });
      const second = pass(stunnedVillain);
      expect(inst(second, villain).attachments.length).toBeLessThanOrEqual(1);
      expect(advancesDiscarded(second)).toBe(advancesDiscarded(first) + 1);
    });
  });

  describe("Slammed (32029)", () => {
    const slammed = (state: GameState) => revealFromEncounterDeck(WAVE6_DEPS, state, "32029").state;
    it("stuns you when you are not stunned", () => {
      const after = slammed(colossusGame());
      expect(inst(after, hero(after)).statuses.stunned).toBe(1);
    });

    it("deals 2 damage to you when you are already stunned", () => {
      const open = slammed(colossusGame());
      const stunned = slammed(withStatuses(colossusGame(), { stunned: 1 }));
      expect(inst(stunned, hero(stunned)).damage).toBe(inst(open, hero(open)).damage + 2);
    });

    it("as a boost card, is revealed: you are stunned", () => {
      const after = pass(stackSetAside(colossusGame(), "32029"));
      expect(inst(after, hero(after)).statuses.stunned).toBe(1);
      expect(instancesOf(after, "32029").length).toBe(1);
      expect(cardId("32029")).toBeDefined();
    });
  });
});
