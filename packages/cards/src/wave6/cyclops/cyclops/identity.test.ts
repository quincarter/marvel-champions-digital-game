import { cardId } from "@mc/content";
import { activeVillain, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  identityOf,
  inst,
  moveToHand,
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
import { WAVE6_DEPS } from "../../index.js";
import { CYCLOPS_IDENTITY } from "./identity.js";
import { cyclopsGame } from "./support.js";

const decline: Picker = () => [];
const heroOf = (state: GameState) => identityOf(state, P1);

/** Cyclops in hero form with Practiced Defense (33006, no damage bonus: the blast alone is measured) on the villain. */
function blastReady(attached = true): { readonly state: GameState; readonly villain: InstanceId } {
  const hero = withForm(cyclopsGame("rhino", { seed: 3 }), { heroForm: 0 });
  const { state, ids } = moveToHand(hero, P1, "33006");
  const villain = activeVillain(state).instanceId;
  if (!attached) return { state, villain };
  const upgrade = ids[0]!;
  const staged = patchInstance(
    {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== upgrade) } : p)),
    },
    upgrade,
    { attachedTo: villain },
  );
  return {
    state: patchInstance(staged, villain, { attachments: [...inst(staged, villain).attachments, upgrade] }),
    villain,
  };
}

const optic = (state: GameState) => {
  const pay = playerOf(state, P1).hand[0]!;
  return use(P1, heroOf(state), "33001a.cyclops-constant", [{ fromHand: pay }]);
};

describe("Cyclops / Scott Summers (identity, 33001a/b)", () => {
  it("registers the three identity refs the card data names, all valid", () => {
    expect(Object.keys(CYCLOPS_IDENTITY).sort()).toEqual([
      "33001a.cyclops-constant",
      "33001b.scott-summers-constant",
      "33001b.scott-summers-constant-2",
    ]);
    for (const definition of Object.values(CYCLOPS_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
  });

  it("the deckbuilding sentence is engine data (offAspectAllowance), not an ability", () => {
    expect(CYCLOPS_IDENTITY["33001b.scott-summers-constant"].effects).toEqual([]);
  });

  it("flips between Scott Summers and Cyclops, once per round", () => {
    const state = cyclopsGame();
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    const hero = settle(runWith(WAVE6_DEPS, state, toHero(P1)), decline, undefined, WAVE6_DEPS);
    expect(playerOf(hero, P1).identity.form).toBe("hero");
    expect(() => runWith(WAVE6_DEPS, hero, toHero(P1))).toThrow(/already_changed_form/);
    const back = settle(
      runWith(WAVE6_DEPS, withForm(state, { heroForm: 0 }), toHero(P1)),
      decline,
      undefined,
      WAVE6_DEPS,
    );
    expect(playerOf(back, P1).identity.form).toBe("alterEgo");
  });

  describe("33001a.cyclops-constant (Optic Blast)", () => {
    it("is an attack action costing one resource of any type, once per round", () => {
      const definition = CYCLOPS_IDENTITY["33001a.cyclops-constant"];
      expect(definition.trigger).toMatchObject({ kind: "action" });
      expect(definition.label).toEqual(["attack"]);
      expect(definition.cost).toEqual({ resources: 1 });
      expect(definition.limit).toEqual({ count: 1, period: "round" });
    });

    it("deals 3 damage to an enemy with an upgrade attached, spending the paid card", () => {
      const { state, villain } = blastReady();
      const handBefore = playerOf(state, P1).hand.length;
      const after = settle(runWith(WAVE6_DEPS, state, optic(state)), firstLegal, undefined, WAVE6_DEPS);
      expect(inst(after, villain).damage).toBe(3);
      expect(playerOf(after, P1).hand).toHaveLength(handBefore - 1);
    });

    it("is not usable against an enemy with no upgrade attached", () => {
      const { state } = blastReady(false);
      expect(() => runWith(WAVE6_DEPS, state, optic(state))).toThrow(/useAbility rejected/);
    });

    it("is limited to once per round", () => {
      const { state, villain } = blastReady();
      const once = settle(runWith(WAVE6_DEPS, state, optic(state)), firstLegal, undefined, WAVE6_DEPS);
      expect(() => runWith(WAVE6_DEPS, once, optic(once))).toThrow(/useAbility rejected/);
      expect(inst(once, villain).damage).toBe(3);
    });
  });

  describe("33001b.scott-summers-constant-2 (Constant Training)", () => {
    it("adds a TACTIC upgrade from the deck to the hand, once per round", () => {
      const state = cyclopsGame("rhino", { seed: 3 });
      const deckTactics = playerOf(state, P1).deck.filter((id) =>
        ["33005", "33006", "33007"].some((c) => state.instances[id]!.cardId === cardId(c)),
      );
      expect(deckTactics.length).toBeGreaterThan(0);
      const ability = use(P1, heroOf(state), "33001b.scott-summers-constant-2");
      const after = settle(
        runWith(WAVE6_DEPS, state, ability),
        (s) => [s.pendingChoice!.options[0]!.optionId],
        undefined,
        WAVE6_DEPS,
      );
      const hand = playerOf(after, P1).hand;
      expect(hand).toHaveLength(playerOf(state, P1).hand.length + 1);
      expect(playerOf(after, P1).deck).toHaveLength(playerOf(state, P1).deck.length - 1);
      const gained = hand.filter((id) => !playerOf(state, P1).hand.includes(id));
      expect(["33005", "33006", "33007"]).toContain(String(after.instances[gained[0]!]!.cardId));
      expect(() => runWith(WAVE6_DEPS, after, ability)).toThrow(/useAbility rejected/);
    });
  });
});
