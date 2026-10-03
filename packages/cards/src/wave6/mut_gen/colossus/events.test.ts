import { cardId } from "@mc/content";
import { activeVillain, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../project-wideawake-testing.js";
import { COLOSSUS_EVENTS } from "./events.js";
import { colossusGame } from "./support.js";

const hero = (state: GameState) => identityOf(state, P1);
const tough = (state: GameState) => inst(state, hero(state)).statuses.tough;
const villain = (state: GameState) => activeVillain(state).instanceId;
const inHeroWithTough = (n: number) => {
  const state = withForm(colossusGame(), { heroForm: 0 });
  return patchInstance(state, hero(state), { statuses: { ...inst(state, hero(state)).statuses, tough: n } });
};
const optionNamed =
  (fragment: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const hit = choice.options.find((o) => o.label.includes(fragment));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };
const inDiscard = (state: GameState, code: string) =>
  playerOf(state, P1).discard.some((id: InstanceId) => state.instances[id]!.cardId === cardId(code));

describe("Colossus events (32007-32010)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(COLOSSUS_EVENTS).sort()).toEqual([
      "32007.made-of-rage-interrupt",
      "32008.steel-fist-action",
      "32009.bulletproof-protector-action",
      "32010.armor-up-interrupt",
    ]);
    for (const definition of Object.values(COLOSSUS_EVENTS)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Steel Fist (32008)", () => {
    const cast = (state: GameState, pick: Picker) => {
      const given = moveToHand(state, P1, "32008");
      const [id] = given.ids as [InstanceId];
      return settle(
        runWith(WAVE6_DEPS, given.state, play(P1, id, payWith(given.state, P1, 2, [id]))),
        pick,
        undefined,
        WAVE6_DEPS,
      );
    };
    it("deals 5 damage to an enemy and, discarding a tough card, stuns and confuses it", () => {
      const state = inHeroWithTough(1);
      const after = cast(state, optionNamed("stun and confuse"));
      expect(inst(after, villain(state)).damage).toBe(5);
      expect(tough(after)).toBe(0);
      expect(inst(after, villain(state)).statuses.stunned).toBe(1);
      expect(inst(after, villain(state)).statuses.confused).toBe(1);
      expect(inDiscard(after, "32008")).toBe(true);
    });
    it("may decline: damage only, the tough card stays", () => {
      const state = inHeroWithTough(1);
      const after = cast(state, optionNamed("Do not"));
      expect(inst(after, villain(state)).damage).toBe(5);
      expect(tough(after)).toBe(1);
      expect(inst(after, villain(state)).statuses.stunned).toBe(0);
      expect(inst(after, villain(state)).statuses.confused).toBe(0);
    });
    it("with no tough card: still 5 damage, nothing stunned or confused", () => {
      const state = inHeroWithTough(0);
      const after = cast(state, optionNamed("stun and confuse"));
      expect(inst(after, villain(state)).damage).toBe(5);
      expect(inst(after, villain(state)).statuses.stunned).toBe(0);
      expect(inst(after, villain(state)).statuses.confused).toBe(0);
    });
    it("discards only one of two tough cards", () => {
      const after = cast(inHeroWithTough(2), optionNamed("stun and confuse"));
      expect(tough(after)).toBe(1);
    });
  });

  describe("Made of Rage (32007)", () => {
    const accepting: Picker = (state) =>
      state.pendingChoice?.prompt.kind === "chooseTriggers"
        ? state.pendingChoice.options.map((o) => o.optionId)
        : firstLegal(state);
    const declining: Picker = firstLegal;
    /** A basic attack by Colossus against a Hydra Mercenary engaged with him, with Made of Rage in hand. */
    const attackMercenary = (state: GameState, pick: Picker) => {
      const given = moveToHand(state, P1, "32007");
      const { state: engaged, id: minion } = engageMinion(given.state, "01101");
      const after = settle(
        runWith(WAVE6_DEPS, engaged, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: hero(engaged),
          targetInstanceId: minion,
        } as never),
        pick,
        undefined,
        WAVE6_DEPS,
      );
      return { after, minion, villainDamage: inst(after, villain(engaged)).damage, hand: given.ids[0]! };
    };
    it("discards a tough card for +6 ATK and overkill: the excess spills onto the villain", () => {
      const { after, villainDamage, hand } = attackMercenary(inHeroWithTough(1), accepting);
      expect(tough(after)).toBe(0);
      expect(villainDamage).toBeGreaterThan(0);
      expect(playerOf(after, P1).discard).toContain(hand);
    });
    it("declined: no tough card spent and no overkill spill", () => {
      const { after, villainDamage } = attackMercenary(inHeroWithTough(1), declining);
      expect(tough(after)).toBe(1);
      expect(villainDamage).toBe(0);
    });
    it("with no tough card the interrupt cannot be paid: no spill and the card stays in hand", () => {
      const { after, villainDamage, hand } = attackMercenary(inHeroWithTough(0), accepting);
      expect(villainDamage).toBe(0);
      expect(playerOf(after, P1).hand).toContain(hand);
    });
    it("discards only one of two tough cards", () => {
      expect(tough(attackMercenary(inHeroWithTough(2), accepting).after)).toBe(1);
    });
  });

  describe("Bulletproof Protector (32009)", () => {
    const cast = (state: GameState, pick: Picker) => {
      const given = moveToHand(state, P1, "32009");
      const [id] = given.ids as [InstanceId];
      return settle(
        runWith(WAVE6_DEPS, given.state, play(P1, id, payWith(given.state, P1, 0, [id]))),
        pick,
        undefined,
        WAVE6_DEPS,
      );
    };
    it("discards a tough card to give 2 tough cards (1 held becomes 0 then 2)", () => {
      const after = cast(inHeroWithTough(1), optionNamed("Give your hero 2"));
      expect(tough(after)).toBe(2);
      expect(inDiscard(after, "32009")).toBe(true);
    });
    it("holding 2: pays one and fills back to the limit of 2", () => {
      expect(tough(cast(inHeroWithTough(2), optionNamed("Give your hero 2")))).toBe(2);
    });
    it("or readies the exhausted hero, spending the tough card", () => {
      const state = inHeroWithTough(1);
      const exhausted = patchInstance(state, hero(state), { exhausted: true });
      const after = cast(exhausted, optionNamed("Ready your hero"));
      expect(inst(after, hero(after)).exhausted).toBe(false);
      expect(tough(after)).toBe(0);
    });
    it("unpayable with no tough card: the play is rejected and nothing changes", () => {
      const state = inHeroWithTough(0);
      const given = moveToHand(state, P1, "32009");
      const [id] = given.ids as [InstanceId];
      expect(() => runWith(WAVE6_DEPS, given.state, play(P1, id, payWith(given.state, P1, 0, [id])))).toThrow(
        /rejected/,
      );
    });
  });

  describe("Armor Up (32010)", () => {
    const villainActivates = (state: GameState, pick: Picker) => {
      const given = moveToHand(state, P1, "32010");
      const after = settle(
        runWith(WAVE6_DEPS, given.state, { type: "endTurn", playerId: P1 }),
        pick,
        undefined,
        WAVE6_DEPS,
      );
      return { after, id: given.ids[0]! };
    };
    const accepting: Picker = (state) =>
      state.pendingChoice?.prompt.kind === "chooseTriggers"
        ? state.pendingChoice.options.map((o) => o.optionId)
        : firstLegal(state);
    it("when the villain would activate, changes him to hero form", () => {
      const state = colossusGame();
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      const { after, id } = villainActivates(state, accepting);
      expect(playerOf(after, P1).discard).toContain(id);
      expect(playerOf(after, P1).identity.form).toBe("hero");
    });
    it("is an alter-ego interrupt: in hero form it is not offered", () => {
      const { after, id } = villainActivates(withForm(colossusGame(), { heroForm: 0 }), accepting);
      expect(playerOf(after, P1).identity.form).toBe("hero");
      expect(playerOf(after, P1).hand).toContain(id);
    });
    it("declined: stays in alter-ego form with the card in hand", () => {
      const { after, id } = villainActivates(colossusGame(), firstLegal);
      expect(playerOf(after, P1).identity.form).toBe("alterEgo");
      expect(playerOf(after, P1).hand).toContain(id);
    });
  });
});
