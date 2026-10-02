import { cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  replay,
  sessionApply,
  startSession,
  statBonus,
  traitsOf,
  type Command,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  firstLegal,
  play,
  resourceAbility,
  type Picker,
} from "../../../testing/harness.js";
import { driveEvents, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
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

const hero = (state: GameState) => withForm(state, { heroForm: 0 });
const BOND = "34001a.psionic-bond";
/**
 * Phoenix in hero form with Down Time (34024, cost 1: "Your alter-ego gets +2 REC", nothing about Phoenix Force) in hand
 * and `power` counters on Phoenix Force, Unleashed or not.
 */
function bondBoard(power: number, flipped = false) {
  const base = hero(phoenixGame());
  const staged = patchInstance(base, forceOf(base), { flipped, counters: power > 0 ? { power } : {} });
  const given = moveToHand(staged, P1, "34024");
  return { state: given.state, downTime: given.ids[0]! };
}
/** Plays Down Time paying only with Psionic Bond. */
const payWithBond = (state: GameState, card: InstanceId): Command =>
  play(P1, card, [], { abilities: [resourceAbility(identityOf(state), BOND)] });

describe("Phoenix / Jean Grey and Phoenix Force (34001a/b, 34002a/b)", () => {
  it("registers the identity and Phoenix Force refs the card data names, all valid", () => {
    expect(Object.keys(PHOENIX_IDENTITY).sort()).toEqual([
      "34001a.psionic-bond",
      "34001b.jean-grey-response",
      "34001b.setup",
      "34002a.phoenix-force-constant",
      "34002a.phoenix-force-forced-response",
      "34002b.phoenix-force-constant",
      "34002b.phoenix-force-constant-2",
      "34002b.phoenix-force-forced-response",
    ]);
    for (const definition of Object.values(PHOENIX_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("34001a.psionic-bond", () => {
    it("Hero Resource: removes 1 power counter from Phoenix Force to generate a [wild] resource; replay deep-equal", () => {
      const { state, downTime } = bondBoard(4);
      const hand = playerOf(state, P1).hand.length;
      const result = sessionApply(startSession(state), payWithBond(state, downTime), WAVE6_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      const session = result.session;
      const after = session.state;
      expect(powerOf(after)).toBe(3);
      expect(inst(after, identityOf(after)).counters.power ?? 0).toBe(0);
      expect(cardsInPlay(after)).toContain(downTime);
      // Only Down Time left the hand: the wild resource paid its whole cost.
      expect(playerOf(after, P1).hand.length).toBe(hand - 1);
      const replayed = replay(session.log, WAVE6_DEPS);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(session.state);
    });

    it("cannot be used with no power counter on Phoenix Force (Unleashed, 0 counters)", () => {
      const { state, downTime } = bondBoard(0, true);
      expect(applyCommand(state, payWithBond(state, downTime), WAVE6_DEPS).ok).toBe(false);
    });

    it("is a Hero Resource: Jean Grey cannot use it", () => {
      const { state, downTime } = bondBoard(4);
      const alterEgo = withForm(state, "alterEgo");
      expect(applyCommand(alterEgo, payWithBond(alterEgo, downTime), WAVE6_DEPS).ok).toBe(false);
    });

    it("is limited to once per phase", () => {
      const { state, downTime } = bondBoard(4);
      const once = settle(runWith(WAVE6_DEPS, state, payWithBond(state, downTime)), firstLegal, undefined, WAVE6_DEPS);
      const again = moveToHand(once, P1, "34024");
      const second = again.ids[0]!;
      expect(applyCommand(again.state, payWithBond(again.state, second), WAVE6_DEPS).ok).toBe(false);
      expect(powerOf(once)).toBe(3);
    });
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

    it("does not flip while counters remain, then flips after Psionic Bond removes the last one (Q24)", () => {
      const two = bondBoard(2);
      const one = settle(
        runWith(WAVE6_DEPS, two.state, payWithBond(two.state, two.downTime)),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(powerOf(one)).toBe(1);
      expect(inst(one, forceOf(one)).flipped).toBe(false);
      const last = bondBoard(1);
      const { state, events } = driveEvents(WAVE6_DEPS, last.state, payWithBond(last.state, last.downTime));
      expect(powerOf(state)).toBe(0);
      expect(inst(state, forceOf(state)).flipped).toBe(true);
      expect(traitNames(state, identityOf(state))).toContain("UNLEASHED");
      // Paying the cost flipped it before Down Time resolved (RRG 1.8 "Initiating Abilities", p. 24, steps 5-6).
      const flippedAt = events.findIndex((e) => e.type === "cardFlipped" && e.instanceId === forceOf(state));
      // Down Time enters play (attached to her identity) only after the flip.
      const enteredAt = events.findIndex((e) => e.type === "cardMoved" && e.instanceId === last.downTime);
      expect(flippedAt).toBeGreaterThanOrEqual(0);
      expect(enteredAt).toBeGreaterThan(flippedAt);
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
