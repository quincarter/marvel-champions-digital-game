import { cardId } from "@mc/content";
import { activeEncounterDeck, activeVillain, cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
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
import { moveToDiscard, withForm } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { PHOENIX_EVENTS } from "./events.js";
import { phoenixGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const villainOf = (state: GameState) => activeVillain(state).instanceId;
const forceOf = (state: GameState): InstanceId => instancesOf(state, "34002a")[0]!;
const powerOf = (state: GameState): number => inst(state, forceOf(state)).counters.power ?? 0;

/** Phoenix in hero form with Phoenix Force Restrained (4 counters), or Unleashed (-2 THW, +2 ATK) when asked. */
function staged(unleashed = false, counters = 2): GameState {
  const state = withForm(phoenixGame("rhino", { seed: 1 }), { heroForm: 0 });
  return patchInstance(state, forceOf(state), { flipped: unleashed, counters: { power: counters } });
}

/** An X-MEN ally of her precon put straight into play under P1 (surgery: no cost, no enter-play). */
function allyInPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, P1);
  const id = [...owner.hand, ...owner.deck].find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== id),
              deck: p.deck.filter((i) => i !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: P1 } },
    },
  };
}

const OUTSIDE_PRECON = ["34032", "34033", "34034", "34035"];
/** A card of a code outside her precon, by relabeling one unneeded deck card (Psychic Assault, Kicker, Soul Sisters). */
function conjure(state: GameState, code: string): GameState {
  const spare = playerOf(state, P1).deck.find((i) => String(state.instances[i]!.cardId) === "34016")!;
  return patchInstance(state, spare, { cardId: cardId(code) });
}

/** Plays `code` from hand paying `cost` with other hand cards; `pick` answers every choice. */
const cast = (state: GameState, code: string, cost: number, pick: Picker = firstLegal) => {
  const given = moveToHand(OUTSIDE_PRECON.includes(code) ? conjure(state, code) : state, P1, code);
  const id = given.ids[0] as InstanceId;
  return settle(runWith(DEPS, given.state, play(P1, id, payWith(given.state, P1, cost, [id]))), pick, undefined, DEPS);
};
/** A deck card of P1's nothing here needs, for relabeling. */
const spareOf = (state: GameState): InstanceId =>
  playerOf(state, P1).deck.find((i) => String(state.instances[i]!.cardId) === "34016")!;
/** Threat on every scheme in play. */
const totalThreat = (state: GameState): number =>
  cardsInPlay(state)
    .filter((id) => ["main_scheme", "side_scheme"].includes(state.cardPool[state.instances[id]!.cardId]?.type ?? ""))
    .reduce((sum, id) => sum + inst(state, id).threat, 0);
/**
 * A minion with patrol and nothing else engaged with P1: an encounter card relabeled Sentinel Mark IV (32093), whose
 * printed guard is taken off the card in this game's pool so Swift Retribution (an attack on the villain) stays playable.
 */
function withPatrolMinion(state: GameState): GameState {
  const sentinel = WAVE6_CARDS.find((card) => card.id === cardId("32093"));
  if (sentinel?.type !== "minion") throw new Error("no Sentinel Mark IV");
  const spare = activeEncounterDeck(state).deck[0]!;
  const pooled: GameState = {
    ...patchInstance(state, spare, { cardId: sentinel.id }),
    cardPool: { ...state.cardPool, [sentinel.id]: { ...sentinel, keywords: [{ name: "patrol" }] } },
  };
  return engageMinion(pooled, "32093").state;
}
const discarded = (state: GameState, code: string) =>
  playerOf(state, P1).discard.some((id) => String(state.instances[id]!.cardId) === code);
/** Picks the option whose label contains `text`, or the card/target `id`; anything else as the default picker does. */
const choosing =
  (text: string, rest: Picker = firstLegal): Picker =>
  (s) => {
    const hit = s.pendingChoice?.options.find((o) => o.label.includes(text));
    return hit ? [hit.optionId] : rest(s);
  };
