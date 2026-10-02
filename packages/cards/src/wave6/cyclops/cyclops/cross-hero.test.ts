import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  allyLimitFor,
  applyCommand,
  characterProfile,
  createGame,
  legalActions,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../../testing/cross-hero.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  payWith,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): Cyclops's
 * aspect and basic cards (`cyclops` 33011-33026, every one whose aspect is not `hero:33001a`) played from a Core
 * hero's deck instead of `cyclops-leadership`: the card's own aspect's Core precon (Captain Marvel for Leadership,
 * She-Hulk Aggression, Black Panther Protection, Spider-Man Justice) and a basic card from Spider-Man or Captain
 * Marvel. A Core identity has no X-MEN or MUTANT trait, so the X-MEN-gated cards assert what their text says for such
 * a deck: they work on the X-MEN ally itself (Beast, the one Leadership X-MEN ally a Core Leadership deck can add) or
 * are refused/not offered.
 *
 * Not yet scripted (`../../coverage.test.ts`, `KNOWN_SKIPPED` and cards no module registers yet): Dust 33012 and
 * Coordinated Attack 33016 (skipped with a written reason), Teamwork 33017, Effective Leadership 33018, Game Time
 * 33022 and Psychic Rapport 33023 (events.ts says "other modules"). Those get a deck-legality check and an `it.todo`
 * for their behavior; 33024-33026 are plain resources (no ability).
 */
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};
const CAPTAIN_MARVEL = "core-captain-marvel-leadership";
const SHE_HULK = "core-she-hulk-aggression";
const BLACK_PANTHER = "core-black-panther-protection";
const SPIDER_MAN = "core-spider-man-justice";

const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const codeOf = (state: GameState, id: InstanceId) => String(state.instances[id]!.cardId);

/** Accepts the named optional triggers; for any other prompt picks the first option `wantCard` accepts, else declines. */
const choosing =
  (wanted: readonly string[], seen: string[] = [], wantCard?: (state: GameState, id: string) => boolean): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    for (const option of options) seen.push(option.optionId);
    const hits = options.filter((o) => wanted.some((w) => o.optionId.includes(w)));
    if (hits.length > 0) return hits.map((o) => o.optionId);
    const card = wantCard ? options.find((o) => wantCard(state, o.optionId)) : undefined;
    return card ? [card.optionId] : firstLegal(state);
  };

/** A game from `coreHero`'s deck with `cardCode` (one copy) plus one Beast (33011, the X-MEN ally a Core Leadership
 * deck can add), past setup, in the player phase. */
