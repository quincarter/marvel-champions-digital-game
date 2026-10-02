import { cardId } from "@mc/content";
import { applyCommand, characterProfile, createGame, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../../testing/cross-hero.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../project-wideawake-testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): Shadowcat's
 * aspect and basic cards (`mut_gen` 32041-32049, every one whose aspect is not `hero:32030a`) played from a Core hero's
 * deck instead of `shadowcat-aggression`: She-Hulk (Aggression) for 32041-32047, Spider-Man (Justice) for the basic
 * 32048-32049. 32050 and 32051 are covered by `../precon-player-cards.test.ts` (Team-Up refusal, reprint aliases) and
 * 32052-32054 are plain resources with no ability. A Core identity has no X-MEN or MUTANT trait, so for the cards gated
 * on one the test asserts what the text says for a non-X-MEN deck (works on the X-MEN card itself, or is refused).
 */
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};
const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";

const villainOf = (state: GameState) => state.villains[0]!.instanceId;
const heroFirst = (state: GameState): GameState =>
  settle(runWith(WAVE6_DEPS, state, toHero(P1)), firstLegal, undefined, WAVE6_DEPS);
const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const hits = (choice?.options ?? []).filter((o) => wanted.some((w) => o.optionId.includes(w)));
    return hits.length > 0 ? hits.map((o) => o.optionId) : firstLegal(state);
  };
const recording =
  (seen: string[]): Picker =>
  (state) => {
    for (const option of state.pendingChoice?.options ?? []) seen.push(option.optionId);
    return firstLegal(state);
  };

