import { cardId } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  legalActions,
  type GameEvent,
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
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { attachToHost, engageMinion } from "../../mut_gen/project-wideawake-testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): the `wolv`
 * aspect and basic cards no hero folder owns (`wolv/precon-player-cards.ts`: 35013-35015, 35017-35023, 35032, 35033)
 * played from a Core hero's deck instead of `wolverine-aggression`. A Core identity has no MUTANT or X-MEN trait, so
 * Weapon X (35022) and Longshot (35033) are asserted not offered, as their "Play only if your identity has ..." text
 * says, and Fastball Special's Team-Up (Colossus and Wolverine) is refused at deck building.
 */
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};
const SHE_HULK = "core-she-hulk-aggression";
const SPIDER_MAN = "core-spider-man-justice";

const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const villainOf = (state: GameState) => activeVillain(state).instanceId;
const hero = (state: GameState): GameState => withForm(state, { heroForm: 0 });
const iconsOf = (state: GameState, id: InstanceId, resource: string): number =>
  (state.cardPool[inst(state, id).cardId] as { resourceIcons?: Record<string, number> }).resourceIcons?.[resource] ?? 0;

const accepting =
  (...labels: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      return choice.options.filter((o) => labels.some((l) => o.label.includes(l))).map((o) => o.optionId);
    }
    return firstLegal(state);
  };
const targeting =
  (id: InstanceId, rest: Picker): Picker =>
  (s) =>
    s.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : rest(s);

/** A game from `coreHero`'s deck with one copy of `code` (and `extra` more), past setup, in the player phase. */
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

function offered(code: string, coreHero: string): boolean {
  const given = moveToHand(stocked(opened(code, coreHero)), P1, code);
  const actions = legalActions(given.state, P1, WAVE6_DEPS);
  return (
    actions.kind === "turn" &&
    actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.ids[0])
  );
}

const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker) => {
  const result = applyCommand(
    state,
    { type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target },
    WAVE6_DEPS,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, pick, undefined, WAVE6_DEPS);
};
const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  events
    .filter((e) => e.type === "damageDealt" && e.targetInstanceId === id)
    .reduce((n, e) => n + (e as { amount: number }).amount, 0);

