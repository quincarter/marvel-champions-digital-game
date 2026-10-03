import { cardId, trait } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  allyLimitFor,
  applyCommand,
  characterProfile,
  createGame,
  legalActions,
  playCostOf,
  traitsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../../testing/cross-hero.js";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { moveToDiscard, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): Storm's
 * aspect and basic cards (`storm` 36014-36029, plus Hangar Bay 36035 from the same pack; every one whose aspect is
 * not `hero:36001a`) played from a Core hero's deck instead of `storm-leadership`: Captain Marvel for the Leadership
 * cards, Spider-Man for the basic ones, Black Panther for Hangar Bay (Protection). No Core identity has the X-MEN or
 * MUTANT trait, so (as in the other wave 6 cross-hero suites) the X-MEN-gated cards assert what their text says for
 * such a deck instead of borrowing a hero from another pack: "To Me, My X-Men!" (36020, "Play only if your identity
 * has the X-MEN trait") is not offered; The X-Jet's resource ("a player whose identity has the X-MEN trait") and
 * X-Mansion's action ("any player whose alter-ego has the MUTANT trait") are refused; Uncanny X-Men's cost reduction
 * ("If each of your characters has the X-MEN trait") does not apply; Utopia's responses and limit apply to the
 * X-MEN allies only.
 *
 * Not coverable from another hero's deck by rule: none; each of the 17 cards is played, or (36020) shown unplayable
 * for the stated rule. Energy, Genius and Strength (36027-36029) are asserted by their printed icon and by paying for
 * a card with them.
 */
const game = {
  deps: WAVE6_DEPS,
  cards: WAVE6_CARDS,
  buildScenario: (players: Parameters<typeof wave6Scenario>[1]["players"]) =>
    wave6Scenario("rhino", { seed: 11, players }),
};
const CAPTAIN_MARVEL = "core-captain-marvel-leadership";
const BLACK_PANTHER = "core-black-panther-protection";
const SPIDER_MAN = "core-spider-man-justice";
const X_MEN = trait("X-MEN");
const X_FORCE = trait("X-FORCE");

const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const hero = (state: GameState): GameState => withForm(state, { heroForm: 0 });
const iconsOf = (state: GameState, id: InstanceId): Record<string, number> =>
  (state.cardPool[inst(state, id).cardId] as { producesIcons?: Record<string, number> }).producesIcons ?? {};

/** Accepts the named optional triggers (by ability id); any other prompt picks the first option `wantCard` accepts. */
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

/** A game from `coreHero`'s deck with one copy of `code` (and `extra` more), past setup, in hero form. */
function opened(code: string, coreHero: string, extra: readonly string[] = []): GameState {
  const built = buildCrossHeroDeck(WAVE6_CARDS, coreHero, code);
  const deck = [...built.deck, ...extra.map((c) => cardId(c))];
  const created = createGame(game.buildScenario([{ ...built, deck }]), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.code}: ${created.error.message}`);
  return hero(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
}

/** `state` with `n` more deck cards in hand, to pay with. */
const stocked = (state: GameState, n = 8): GameState => ({
  ...state,
  players: state.players.map((p) =>
    p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, n)], deck: p.deck.slice(n) } : p,
  ),
});

const withAlly = (state: GameState, code: string, cost: number, pick: Picker = firstLegal) => {
  const played = playFromHand(WAVE6_DEPS, state, code, cost, pick);
  return { state: played.state, id: played.id };
};

function offered(code: string, coreHero: string): boolean {
  const given = moveToHand(stocked(opened(code, coreHero)), P1, code);
  const actions = legalActions(given.state, P1, WAVE6_DEPS);
  return (
    actions.kind === "turn" &&
    actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.ids[0])
  );
}

const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker = firstLegal) =>
  settle(
    runWith(WAVE6_DEPS, state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: target,
    }),
    pick,
    undefined,
    WAVE6_DEPS,
  );
const damageAfter = (before: GameState, after: GameState, id: InstanceId) =>
  inst(after, id).damage - inst(before, id).damage;

describe("Storm's aspect and basic cards, from a Core hero's deck", () => {
  it("every one is legal in a Core deck of its aspect (one copy added to the precon)", () => {
    for (const [code, coreHero] of [
      ["36014", CAPTAIN_MARVEL],
      ["36015", CAPTAIN_MARVEL],
      ["36016", CAPTAIN_MARVEL],
      ["36017", CAPTAIN_MARVEL],
      ["36018", CAPTAIN_MARVEL],
      ["36019", CAPTAIN_MARVEL],
      ["36020", CAPTAIN_MARVEL],
      ["36021", CAPTAIN_MARVEL],
      ["36022", SPIDER_MAN],
      ["36023", SPIDER_MAN],
      ["36024", SPIDER_MAN],
      ["36025", SPIDER_MAN],
      ["36026", SPIDER_MAN],
      ["36027", SPIDER_MAN],
      ["36028", SPIDER_MAN],
      ["36029", SPIDER_MAN],
      ["36035", BLACK_PANTHER],
    ] as const) {
      const deck = buildCrossHeroDeck(WAVE6_CARDS, coreHero, code);
      expect(deck.deck.includes(cardId(code)), code).toBe(true);
      const created = createGame(game.buildScenario([deck]), WAVE6_DEPS);
      expect(created.ok, code).toBe(true);
    }
  });

  describe("36014 Havok", () => {
    const CHARGE = "01099"; // 2 boost icons
    const ASSAULT = "01187"; // no boost icon

    it("discards the top encounter card; +1 ATK and +1 consequential damage per boost icon (2 icons: 4 damage, 2 to him)", () => {
      const { state: staged, id: havok } = withAlly(stocked(opened("36014", CAPTAIN_MARVEL)), "36014", 4);
      const topped = stackEncounterDeck(staged, CHARGE);
      const charge = activeEncounterDeck(topped).deck[0]!;
      const after = basicAttack(topped, havok, villainOf(topped));
      expect(activeEncounterDeck(after).discard).toContain(charge);
      expect(damageAfter(topped, after, villainOf(topped))).toBe(4);
      expect(inst(after, havok).damage).toBe(2);
    });

    it("with no boost icon discarded he deals his printed 2 and takes no damage", () => {
      const { state: staged, id: havok } = withAlly(stocked(opened("36014", CAPTAIN_MARVEL)), "36014", 4);
      const topped = stackEncounterDeck(staged, ASSAULT);
      const after = basicAttack(topped, havok, villainOf(topped));
      expect(damageAfter(topped, after, villainOf(topped))).toBe(2);
      expect(inst(after, havok).damage).toBe(0);
    });
  });

  describe("36015 Mirage", () => {
    it("after she enters play, stuns an enemy whose SCH is less than her THW (2): a SCH 0 minion yes, SCH 2 no", () => {
      const base = stocked(opened("36015", CAPTAIN_MARVEL));
      const { state: withMercenary, id: mercenary } = engageMinion(base, "01101", P1); // SCH 0
      const { state: staged, id: sandman } = engageMinion(withMercenary, "01102", P1); // SCH 2
      let seen: readonly string[] = [];
      const pick: Picker = (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseTarget") {
          seen = choice.options.map((o) => o.optionId);
          if (seen.includes(mercenary)) return [mercenary];
        }
        return choosing(["36015.mirage-response"])(state);
      };
      const { state: played } = withAlly(staged, "36015", 3, pick);
      expect(inst(played, mercenary).statuses.stunned).toBe(1);
      expect(seen).toContain(villainOf(staged)); // Rhino SCH 1 is less than 2
      expect(seen).not.toContain(sandman);
      expect(inst(played, sandman).statuses.stunned).toBe(0);
    });
  });

  describe("36016 Gentle", () => {
    it("takes 1 (printed) + 1 consequential damage after attacking the villain, only 1 after attacking a minion", () => {
      const { state: staged, id: gentle } = withAlly(stocked(opened("36016", CAPTAIN_MARVEL)), "36016", 3);
      const vsVillain = basicAttack(staged, gentle, villainOf(staged));
      expect(damageAfter(staged, vsVillain, villainOf(staged))).toBe(3);
      expect(inst(vsVillain, gentle).damage).toBe(2);
      const { state: withMinion, id: minion } = engageMinion(staged, "01101", P1);
      const vsMinion = basicAttack(withMinion, gentle, minion);
      expect(inst(vsMinion, gentle).damage).toBe(1);
    });
  });

  describe("36017 Pixie", () => {
    it("after you play her from hand, adds an X-MEN ally from your discard pile to your hand", () => {
      const start = stocked(opened("36017", CAPTAIN_MARVEL, ["36014"]));
      const discarded = moveToDiscard(start, P1, "36014");
      const given = moveToHand(discarded.state, P1, "36017");
      const pixie = given.ids[0]!;
      const played = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, pixie, payWith(given.state, P1, 2, [pixie]))),
        choosing(["36017.pixie-response"], [], (_s, id) => id === discarded.id),
        undefined,
        WAVE6_DEPS,
      );
      expect(inPlay(played, pixie)).toBe(true);
      expect(playerOf(played, P1).hand).toContain(discarded.id);
      expect(playerOf(played, P1).discard).not.toContain(discarded.id);
    });
  });

  describe("36018 Uncanny X-Men", () => {
    it("an X-MEN ally gets +1 hit point, but costs its full 3: the Core hero's identity is not X-MEN", () => {
      const base = stocked(opened("36018", CAPTAIN_MARVEL, ["36016"]));
      const before = moveToHand(base, P1, "36016");
      const printedHp = profile(before.state, before.ids[0]!).maxHp;
      const { state: staged } = withAlly(base, "36018", 3);
      const given = moveToHand(staged, P1, "36016");
      const gentle = given.ids[0]!;
      expect(playCostOf(given.state, P1, gentle, WAVE6_DEPS)?.current).toBe(3);
      const played = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, gentle, payWith(given.state, P1, 3, [gentle]))),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inPlay(played, gentle)).toBe(true);
      expect(profile(played, gentle).maxHp).toBe(printedHp + 1);
    });

    it("Max 1 TEAM card per player: a second copy cannot be played", () => {
      const { state: staged } = withAlly(stocked(opened("36018", CAPTAIN_MARVEL, ["36018"])), "36018", 3);
      const given = moveToHand(staged, P1, "36018");
      const second = given.ids[0]!;
      expect(applyCommand(given.state, play(P1, second, payWith(given.state, P1, 3, [second])), WAVE6_DEPS).ok).toBe(
        false,
      );
    });
  });

  describe("36019 Leadership Skill", () => {
    const armed = () => {
      const base = stocked(opened("36019", CAPTAIN_MARVEL, ["36017"]));
      const { state: withPixie, id: pixie } = withAlly(base, "36017", 2);
      const given = moveToHand(withPixie, P1, "36019");
      const skill = given.ids[0]!;
      const state = settle(
        runWith(
          WAVE6_DEPS,
          given.state,
          play(P1, skill, payWith(given.state, P1, 1, [skill]), { attachToInstanceId: identityOf(given.state, P1) }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      return { state, skill, pixie };
    };

    it("enters play with 3 leadership counters; an ally's basic attack spends 1 for +1 ATK (Pixie 2 becomes 3)", () => {
      const { state, skill, pixie } = armed();
      expect(inst(state, skill).counters.leadership).toBe(3);
      const after = basicAttack(state, pixie, villainOf(state), choosing(["36019.leadership-skill-interrupt"]));
      expect(damageAfter(state, after, villainOf(state))).toBe(3);
      expect(inst(after, skill).counters.leadership).toBe(2);
    });

    it("an ally's basic thwart spends 1 for +1 THW (Pixie 1 becomes 2)", () => {
      const { state, skill, pixie } = armed();
      const scheme = state.mainScheme.instanceId;
      const loaded = patchInstance(state, scheme, { threat: 10 });
      const after = settle(
        runWith(WAVE6_DEPS, loaded, {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: pixie,
          schemeInstanceId: scheme,
        }),
        choosing(["36019.leadership-skill-interrupt"]),
        undefined,
        WAVE6_DEPS,
      );
      expect(10 - inst(after, scheme).threat).toBe(2);
      expect(inst(after, skill).counters.leadership).toBe(2);
    });

    it("the hero's own basic attack never uses it: no counter spent, printed damage only", () => {
      const { state, skill } = armed();
      const id = identityOf(state, P1);
      const seen: string[] = [];
      const after = basicAttack(state, id, villainOf(state), choosing(["36019.leadership-skill-interrupt"], seen));
      expect(seen.some((o) => o.includes("36019"))).toBe(false);
      expect(inst(after, skill).counters.leadership).toBe(3);
      expect(damageAfter(state, after, villainOf(state))).toBe(profile(state, id).atk);
    });
  });

  describe('36020 "To Me, My X-Men!"', () => {
    it("is not playable for a Core hero (identity not X-MEN), though another Leadership card is", () => {
      expect(offered("36020", CAPTAIN_MARVEL)).toBe(false);
      expect(offered("36019", CAPTAIN_MARVEL)).toBe(true);
    });
  });

  describe("36021 Effective Leadership", () => {
    it("spent to play an ally, that ally gets +1 THW and +1 ATK (Gentle 1/3 becomes 2/4); declined, it stays 1/3", () => {
      const base = stocked(opened("36021", CAPTAIN_MARVEL, ["36016"]));
      const given = moveToHand(base, P1, "36016", "36021");
      const [gentle, resource] = given.ids as [InstanceId, InstanceId];
      const others = payWith(given.state, P1, 2, [gentle, resource]);
      const playWith = (pick: Picker) =>
        settle(runWith(WAVE6_DEPS, given.state, play(P1, gentle, [resource, ...others])), pick, undefined, WAVE6_DEPS);
      const declined = playWith(firstLegal);
      expect([profile(declined, gentle).thw, profile(declined, gentle).atk]).toEqual([1, 3]);
      const seen: string[] = [];
      const played = playWith(choosing(["36021.effective-leadership-interrupt"], seen));
      expect(seen.some((id) => id.includes("36021.effective-leadership-interrupt"))).toBe(true);
      expect([profile(played, gentle).thw, profile(played, gentle).atk]).toEqual([2, 4]);
    });
  });

  describe("36022 Forge", () => {
    const playForge = (start: GameState, want: InstanceId) => {
      const given = moveToHand(start, P1, "36022");
      const forge = given.ids[0]!;
      const candidates: InstanceId[] = [];
      const played = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, forge, payWith(given.state, P1, 2, [forge]))),
        (s) => {
          for (const o of s.pendingChoice?.options ?? []) {
            if (o.ref.kind === "card") candidates.push(o.ref.instanceId);
          }
          const hit = s.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === want);
          return hit ? [hit.optionId] : choosing(["36022.forge-response"])(s);
        },
        undefined,
        WAVE6_DEPS,
      );
      expect(inPlay(played, forge)).toBe(true);
      expect(candidates).toContain(want);
      for (const id of candidates) {
        const traits = traitsOf(played, id, WAVE6_DEPS);
        expect(traits.includes(X_MEN) || traits.includes(X_FORCE), id).toBe(true);
      }
      return played;
    };

    it("after he enters play, finds an X-MEN or X-FORCE support in the deck and adds it to your hand (Utopia)", () => {
      const start = stocked(opened("36022", SPIDER_MAN, ["36024"]));
      const utopia = playerOf(start, P1).deck.find((i) => inst(start, i).cardId === cardId("36024"))!;
      const played = playForge(start, utopia);
      expect(playerOf(played, P1).hand).toContain(utopia);
      expect(playerOf(played, P1).deck).not.toContain(utopia);
    });

    it("also finds one in the discard pile", () => {
      const discarded = moveToDiscard(stocked(opened("36022", SPIDER_MAN, ["36024"])), P1, "36024");
      const played = playForge(discarded.state, discarded.id);
      expect(playerOf(played, P1).hand).toContain(discarded.id);
      expect(playerOf(played, P1).discard).not.toContain(discarded.id);
    });
  });

  describe("36023 The X-Jet", () => {
    it("plays as a support, but its resource is refused: a Core hero's identity has no X-MEN trait", () => {
      const { state, cardInstanceId: jet } = playFromAnotherHerosDeck("36023", game, {
        coreHero: SPIDER_MAN,
        setup: (s) => stocked(hero(s)),
      });
      expect(inPlay(state, jet)).toBe(true);
      const owner = playerOf(state, P1);
      const found = [...owner.hand, ...owner.deck].find((id) => {
        const printed = state.cardPool[state.instances[id]!.cardId] as { cost?: number; type: string };
        return printed.cost === 1 && ["support", "ally"].includes(printed.type);
      })!;
      const given = moveToHand(state, P1, state.instances[found]!.cardId);
      const result = applyCommand(
        given.state,
        play(P1, given.ids[0]!, [], { abilities: [resourceAbility(jet, "36023.the-x-jet-resource")] }),
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain("condition is not met");
    });
  });

  describe("36024 Utopia", () => {
    const base = () => stocked(opened("36024", CAPTAIN_MARVEL, ["36016", "36017"]));

    it("raises the ally limit from 3 to 4 only while each of your allies is X-MEN (Gentle yes)", () => {
      const start = base();
      expect(allyLimitFor(start, WAVE6_DEPS, P1)).toBe(3);
      const { state: withUtopia } = withAlly(start, "36024", 2);
      expect(allyLimitFor(withUtopia, WAVE6_DEPS, P1)).toBe(4);
      const { state: withGentle } = withAlly(withUtopia, "36016", 3);
      expect(allyLimitFor(withGentle, WAVE6_DEPS, P1)).toBe(4);
    });

    it("after an X-MEN ally enters play, exhausts to ready an X-MEN character: the exhausted Gentle, never the Core hero", () => {
      const { state: withUtopia, id: utopia } = withAlly(base(), "36024", 2);
      const { state: withGentle, id: gentle } = withAlly(withUtopia, "36016", 3);
      const tired = patchInstance(patchInstance(withGentle, gentle, { exhausted: true }), identityOf(withGentle, P1), {
        exhausted: true,
      });
      // Utopia was readied again by surgery so the second ally's entry can use it.
      const given = moveToHand(patchInstance(tired, utopia, { exhausted: false }), P1, "36017");
      const pixie = given.ids[0]!;
      const targets: string[] = [];
      const played = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, pixie, payWith(given.state, P1, 2, [pixie]))),
        (s) => {
          const choice = s.pendingChoice;
          if (choice?.prompt.kind === "chooseTarget") {
            targets.push(...choice.options.map((o) => o.optionId));
            if (choice.options.some((o) => o.optionId === gentle)) return [gentle];
          }
          return choosing(["36024.utopia-response"])(s);
        },
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(played, utopia).exhausted).toBe(true);
      expect(inst(played, gentle).exhausted).toBe(false);
      expect(inst(played, identityOf(played, P1)).exhausted).toBe(true);
      expect(targets).not.toContain(identityOf(played, P1));
    });
  });

  describe("36025 X-Mansion", () => {
    it("plays as a support, but its action is refused: a Core hero's alter-ego is not a MUTANT", () => {
      const { state, cardInstanceId: mansion } = playFromAnotherHerosDeck("36025", game, {
        coreHero: SPIDER_MAN,
        setup: (s) => patchInstance(withForm(stocked(s), "alterEgo"), identityOf(s, P1), { damage: 2 }),
      });
      expect(inPlay(state, mansion)).toBe(true);
      const result = applyCommand(
        state,
        { type: "useAbility", playerId: P1, sourceInstanceId: mansion, abilityId: "36025.x-mansion-action" } as never,
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
      expect(inst(state, identityOf(state, P1)).damage).toBe(2);
    });
  });

  describe("36026 Endurance", () => {
    it("attached to the hero, you get +3 hit points", () => {
      const base = stocked(opened("36026", SPIDER_MAN));
      const id = identityOf(base, P1);
      const hp = profile(base, id).maxHp;
      const given = moveToHand(base, P1, "36026");
      const endurance = given.ids[0]!;
      const played = settle(
        runWith(
          WAVE6_DEPS,
          given.state,
          play(P1, endurance, payWith(given.state, P1, 1, [endurance]), { attachToInstanceId: id }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(played, endurance).attachedTo).toBe(id);
      expect(profile(played, id).maxHp).toBe(hp + 3);
    });
  });

  describe("36027 Energy, 36028 Genius, 36029 Strength", () => {
    for (const [code, icon] of [
      ["36027", "energy"],
      ["36028", "mental"],
      ["36029", "physical"],
    ] as const) {
      it(`${code} produces 2 ${icon} icons and pays the cost of a 1-cost card`, () => {
        const base = opened(code, SPIDER_MAN, ["36026"]);
        const given = moveToHand(base, P1, code, "36026");
        const [resource, endurance] = given.ids as [InstanceId, InstanceId];
        expect(iconsOf(given.state, resource)).toEqual({ [icon]: 2 });
        const played = settle(
          runWith(
            WAVE6_DEPS,
            given.state,
            play(P1, endurance, [resource], { attachToInstanceId: identityOf(given.state, P1) }),
          ),
          firstLegal,
          undefined,
          WAVE6_DEPS,
        );
        expect(inPlay(played, endurance) || inst(played, endurance).attachedTo !== null).toBe(true);
        expect(playerOf(played, P1).discard).toContain(resource);
      });
    }
  });

  describe("36035 Hangar Bay", () => {
    const defended = (survives: boolean) => {
      const start = stocked(opened("36035", BLACK_PANTHER));
      // Black Panther's own Core precon runs allies of its aspect; use one with enough hit points to survive a 2 ATK hit.
      const allyId = [...playerOf(start, P1).hand, ...playerOf(start, P1).deck].find((i) => {
        const printed = start.cardPool[inst(start, i).cardId] as { type: string; hp?: number };
        return printed.type === "ally" && (printed.hp ?? 0) > 2;
      })!;
      const allyCode = inst(start, allyId).cardId as string;
      const cost = (start.cardPool[inst(start, allyId).cardId] as { cost: number }).cost;
      const bay = withAlly(start, "36035", 1);
      const { state: staged, id: ally } = withAlly(bay.state, allyCode, cost);
      const hp = profile(staged, ally).maxHp;
      const hurt = survives ? staged : patchInstance(staged, ally, { damage: hp - 1 });
      // A boost card with no boost icon, so the villain's ATK is exactly its printed 2.
      const topped = stackEncounterDeck(hurt, "01104");
      const toDefender = settle(
        runWith(WAVE6_DEPS, topped, endTurn(P1)),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        WAVE6_DEPS,
      );
      const seen: string[] = [];
      const after = settle(
        answer(toDefender, [ally], WAVE6_DEPS),
        (s) => {
          seen.push(...(s.pendingChoice?.options ?? []).map((o) => o.optionId));
          return choosing(["36035.hangar-bay-response"])(s);
        },
        (s) => s.step.phase !== "villain" || !s.pendingChoice,
        WAVE6_DEPS,
      );
      return { after, ally, bay: bay.id, seen, hp };
    };

    it("after an ally defends and is not defeated, exhausts Hangar Bay to ready that ally", () => {
      const { after, ally, bay, seen, hp } = defended(true);
      if (hp <= 2) throw new Error("the staged ally cannot survive the villain's 2 ATK");
      expect(seen.some((o) => o.endsWith("36035.hangar-bay-response"))).toBe(true);
      expect(inst(after, ally).exhausted).toBe(false);
      expect(inst(after, bay).exhausted).toBe(true);
    });

    it("is not offered when the defending ally is defeated", () => {
      const { after, ally, bay, seen } = defended(false);
      expect(seen.some((o) => o.endsWith("36035.hangar-bay-response"))).toBe(false);
      expect(playerOf(after, P1).playArea).not.toContain(ally);
      expect(inst(after, bay).exhausted).toBe(false);
    });
  });
});
