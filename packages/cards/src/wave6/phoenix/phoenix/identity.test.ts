import { cardId } from "@mc/content";
import { statBonus, traitsOf, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { heroAction, mergeRegistries, named, removeCountersFrom } from "../../../dsl/index.js";
import {
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  firstLegal,
  type Picker,
  use,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_ABILITIES, WAVE6_DEPS } from "../../index.js";
import { PHOENIX_IDENTITY } from "./identity.js";
import { phoenixGame } from "./support.js";

const decline: Picker = () => [];
const traitNames = (state: GameState, id: InstanceId, deps: EngineDeps = WAVE6_DEPS) =>
  traitsOf(state, id, deps).map(String);
const forceOf = (state: GameState): InstanceId => instancesOf(state, "34002a")[0]!;
const powerOf = (state: GameState): number => inst(state, forceOf(state)).counters.power ?? 0;
/** Takes every offered optional response (the first option of any choice that has one). */
const accept: Picker = (state) => {
  const choice = state.pendingChoice;
  return choice && choice.options.length > 0 ? [choice.options[0]!.optionId] : [];
};
const recover = (state: GameState): GameState =>
  settle(runWith(WAVE6_DEPS, state, { type: "basicRecover", playerId: P1 }), accept, undefined, WAVE6_DEPS);

/**
 * Psionic Bond (34001a) is not scripted (coverage.test.ts KNOWN_SKIPPED), so this stand-in on its id removes counters
 * as an action, to drive Phoenix Force's "last counter removed" response without an unscripted card.
 */
const REMOVER_DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE6_ABILITIES, {
    "34001a.psionic-bond": heroAction(removeCountersFrom(named("Phoenix Force"), "power", 1)),
  }),
};
const hero = (state: GameState) => withForm(state, { heroForm: 0 });