describe("The wolv aspect and basic cards, from a Core hero's deck", () => {
  it("every one but Fastball Special is legal in a Core deck of its aspect (one copy added to the precon)", () => {
    for (const [code, coreHero] of [
      ["35013", SHE_HULK],
      ["35014", SHE_HULK],
      ["35015", SHE_HULK],
      ["35017", SHE_HULK],
      ["35018", SHE_HULK],
      ["35019", SHE_HULK],
      ["35020", SHE_HULK],
      ["35021", SPIDER_MAN],
      ["35022", SPIDER_MAN],
      ["35032", SPIDER_MAN],
      ["35033", SPIDER_MAN],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, coreHero, code);
      expect(deck.deck.includes(cardId(code)), code).toBe(true);
      const created = createGame(game.buildScenario([deck]), WAVE6_DEPS);
      expect(created.ok, code).toBe(true);
    }
  });

  it("Fastball Special 35023 (Colossus and Wolverine) is refused in a Core hero's deck", () => {
    const created = createGame(game.buildScenario([buildCrossHeroDeck(WAVE6_CARDS, SPIDER_MAN, "35023")]), WAVE6_DEPS);
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe("illegal_deck");
      expect(created.error.message).toContain("only a deck whose identity is one of them may include it");
    }
  });

  it("Weapon X 35022 (MUTANT) and Longshot 35033 (X-MEN) are not offered to a Core hero, though a plain card is", () => {
    expect(offered("35022", SPIDER_MAN)).toBe(false);
    expect(offered("35033", SPIDER_MAN)).toBe(false);
    expect(offered("35021", SPIDER_MAN)).toBe(true);
  });

  describe("35013 Psylocke", () => {
    it("enters play with 2 psionic counters; her attack interrupt confuses and damages the villain", () => {
      const { state, cardInstanceId } = playFromAnotherHerosDeck("35013", game, {
        coreHero: SHE_HULK,
        cost: 4,
        setup: (s) => stocked(hero(s)),
      });
      expect(inst(state, cardInstanceId).counters.psionic).toBe(2);
      const ready = patchInstance(state, cardInstanceId, { exhausted: false });
      const after = basicAttack(ready, cardInstanceId, villainOf(ready), accepting("Psylocke"));
      expect(inst(after, cardInstanceId).counters.psionic).toBe(1);
      expect(inst(after, villainOf(ready)).statuses.confused).toBe(1);
      expect(inst(after, villainOf(ready)).damage).toBe(2);
    });
  });

  describe("35014 Sunfire", () => {
    it("after he is played, spending an [energy] resource discards a Hero Action attachment; none, none offered", () => {
      const base = stocked(opened("35014", SHE_HULK));
      const horn = attachToHost(base, "01100", villainOf(base));
      const given = moveToHand(horn.state, P1, "35014");
      const sunfire = given.ids[0] as InstanceId;
      const pay = playerOf(given.state, P1)
        .hand.filter((i) => i !== sunfire && iconsOf(given.state, i, "energy") === 0)
        .slice(0, 2);
      const withEnergy = playerOf(given.state, P1).hand.find(
        (i) => i !== sunfire && iconsOf(given.state, i, "energy") > 0,
      );
      expect(withEnergy).toBeDefined();
      const result = applyCommand(given.state, play(P1, sunfire, pay), WAVE6_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      const after = settle(
        result.state,
        (s) => {
          if (s.pendingChoice?.prompt.kind === "payForAbility") return [`hand:${withEnergy}`];
          return targeting(horn.id, accepting("Sunfire"))(s);
        },
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, villainOf(after)).attachments).not.toContain(horn.id);
      expect(playerOf(after, P1).discard).toContain(withEnergy);

      const none = stocked(opened("35014", SHE_HULK));
      const labels: string[] = [];
      const bare = playFromHand(WAVE6_DEPS, none, "35014", 2, (s) => {
        for (const o of s.pendingChoice?.options ?? []) labels.push(o.label);
        return accepting("Sunfire")(s);
      });
      expect(inPlay(bare.state, bare.id)).toBe(true);
      expect(labels).not.toContain("Sunfire");
    });
  });

  describe("35015 Battle Fury", () => {
    it("after She-Hulk defeats a minion: 1 damage to her, Battle Fury discarded, her readied", () => {
      const base = stocked(opened("35015", SHE_HULK));
      const { state: engaged, id: minion } = engageMinion(base, "01101", P1);
      const given = moveToHand(engaged, P1, "35015");
      const fury = given.ids[0] as InstanceId;
      const identity = identityOf(given.state, P1);
      const attached = settle(
        applyOkPlay(given.state, play(P1, fury, payWith(given.state, P1, 1, [fury]), { attachToInstanceId: identity })),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      const after = basicAttack(
        patchInstance(attached, minion, { damage: 99 }),
        identity,
        minion,
        accepting("Battle Fury"),
      );
      expect(inPlay(after, minion)).toBe(false);
      expect(playerOf(after, P1).discard).toContain(fury);
      expect(inst(after, identity).damage).toBe(1);
      expect(inst(after, identity).exhausted).toBe(false);
    });
  });

  describe("35017 Outta My Way!", () => {
    it("deals 3 damage to the villain, and 5 to a guard minion", () => {
      const plain = playFromAnotherHerosDeck("35017", game, { coreHero: SHE_HULK, cost: 2, setup: hero });
      expect(inst(plain.state, villainOf(plain.state)).damage).toBe(3);
      const base = stocked(opened("35017", SHE_HULK));
      const { state, id: guard } = engageMinion(base, "01101", P1);
      const given = moveToHand(state, P1, "35017");
      const event = given.ids[0] as InstanceId;
      const driven = driveEventsPicking(
        WAVE6_DEPS,
        given.state,
        targeting(guard, firstLegal),
        play(P1, event, payWith(given.state, P1, 2, [event])),
      );
      expect(damageTo(driven.events, guard)).toBe(5);
    });
  });

  describe("35018 Precision Strike", () => {
    it("deals 2 damage; defeating the enemy heals 2 from the hero", () => {
      const base = stocked(opened("35018", SHE_HULK));
      const { state, id: minion } = engageMinion(base, "01101", P1);
      const identity = identityOf(state, P1);
      const hurt = patchInstance(patchInstance(state, minion, { damage: 2 }), identity, { damage: 5 });
      const { state: after } = playFromHand(WAVE6_DEPS, hurt, "35018", 1, targeting(minion, firstLegal));
      expect(inPlay(after, minion)).toBe(false);
      expect(inst(after, identity).damage).toBe(3);
      const miss = playFromAnotherHerosDeck("35018", game, { coreHero: SHE_HULK, cost: 1, setup: hero });
      expect(inst(miss.state, villainOf(miss.state)).damage).toBe(2);
    });
  });

  describe("35019 Mean Swing", () => {
    it("with no Weapon upgrade on the hero the interrupt is never offered", () => {
      const base = stocked(opened("35019", SHE_HULK));
      const given = moveToHand(base, P1, "35019");
      const identity = identityOf(given.state, P1);
      const offeredLabels: string[] = [];
      const after = basicAttack(given.state, identity, villainOf(given.state), (s) => {
        for (const o of s.pendingChoice?.options ?? []) offeredLabels.push(o.label);
        return firstLegal(s);
      });
      expect(offeredLabels).not.toContain("Mean Swing");
      expect(inst(after, villainOf(after)).damage).toBe(characterProfile(given.state, identity, WAVE6_DEPS)!.atk);
    });
  });

  describe("35020 Aggressive Energy", () => {
    it("spent to play an ATTACK event it adds 1 damage (Outta My Way!: 4); a different payment adds none", () => {
      const run = (spend: boolean) => {
        const base = stocked(opened("35017", SHE_HULK, ["35020"]));
        const given = moveToHand(base, P1, "35017", "35020");
        const [event, energy] = given.ids as [InstanceId, InstanceId];
        const filler = payWith(given.state, P1, 2, [event, energy]);
        const payment = spend ? [energy, filler[0]!] : filler;
        const after = settle(
          applyOkPlay(given.state, play(P1, event, payment)),
          accepting("Aggressive Energy"),
          undefined,
          WAVE6_DEPS,
        );
        return inst(after, villainOf(after)).damage;
      };
      expect(run(true)).toBe(4);
      expect(run(false)).toBe(3);
    });
  });

  describe("35021 Colossus", () => {
    it("costs its full 4 for a Core hero (no MUTANT or X-MEN identity): 3 resources are refused; it enters with a tough status", () => {
      const given = moveToHand(stocked(opened("35021", SPIDER_MAN)), P1, "35021");
      const [colossus] = given.ids as [InstanceId];
      const cheap = applyCommand(given.state, play(P1, colossus, payWith(given.state, P1, 3, [colossus])), WAVE6_DEPS);
      expect(cheap.ok).toBe(false);
      const { state, cardInstanceId } = playFromAnotherHerosDeck("35021", game, { coreHero: SPIDER_MAN, cost: 4 });
      expect(inPlay(state, cardInstanceId)).toBe(true);
      expect(inst(state, cardInstanceId).statuses.tough).toBe(1);
    });
  });

  describe("35032 Command Center", () => {
    const BOMB_SCARE = "01109";
    const centered = () => {
      const base = stocked(opened("35032", SPIDER_MAN, ["35021"]));
      const one = playFromHand(WAVE6_DEPS, base, "35032", 1);
      const two = playFromHand(WAVE6_DEPS, one.state, "35021", 4);
      const scheme = encounterCardInVillainArea(two.state, BOMB_SCARE, 1);
      return {
        state: patchInstance(scheme.state, two.id, { exhausted: false }),
        center: one.id,
        ally: two.id,
        scheme: scheme.id,
      };
    };
    const thwart = (state: GameState, thwarter: InstanceId, scheme: InstanceId) => {
      const result = applyCommand(
        state,
        { type: "basicThwart", playerId: P1, thwarterInstanceId: thwarter, schemeInstanceId: scheme },
        WAVE6_DEPS,
      );
      if (!result.ok) throw new Error(result.error.message);
      return settle(result.state, accepting("Command Center"), undefined, WAVE6_DEPS);
    };

    it("after an ally thwarts and defeats a side scheme, exhausts to deal 2 damage to an enemy", () => {
      const { state, center, ally, scheme } = centered();
      const after = thwart(state, ally, scheme);
      expect(inst(after, center).exhausted).toBe(true);
      expect(inst(after, villainOf(after)).damage).toBe(2);
    });

    it("your hero defeating the side scheme does not trigger it", () => {
      const { state, center, scheme } = centered();
      const after = thwart(state, identityOf(state, P1), scheme);
      expect(inst(after, center).exhausted).toBe(false);
      expect(inst(after, villainOf(after)).damage).toBe(0);
    });

    it("an ally thwart that leaves threat on the side scheme does not trigger it", () => {
      const { state, center, ally, scheme } = centered();
      const after = thwart(patchInstance(state, scheme, { threat: 9 }), ally, scheme);
      expect(inst(after, scheme).threat).toBeGreaterThan(0);
      expect(inst(after, center).exhausted).toBe(false);
    });
  });
});

function applyOkPlay(state: GameState, command: Parameters<typeof applyCommand>[1]): GameState {
  const result = applyCommand(state, command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}
