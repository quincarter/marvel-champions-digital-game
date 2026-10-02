import { activeVillain, cardsInPlay, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
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
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  revealFromEncounterDeck,
  stackSetAside,
  stageNemesisCardForReveal,
  withDamage,
  withForm,
} from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { WOLVERINE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { wolverineGame } from "./support.js";

const ADVANCE = "01186";
const me = (state: GameState): InstanceId => identityOf(state, P1);
const heroGame = () => withForm(wolverineGame(), { heroForm: 0 });
const villainOf = (state: GameState) => activeVillain(state)!.instanceId;
const stunVillain = (state: GameState) =>
  patchInstance(state, villainOf(state), { statuses: { ...inst(state, villainOf(state)).statuses, stunned: 1 } });
const stunned = (state: GameState) =>
  patchInstance(state, me(state), { statuses: { ...inst(state, me(state)).statuses, stunned: 1 } });
const pass = (state: GameState, pick: Picker = firstLegal) =>
  settle(runWith(WAVE6_DEPS, state, endTurn(P1)), pick, undefined, WAVE6_DEPS);
const encounterPiles = (state: GameState) => Object.values(state.encounterDecks)[0]!;
const inPlay = (state: GameState, code: string): InstanceId | undefined =>
  instancesOf(state, code).find((id) => cardsInPlay(state).includes(id));
const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Picks the offered option whose id or label contains `text` (else the first legal choice). */
const choosing =
  (text: string): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => `${o.optionId} ${JSON.stringify(o)}`.includes(text));
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Wolverine's obligation and nemesis set (35027-35031)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(WOLVERINE_OBLIGATION_NEMESIS).sort()).toEqual([
      "35027.obligation",
      "35028.omega-red-forced-interrupt",
      "35029.the-carbonadium-synthesizer-constant",
      "35030.death-factor-forced-response",
      "35030.death-factor-interrupt",
      "35031.boost",
      "35031.when-revealed",
    ]);
    for (const definition of Object.values(WOLVERINE_OBLIGATION_NEMESIS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Past Demons (35027)", () => {
    const demons = (pick: Picker) => {
      const after = pass(stackEncounterDeck(stunVillain(wolverineGame()), ADVANCE, "35027"), pick);
      return { after, card: instancesOf(after, "35027")[0]! };
    };

    it("35027.obligation, exhaust Logan: removes Past Demons from the game", () => {
      const { after, card } = demons(choosing("Exhaust"));
      expect(after.removedFromGame).toContain(card);
      expect(inst(after, me(after)).exhausted).toBe(true);
      expect(inst(after, me(after)).statuses.stunned).toBeFalsy();
    });

    it("35027.obligation, the alternative: you are stunned and confused and Past Demons is discarded", () => {
      const { after, card } = demons(choosing("stunned and confused"));
      expect(inst(after, me(after)).statuses.stunned).toBe(1);
      expect(inst(after, me(after)).statuses.confused).toBe(1);
      expect(encounterPiles(after).discard).toContain(card);
      expect(after.removedFromGame).not.toContain(card);
    });

    it("35027.obligation: a hero-form player may flip to alter-ego form, then exhaust Logan to remove it", () => {
      const after = pass(stackEncounterDeck(stunVillain(heroGame()), "35027"), choosing("Flip"));
      expect(playerOf(after, P1).identity.form).toBe("alterEgo");
      expect(inst(after, me(after)).exhausted).toBe(true);
      expect(after.removedFromGame).toContain(instancesOf(after, "35027")[0]);
    });

    it("35027.obligation: staying in hero form leaves only the stunned-and-confused option", () => {
      const after = pass(stackEncounterDeck(stunVillain(heroGame()), "35027"), choosing("Stay"));
      expect(playerOf(after, P1).identity.form).toBe("hero");
      expect(inst(after, me(after)).statuses.stunned).toBe(1);
      expect(inst(after, me(after)).statuses.confused).toBe(1);
    });
  });

  describe("Omega Red (35028, nemesis minion)", () => {
    it("is revealed from the set-aside nemesis cards into play", () => {
      expect(
        inPlay(revealFromEncounterDeck(WAVE6_DEPS, stunVillain(heroGame()), "35028", firstLegal, 0).state, "35028"),
      ).toBeDefined();
    });

    it("35028.omega-red-forced-interrupt: when he attacks you, 1 damage to each character you control", () => {
      const { state: out, id } = revealFromEncounterDeck(WAVE6_DEPS, stunVillain(heroGame()), "35028", firstLegal, 0);
      const { events } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(out, ADVANCE, ADVANCE),
        firstLegal,
        endTurn(P1),
      );
      expect(of(events, "attackResolved").map((e) => e.enemyInstanceId)).toContain(id);
      expect(resolved(events)).toContain("35028.omega-red-forced-interrupt");
      const dealt = of(events, "damageDealt").filter((e) => e.targetInstanceId === me(out));
      expect(dealt.some((e) => e.amount === 1)).toBe(true);
    });
  });

  describe("The Carbonadium Synthesizer (35029)", () => {
    const strike = (withScheme: boolean) => {
      const { state: red, id } = revealFromEncounterDeck(WAVE6_DEPS, stunVillain(heroGame()), "35028", firstLegal, 0);
      let state = patchInstance(red, id, { damage: 7 });
      if (withScheme) state = encounterCardInVillainArea(stackSetAside(state, "35029"), "35029", 1).state;
      const ready = patchInstance(state, me(state), { exhausted: false });
      const after = settle(
        runWith(WAVE6_DEPS, ready, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: me(ready),
          targetInstanceId: id,
        }),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      return { after, id };
    };

    it("35029.the-carbonadium-synthesizer-constant: while in play, lethal damage does not defeat Omega Red", () => {
      const { after, id } = strike(true);
      expect(cardsInPlay(after)).toContain(id);
    });

    it("without the side scheme, the same attack defeats Omega Red", () => {
      const { after, id } = strike(false);
      expect(cardsInPlay(after)).not.toContain(id);
    });
  });

  describe("Death Factor (35030)", () => {
    /** Death Factor attached to Logan (alter-ego), the villain stunned. */
    const attached = (damage = 0) => {
      const { state, id } = revealFromEncounterDeck(WAVE6_DEPS, stunVillain(wolverineGame()), "35030");
      return { state: damage ? withDamage(state, me(state), damage) : state, id };
    };

    it("is revealed from the set-aside nemesis cards and attaches to your identity", () => {
      const { state, id } = attached();
      expect(inst(state, id).attachedTo).toBe(me(state));
    });

    it("35030.death-factor-forced-response: after your turn ends, you take 1 damage", () => {
      const { state, id } = attached();
      const before = inst(state, me(state)).damage;
      const { state: after, events } = driveEventsPicking(WAVE6_DEPS, state, firstLegal, endTurn(P1));
      expect(resolved(events)).toContain("35030.death-factor-forced-response");
      expect(inst(after, me(after)).damage).toBe(before + 1);
      expect(cardsInPlay(after)).toContain(id);
    });

    const recoverWith = (pick: Picker) => {
      const { state, id } = attached(3);
      const ready = patchInstance(state, me(state), { exhausted: false });
      let offered = false;
      const spy: Picker = (s) => {
        if (s.pendingChoice?.options.some((o) => o.optionId.includes("death-factor"))) offered = true;
        return pick(s);
      };
      const out = driveEventsPicking(WAVE6_DEPS, ready, spy, { type: "basicRecover", playerId: P1 });
      return { ...out, id, offered };
    };

    it("35030.death-factor-interrupt: offered to the host's player; accepting discards it and heals nothing (Q20)", () => {
      const { state: after, events, id, offered } = recoverWith(choosing("death-factor"));
      expect(offered).toBe(true);
      expect(resolved(events)).toContain("35030.death-factor-interrupt");
      expect(inst(after, me(after)).damage).toBe(3);
      expect(inst(after, me(after)).exhausted).toBe(true);
      expect(cardsInPlay(after)).not.toContain(id);
      expect(encounterPiles(after).discard).toContain(id);
    });

    it("35030.death-factor-interrupt: declining heals normally and Death Factor stays", () => {
      const { state: after, id, offered } = recoverWith(firstLegal);
      expect(offered).toBe(true);
      expect(inst(after, me(after)).damage).toBeLessThan(3);
      expect(cardsInPlay(after)).toContain(id);
    });
  });

  describe("Tentacle Strike (35031)", () => {
    const strike = (state: GameState) => {
      const staged = stageNemesisCardForReveal(stunVillain(state), "35031", P1, 1);
      return driveEventsPicking(WAVE6_DEPS, staged, firstLegal, endTurn(P1));
    };
    const damageTo = (events: readonly GameEvent[], state: GameState) =>
      of(events, "damageDealt")
        .filter((e) => e.targetInstanceId === me(state))
        .reduce((n, e) => n + e.amount, 0);

    it("35031.when-revealed: you are stunned and take 1 damage", () => {
      const open = heroGame();
      const { state, events } = strike(open);
      expect(inst(state, me(state)).statuses.stunned).toBe(1);
      expect(damageTo(events, open)).toBe(1);
    });

    it("35031.when-revealed: already stunned, you take 4 damage instead", () => {
      const open = stunned(heroGame());
      const { events } = strike(open);
      expect(damageTo(events, open)).toBe(4);
    });

    // As a boost card on the villain's attack.
    const boosted = (state: GameState) => pass(stackSetAside(state, "35031"));
    it("35031.boost: you are stunned, and take 1 damage (4 instead if you were already stunned)", () => {
      const open = heroGame();
      const first = boosted(open);
      const second = boosted(stunned(open));
      expect(inst(first, me(first)).statuses.stunned).toBe(1);
      // The same attack with the same boost in both runs, so the difference is the 1 vs 4 damage.
      expect(inst(second, me(second)).damage - inst(first, me(first)).damage).toBe(3);
      expect(inst(first, me(first)).damage).toBeGreaterThanOrEqual(1);
    });
  });
});