describe("Phoenix / Jean Grey and Phoenix Force (34001a/b, 34002a/b)", () => {
  it("registers the identity and Phoenix Force refs the card data names, all valid", () => {
    expect(Object.keys(PHOENIX_IDENTITY).sort()).toEqual([
      "34001b.jean-grey-response",
      "34001b.setup",
      "34002a.phoenix-force-constant",
      "34002a.phoenix-force-forced-response",
      "34002b.phoenix-force-constant",
      "34002b.phoenix-force-constant-2",
      "34002b.phoenix-force-forced-response",
    ]);
    for (const definition of Object.values(PHOENIX_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
    expect("34001a.psionic-bond" in WAVE6_ABILITIES).toBe(false); // KNOWN_SKIPPED: engine gap.
  });

  describe("34001b.setup", () => {
    it("puts Phoenix Force into play from the set-aside area, Restrained side up, attached, with 4 power counters", () => {
      const state = phoenixGame();
      const force = forceOf(state);
      const instance = inst(state, force);
      expect(instance.cardId).toBe(cardId("34002a"));
      expect(instance.flipped).toBe(false);
      expect(instance.attachedTo).toBe(identityOf(state));
      expect(instance.counters.power).toBe(4);
      expect(inst(state, identityOf(state)).attachments).toContain(force);
      expect(traitNames(state, identityOf(state))).toContain("RESTRAINED");
    });

    it("takes it from neither the deck, the hand nor the discard pile, and no copy is left set aside", () => {
      const state = phoenixGame();
      const force = forceOf(state);
      const player = playerOf(state, P1);
      expect(instancesOf(state, "34002a")).toHaveLength(1);
      expect(player.deck).not.toContain(force);
      expect(player.hand).not.toContain(force);
      expect(player.discard).not.toContain(force);
      expect(player.setAside).not.toContain(force);
    });
  });

  describe("form flips (hero Phoenix / alter-ego Jean Grey)", () => {
    it("starts as Jean Grey and flips to Phoenix and back, once per round", () => {
      const state = phoenixGame();
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      const phoenix = settle(runWith(WAVE6_DEPS, state, toHero(P1)), decline, undefined, WAVE6_DEPS);
      expect(playerOf(phoenix, P1).identity.form).toBe("hero");
      expect(() => runWith(WAVE6_DEPS, phoenix, toHero(P1))).toThrow(/already_changed_form/);
      const back = settle(runWith(WAVE6_DEPS, hero(state), toHero(P1)), decline, undefined, WAVE6_DEPS);
      expect(playerOf(back, P1).identity.form).toBe("alterEgo");
    });
  });

  describe("34001b.jean-grey-response", () => {
    it("places 1 power counter on Phoenix Force after her basic recovery", () => {
      const state = phoenixGame();
      const damaged = patchInstance(state, identityOf(state), { damage: 3 });
      const after = recover(damaged);
      expect(inst(after, identityOf(after)).damage).toBeLessThan(3);
      expect(powerOf(after)).toBe(5);
    });

    it("does not answer as Phoenix (the hero form has no recover)", () => {
      const state = hero(phoenixGame());
      expect(() => runWith(WAVE6_DEPS, state, { type: "basicRecover", playerId: P1 })).toThrow();
    });
  });

  describe("34002a Phoenix Force, Restrained", () => {
    it("gives you RESTRAINED, not UNLEASHED, and no stat change", () => {
      const state = hero(phoenixGame());
      const names = traitNames(state, identityOf(state));
      expect(names).toContain("RESTRAINED");
      expect(names).not.toContain("UNLEASHED");
      expect(statBonus(state, WAVE6_DEPS, identityOf(state), "atk")).toBe(0);
      expect(statBonus(state, WAVE6_DEPS, identityOf(state), "thw")).toBe(0);
    });

    it("does not flip while counters remain, then flips after the last one is removed", () => {
      let state = hero(phoenixGame());
      const bond = (s: GameState) => use(P1, identityOf(s), "34001a.psionic-bond");
      state = patchInstance(state, forceOf(state), { counters: { power: 2 } });
      state = settle(runWith(REMOVER_DEPS, state, bond(state)), firstLegal, undefined, REMOVER_DEPS);
      expect(powerOf(state)).toBe(1);
      expect(inst(state, forceOf(state)).flipped).toBe(false);
      // The ability's limit is none here: use it again for the last counter.
      state = settle(runWith(REMOVER_DEPS, state, bond(state)), firstLegal, undefined, REMOVER_DEPS);
      expect(powerOf(state)).toBe(0);
      expect(inst(state, forceOf(state)).flipped).toBe(true);
    });
  });

  describe("34002b Phoenix Force, Unleashed", () => {
    const unleashed = (counters: number): GameState => {
      const state = hero(phoenixGame());
      return patchInstance(state, forceOf(state), { flipped: true, counters: counters ? { power: counters } : {} });
    };

    it("gives you UNLEASHED instead of RESTRAINED, -2 THW and +2 ATK", () => {
      const state = unleashed(0);
      const names = traitNames(state, identityOf(state));
      expect(names).toContain("UNLEASHED");
      expect(names).not.toContain("RESTRAINED");
      expect(statBonus(state, WAVE6_DEPS, identityOf(state), "atk")).toBe(2);
      expect(statBonus(state, WAVE6_DEPS, identityOf(state), "thw")).toBe(-2);
    });

    it("flips back to Restrained when a power counter placed brings it to 4, not before", () => {
      // Jean Grey's response places the counter; Unleashed is checked after it, so 2 -> 3 does not flip, 3 -> 4 does.
      const base = withForm(phoenixGame(), "alterEgo");
      const damaged = (counters: number) => {
        const state = patchInstance(base, forceOf(base), { flipped: true, counters: { power: counters } });
        return patchInstance(state, identityOf(state), { damage: 3 });
      };
      const three = recover(damaged(2));
      expect(powerOf(three)).toBe(3);
      expect(inst(three, forceOf(three)).flipped).toBe(true);
      const four = recover(damaged(3));
      expect(powerOf(four)).toBe(4);
      expect(inst(four, forceOf(four)).flipped).toBe(false);
      expect(traitNames(four, identityOf(four))).toContain("RESTRAINED");
    });

    it("a counter placed while Restrained never flips it (Restrained has no placed-counter response)", () => {
      const state = phoenixGame();
      const after = recover(patchInstance(state, identityOf(state), { damage: 3 }));
      expect(powerOf(after)).toBe(5);
      expect(inst(after, forceOf(after)).flipped).toBe(false);
    });
  });
});