const targeting =
  (id: InstanceId, rest: Picker = firstLegal): Picker =>
  (s) =>
    s.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : rest(s);

describe("Phoenix events (34010-34013, 34017-34019, 34023, 34032-34035)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(PHOENIX_EVENTS).sort()).toEqual([
      "34010.telekinetic-attack-action",
      "34011.psychic-blast-action",
      "34012.telepathic-trickery-action",
      "34013.phoenix-firebird-action",
      "34017.psychic-manipulation-interrupt",
      "34018.mutant-peacekeepers-action",
      "34019.swift-retribution-action",
      "34023.psychic-rapport-action",
      "34032.psychic-assault-action",
      "34033.psychic-misdirection-interrupt",
      "34034.psychic-kicker-action",
      "34035.soul-sisters-action",
    ]);
    for (const definition of Object.values(PHOENIX_EVENTS)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Telekinetic Attack (34010)", () => {
    it("Restrained: 7 damage to the villain", () => {
      const state = staged();
      const after = cast(state, "34010", 3);
      expect(inst(after, villainOf(state)).damage).toBe(7);
    });
    it("Unleashed: 9 damage to the villain", () => {
      const state = staged(true);
      const after = cast(state, "34010", 3);
      expect(inst(after, villainOf(state)).damage).toBe(9);
    });
    it("Unleashed gains overkill: the excess over a minion's hit points goes to the villain", () => {
      const { state: base, id: minion } = engageMinion(staged(true), "01101", P1);
      const after = cast(base, "34010", 3, targeting(minion));
      expect(inst(after, villainOf(base)).damage).toBeGreaterThan(0);
    });
    it("Restrained: no overkill, the minion's excess damage is lost", () => {
      const { state: base, id: minion } = engageMinion(staged(), "01101", P1);
      const after = cast(base, "34010", 3, targeting(minion));
      expect(inst(after, villainOf(base)).damage).toBe(0);
    });
  });

  describe("Psychic Blast (34011)", () => {
    const withTwoMinions = (unleashed: boolean) => {
      const { state: one, id: first } = engageMinion(staged(unleashed), "01101", P1);
      const { state, id: second } = engageMinion(one, "01101", P1);
      return { state, first, second };
    };
    it("Restrained: 4 damage to the villain only", () => {
      const { state, first, second } = withTwoMinions(false);
      const after = cast(state, "34011", 2);
      expect(inst(after, villainOf(state)).damage).toBe(4);
      expect(inst(after, first).damage).toBe(0);
      expect(inst(after, second).damage).toBe(0);
    });
    it("Unleashed: 4 to the villain and 4 to each minion engaged with you", () => {
      const { state, first, second } = withTwoMinions(true);
      const after = cast(state, "34011", 2);
      expect(inst(after, villainOf(state)).damage).toBe(4);
      for (const id of [first, second]) {
        // Each Rhino minion took 4 (damaged, or defeated and gone from the play area if its hit points are 4 or less).
        expect(inst(after, id).damage > 0 || !playerOf(after, P1).playArea.includes(id)).toBe(true);
      }
    });
  });

  describe("Telepathic Trickery (34012)", () => {
    it("Restrained: removes 4 threat from a scheme, no status cards", () => {
      const state = patchInstance(staged(), staged().mainScheme.instanceId, { threat: 8 });
      const after = cast(state, "34012", 2);
      expect(mainThreat(after)).toBe(4);
      expect(inst(after, villainOf(state)).statuses.stunned).toBe(0);
      expect(inst(after, villainOf(state)).statuses.confused).toBe(0);
    });
    it("Unleashed: also stuns and confuses an enemy", () => {
      const base = staged(true);
      const state = patchInstance(base, base.mainScheme.instanceId, { threat: 8 });
      const after = cast(state, "34012", 2);
      expect(mainThreat(after)).toBe(4);
      expect(inst(after, villainOf(state)).statuses.stunned).toBe(1);
      expect(inst(after, villainOf(state)).statuses.confused).toBe(1);
    });
  });

  describe("Phoenix Firebird (34013)", () => {
    it("removes 1 power counter and readies Phoenix", () => {
      const base = staged(false, 3);
      const state = patchInstance(base, identityOf(base), { exhausted: true });
      const after = cast(state, "34013", 1, choosing("Remove 1 power counter"));
      expect(powerOf(after)).toBe(2);
      expect(inst(after, identityOf(after)).exhausted).toBe(false);
    });
    it("places 2 power counters on Phoenix Force", () => {
      const state = staged(false, 2);
      const after = cast(state, "34013", 1, choosing("Place 2 power counters"));
      expect(powerOf(after)).toBe(4);
    });
    it("Unleashed reaching 4 power counters flips Phoenix Force back to Restrained", () => {
      const state = staged(true, 2);
      const after = cast(state, "34013", 1, choosing("Place 2 power counters"));
      expect(powerOf(after)).toBe(4);
      expect(inst(after, forceOf(after)).flipped).toBe(false);
    });
    it("removing the last counter flips Restrained to Unleashed", () => {
      const state = staged(false, 1);
      const after = cast(state, "34013", 1, choosing("Remove 1 power counter"));
      expect(powerOf(after)).toBe(0);
      expect(inst(after, forceOf(after)).flipped).toBe(true);
    });
    it("the removal option is not offered with no counters on Phoenix Force", () => {
      const state = staged(true, 0);
      const offered: string[] = [];
      cast(state, "34013", 1, (s) => {
        for (const o of s.pendingChoice?.options ?? []) offered.push(o.label);
        return firstLegal(s);
      });
      expect(offered.some((l) => l.includes("Remove 1 power counter"))).toBe(false);
    });
  });

  describe("Psychic Manipulation (34017) with Swift Retribution (34019)", () => {
    /** Low enough that a scheme's placement cannot reach the main scheme's target threat (that would end the game). */
    const START = 3;
    const scheme = (state: GameState, pick: Picker, start = START) => {
      const given = moveToHand(state, P1, "34019", "34017");
      const [swift] = given.ids as [InstanceId, InstanceId];
      const base = patchInstance(given.state, given.state.mainScheme.instanceId, { threat: start });
      return settle(runWith(DEPS, base, play(P1, swift, payWith(base, P1, 1, given.ids))), pick, undefined, DEPS);
    };
    it("Swift Retribution: the villain schemes (threat is placed) and takes 4 damage", () => {
      const state = staged();
      const after = scheme(state, firstLegal);
      expect(inst(after, villainOf(state)).damage).toBe(4);
      expect(mainThreat(after)).toBeGreaterThan(START);
    });
    it("the scheme removes threat instead of placing it, by the same total", () => {
      const state = staged();
      const placed = mainThreat(scheme(state, firstLegal)) - START;
      const after = scheme(
        state,
        choosing("Psychic Manipulation", (s) =>
          s.pendingChoice?.prompt.kind === "payForCard"
            ? s.pendingChoice.options.slice(0, 3).map((o) => o.optionId)
            : firstLegal(s),
        ),
      );
      expect(mainThreat(after)).toBe(START - placed);
      expect(discarded(after, "34017")).toBe(true);
    });

    // Owner decision (2026-10-03): a "(thwart)"-labeled ability is a real thwart, whether or not it uses the hero's
    // THW. RRG 1.8 "Labeled Ability" (p. 26): "that ability is considered to be a thwart made by that player's
    // identity"; "Patrol" (p. 32): the engaged player "cannot use cards they control to thwart the main scheme".
    const manipulating: Picker = (s) => {
      const choice = s.pendingChoice;
      const named = choice?.options.find(
        (o) => o.label.includes("Psychic Manipulation") || o.label.includes("Surprise!"),
      );
      if (named) return [named.optionId];
      return choice?.prompt.kind === "payForCard" ? choice.options.slice(0, 3).map((o) => o.optionId) : firstLegal(s);
    };
    it("is a thwart by Phoenix: 'after you thwart' (Surprise! 32187) answers it (owner decision; RRG 1.8 p. 26)", () => {
      const state = staged();
      const placed = mainThreat(scheme(state, firstLegal)) - START;
      const surprise = allyInPlay(patchInstance(state, spareOf(state), { cardId: cardId("32187") }), "32187");
      // Without Psychic Manipulation nobody thwarts (Swift Retribution is an attack), so Surprise! is never offered.
      const plain = scheme(surprise.state, (s) =>
        s.pendingChoice?.options.some((o) => o.label.includes("Psychic Manipulation")) ? [] : manipulating(s),
      );
      expect(cardsInPlay(plain)).toContain(surprise.id);
      // With it, the removal is Phoenix's thwart: Surprise! removes 3 more threat, confuses an enemy and is used up.
      // (More threat to start with, so both removals have room; nothing is placed, so the scheme cannot complete.)
      const ROOMY = 10;
      const before = totalThreat(
        patchInstance(surprise.state, surprise.state.mainScheme.instanceId, { threat: ROOMY }),
      );
      const after = scheme(surprise.state, manipulating, ROOMY);
      expect(discarded(after, "34017")).toBe(true);
      expect(cardsInPlay(after)).not.toContain(surprise.id);
      expect(after.removedFromGame).toContain(surprise.id);
      expect(before - totalThreat(after)).toBe(placed + 3);
      expect(inst(after, villainOf(after)).statuses.confused ?? 0).toBeGreaterThan(0);
    });
    it("an engaged patrol minion stops the removal, and nothing is placed either (owner decision; RRG 1.8 'Patrol', p. 32)", () => {
      const patrolled = withPatrolMinion(staged());
      const after = scheme(patrolled, manipulating);
      expect(discarded(after, "34017")).toBe(true);
      expect(mainThreat(after)).toBe(START);
      // The same play without the patrol minion removes threat.
      expect(mainThreat(scheme(staged(), manipulating))).toBeLessThan(START);
    });
  });

  describe("Psychic Misdirection (34033)", () => {
    const endTurnWith = (state: GameState, pick: Picker) => {
      const given = moveToHand(conjure(state, "34033"), P1, "34033");
      return {
        id: given.ids[0]!,
        state: settle(runWith(DEPS, given.state, { type: "endTurn", playerId: P1 }), pick, undefined, DEPS),
      };
    };
    const redirect: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "payForCard"
        ? s.pendingChoice.options
            .filter((o) => !o.label.includes("Psychic Misdirection"))
            .slice(0, 2)
            .map((o) => o.optionId)
        : s.pendingChoice?.prompt.kind === "chooseTriggers"
          ? choosing("Psychic Misdirection")(s)
          : firstLegal(s);
    it("the villain's attack damage goes to the chosen different enemy instead of you", () => {
      const { state: base, id: minion } = engageMinion(staged(), "01101", P1);
      const kept = endTurnWith(base, firstLegal);
      const after = endTurnWith(base, redirect);
      expect(inst(kept.state, minion).damage).toBe(0);
      expect(inst(after.state, minion).damage).toBeGreaterThan(0);
      expect(discarded(after.state, "34033")).toBe(true);
      // The villain attacked you and your identity defended, so it took less than when it took the hit (kept) ...
      expect(inst(after.state, identityOf(after.state)).damage).toBeLessThan(
        inst(kept.state, identityOf(kept.state)).damage,
      );
    });
    it("is not offered with no other enemy to choose", () => {
      const offered: string[] = [];
      endTurnWith(staged(), (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTriggers")
          for (const o of s.pendingChoice.options) offered.push(o.label);
        return firstLegal(s);
      });
      expect(offered.some((l) => l.includes("Psychic Misdirection"))).toBe(false);
    });
  });

  describe("Mutant Peacekeepers (34018)", () => {
    it("exhausts the hero and the chosen X-MEN ally and removes their combined THW", () => {
      const base = staged();
      const { state: withAlly, id: ally } = allyInPlay(base, "34015");
      const state = patchInstance(withAlly, withAlly.mainScheme.instanceId, { threat: 12 });
      const after = cast(state, "34018", 1);
      // Phoenix THW 3 + Marvel Girl THW 2
      expect(mainThreat(after)).toBe(7);
      expect(inst(after, identityOf(after)).exhausted).toBe(true);
      expect(inst(after, ally).exhausted).toBe(true);
    });
    it("cannot be paid with no X-MEN ally to exhaust", () => {
      const state = staged();
      const given = moveToHand(state, P1, "34018");
      expect(() =>
        runWith(DEPS, given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids))),
      ).toThrow();
    });
  });

  describe("Psychic Assault (34032)", () => {
    it("deals 3 damage to an enemy and confuses it", () => {
      const state = staged();
      const after = cast(state, "34032", 2);
      expect(inst(after, villainOf(state)).damage).toBe(3);
      expect(inst(after, villainOf(state)).statuses.confused).toBe(1);
    });
  });

  describe("Psychic Kicker (34034)", () => {
    it("readies an ally and gives it +2 THW and +2 ATK for its next basic thwart or attack, ended by the first", () => {
      const base = staged();
      const { state: withAlly, id: ally } = allyInPlay(base, "34015");
      const state = patchInstance(withAlly, ally, { exhausted: true });
      const after = cast(state, "34034", 0, targeting(ally));
      expect(inst(after, ally).exhausted).toBe(false);
      const attacked = settle(
        runWith(DEPS, after, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: ally,
          targetInstanceId: villainOf(after),
        }),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(inst(attacked, villainOf(after)).damage).toBe(3); // 1 ATK + 2
      expect(inst(attacked, ally).exhausted).toBe(true);
    });
  });

  describe("Soul Sisters (34035)", () => {
    it("readies Phoenix and Storm and heals 2 damage from each", () => {
      const { state: withStorm, id: storm } = allyInPlay(staged(), "34021");
      const base = patchInstance(withStorm, storm, { exhausted: true, damage: 1 });
      const state = patchInstance(base, identityOf(base), { exhausted: true, damage: 5 });
      const after = cast(state, "34035", 1);
      expect(inst(after, identityOf(after)).exhausted).toBe(false);
      expect(inst(after, identityOf(after)).damage).toBe(3);
      expect(inst(after, storm).exhausted).toBe(false);
      expect(inst(after, storm).damage).toBe(0);
    });
    it("cannot be played with Storm not in play (Team-Up)", () => {
      const given = moveToHand(conjure(staged(), "34035"), P1, "34035");
      expect(() => runWith(DEPS, given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids)))).toThrow(
        /Team-Up/,
      );
    });
  });

  describe("Psychic Rapport (34023)", () => {
    it("readies Phoenix, then places 2 power counters on Phoenix Force", () => {
      const base = allyInPlay(staged(false, 2), "34003").state;
      const state = patchInstance(base, identityOf(base), { exhausted: true });
      const after = cast(state, "34023", 2, choosing("Place 2 power counters"));
      expect(inst(after, identityOf(after)).exhausted).toBe(false);
      expect(powerOf(after)).toBe(4);
    });
    it("or returns a Cyclops card from the discard pile to hand", () => {
      const base = allyInPlay(staged(), "34003").state;
      const { state, id } = moveToDiscard(conjure(base, "33005"), P1, "33005");
      const after = cast(state, "34023", 2, choosing("Return a Cyclops card", targeting(id)));
      expect(playerOf(after, P1).hand).toContain(id);
      expect(powerOf(after)).toBe(2);
    });
  });
});
