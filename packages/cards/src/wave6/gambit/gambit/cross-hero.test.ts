import {
  applyCommand,
  characterProfile,
  type Command,
  createGame,
  legalActions,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../../testing/cross-hero.js";
import {
  applyOk,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): Gambit's
 * aspect and basic cards (`gambit` 37011-37024, 37030, 37031: every one whose aspect is not `hero:37001a`) played from
 * a Core hero's deck instead of `gambit-justice`. A Core identity is neither MUTANT nor a THIEF/SPY, so the gated
 * cards assert what their text says for such a deck: Breaking and Entering, Mutant Education and X-Men Instruction are refused, X-Mansion
 * cannot be triggered, Beauty and the Thief (Team-Up Gambit and Rogue) cannot be in the deck at all.
 */
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};
const SPIDER_MAN = "core-spider-man-justice";
const SHE_HULK = "core-she-hulk-aggression";

const applied = (state: GameState, command: Command): GameState => applyOk(state, command, WAVE6_DEPS).state;
const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const costOf = (code: string): number => (WAVE6_CARDS.find((c) => c.id === code) as { cost?: number }).cost ?? 0;
const mainScheme = (state: GameState): InstanceId => state.mainScheme.instanceId;
const mainThreat = (state: GameState): number => inst(state, mainScheme(state)).threat;
/** Puts `threat` on the main scheme so a thwart has something to remove. */
const withThreat = (state: GameState, threat: number): GameState => patchInstance(state, mainScheme(state), { threat });

/** Accepts every optional trigger whose id contains one of `wanted`; picks `wantCard`'s card at a card prompt. */
const choosing =
  (wanted: readonly string[], seen: string[] = [], wantCard?: (id: string) => boolean): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    for (const option of options) seen.push(option.optionId);
    const hits = options.filter((o) => wanted.some((w) => o.optionId.includes(w)));
    if (hits.length > 0) return hits.map((o) => o.optionId);
    const card = wantCard ? options.find((o) => wantCard(o.optionId)) : undefined;
    return card ? [card.optionId] : firstLegal(state);
  };

/** A game from `coreHero`'s deck with one `code` seated, past setup, in the player phase. */
function opened(code: string, coreHero = SPIDER_MAN): GameState {
  const created = createGame(game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, coreHero, code)]), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
}

/** Whether a legal `playCard` action exists for `id`. */
const canPlay = (state: GameState, id: InstanceId): boolean => {
  const actions = legalActions(state, P1, WAVE6_DEPS);
  return (
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)
  );
};