/** She-Hulk's deck with the card under test, plus one Wolverine (the X-MEN ally a Core deck can hold), opened. */
function withWolverine(code: string): GameState {
  const built = buildCrossHeroDeck(WAVE6_CARDS, SHE_HULK, code);
  const created = createGame(game.buildScenario([{ ...built, deck: [...built.deck, cardId("32041")] }]), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

describe("Shadowcat's aspect and basic cards, from a Core hero's deck", () => {
  it("every one is legal in a Core deck of its aspect (one copy added to the precon)", () => {
    for (const [code, hero] of [
      ["32041", SHE_HULK],
      ["32042", SHE_HULK],
      ["32043", SHE_HULK],
      ["32044", SHE_HULK],
      ["32045", SHE_HULK],
      ["32046", SHE_HULK],
      ["32047", SHE_HULK],
      ["32048", SPIDER_MAN],
      ["32049", SPIDER_MAN],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, hero, code);
      expect(deck.deck.filter((id) => id === code)).toHaveLength(1);
    }
  });

  describe("32041.wolverine-constant and -response", () => {
    it("plays as an ally; after the turn begins he heals 1 damage from himself", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("32041", game, {
        coreHero: SHE_HULK,
        setup: heroFirst,
      });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      const hurt = {
        ...state,
        instances: { ...state.instances, [cardInstanceId]: { ...inst(state, cardInstanceId), damage: 1 } },
      };
      const { state: after } = driveEventsPicking(
        WAVE6_DEPS,
        hurt,
        accepting("32041.wolverine-response"),
        endTurn(P1),
        endTurn(P1),
      );
      expect(inst(after, cardInstanceId).damage).toBe(0);
    });
  });

  describe("32042.magik-response", () => {
    it("plays as an ally, and her response is not offered: no minion is engaged with an X-MEN hero", () => {
      const seen: string[] = [];
      const { state, cardInstanceId } = playFromAnotherHerosDeck("32042", game, {
        coreHero: SHE_HULK,
        setup: (s) => engageMinion(heroFirst(s), "01101").state,
        pick: recording(seen),
      });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(seen.some((id) => id.includes("32042.magik-response"))).toBe(false);
    });
  });

  describe("32043.attack-training-constant-2", () => {
    it("attaches to an X-MEN ally for +1 ATK and +2 hit points; nobody else gets them", () => {
      const opened = heroFirst(withWolverine("32043"));
      const { state, id: wolverine } = playFromHand(WAVE6_DEPS, opened, "32041", 4);
      const atk = profile(state, wolverine).atk;
      const hp = profile(state, wolverine).maxHp;
      const heroAtk = profile(state, identityOf(state, P1)).atk;
      const given = moveToHand(state, P1, "32043");
      const [training] = given.ids as [InstanceId];
      const after = settle(
        runWith(
          WAVE6_DEPS,
          given.state,
          play(P1, training, payWith(given.state, P1, 1, [training]), { attachToInstanceId: wolverine }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, wolverine).attachments).toContain(training);
      expect(profile(after, wolverine).atk).toBe(atk + 1);
      expect(profile(after, wolverine).maxHp).toBe(hp + 2);
      expect(profile(after, identityOf(after, P1)).atk).toBe(heroAtk);
    });

    it("cannot attach to the Core hero (not an X-MEN ally)", () => {
      const state = heroFirst(withWolverine("32043"));
      const given = moveToHand(state, P1, "32043");
      const [training] = given.ids as [InstanceId];
      const result = applyCommand(
        given.state,
        play(P1, training, payWith(given.state, P1, 1, [training]), {
          attachToInstanceId: identityOf(given.state, P1),
        }),
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("32044.gatekeeper-constant", () => {
    it("attaches to a minion: +2 hit points and patrol, for a non-X-MEN deck too", () => {
      const { state: base, id: minion } = (() => {
        const built = buildCrossHeroDeck(WAVE6_CARDS, SHE_HULK, "32044");
        const created = createGame(game.buildScenario([built]), WAVE6_DEPS);
        if (!created.ok) throw new Error(created.error.message);
        const opened = heroFirst(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
        return engageMinion(opened, "01101");
      })();
      const hp = profile(base, minion).maxHp;
      const given = moveToHand(base, P1, "32044");
      const [gatekeeper] = given.ids as [InstanceId];
      const after = settle(
        runWith(
          WAVE6_DEPS,
          given.state,
          play(P1, gatekeeper, payWith(given.state, P1, 2, [gatekeeper]), { attachToInstanceId: minion }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, minion).attachments).toContain(gatekeeper);
      expect(profile(after, minion).maxHp).toBe(hp + 2);
    });
  });

  describe("32045.team-strike-action", () => {
    it("is refused: the identity must have the X-MEN trait, which no Core hero has", () => {
      const built = buildCrossHeroDeck(WAVE6_CARDS, SHE_HULK, "32045");
      const created = createGame(game.buildScenario([built]), WAVE6_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const opened = heroFirst(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
      const given = moveToHand(opened, P1, "32045");
      const [card] = given.ids as [InstanceId];
      const result = applyCommand(given.state, play(P1, card, payWith(given.state, P1, 1, [card])), WAVE6_DEPS);
      expect(result.ok).toBe(false);
    });
  });

  describe("32046.toe-to-toe-action", () => {
    it("works for a Core hero: the villain attacks her, then takes 5 damage", () => {
      const { state } = playFromAnotherHerosDeck("32046", game, {
        coreHero: SHE_HULK,
        setup: heroFirst,
        pick: (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [identityOf(s, P1)] : firstLegal(s)),
      });
      expect(inst(state, villainOf(state)).damage).toBe(5);
    });
  });

  describe("32047.aggressive-energy-interrupt", () => {
    it("spent to play an Attack event from a Core hero's deck, that event deals 1 additional damage", () => {
      const built = buildCrossHeroDeck(WAVE6_CARDS, SHE_HULK, "32046");
      const created = createGame(
        game.buildScenario([{ ...built, deck: [...built.deck, cardId("32047")] }]),
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const opened = heroFirst(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
      const given = moveToHand(opened, P1, "32046", "32047");
      const [event, energy] = given.ids as [InstanceId, InstanceId];
      const after = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, event, [energy])),
        (s) =>
          s.pendingChoice?.prompt.kind === "declareDefender"
            ? [identityOf(s, P1)]
            : accepting("32047.aggressive-energy-interrupt")(s),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, villainOf(after)).damage).toBe(6);
    });
  });

  describe("32048.colossus-constant", () => {
    it("costs 4 for a non-MUTANT, non-X-MEN identity (the reduction needs one of those traits)", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("32048", game, {
        coreHero: SPIDER_MAN,
        setup: heroFirst,
        cost: 4,
      });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(profile(state, cardInstanceId).atk).toBe(3);
    });
  });

  describe("32049.x-mansion-action", () => {
    it("plays as a support, but its action is refused: a Core hero's alter-ego is not a MUTANT", () => {
      const { state, cardInstanceId: mansion } = playFromAnotherHerosDeck("32049", game, {
        coreHero: SPIDER_MAN,
        cost: 3,
      });
      expect(inPlay(state, mansion)).toBe(true);
      const result = applyCommand(
        state,
        { type: "useAbility", playerId: P1, sourceInstanceId: mansion, abilityId: "32049.x-mansion-action" } as never,
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
    });
  });
});
