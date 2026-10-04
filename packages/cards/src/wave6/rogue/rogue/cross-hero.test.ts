import { applyCommand, createGame, legalActions, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../../testing/cross-hero.js";
import {
  applyOk,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): Rogue's
 * aspect and basic cards (`rogue` 38010-38023: every one whose aspect is not `hero:38001a`) played from a Core hero's
 * deck instead of `rogue-protection`. A Core identity is neither MUTANT nor X-MEN, so the gated cards assert what
 * their text says for such a deck: Armor, Moira MacTaggert and X-Gene are refused, and Beauty and the Thief (Team-Up
 * Gambit and Rogue) cannot be in the deck at all. Med Lab (38028, Leadership) is tested in
 * `support-upgrades-allies.test.ts` and is left out here.
 */
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};
const SPIDER_MAN = "core-spider-man-justice";
const BLACK_PANTHER = "core-black-panther-protection";
const MERCENARY = "01101"; // Hydra Mercenary: non-ELITE minion
const NO_ICONS = "01186"; // Advance, 0 boost icons
const ONE_ICON = "01188"; // Caught Off Guard, 1 boost icon
const TWO_ICONS = "01190"; // Shadow of the Past, 2 boost icons

const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const counter = (state: GameState, id: InstanceId, type: string): number => inst(state, id).counters[type] ?? 0;
const handSize = (state: GameState): number => playerOf(state, P1).hand.length;
const costOf = (code: string): number => (WAVE6_CARDS.find((c) => c.id === code) as { cost?: number }).cost ?? 0;

/** Accepts every optional trigger whose id contains one of `wanted`; picks `wantCard`'s card at a card prompt. */
const choosing =
  (wanted: readonly string[], wantCard?: (id: string) => boolean): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    const hits = options.filter((o) => wanted.some((w) => o.optionId.includes(w)));
    if (hits.length > 0) return hits.map((o) => o.optionId);
    const card = wantCard ? options.find((o) => wantCard(o.optionId)) : undefined;
    return card ? [card.optionId] : firstLegal(state);
  };

/** A game from `coreHero`'s deck with one `code` seated, past setup, in the player phase, in hero form. */
function opened(code: string, coreHero = BLACK_PANTHER): GameState {
  const created = createGame(game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, coreHero, code)]), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
  return withForm(state, { heroForm: 0 });
}

const canPlay = (state: GameState, id: InstanceId): boolean => {
  const actions = legalActions(state, P1, WAVE6_DEPS);
  return (
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)
  );
};

/**
 * Ends the player's turn (the villain phase runs) with `held` cards in hand, collecting every event. `ref` is the
 * trigger accepted when offered (once per prompt); `defend` declares the hero as defender; a payForCard prompt is
 * paid with `payWithCode` when given, else the first offered card; discard-down never discards `held`.
 */
function villainPhase(
  state: GameState,
  options: {
    held?: readonly string[];
    ref?: string;
    defend?: boolean;
    payWithCode?: string;
    alsoRef?: readonly string[];
  } = {},
) {
  const given = moveToHand(state, P1, ...(options.held ?? []));
  const events: GameEvent[] = [];
  let offered = 0;
  const refs = [options.ref, ...(options.alsoRef ?? [])].filter((r): r is string => r !== undefined);
  const pick: Picker = (s) => {
    const open = s.pendingChoice;
    if (!open) return [];
    if (open.prompt.kind === "discardDownToHandSize") {
      const spare = open.options.filter((o) => !given.ids.includes(o.optionId as InstanceId));
      return spare.slice(0, open.minSelections).map((o) => o.optionId);
    }
    if (open.prompt.kind === "payForCard") {
      const wanted = options.payWithCode
        ? open.options.find(
            (o) => o.ref.kind === "card" && s.instances[o.ref.instanceId]?.cardId === options.payWithCode,
          )
        : undefined;
      return [(wanted ?? open.options[0]!).optionId];
    }
    const hero = open.options.find((o) => o.optionId === identityOf(s, P1));
    if (options.defend && hero) return [hero.optionId];
    const mine = open.options.filter((o) => refs.some((r) => o.optionId.includes(r)));
    if (mine.length > 0) {
      offered++;
      return [mine[0]!.optionId];
    }
    return firstLegal(s);
  };
  let current = applyOk(given.state, { type: "endTurn", playerId: P1 }, WAVE6_DEPS);
  events.push(...current.events);
  const settled = settle(current.state, (s) => pick(s), undefined, WAVE6_DEPS);
  return { state: settled, given, offered: () => offered, events };
}