function openedWithBeast(cardCode: string, coreHero = CAPTAIN_MARVEL): GameState {
  const built = buildCrossHeroDeck(WAVE6_CARDS, coreHero, cardCode);
  const created = createGame(game.buildScenario([{ ...built, deck: [...built.deck, cardId("33011")] }]), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Whether playing `card` attached to `host` is a legal target of a legal play. */
const canAttach = (state: GameState, card: InstanceId, host: InstanceId): boolean => {
  const actions = legalActions(state, P1, WAVE6_DEPS);
  if (actions.kind !== "turn") return false;
  return actions.legal.some(
    (a) => a.action.kind === "playCard" && a.action.instanceId === card && (a.targets ?? []).includes(host),
  );
};

describe("Cyclops's aspect and basic cards, from a Core hero's deck", () => {
  it("every one is legal in a Core deck of its aspect (one copy added to the precon)", () => {
    for (const [code, hero] of [
      ["33011", CAPTAIN_MARVEL],
      ["33012", SHE_HULK],
      ["33013", BLACK_PANTHER],
      ["33014", SPIDER_MAN],
      ["33015", CAPTAIN_MARVEL],
      ["33016", CAPTAIN_MARVEL],
      ["33017", CAPTAIN_MARVEL],
      ["33018", CAPTAIN_MARVEL],
      ["33019", SPIDER_MAN],
      ["33020", SPIDER_MAN],
      ["33021", SPIDER_MAN],
      ["33022", SPIDER_MAN],
      ["33024", SPIDER_MAN],
      ["33025", SPIDER_MAN],
      ["33026", SPIDER_MAN],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, hero, code);
      expect(
        deck.deck.filter((id) => id === code),
        code,
      ).toHaveLength(1);
      const created = createGame(game.buildScenario([deck]), WAVE6_DEPS);
      expect(created.ok, code).toBe(true);
    }
  });

  it("33023 Psychic Rapport (Team-Up: Cyclops and Phoenix) is refused in a Core hero's deck", () => {
    const deck = buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "33023");
    const created = createGame(game.buildScenario([deck]), WAVE6_DEPS);
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe("illegal_deck");
      expect(created.error.message).toContain("only a deck whose identity is one of them may include it");
    }
  });

  describe("33011.beast-response", () => {
    it("plays as an ally and fetches a resource card from the deck or discard pile to the hand", () => {
      const seen: string[] = [];
      const isResource = (state: GameState, id: string) =>
        state.instances[id as InstanceId] !== undefined &&
        state.cardPool[state.instances[id as InstanceId]!.cardId]!.type === "resource";
      const { state, cardInstanceId } = playFromAnotherHerosDeck("33011", game, {
        coreHero: CAPTAIN_MARVEL,
        pick: choosing(["33011.beast-response"], seen, isResource),
      });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(seen.some((id) => id.includes("33011.beast-response"))).toBe(true);
      // The choice offered only resource cards, and its pick went to the hand.
      const offered = seen.filter((id) => state.instances[id as InstanceId]);
      expect(offered.length).toBeGreaterThan(0);
      for (const id of offered) expect(isResource(state, id)).toBe(true);
    });
  });

  describe("33013 Rockslide (retaliate 1)", () => {
    it("plays as an ally from a Protection deck", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("33013", game, { coreHero: BLACK_PANTHER });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(codeOf(state, cardInstanceId)).toBe("33013");
    });
  });

  describe("33014.blindfold-response", () => {
    it("looks at the top 5 encounter cards, discards the chosen one and puts the rest back in order", () => {
      const created = createGame(
        game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "33014")]),
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      const [c1, c2, c3, c4, c5, ...rest] = activeEncounterDeck(opened).deck;
      const { state } = playFromHand(
        WAVE6_DEPS,
        opened,
        "33014",
        3,
        choosing(["33014.blindfold-response"], [], (_s, id) => id === c3),
      );
      const encounter = activeEncounterDeck(state);
      expect(encounter.deck).toEqual([c1, c2, c4, c5, ...rest]);
      expect(encounter.discard).toContain(c3);
    });
  });

  describe("33015.danger-room-training-constant", () => {
    it("attaches to an X-MEN ally for +1 THW, +1 ATK and +1 hit point; the Core hero is not a legal host", () => {
      const opened = openedWithBeast("33015");
      const { state, id: beast } = playFromHand(WAVE6_DEPS, opened, "33011", 4);
      const before = profile(state, beast);
      const given = moveToHand(state, P1, "33015");
      const [training] = given.ids as [InstanceId];
      expect(canAttach(given.state, training, beast)).toBe(true);
      expect(canAttach(given.state, training, identityOf(given.state, P1))).toBe(false);
      const after = given.state;
      const played = settle(
        applyOk(after, play(P1, training, payWith(after, P1, 1, [training]), { attachToInstanceId: beast })),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      const now = profile(played, beast);
      expect([now.thw, now.atk, now.maxHp]).toEqual([before.thw + 1, before.atk + 1, before.maxHp + 1]);
      const refused = applyCommand(
        after,
        play(P1, training, payWith(after, P1, 1, [training]), { attachToInstanceId: identityOf(after, P1) }),
        WAVE6_DEPS,
      );
      expect(refused.ok).toBe(false);
    });
  });

  describe("33019.angel-constant", () => {
    it("costs its full 3 for a Core hero (no MUTANT or X-MEN identity), so 2 resources are refused", () => {
      const created = createGame(
        game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "33019")]),
        WAVE6_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
      const given = moveToHand(opened, P1, "33019");
      const [angel] = given.ids as [InstanceId];
      const cheap = applyCommand(given.state, play(P1, angel, payWith(given.state, P1, 2, [angel])), WAVE6_DEPS);
      expect(cheap.ok).toBe(false);
      const { state, cardInstanceId } = playFromAnotherHerosDeck("33019", game, { coreHero: SPIDER_MAN, cost: 3 });
      expect(inPlay(state, cardInstanceId)).toBe(true);
    });
  });

  describe("33020 Utopia", () => {
    it("33020.utopia-constant: raises the ally limit by 1 while each ally is X-MEN (none, then Beast), not for a Core ally", () => {
      const opened = withForm(openedWithBeast("33020"), { heroForm: 0 });
      expect(allyLimitFor(opened, WAVE6_DEPS, P1)).toBe(3);
      const { state: withUtopia } = playFromHand(WAVE6_DEPS, opened, "33020", 2);
      expect(allyLimitFor(withUtopia, WAVE6_DEPS, P1)).toBe(4);
      const { state: withBeast } = playFromHand(WAVE6_DEPS, withUtopia, "33011", 4);
      expect(allyLimitFor(withBeast, WAVE6_DEPS, P1)).toBe(4);
    });

    it("33020.utopia-response: after Beast (X-MEN) enters play, Utopia exhausts to ready an X-MEN character", () => {
      const opened = withForm(openedWithBeast("33020"), { heroForm: 0 });
      const { state: withUtopia, id: utopia } = playFromHand(WAVE6_DEPS, opened, "33020", 2);
      const seen: string[] = [];
      const { state: after, id: beast } = playFromHand(
        WAVE6_DEPS,
        patchExhausted(withUtopia),
        "33011",
        4,
        choosing(["33020.utopia-response"], seen),
      );
      expect(seen.some((id) => id.includes("33020.utopia-response"))).toBe(true);
      expect(inst(after, utopia).exhausted).toBe(true);
      expect(inPlay(after, beast)).toBe(true);
    });
  });

  describe("33021.danger-room-response", () => {
    it("is an Alter-Ego Response for a MUTANT alter-ego: a Core hero's alter-ego is not offered it", () => {
      const opened = openedWithBeast("33021");
      expect(playerOf(opened, P1).identity.form).toBe("alterEgo");
      const { state: withRoom, id: room } = playFromHand(WAVE6_DEPS, opened, "33021", 2);
      expect(inPlay(withRoom, room)).toBe(true);
      const seen: string[] = [];
      const { state: after, id: beast } = playFromHand(WAVE6_DEPS, withRoom, "33011", 4, choosing([], seen));
      expect(seen.some((id) => id.includes("33021.danger-room-response"))).toBe(false);
      expect(inst(after, room).exhausted).toBe(false);
      expect(inst(after, beast).attachments).toEqual([]);
    });
  });

  describe("not yet scripted (see the docblock)", () => {
    it.todo(
      "33012 Dust: attacks each minion; a Core Aggression hero plays her as an X-MEN ally (33012.dust-interrupt)",
    );
    it.todo("33016 Coordinated Attack: -1 consequential damage to allies attacking the attached minion");
    it.todo("33017 Teamwork: hero interrupt adding an exhausted ally's power to a basic THW or ATK");
    it.todo("33018 Effective Leadership: +1 THW and +1 ATK to the ally it is spent to play");
    it.todo("33022 Game Time: ready an ally with a TRAINING upgrade attached and heal 1 damage from it");
    it.todo("33023 Psychic Rapport: Hero Action readying Cyclops and Phoenix (only deckable with them)");
  });
});

function applyOk(state: GameState, command: Parameters<typeof applyCommand>[1]): GameState {
  const result = applyCommand(state, command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

/** The hero exhausted (so a "ready" effect has something to do); the same state otherwise. */
function patchExhausted(state: GameState): GameState {
  const hero = identityOf(state, P1);
  return { ...state, instances: { ...state.instances, [hero]: { ...inst(state, hero), exhausted: true } } };
}
