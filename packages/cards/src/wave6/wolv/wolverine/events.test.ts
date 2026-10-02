import { activeVillain, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
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
  runWith,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { WOLVERINE_EVENTS } from "./events.js";
import { wolverineGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const villainOf = (state: GameState) => activeVillain(state).instanceId;
/** Wolverine in hero form, Rhino as the villain. */
const staged = (): GameState => withForm(wolverineGame("rhino", { seed: 1 }), { heroForm: 0 });
const damageOf = (state: GameState): number => inst(state, identityOf(state, P1)).damage;
const inPlay = (state: GameState, id: InstanceId): boolean => playerOf(state, P1).playArea.includes(id);

/** Plays `code` from hand paying `cost` with other hand cards; `pick` answers every choice. */
const cast = (state: GameState, code: string, cost: number, pick: Picker = firstLegal) => {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0] as InstanceId;
  return settle(runWith(DEPS, given.state, play(P1, id, payWith(given.state, P1, cost, [id]))), pick, undefined, DEPS);
};
const targeting =
  (id: InstanceId, rest: Picker = firstLegal): Picker =>
  (s) =>
    s.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : rest(s);
const choosing =
  (text: string, rest: Picker = firstLegal): Picker =>
  (s) => {
    const hit = s.pendingChoice?.options.find((o) => o.label.includes(text));
    return hit ? [hit.optionId] : rest(s);
  };
const handSize = (state: GameState): number => playerOf(state, P1).hand.length;

describe("Wolverine events (35008-35012)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(WOLVERINE_EVENTS).sort()).toEqual([
      "35008.berserker-barrage-action",
      "35009.slice-and-dice-action",
      "35010.lunging-strike-action",
      "35011.track-by-scent-action",
      "35012.regenerative-healing-action",
    ]);
    for (const definition of Object.values(WOLVERINE_EVENTS)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Berserker Barrage (35008)", () => {
    it("deals 4 damage to the villain; no defeat, so no repeat is offered and he takes nothing", () => {
      const state = staged();
      const offered: string[] = [];
      const after = cast(state, "35008", 2, (s) => {
        for (const o of s.pendingChoice?.options ?? []) offered.push(o.label);
        return firstLegal(s);
      });
      expect(inst(after, villainOf(state)).damage).toBe(4);
      expect(damageOf(after)).toBe(0);
      expect(offered.some((l) => l.includes("Take 2 damage"))).toBe(false);
    });

    it("defeating a minion offers the repeat; declining takes no damage and attacks no more", () => {
      const { state, id: minion } = engageMinion(staged(), "01101", P1);
      const after = cast(state, "35008", 2, choosing("Do not repeat", targeting(minion)));
      expect(inPlay(after, minion)).toBe(false);
      expect(damageOf(after)).toBe(0);
      expect(inst(after, villainOf(state)).damage).toBe(0);
    });

    it("taking 2 damage repeats with a fresh target; the repeat that defeats nothing stops there", () => {
      const { state: one, id: first } = engageMinion(staged(), "01101", P1);
      const { state, id: second } = engageMinion(one, "01101", P1);
      let target = first;
      const after = cast(state, "35008", 2, (s) => {
        const take = s.pendingChoice?.options.find((o) => o.label.includes("Take 2 damage"));
        if (take) {
          target = second;
          return [take.optionId];
        }
        return targeting(target)(s);
      });
      expect(inPlay(after, first)).toBe(false);
      expect(inPlay(after, second)).toBe(false);
      expect(damageOf(after)).toBe(4);
    });

    it("the repeat's attack need not defeat anything: it hits the villain for 4 and stops", () => {
      const { state, id: minion } = engageMinion(staged(), "01101", P1);
      let repeated = false;
      const after = cast(state, "35008", 2, (s) => {
        const take = s.pendingChoice?.options.find((o) => o.label.includes("Take 2 damage"));
        if (take) {
          repeated = true;
          return [take.optionId];
        }
        return repeated ? targeting(villainOf(s))(s) : targeting(minion)(s);
      });
      expect(damageOf(after)).toBe(2);
      expect(inst(after, villainOf(state)).damage).toBe(4);
    });
  });

  describe("Berserker Barrage (35008) with Aggressive Energy (35020)", () => {
    // Ruling Jul 9, 2026 (3) #4 (docs/phase7-wave6.md §3.41): the 2 damage Wolverine takes is not damage the event
    // deals, so Aggressive Energy's "1 additional damage" adds to the attacks only.
    it("adds 1 to each attack on an enemy but nothing to the 2 damage Wolverine takes", () => {
      const { state: one, id: minion } = engageMinion(staged(), "01101", P1);
      const given = moveToHand(one, P1, "35008", "35020");
      const [barrage, energy] = given.ids as [InstanceId, InstanceId];
      const filler = payWith(given.state, P1, 1, [barrage, energy]);
      let repeated = false;
      const pick: Picker = (s) => {
        const trigger = s.pendingChoice?.options.find((o) => o.label.includes("Aggressive Energy"));
        if (s.pendingChoice?.prompt.kind === "chooseTriggers" && trigger) return [trigger.optionId];
        const take = s.pendingChoice?.options.find((o) => o.label.includes("Take 2 damage"));
        if (take) {
          repeated = true;
          return [take.optionId];
        }
        return targeting(repeated ? villainOf(s) : minion)(s);
      };
      const after = settle(runWith(DEPS, given.state, play(P1, barrage, [energy, ...filler])), pick, undefined, DEPS);
      expect(repeated).toBe(true);
      expect(inPlay(after, minion)).toBe(false);
      expect(inst(after, villainOf(one)).damage).toBe(5);
      expect(damageOf(after)).toBe(2);
    });
  });

  describe("Lunging Strike (35010)", () => {
    // Played through Wolverine's Claws (overkill) is `identity.test.ts`'s (§3.42).
    it("played from hand: 8 damage to an enemy, no overkill", () => {
      const { state, id: minion } = engageMinion(staged(), "01101", P1);
      const after = cast(state, "35010", 3, targeting(minion));
      expect(inPlay(after, minion)).toBe(false);
      expect(inst(after, villainOf(state)).damage).toBe(0);
    });
  });

  describe("Slice and Dice (35009)", () => {
    it("makes two separate 3-damage attacks, each on its own chosen enemy", () => {
      const { state: one, id: first } = engageMinion(staged(), "01101", P1);
      const { state, id: second } = engageMinion(one, "01101", P1);
      let target = first;
      const after = cast(state, "35009", 3, (s) => {
        const hit = targeting(target)(s);
        if (s.pendingChoice?.options.some((o) => o.optionId === target)) target = second;
        return hit;
      });
      expect(inPlay(after, first)).toBe(false);
      expect(inPlay(after, second)).toBe(false);
      expect(inst(after, villainOf(state)).damage).toBe(0);
    });

    it("both attacks may hit the same enemy: the villain takes 6", () => {
      const state = staged();
      const after = cast(state, "35009", 3);
      expect(inst(after, villainOf(state)).damage).toBe(6);
    });
  });

  describe("Track by Scent (35011)", () => {
    const withThreat = (threat: number) => {
      const base = staged();
      return patchInstance(base, base.mainScheme.instanceId, { threat });
    };
    it("removes 3 threat and draws 2 cards when that removes the last threat", () => {
      const state = withThreat(3);
      const given = moveToHand(state, P1, "35011");
      const before = handSize(given.state);
      const after = settle(
        runWith(DEPS, given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 2, [given.ids[0]!]))),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(mainThreat(after)).toBe(0);
      expect(handSize(after)).toBe(before - 1 - 2 + 2);
    });
    it("removes 3 threat and draws nothing when threat is left", () => {
      const state = withThreat(5);
      const given = moveToHand(state, P1, "35011");
      const before = handSize(given.state);
      const after = settle(
        runWith(DEPS, given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 2, [given.ids[0]!]))),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(mainThreat(after)).toBe(2);
      expect(handSize(after)).toBe(before - 1 - 2);
    });
  });

  describe("Regenerative Healing (35012)", () => {
    const hurt = (damage: number, statuses: { stunned?: number; confused?: number } = {}): GameState => {
      const base = staged();
      const id = identityOf(base, P1);
      return patchInstance(base, id, { damage, statuses: { ...inst(base, id).statuses, ...statuses } });
    };
    const statusesOf = (state: GameState) => inst(state, identityOf(state, P1)).statuses;

    it("heals 4 damage from your identity", () => {
      expect(damageOf(cast(hurt(6), "35012", 1, choosing("Heal 4")))).toBe(2);
    });
    it("heals only what is there", () => {
      expect(damageOf(cast(hurt(2), "35012", 1, choosing("Heal 4")))).toBe(0);
    });
    it("discards each stunned and confused status card, leaving damage alone", () => {
      const after = cast(hurt(3, { stunned: 1, confused: 1 }), "35012", 1, choosing("Discard each stunned"));
      expect(statusesOf(after).stunned).toBe(0);
      expect(statusesOf(after).confused).toBe(0);
      expect(damageOf(after)).toBe(3);
    });
    it("the heal option does not touch status cards", () => {
      const after = cast(hurt(6, { stunned: 1 }), "35012", 1, choosing("Heal 4"));
      expect(statusesOf(after).stunned).toBe(1);
    });
    it("offers each option only while it can change something", () => {
      const labels = (state: GameState): string[] => {
        const seen: string[] = [];
        cast(state, "35012", 1, (s) => {
          for (const o of s.pendingChoice?.options ?? []) seen.push(o.label);
          return firstLegal(s);
        });
        return seen;
      };
      expect(labels(hurt(3)).some((l) => l.includes("Discard each"))).toBe(false);
      expect(labels(hurt(0, { confused: 1 })).some((l) => l.includes("Heal 4"))).toBe(false);
      expect(labels(hurt(3, { confused: 1 })).some((l) => l.includes("Discard each"))).toBe(true);
    });
    it("is an Action, playable in alter-ego form too", () => {
      const base = wolverineGame("rhino", { seed: 1 });
      const id = identityOf(base, P1);
      const state = patchInstance(base, id, { damage: 5 });
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      expect(damageOf(cast(state, "35012", 1, choosing("Heal 4")))).toBe(1);
    });
  });
});