describe("Rogue's aspect and basic cards, from a Core hero's deck", () => {
  it("every one is legal in a Core deck (one copy added to the precon)", () => {
    for (const [code, hero] of [
      ["38010", BLACK_PANTHER],
      ["38011", BLACK_PANTHER],
      ["38012", BLACK_PANTHER],
      ["38013", BLACK_PANTHER],
      ["38014", BLACK_PANTHER],
      ["38015", BLACK_PANTHER],
      ["38016", BLACK_PANTHER],
      ["38017", BLACK_PANTHER],
      ["38018", SPIDER_MAN],
      ["38019", SPIDER_MAN],
      ["38021", SPIDER_MAN],
      ["38022", SPIDER_MAN],
      ["38023", SPIDER_MAN],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, hero, code);
      expect(deck.deck.filter((id) => id === code)).toHaveLength(1);
      expect(createGame(game.buildScenario([deck]), WAVE6_DEPS).ok, code).toBe(true);
    }
  });

  it("38020 Beauty and the Thief (Team-Up: Gambit and Rogue) is refused in a Core hero's deck", () => {
    const created = createGame(game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "38020")]), WAVE6_DEPS);
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe("illegal_deck");
      expect(created.error.message).toContain("only a deck whose identity is one of them may include it");
    }
  });

  describe("38010.iceman", () => {
    it("enters play with 3 freeze counters; after a minion enters play, 1 counter stuns it", () => {
      const { state, cardInstanceId: iceman } = playFromAnotherHerosDeck("38010", game, { cost: 3 });
      expect(inPlay(state, iceman)).toBe(true);
      expect(counter(state, iceman, "freeze")).toBe(3);
      const run = villainPhase(withForm(stackEncounterDeck(state, NO_ICONS, MERCENARY), { heroForm: 0 }), {
        ref: "38010.iceman-response",
      });
      expect(run.offered()).toBeGreaterThan(0);
      expect(counter(run.state, iceman, "freeze")).toBe(2);
      const minion = Object.values(run.state.instances).find(
        (i) => i.cardId === cardId(MERCENARY) && i.engagedWith === P1,
      );
      expect(minion?.statuses.stunned ?? 0).toBe(1);
    });
  });

  describe("38011.karma", () => {
    it("after you play her, takes control of a non-ELITE minion as a CONTROLLED ally", () => {
      let minion: InstanceId | undefined;
      const { state, cardInstanceId: karma } = playFromAnotherHerosDeck("38011", game, {
        cost: 4,
        setup: (s) => {
          const engaged = engageMinion(s, MERCENARY, P1);
          minion = engaged.id;
          return engaged.state;
        },
        pick: (s) => choosing(["38011.karma-response"], (id) => id === minion)(s),
      });
      expect(inPlay(state, karma)).toBe(true);
      const taken = inst(state, minion!);
      expect(taken.controllerId).toBe(P1);
      expect(taken.engagedWith).toBeNull();
      expect(taken.treatedAs).toMatchObject({ kind: "ally", consequential: 2, thwFromSch: true, source: karma });
    });
  });

  describe("38012.armor (play only if your identity has the X-MEN trait)", () => {
    it("is not playable by a Core hero in either form", () => {
      for (const form of [{ heroForm: 0 }, "alterEgo"] as const) {
        const given = moveToHand(withForm(opened("38012"), form), P1, "38012");
        const [card] = given.ids as [InstanceId];
        expect(canPlay(given.state, card)).toBe(false);
        const refused = applyCommand(given.state, play(P1, card, payWith(given.state, P1, 2, [card])), WAVE6_DEPS);
        expect(refused.ok).toBe(false);
      }
    });
  });

  describe("38013.unflappable", () => {
    it("plays as an upgrade; after the hero defends and takes no damage, exhausts to draw 1 card", () => {
      const { state, cardInstanceId: card } = playFromAnotherHerosDeck("38013", game, { cost: 1 });
      expect(inst(state, card).attachedTo).not.toBeNull();
      const staged = withForm(stackEncounterDeck(state, NO_ICONS), { heroForm: 0 });
      const plain = villainPhase(staged, { defend: true });
      const used = villainPhase(staged, { defend: true, ref: "38013.unflappable-response" });
      expect(inst(plain.state, identityOf(plain.state, P1)).damage).toBe(0);
      expect(used.offered()).toBeGreaterThan(0);
      expect(inst(used.state, card).exhausted).toBe(true);
      expect(handSize(used.state)).toBe(handSize(plain.state) + 1);
    });
  });

  describe("38014.judoka-skill", () => {
    it("has 3 judo counters; when the hero defends, 1 counter gives that enemy -2 ATK for the attack", () => {
      const { state, cardInstanceId: card } = playFromAnotherHerosDeck("38014", game, { cost: 2 });
      expect(counter(state, card, "judo")).toBe(3);
      const staged = withForm(stackEncounterDeck(state, TWO_ICONS), { heroForm: 0 });
      const plain = villainPhase(staged, { defend: true });
      const judo = villainPhase(staged, { defend: true, ref: "38014.judoka-skill-interrupt" });
      const damage = (s: GameState) => inst(s, identityOf(s, P1)).damage;
      expect(judo.offered()).toBeGreaterThan(0);
      expect(counter(judo.state, card, "judo")).toBe(2);
      expect(damage(plain.state)).toBeGreaterThanOrEqual(2);
      expect(damage(judo.state)).toBe(damage(plain.state) - 2);
    });
  });

  describe("38015.preemptive-strike-interrupt", () => {
    it("cancels the boost card's icon and deals 1 damage to the villain for it", () => {
      const base = stackEncounterDeck(opened("38015"), ONE_ICON);
      const baseline = villainPhase(base, { held: ["38015"] });
      const used = villainPhase(base, { held: ["38015"], ref: "38015.preemptive-strike-interrupt" });
      expect(used.offered()).toBeGreaterThan(0);
      expect(inst(used.state, villainOf(used.state)).damage).toBe(
        inst(baseline.state, villainOf(baseline.state)).damage + 1,
      );
      expect(playerOf(used.state, P1).discard).toContain(used.given.ids[0]);
    });
  });

  describe("38016.not-today-interrupt", () => {
    it("gives +2 DEF for that attack: the damage taken drops, and taking none removes 2 threat", () => {
      const base = patchInstance(stackEncounterDeck(opened("38016"), ONE_ICON), opened("38016").mainScheme.instanceId, {
        threat: 3,
      });
      const baseline = villainPhase(base, { held: ["38016"], defend: true });
      const used = villainPhase(base, { held: ["38016"], defend: true, ref: "38016.not-today-interrupt" });
      expect(used.offered()).toBeGreaterThan(0);
      const damage = (s: GameState) => inst(s, identityOf(s, P1)).damage;
      const threat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;
      expect(damage(used.state)).toBe(Math.max(0, damage(baseline.state) - 2));
      // Rhino's 1 damage is stopped by the +2 DEF, so the second sentence applies too.
      expect(damage(baseline.state)).toBe(1);
      expect(damage(used.state)).toBe(0);
      expect(threat(used.state)).toBe(threat(baseline.state) - 2);
      expect(playerOf(used.state, P1).discard).toContain(used.given.ids[0]);
    });
  });

  describe("38017.defensive-energy-interrupt", () => {
    it("spent to play a Defense event (Preemptive Strike), draws 1 card", () => {
      // The 38017 deck runs no Defense event of its own: relabel the top deck card as a Preemptive Strike.
      const seated = opened("38017");
      const top = playerOf(seated, P1).deck[0]!;
      const base = stackEncounterDeck(patchInstance(seated, top, { cardId: cardId("38015") }), ONE_ICON);
      const plain = villainPhase(base, {
        held: ["38015", "38017"],
        payWithCode: "38017",
        ref: "38015.preemptive-strike-interrupt",
      });
      const drew = villainPhase(base, {
        held: ["38015", "38017"],
        payWithCode: "38017",
        ref: "38017.defensive-energy-interrupt",
        alsoRef: ["38015.preemptive-strike-interrupt"],
      });
      expect(drew.offered()).toBeGreaterThan(0);
      expect(handSize(drew.state)).toBe(handSize(plain.state) + 1);
    });
  });

  describe("38018 Moira MacTaggert and 38019 X-Gene (play only if your identity has the MUTANT trait)", () => {
    it("neither is playable by a Core hero", () => {
      for (const code of ["38018", "38019"]) {
        for (const form of [{ heroForm: 0 }, "alterEgo"] as const) {
          const given = moveToHand(withForm(opened(code, SPIDER_MAN), form), P1, code);
          const [card] = given.ids as [InstanceId];
          expect(canPlay(given.state, card), code).toBe(false);
          const refused = applyCommand(
            given.state,
            play(P1, card, payWith(given.state, P1, costOf(code), [card])),
            WAVE6_DEPS,
          );
          expect(refused.ok, code).toBe(false);
        }
      }
    });
  });

  describe("38021 Energy, 38022 Genius, 38023 Strength", () => {
    it("each is a resource card in hand, not playable as anything else", () => {
      for (const code of ["38021", "38022", "38023"]) {
        const given = moveToHand(opened(code, SPIDER_MAN), P1, code);
        const [resource] = given.ids as [InstanceId];
        expect(given.state.cardPool[inst(given.state, resource).cardId]!.type).toBe("resource");
        expect(playerOf(given.state, P1).hand).toContain(resource);
        expect(canPlay(given.state, resource), code).toBe(false);
      }
    });
  });
});
