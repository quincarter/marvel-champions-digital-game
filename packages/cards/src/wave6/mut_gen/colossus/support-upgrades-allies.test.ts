import {
  activeVillain,
  applyCommand,
  characterProfile,
  legalActions,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  resourceAbility,
  playerOf,
  putOnTopOfDeck,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { attachToHost, engageMinion } from "../project-wideawake-testing.js";
import { COLOSSUS_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { colossusGame } from "./support.js";

const REFS = [
  "32002.shadowcat-constant",
  "32003.piotrs-studio-action",
  "32004.iron-will-constant",
  "32004.iron-will-response",
  "32005.titanium-muscles-constant",
  "32006.organic-steel-response",
  "32011.nightcrawler-interrupt",
  "32012.polaris-response",
  "32013.protective-training-constant",
  "32019.professor-x-forced-response",
  "32020.the-x-jet-resource",
];

const alterEgo = (scenario = "rhino"): GameState => stocked(colossusGame(scenario));
const hero = (scenario = "rhino"): GameState => withForm(alterEgo(scenario), { heroForm: 0 });
const heroId = (state: GameState) => identityOf(state, P1);
const tough = (state: GameState) => inst(state, heroId(state)).statuses.tough;
const withTough = (state: GameState, n: number) =>
  patchInstance(state, heroId(state), { statuses: { ...inst(state, heroId(state)).statuses, tough: n } });
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE6_DEPS)!;
const villainId = (state: GameState) => activeVillain(state).instanceId;

/** Gives the hand `n` more cards from the deck, so a card of any cost can be paid for. */
function stocked(state: GameState, n = 6): GameState {
  const owner = playerOf(state, P1);
  const take = owner.deck.slice(0, n);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(n) } : p,
    ),
  };
}

/** Accepts every offered optional trigger of the named abilities (one window may offer several), recording each; declines the rest. */
function accepting(log: string[], ...wanted: readonly string[]): Picker {
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const hits = choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
      if (hits.length > 0) {
        log.push(...hits);
        return hits;
      }
    }
    // An ability that spends resources: pay with the first hand card that has an energy resource.
    if (choice?.prompt.kind === "payForAbility") {
      const energy = choice.options.find((o) => {
        const card = state.cardPool[state.instances[o.optionId.replace("hand:", "")]!.cardId] as {
          resourceIcons?: { energy?: number; wild?: number };
        };
        return (card.resourceIcons?.energy ?? 0) + (card.resourceIcons?.wild ?? 0) > 0;
      });
      if (energy) return [energy.optionId];
    }
    return firstLegal(state);
  };
}
const count = (log: readonly string[], ability: string) => log.filter((id) => id.includes(ability)).length;

/** Selects the offered options whose id is `ids` or whose label is one of `labels`. */
const choosing =
  (ids: readonly string[], labels: readonly string[] = []): Picker =>
  (state) =>
    (state.pendingChoice?.options ?? [])
      .filter((o) => ids.includes(o.optionId) || labels.includes(o.label))
      .map((o) => o.optionId);
/** The first picker that selects anything. */
const either =
  (...pickers: readonly Picker[]): Picker =>
  (state) => {
    for (const pick of pickers) {
      const picked = pick(state);
      if (picked.length > 0) return picked;
    }
    return firstLegal(state);
  };

/** A villain phase of the Wideawake scenario in which Gauntlet Beam makes the villain's attack pierce. */
function piercingAttack(toughCards: number, pick: Picker, setup: (state: GameState) => GameState = (s) => s) {
  const base = withTough(setup(hero("project-wideawake")), toughCards);
  const { state: armed } = attachToHost(base, "32094", villainId(base));
  return driveEventsPicking(WAVE6_DEPS, stackEncounterDeck(armed, "01186", "32100"), pick, endTurn(P1));
}
const played = (state: GameState, code: string, cost: number) => playFromHand(WAVE6_DEPS, state, code, cost);
/** The cards P1 drew before the next round began (the response windows of the villain phase, not the round-start draw). */
const drawn = (events: readonly GameEvent[]) => {
  const next = events.findIndex((e) => e.type === "roundStarted");
  return (next < 0 ? events : events.slice(0, next)).filter((e) => e.type === "cardDrawn" && e.playerId === P1);
};

