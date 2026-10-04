import { cardId } from "@mc/content";
import { applyCommand, characterProfile, createGame, legalActions, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../../testing/cross-hero.js";
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
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): Phoenix's
 * aspect and basic cards (`phoenix` 34014-34027 and 34032-34035, every one whose aspect is not `hero:34001a`) played
 * from a Core hero's deck instead of `phoenix-justice`. A Core identity has no PSIONIC, X-MEN or MUTANT trait, so the
 * gated cards (Psychic Manipulation, Mutant Peacekeepers, Cerebro, Psychic Assault / Misdirection / Kicker) are
 * asserted not offered, as their "Play only if your identity has ..." text says; Team-Up cards are refused at deck
 * building. 34025-34027 are plain resources (no ability).
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
const hero = (state: GameState): GameState => withForm(state, { heroForm: 0 });

const accepting =
  (wanted: string): Picker =>
  (state) => {
    const hit = (state.pendingChoice?.options ?? []).filter((o) => o.optionId.includes(wanted));
    return hit.length > 0 ? hit.map((o) => o.optionId) : firstLegal(state);
  };

/** A game from `coreHero`'s deck with one copy of `code`, past setup, in the player phase, in hero form. */
function opened(code: string, coreHero: string, extra: readonly string[] = [], heroForm = true): GameState {
  const built = buildCrossHeroDeck(WAVE6_CARDS, coreHero, code);
  const deck = [...built.deck, ...extra.map((c) => cardId(c))];
  const created = createGame(game.buildScenario([{ ...built, deck }]), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.code}: ${created.error.message}`);
  const past = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
  return heroForm ? hero(past) : past;
}

/** `state` with `n` more deck cards in hand, to pay with. */
const stocked = (state: GameState, n = 8): GameState => ({
  ...state,
  players: state.players.map((p) =>
    p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, n)], deck: p.deck.slice(n) } : p,
  ),
});

/** Whether `code` (in hand, with plenty to pay with) is offered as a play at all. */
function offered(code: string, coreHero: string): boolean {
  const given = moveToHand(stocked(opened(code, coreHero)), P1, code);
  const actions = legalActions(given.state, P1, WAVE6_DEPS);
  return (
    actions.kind === "turn" &&
    actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.ids[0])
  );
}

const canAttach = (state: GameState, card: InstanceId, host: InstanceId): boolean => {
  const actions = legalActions(state, P1, WAVE6_DEPS);
  return (
    actions.kind === "turn" &&
    actions.legal.some(
      (a) => a.action.kind === "playCard" && a.action.instanceId === card && (a.targets ?? []).includes(host),
    )
  );
};

function applyOk(state: GameState, command: Parameters<typeof applyCommand>[1]): GameState {
  const result = applyCommand(state, command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

describe("Phoenix's aspect and basic cards, from a Core hero's deck", () => {
  it("every one that has no Team-Up is legal in a Core deck of its aspect (one copy added to the precon)", () => {
    for (const [code, coreHero] of [
      ["34014", SPIDER_MAN],
      ["34015", SPIDER_MAN],
      ["34016", SPIDER_MAN],
      ["34017", SPIDER_MAN],
      ["34018", SPIDER_MAN],
      ["34019", SPIDER_MAN],
      ["34020", SPIDER_MAN],
      ["34021", SPIDER_MAN],
      ["34022", SPIDER_MAN],
      ["34024", SPIDER_MAN],
      ["34025", SPIDER_MAN],
      ["34026", SPIDER_MAN],
      ["34027", SPIDER_MAN],
      ["34032", SHE_HULK],
      ["34033", BLACK_PANTHER],
      ["34034", CAPTAIN_MARVEL],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, coreHero, code);
      expect(deck.deck.includes(cardId(code)), code).toBe(true);
      const created = createGame(game.buildScenario([deck]), WAVE6_DEPS);
      expect(created.ok, code).toBe(true);
    }
  });

  it("Psychic Rapport 34023 (Cyclops and Phoenix) and Soul Sisters 34035 (Phoenix and Storm) are refused in a Core hero's deck", () => {
    for (const code of ["34023", "34035"]) {
      const created = createGame(game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, code)]), WAVE6_DEPS);
      expect(created.ok, code).toBe(false);
      if (!created.ok) {
        expect(created.error.code).toBe("illegal_deck");
        expect(created.error.message).toContain("only a deck whose identity is one of them may include it");
      }
    }
  });

  describe("cards gated on the identity's traits", () => {
    it("are not offered to a Core hero, though a plain card of the same cost is", () => {
      for (const [code, coreHero] of [
        ["34017", SPIDER_MAN],
        ["34018", SPIDER_MAN],
        ["34022", SPIDER_MAN],
        ["34032", SHE_HULK],
        ["34033", BLACK_PANTHER],
        ["34034", CAPTAIN_MARVEL],
      ] as const) {
        expect(offered(code, coreHero), code).toBe(false);
      }
      expect(offered("34019", SPIDER_MAN)).toBe(true);
    });
  });

  describe("34014 Banshee and 34015 Marvel Girl", () => {
    it("play as allies from a Justice deck", () => {
      for (const [code, cost] of [
        ["34014", 4],
        ["34015", 3],
      ] as const) {
        const { state, cardInstanceId } = playFromAnotherHerosDeck(code, game, { coreHero: SPIDER_MAN, cost });
        expect(inPlay(state, cardInstanceId), code).toBe(true);
      }
    });

    it("34014.banshee-response: after Banshee thwarts, a minion is confused", () => {
      const { state: withBanshee, cardInstanceId: banshee } = playFromAnotherHerosDeck("34014", game, {
        coreHero: SPIDER_MAN,
        cost: 4,
      });
      const { state: engaged, id: minion } = engageMinion(withBanshee, "01101", P1);
      const scheme = engaged.mainScheme.instanceId;
      const threatened = patchInstance(engaged, scheme, { threat: 6 });
      const after = settle(
        applyOk(threatened, {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: banshee,
          schemeInstanceId: scheme,
        } as never),
        accepting("34014.banshee-response"),
        undefined,
        WAVE6_DEPS,
      );
      expect(mainThreat(after)).toBeLessThan(6);
      expect(inst(after, minion).statuses.confused).toBeGreaterThan(0);
    });
  });

  describe("34016.mission-training-constant", () => {
    it("attaches to an X-MEN ally (Storm) for +1 THW and +2 hit points; the Core hero is not a legal host", () => {
      const base = stocked(opened("34016", SPIDER_MAN, ["34021"]));
      const { state, id: storm } = playFromHand(WAVE6_DEPS, base, "34021", 5);
      const before = profile(state, storm);
      const given = moveToHand(state, P1, "34016");
      const [training] = given.ids as [InstanceId];
      expect(canAttach(given.state, training, storm)).toBe(true);
      expect(canAttach(given.state, training, identityOf(given.state, P1))).toBe(false);
      const played = settle(
        applyOk(
          given.state,
          play(P1, training, payWith(given.state, P1, 1, [training]), { attachToInstanceId: storm }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      const now = profile(played, storm);
      expect([now.thw, now.maxHp]).toEqual([before.thw + 1, before.maxHp + 2]);
    });
  });

  describe("34019 Swift Retribution", () => {
    it("from a Justice deck: the villain schemes and takes 4 damage", () => {
      const { state } = playFromAnotherHerosDeck("34019", game, {
        coreHero: SPIDER_MAN,
        setup: (s) => hero(s),
      });
      expect(inst(state, state.villains[0]!.instanceId).damage).toBe(4);
    });
  });

  describe("34020 Passion for Justice", () => {
    it("spent to play For Justice! (a THWART event), it removes 1 more threat than when the interrupt is declined", () => {
      const run = (pick: Picker) => {
        const start = stocked(opened("34020", SPIDER_MAN));
        const base = patchInstance(start, start.mainScheme.instanceId, { threat: 8 });
        const given = moveToHand(base, P1, "01060", "34020");
        const [event, passion] = given.ids as [InstanceId, InstanceId];
        const filler = payWith(given.state, P1, 2, [event, passion]);
        const after = settle(applyOk(given.state, play(P1, event, [passion, filler[0]!])), pick, undefined, WAVE6_DEPS);
        return { removed: 8 - mainThreat(after), after, passion };
      };
      const spent = run(accepting("34020.passion-for-justice-interrupt"));
      const declined = run(firstLegal);
      expect(spent.removed).toBe(declined.removed + 1);
      expect(playerOf(spent.after, P1).discard).toContain(spent.passion);
    });
  });

  describe("34021 Storm", () => {
    it("costs its full 5 for a Core hero (no MUTANT or X-MEN identity), so 4 resources are refused", () => {
      const given = moveToHand(stocked(opened("34021", SPIDER_MAN)), P1, "34021");
      const [storm] = given.ids as [InstanceId];
      const cheap = applyCommand(given.state, play(P1, storm, payWith(given.state, P1, 4, [storm])), WAVE6_DEPS);
      expect(cheap.ok).toBe(false);
      const { state, cardInstanceId } = playFromAnotherHerosDeck("34021", game, { coreHero: SPIDER_MAN, cost: 5 });
      expect(inPlay(state, cardInstanceId)).toBe(true);
    });
  });

  describe("34024 Down Time", () => {
    it("is playable from a Core deck and raises an alter-ego's recovery by 2", () => {
      const base = stocked(opened("34024", SPIDER_MAN, [], false));
      const { state } = playFromHand(WAVE6_DEPS, base, "34024", 1);
      const alterEgo = identityOf(state, P1);
      expect(profile(state, alterEgo).rec).toBe(profile(base, alterEgo).rec + 2);
    });
  });
});