describe("Gambit's aspect and basic cards, from a Core hero's deck", () => {
  it("every one is legal in a Core deck of its aspect (one copy added to the precon)", () => {
    for (const [code, hero] of [
      ["37011", SPIDER_MAN],
      ["37012", SPIDER_MAN],
      ["37013", SPIDER_MAN],
      ["37014", SPIDER_MAN],
      ["37015", SPIDER_MAN],
      ["37016", SPIDER_MAN],
      ["37017", SPIDER_MAN],
      ["37018", SPIDER_MAN],
      ["37020", SPIDER_MAN],
      ["37021", SPIDER_MAN],
      ["37022", SPIDER_MAN],
      ["37023", SPIDER_MAN],
      ["37024", SPIDER_MAN],
      ["37030", SHE_HULK],
      ["37031", SPIDER_MAN],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, hero, code);
      expect(deck.deck.filter((id) => id === code)).toHaveLength(1);
      expect(createGame(game.buildScenario([deck]), WAVE6_DEPS).ok, code).toBe(true);
    }
  });

  it("37019 Beauty and the Thief (Team-Up: Gambit and Rogue) is refused in a Core hero's deck", () => {
    const created = createGame(game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "37019")]), WAVE6_DEPS);
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe("illegal_deck");
      expect(created.error.message).toContain("only a deck whose identity is one of them may include it");
    }
  });

  describe("37011.bishop-response", () => {
    it("plays as an ally and, after an enemy attacks Spider-Man, takes an energy counter", () => {
      const { state, cardInstanceId: bishop } = playFromAnotherHerosDeck("37011", game, { cost: 3 });
      expect(inPlay(state, bishop)).toBe(true);
      const seen: string[] = [];
      const after = settle(
        applied(withForm(state, { heroForm: 0 }), { type: "endTurn", playerId: P1 }),
        choosing(["37011.bishop-response"], seen),
        undefined,
        WAVE6_DEPS,
      );
      expect(seen.some((id) => id.includes("37011.bishop-response"))).toBe(true);
      expect(inst(after, bishop).counters.energy ?? 0).toBeGreaterThanOrEqual(1);
    });
  });

  describe("37012.dazzler-response", () => {
    it("after she enters play, confuses the enemy picked (the villain)", () => {
      const seen: string[] = [];
      const { state, cardInstanceId } = playFromAnotherHerosDeck("37012", game, {
        cost: 4,
        pick: choosing(["37012.dazzler-response"], seen, (id) => id === villainOfOpened()),
      });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(seen.some((id) => id.includes("37012.dazzler-response"))).toBe(true);
      expect(inst(state, villainOf(state)).statuses.confused ?? 0).toBe(1);
    });
    // The villain's instance id is the same in every game with this seed and scenario.
    const villainOfOpened = () => villainOf(opened("37012"));
  });

  describe("37013.operative-skill-interrupt", () => {
    it("attaches to Spider-Man with 3 counters; his thwart then removes 1 additional threat", () => {
      const base = withThreat(withForm(opened("37013"), { heroForm: 0 }), 10);
      const { state, id } = playFromHand(WAVE6_DEPS, base, "37013", costOf("37013"));
      const hero = identityOf(state, P1);
      expect(inst(state, id).attachedTo).toBe(hero);
      expect(inst(state, id).counters.operative).toBe(3);
      const before = mainThreat(state);
      const after = settle(
        applied(state, {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: hero,
          schemeInstanceId: state.mainScheme.instanceId,
        }),
        choosing(["37013.operative-skill-interrupt"]),
        undefined,
        WAVE6_DEPS,
      );
      expect(before - mainThreat(after)).toBe(profile(state, hero).thw + 1);
      expect(inst(after, id).counters.operative).toBe(2);
    });
  });

  describe("37014.stealth-strike-action", () => {
    it("deals 4 damage to the villain, and removes no threat when nothing is defeated", () => {
      const base = withForm(opened("37014"), { heroForm: 0 });
      const villain = villainOf(base);
      const threat = mainThreat(base);
      const { state } = playFromHand(WAVE6_DEPS, base, "37014", costOf("37014"));
      expect(inst(state, villain).damage).toBe(4);
      expect(mainThreat(state)).toBe(threat);
    });

    it("when the attack defeats a minion, removes 2 threat from a scheme", () => {
      const base = withForm(opened("37014"), { heroForm: 0 });
      const { state: engaged, id: minion } = engageMinion(base, "01101", P1);
      const wounded = withThreat(patchInstance(engaged, minion, { damage: 1 }), 10);
      const threat = mainThreat(wounded);
      const { state } = playFromHand(
        WAVE6_DEPS,
        wounded,
        "37014",
        costOf("37014"),
        choosing([], [], (id) => id === minion),
      );
      expect(playerOf(state, P1).playArea).not.toContain(minion);
      expect(mainThreat(state)).toBe(threat - 2);
    });
  });

  describe("37015 Breaking and Entering (play only if SPY or THIEF)", () => {
    it("is not playable by Spider-Man (neither trait), in either form", () => {
      for (const form of [{ heroForm: 0 }, "alterEgo"] as const) {
        const given = moveToHand(withForm(opened("37015"), form), P1, "37015");
        const [card] = given.ids as [InstanceId];
        expect(canPlay(given.state, card)).toBe(false);
        const refused = applyCommand(given.state, play(P1, card, payWith(given.state, P1, 2, [card])), WAVE6_DEPS);
        expect(refused.ok).toBe(false);
      }
    });
  });

  describe("37016.passion-for-justice-interrupt", () => {
    it("spent to play a THWART event (For Justice!), that event removes 1 additional threat", () => {
      const run = (accept: boolean) => {
        const base = withThreat(withForm(opened("37016"), { heroForm: 0 }), 10);
        const given = moveToHand(moveToHand(base, P1, "01060").state, P1, "37016");
        const [passion] = given.ids as [InstanceId];
        const forJustice = instancesOf(given.state, "01060").find((i) => playerOf(given.state, P1).hand.includes(i))!;
        const threat = mainThreat(given.state);
        const after = settle(
          applied(given.state, play(P1, forJustice, [passion, ...payWith(given.state, P1, 1, [forJustice, passion])])),
          accept ? choosing(["37016.passion-for-justice-interrupt"]) : firstLegal,
          undefined,
          WAVE6_DEPS,
        );
        return threat - mainThreat(after);
      };
      expect(run(true)).toBe(run(false) + 1);
    });
  });

  describe("37017.professor-x-forced-response", () => {
    it("plays as an ally; its Forced Response offers its options and Confuse the villain applies", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("37017", game, { cost: 3 });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(inst(state, villainOf(state)).statuses.confused ?? 0).toBe(1);
    });
  });

  describe("37018.x-mansion-action", () => {
    it("plays as a support, but a Core alter-ego (not MUTANT) cannot trigger it", () => {
      const { state, cardInstanceId: mansion } = playFromAnotherHerosDeck("37018", game, { cost: 2 });
      expect(inPlay(state, mansion)).toBe(true);
      const hurt = patchInstance(state, identityOf(state, P1), { damage: 2 });
      expect(playerOf(hurt, P1).identity.form).toBe("alterEgo");
      const refused = applyCommand(hurt, use(P1, mansion, "37018.x-mansion-action"), WAVE6_DEPS);
      expect(refused.ok).toBe(false);
      expect(inst(hurt, mansion).exhausted).toBe(false);
    });
  });

  describe("37020.hit-and-run-constant", () => {
    it("deals 2 damage to the villain and removes 2 threat from the main scheme", () => {
      const base = withThreat(withForm(opened("37020"), { heroForm: 0 }), 10);
      const threat = mainThreat(base);
      const { state } = playFromHand(WAVE6_DEPS, base, "37020", costOf("37020"));
      expect(inst(state, villainOf(state)).damage).toBe(2);
      expect(mainThreat(state)).toBe(threat - 2);
    });
  });

  describe("37022 Energy, 37023 Genius, 37024 Strength", () => {
    it("each is a resource card that pays for a cost-1 event", () => {
      for (const code of ["37022", "37023", "37024"]) {
        const base = withForm(opened(code), { heroForm: 0 });
        const given = moveToHand(base, P1, code);
        const [resource] = given.ids as [InstanceId];
        expect(state_type(given.state, resource)).toBe("resource");
        expect(playerOf(given.state, P1).hand).toContain(resource);
      }
    });
    const state_type = (state: GameState, id: InstanceId) => state.cardPool[inst(state, id).cardId]!.type;
  });

  describe("37030.war-room-response", () => {
    it("played from a Core Aggression deck: after an ally defeats a minion, exhausts to remove 1 threat", () => {
      const { state: played, cardInstanceId: warRoom } = playFromAnotherHerosDeck("37030", game, {
        coreHero: SHE_HULK,
        cost: 1,
      });
      expect(inPlay(played, warRoom)).toBe(true);
      const { state: withAlly, id: tigra } = playFromHand(WAVE6_DEPS, played, "01051", 3);
      const { state: engaged, id: minion } = engageMinion(withAlly, "01101", P1);
      const wounded = withThreat(patchInstance(engaged, minion, { damage: 2 }), 10);
      const threat = mainThreat(wounded);
      const seen: string[] = [];
      const after = settle(
        applied(wounded, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: tigra,
          targetInstanceId: minion,
        }),
        choosing(["37030.war-room-response"], seen),
        undefined,
        WAVE6_DEPS,
      );
      expect(seen.some((id) => id.includes("37030.war-room-response"))).toBe(true);
      expect(inst(after, warRoom).exhausted).toBe(true);
      expect(mainThreat(after)).toBe(threat - 1);
    });
  });

  describe("37021 Mutant Education and 37031 X-Men Instruction (play only if your identity has the MUTANT trait)", () => {
    it("neither is playable by a Core alter-ego", () => {
      for (const code of ["37021", "37031"]) {
        const given = moveToHand(opened(code), P1, code);
        const [card] = given.ids as [InstanceId];
        expect(canPlay(given.state, card), code).toBe(false);
        expect(applyCommand(given.state, play(P1, card, []), WAVE6_DEPS).ok, code).toBe(false);
      }
    });
  });
});