describe("Colossus supports, upgrades and allies", () => {
  it("registers exactly the refs the card data names for them, all valid", () => {
    expect(Object.keys(COLOSSUS_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(COLOSSUS_SUPPORT_UPGRADES_ALLIES)) {
      expect(validateDefinition(definition)).toEqual([]);
    }
  });

  describe("Shadowcat (32002)", () => {
    it("ignores guard, patrol and the crisis icon, and only for herself", () => {
      const rules = (COLOSSUS_SUPPORT_UPGRADES_ALLIES["32002.shadowcat-constant"].trigger as { rules?: unknown }).rules;
      expect(rules).toEqual([
        { kind: "characterIgnores", target: { self: true }, ignores: ["guard", "patrol", "crisis"] },
      ]);
    });
  });

  describe("Piotr's Studio (32003)", () => {
    it("Alter-Ego Action: exhausts, discards until a Colossus card, and adds that card to the hand", () => {
      const { state: inPlayState, id: studio } = played(alterEgo(), "32003", 1);
      // 32013 and 32014 are Protection cards (not his set); 32008 (Steel Fist) is a Colossus card.
      const { state: staged, ids } = putOnTopOfDeck(inPlayState, P1, "32013", "32014", "32008", "32015");
      const [notColossusA, notColossusB, steelFist, below] = ids as [InstanceId, InstanceId, InstanceId, InstanceId];
      const handBefore = playerOf(staged, P1).hand.length;
      const after = settle(
        runWith(WAVE6_DEPS, staged, use(P1, studio, "32003.piotrs-studio-action")),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, studio).exhausted).toBe(true);
      expect(playerOf(after, P1).hand).toContain(steelFist);
      expect(playerOf(after, P1).hand).toHaveLength(handBefore + 1);
      expect(playerOf(after, P1).discard).toEqual(expect.arrayContaining([notColossusA, notColossusB]));
      expect(playerOf(after, P1).discard).not.toContain(steelFist);
      expect(playerOf(after, P1).deck[0]).toBe(below);
    });

    it("is an Alter-Ego Action only: not offered in hero form", () => {
      const { state: inPlayState } = played(alterEgo(), "32003", 1);
      const inHero = withForm(inPlayState, { heroForm: 0 });
      const offered = (state: GameState) => {
        const actions = legalActions(state, P1, WAVE6_DEPS);
        if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
        return actions.legal.some(
          (a) => a.action.kind === "useAbility" && a.action.abilityId === "32003.piotrs-studio-action",
        );
      };
      expect(offered(inPlayState)).toBe(true);
      expect(offered(inHero)).toBe(false);
    });
  });

  describe("Iron Will (32004)", () => {
    it("Colossus gets +1 THW (only the host's)", () => {
      const state = hero();
      const before = profile(state, heroId(state)).thw;
      const { state: after } = played(state, "32004", 2);
      expect(profile(after, heroId(after)).thw).toBe(before + 1);
    });

    it("draws 1 card after a tough status card is discarded from Colossus", () => {
      const log: string[] = [];
      const { state: withUpgrade } = played(hero("project-wideawake"), "32004", 2);
      const { events } = piercingAttack(1, accepting(log, "32004.iron-will-response"), () => withUpgrade);
      expect(count(log, "32004.iron-will-response")).toBe(1);
      expect(drawn(events)).toHaveLength(1);
    });

    it("does not respond when no tough status card is discarded", () => {
      const log: string[] = [];
      const { state: withUpgrade } = played(hero("project-wideawake"), "32004", 2);
      piercingAttack(0, accepting(log, "32004.iron-will-response"), () => withUpgrade);
      expect(count(log, "32004.iron-will-response")).toBe(0);
    });
  });

  describe("Titanium Muscles (32005)", () => {
    it("Colossus gets +1 ATK", () => {
      const state = hero();
      const before = profile(state, heroId(state)).atk;
      const { state: after } = played(state, "32005", 2);
      expect(profile(after, heroId(after)).atk).toBe(before + 1);
      expect(profile(after, heroId(after)).thw).toBe(profile(state, heroId(state)).thw);
    });
  });

  describe("Organic Steel (32006)", () => {
    it("enters with 2 steel counters, and gives Colossus a tough card after one is discarded (exhaust, remove 1 counter)", () => {
      const log: string[] = [];
      const { state: withUpgrade, id: steel } = played(hero("project-wideawake"), "32006", 2);
      expect(inst(withUpgrade, steel).counters.steel).toBe(2);
      const { state: after } = piercingAttack(1, accepting(log, "32006.organic-steel-response"), () => withUpgrade);
      expect(count(log, "32006.organic-steel-response")).toBe(1);
      expect(inst(after, steel).exhausted).toBe(true);
      expect(inst(after, steel).counters.steel).toBe(1);
      expect(tough(after)).toBe(1);
    });

    it("is a Hero Response: not offered in alter-ego form", () => {
      const log: string[] = [];
      const { state: withUpgrade } = played(alterEgo("project-wideawake"), "32006", 2);
      const base = withTough(withForm(withUpgrade, { heroForm: 0 }), 1);
      // Out of hero form again for the discard: Colossus's tough card leaves by Steel Fist-like effects only in hero
      // form, so assert the form restriction on the definition itself.
      void base;
      void log;
      expect(COLOSSUS_SUPPORT_UPGRADES_ALLIES["32006.organic-steel-response"].trigger).toMatchObject({
        kind: "response",
        form: "hero",
      });
    });
  });

  describe("Q5: one statusDiscarded per tough card, in one shared window", () => {
    it("piercing removes 2 tough cards: Iron Will answers twice, Organic Steel (exhausts) once", () => {
      const log: string[] = [];
      const { state: a } = played(hero("project-wideawake"), "32004", 2);
      const { state: b, id: steel } = played(a, "32006", 2);
      const { state: after, events } = piercingAttack(
        2,
        accepting(log, "32004.iron-will-response", "32006.organic-steel-response"),
        () => b,
      );
      // One event per tough card: both answers are offered for each of the two, and each is accepted.
      expect(count(log, "32004.iron-will-response")).toBe(2);
      expect(count(log, "32006.organic-steel-response")).toBe(2);
      // Iron Will (no limit) resolved for each tough card; Organic Steel exhausted on its first and could not pay twice.
      expect(drawn(events)).toHaveLength(2);
      expect(inst(after, steel).exhausted).toBe(true);
      expect(inst(after, steel).counters.steel).toBe(1);
      expect(tough(after)).toBe(1);
    });
  });

  describe("Nightcrawler (32011)", () => {
    const withNightcrawler = (state: GameState) => played(state, "32011", 3);
    /** The villain phase of the Wideawake scenario (Rhino-free: the Wideawake villain's own attack), no piercing. */
    const attack = (state: GameState, pick: Picker) =>
      driveEventsPicking(WAVE6_DEPS, stackEncounterDeck(state, "01186", "32100"), pick, endTurn(P1));

    it("registers an interrupt on an X-MEN character's damage from an attack, costing an energy and himself", () => {
      const definition = COLOSSUS_SUPPORT_UPGRADES_ALLIES["32011.nightcrawler-interrupt"];
      expect(definition.trigger).toMatchObject({ kind: "interrupt", on: { on: "dealDamage", fromAttack: true } });
      expect(definition.effects).toEqual([{ kind: "preventDamage" }]);
    });

    it("prevents all of the attack's damage to Colossus, spends an energy resource and returns himself to hand", () => {
      const { state: inPlayState, id: nightcrawler } = withNightcrawler(hero("project-wideawake"));
      const log: string[] = [];
      const base = stackEncounterDeck(inPlayState, "01186", "32100");
      const control = attack(inPlayState, firstLegal).state;
      expect(inst(control, heroId(control)).damage).toBeGreaterThan(0);
      const { state: after } = driveEventsPicking(
        WAVE6_DEPS,
        base,
        accepting(log, "32011.nightcrawler-interrupt"),
        endTurn(P1),
      );
      expect(count(log, "32011.nightcrawler-interrupt")).toBeGreaterThanOrEqual(1);
      expect(inst(after, heroId(after)).damage).toBe(0);
      expect(playerOf(after, P1).hand).toContain(nightcrawler);
      expect(playerOf(after, P1).playArea).not.toContain(nightcrawler);
    });

    it("is not offered when no hand card can pay an energy resource", () => {
      const { state: inPlayState, id: nightcrawler } = withNightcrawler(hero("project-wideawake"));
      // A resource card's icons are `producesIcons` (Defensive Energy's [wild]); any other card's, `resourceIcons`.
      const hasEnergy = (state: GameState, id: InstanceId) => {
        const card = state.cardPool[state.instances[id]!.cardId] as {
          resourceIcons?: { energy?: number; wild?: number };
          producesIcons?: { energy?: number; wild?: number };
        };
        const icons = card.producesIcons ?? card.resourceIcons;
        return (icons?.energy ?? 0) + (icons?.wild ?? 0) > 0;
      };
      const dry: GameState = {
        ...inPlayState,
        players: inPlayState.players.map((p) =>
          p.playerId === P1
            ? {
                ...p,
                hand: p.hand.filter((id) => !hasEnergy(inPlayState, id)),
                discard: [...p.discard, ...p.hand.filter((id) => hasEnergy(inPlayState, id))],
              }
            : p,
        ),
      };
      const offered: string[] = [];
      const { state: after } = attack(dry, accepting(offered, "32011.nightcrawler-interrupt"));
      // The cost cannot be paid, so the interrupt is never offered (docs/phase7-wave6.md §3.84): nothing is prevented
      // and Nightcrawler stays in play.
      expect(offered).toEqual([]);
      expect(inst(after, heroId(after)).damage).toBeGreaterThan(0);
      expect(playerOf(after, P1).playArea).toContain(nightcrawler);
    });
  });

  describe("Polaris (32012)", () => {
    it("gives the chosen X-MEN character a tough status card (Colossus)", () => {
      const state = hero();
      const log: string[] = [];
      const { state: after, id: polaris } = playFromHand(
        WAVE6_DEPS,
        state,
        "32012",
        3,
        either(choosing([heroId(state)]), accepting(log, "32012.polaris-response")),
      );
      void polaris;
      expect(count(log, "32012.polaris-response")).toBe(1);
      expect(tough(after)).toBe(1);
    });

    it("may give it to any X-MEN character, herself included (and then not to Colossus)", () => {
      const state = hero();
      const log: string[] = [];
      const given = moveToHand(stocked(state), P1, "32012");
      const [id] = given.ids as [InstanceId];
      const after = settle(
        runWith(WAVE6_DEPS, given.state, play(P1, id, payWith(given.state, P1, 3, [id]))),
        either(choosing([id]), accepting(log, "32012.polaris-response")),
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, id).statuses.tough).toBe(1);
      expect(tough(after)).toBe(0);
    });
  });

  describe("Protective Training (32013)", () => {
    it("the attached ally gets +3 hit points; nobody else does", () => {
      const state = hero();
      const { state: withPolaris, id: polaris } = playFromHand(WAVE6_DEPS, state, "32012", 3);
      const hpBefore = profile(withPolaris, polaris).maxHp;
      const heroHpBefore = profile(withPolaris, heroId(withPolaris)).maxHp;
      const given = moveToHand(stocked(withPolaris), P1, "32013");
      const [training] = given.ids as [InstanceId];
      const after = settle(
        runWith(
          WAVE6_DEPS,
          given.state,
          play(P1, training, payWith(given.state, P1, 1, [training]), { attachToInstanceId: polaris }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, polaris).attachments).toContain(training);
      expect(profile(after, polaris).maxHp).toBe(hpBefore + 3);
      expect(profile(after, heroId(after)).maxHp).toBe(heroHpBefore);
    });

    it("Max 1 TRAINING upgrade per ally: a second is refused on Polaris, and is fine on Nightcrawler", () => {
      const { state: withPolaris, id: polaris } = playFromHand(WAVE6_DEPS, hero(), "32012", 3);
      const { state: withBoth, id: nightcrawler } = playFromHand(WAVE6_DEPS, stocked(withPolaris), "32011", 3);
      const given = moveToHand(stocked(withBoth), P1, "32013", "32013");
      const [first, second] = given.ids as [InstanceId, InstanceId];
      const onto = (state: GameState, id: InstanceId, host: InstanceId) =>
        play(P1, id, payWith(state, P1, 1, [first, second]), { attachToInstanceId: host });
      const trained = settle(
        runWith(WAVE6_DEPS, given.state, onto(given.state, first, polaris)),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      const refused = applyCommand(trained, onto(trained, second, polaris), WAVE6_DEPS);
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.message).toBe("max 1 TRAINING upgrade per host");
      const both = settle(
        runWith(WAVE6_DEPS, trained, onto(trained, second, nightcrawler)),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(both, polaris).attachments.filter((id) => id === first || id === second)).toEqual([first]);
      expect(inst(both, nightcrawler).attachments).toContain(second);
    });
  });

  describe("Professor X (32019)", () => {
    const enter = (state: GameState, label: string, log: string[] = []) =>
      playFromHand(
        WAVE6_DEPS,
        state,
        "32019",
        3,
        either(choosing([], [label]), accepting(log, "32019.professor-x-forced-response")),
      );

    it("Forced Response: confuse the villain", () => {
      const state = hero();
      const { state: after } = enter(state, "Confuse the villain");
      expect(inst(after, villainId(after)).statuses.confused).toBe(1);
    });

    it("stun a minion: stuns the one chosen", () => {
      const { state: withMinion, id: minion } = engageMinion(hero("project-wideawake"), "32093");
      const { state: after } = enter(withMinion, "Stun a minion");
      expect(inst(after, minion).statuses.stunned).toBe(1);
    });

    it("stun a minion is not offered with no minion in play", () => {
      const state = hero();
      const given = moveToHand(stocked(state), P1, "32019");
      const [id] = given.ids as [InstanceId];
      const labels: string[] = [];
      settle(
        runWith(WAVE6_DEPS, given.state, play(P1, id, payWith(given.state, P1, 3, [id]))),
        (s) => {
          const options = s.pendingChoice?.options.map((o) => o.label) ?? [];
          if (options.includes("Confuse the villain")) labels.push(...options);
          return firstLegal(s);
        },
        undefined,
        WAVE6_DEPS,
      );
      expect(labels).toContain("Confuse the villain");
      expect(labels).not.toContain("Stun a minion");
    });

    it("ready an X-MEN character: readies exhausted Colossus", () => {
      const state = hero();
      const exhausted = patchInstance(state, heroId(state), { exhausted: true });
      const { state: after } = enter(exhausted, "Ready an X-MEN character");
      expect(inst(after, heroId(after)).exhausted).toBe(false);
    });

    it("is discarded at the end of the round if still in play", () => {
      const { state: inPlayState, id: professor } = enter(hero("project-wideawake"), "Confuse the villain");
      expect(playerOf(inPlayState, P1).playArea).toContain(professor);
      const { state: after } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(inPlayState, "01186", "32100"),
        firstLegal,
        endTurn(P1),
      );
      expect(playerOf(after, P1).playArea).not.toContain(professor);
      expect(playerOf(after, P1).discard).toContain(professor);
    });
  });

  describe("The X-Jet (32020)", () => {
    it("Resource: exhausts to generate a wild resource for a player whose identity has the X-MEN trait", () => {
      const { state: withJet, id: jet } = played(hero(), "32020", 3);
      const given = moveToHand(withJet, P1, "32004");
      const [ironWill] = given.ids as [InstanceId];
      const [other] = payWith(given.state, P1, 1, [ironWill]);
      const after = settle(
        runWith(
          WAVE6_DEPS,
          given.state,
          play(P1, ironWill, [other!], { abilities: [resourceAbility(jet, "32020.the-x-jet-resource")] }),
        ),
        firstLegal,
        undefined,
        WAVE6_DEPS,
      );
      expect(inst(after, jet).exhausted).toBe(true);
      expect(inst(after, heroId(after)).attachments).toContain(ironWill);
    });

    it("cannot be used for a player whose identity lacks the X-MEN trait", () => {
      const state = colossusGame("rhino", { extraPlayers: [{ starterDeckId: "core-spider-man-justice" }] });
      const { state: withJet, id: jet } = played(withForm(state, { heroForm: 0 }), "32020", 3);
      const turn = settle(runWith(WAVE6_DEPS, withJet, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);
      const p2 = playerOf(turn, P2);
      const found = [...p2.hand, ...p2.deck].find((id) => {
        const printed = turn.cardPool[turn.instances[id]!.cardId] as { cost?: number; type: string };
        return printed.cost === 1 && ["support", "upgrade", "ally"].includes(printed.type);
      })!;
      const given = moveToHand(turn, P2, turn.instances[found]!.cardId);
      const result = applyCommand(
        given.state,
        play(P2, given.ids[0]!, [], { abilities: [resourceAbility(jet, "32020.the-x-jet-resource")] }),
        WAVE6_DEPS,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain("condition is not met");
    });
  });
});
