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
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): Colossus's
 * aspect and basic cards (`mut_gen` 32011-32024, every one whose aspect is not `hero:32001a`) played from a Core hero's
 * deck instead of `colossus-protection`: Black Panther (Protection) for 32011-32018, Spider-Man (Justice) for the basic
 * 32019-32024. Most are X-MEN gated by their own text and a Core identity has no X-MEN trait, so for those the test
 * asserts the card does what its text says for a non-X-MEN deck (works on the X-MEN card itself, or is refused).
 * 32014-32018 and 32021 have no script yet (`../../coverage.test.ts`), and 32022-32024 are plain resources (no ability).
 */
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};
const BLACK_PANTHER = "core-black-panther-protection";
const SPIDER_MAN = "core-spider-man-justice";

const villainOf = (state: GameState) => state.villains[0]!.instanceId;
const heroFirst = (state: GameState): GameState =>
  settle(runWith(WAVE6_DEPS, state, toHero(P1)), firstLegal, undefined, WAVE6_DEPS);
const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
/** Accepts the named optional triggers; declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const hits = (choice?.options ?? []).filter((o) => wanted.some((w) => o.optionId.includes(w)));
    return hits.length > 0 ? hits.map((o) => o.optionId) : firstLegal(state);
  };
/** Records every optional trigger option offered while resolving, accepting none. */
const recording =
  (seen: string[]): Picker =>
  (state) => {
    for (const option of state.pendingChoice?.options ?? []) seen.push(option.optionId);
    return firstLegal(state);
  };

describe("Colossus's aspect and basic cards, from a Core hero's deck", () => {
  it("every one is legal in a Core deck of its aspect (one copy added to the precon)", () => {
    for (const [code, hero] of [
      ["32011", BLACK_PANTHER],
      ["32012", BLACK_PANTHER],
      ["32013", BLACK_PANTHER],
      ["32019", SPIDER_MAN],
      ["32020", SPIDER_MAN],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, hero, code);
      expect(deck.deck.filter((id) => id === code)).toHaveLength(1);
    }
  });

  describe("32011.nightcrawler-interrupt", () => {
    it("plays as an ally, and his interrupt is not offered when a non-X-MEN hero takes the attack's damage", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("32011", game, {
        coreHero: BLACK_PANTHER,
        setup: heroFirst,
      });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      const seen: string[] = [];
      const { state: after } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(state, "01186", "01186"),
        recording(seen),
        endTurn(P1),
      );
      expect(seen.some((id) => id.includes("32011.nightcrawler-interrupt"))).toBe(false);
      expect(inPlay(after, cardInstanceId)).toBe(true);
    });
  });

  describe("32012.polaris-response", () => {
    it("gives a tough status card to an X-MEN character: only Polaris herself is one in a Core deck", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("32012", game, {
        coreHero: BLACK_PANTHER,
        pick: accepting("32012.polaris-response"),
      });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(inst(state, cardInstanceId).statuses.tough).toBe(1);
      expect(inst(state, identityOf(state, P1)).statuses.tough).toBe(0);
    });
  });

  describe("32013.protective-training-constant", () => {
    /** Black Panther's deck with Protective Training (the card under test) and one Nightcrawler, the only X-MEN ally
     * a Core deck can hold, with Nightcrawler already in play. */
    function withNightcrawlerInPlay() {
      const built = buildCrossHeroDeck(WAVE6_CARDS, BLACK_PANTHER, "32013");
      const created = createGame(
        game.buildScenario([{ ...built, deck: [...built.deck, cardId("32011")] }]),
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      return playFromHand(WAVE6_DEPS, opened, "32011", 3);
    }

    it("attaches to an X-MEN ally for +3 hit points; nobody else gets them", () => {
      const { state, id: nightcrawler } = withNightcrawlerInPlay();
      const hpBefore = profile(state, nightcrawler).maxHp;
      const heroHpBefore = profile(state, identityOf(state, P1)).maxHp;
      const given = moveToHand(state, P1, "32013");
      const [training] = given.ids as [InstanceId];
      const after = settle(
        runWith(
          WAVE6_DEPS,
          given.state,
          play(P1, training, payWith(given.state, P1, 1, [training]), { attachToInstanceId: nightcrawler }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, nightcrawler).attachments).toContain(training);
      expect(profile(after, nightcrawler).maxHp).toBe(hpBefore + 3);
      expect(profile(after, identityOf(after, P1)).maxHp).toBe(heroHpBefore);
    });

    it("cannot attach to the Core hero (not an X-MEN ally)", () => {
      const { state } = withNightcrawlerInPlay();
      const given = moveToHand(state, P1, "32013");
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

  describe("32019.professor-x-forced-response", () => {
    it("confuses the villain on entering play, and is discarded at the end of the round", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("32019", game, { coreHero: SPIDER_MAN });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(inst(state, villainOf(state)).statuses.confused).toBe(1);
      const turned = settle(runWith(WAVE6_DEPS, state, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);
      expect(playerOf(turned, P1).discard).toContain(cardInstanceId);
    });
  });

  describe("32020.the-x-jet-resource", () => {
    it("plays as a support, but its resource is refused: a Core hero's identity has no X-MEN trait", () => {
      const { state, cardInstanceId: jet } = playFromAnotherHerosDeck("32020", game, { coreHero: SPIDER_MAN });
      expect(inPlay(state, jet)).toBe(true);
      const owner = playerOf(state, P1);
      const found = [...owner.hand, ...owner.deck].find((id) => {
        const printed = state.cardPool[state.instances[id]!.cardId] as { cost?: number; type: string };
        return printed.cost === 1 && ["support", "ally"].includes(printed.type);
      })!;
      const given = moveToHand(state, P1, state.instances[found]!.cardId);
      const result = applyCommand(
        given.state,
        play(P1, given.ids[0]!, [], { abilities: [resourceAbility(jet, "32020.the-x-jet-resource")] }),
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain("condition is not met");
    });
  });
});
