import { describe, expect, it } from "vitest";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  legalActions,
  statBonus,
  type GameState,
  type InstanceId,
  type Payment,
} from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  settleUntil,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../testing/cross-hero.js";
import { encounterCardInVillainArea } from "../../testing/staging.js";
import { WAVE5_CARDS } from "../cards.js";
import { wave5Scenario } from "../setup.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spdrScenario } from "./support.js";

const spdrVsRhino = (seed = 1) => startWave5Game(spdrScenario("rhino", { seed }));

/** A picker that accepts the `chooseOne`/`chooseTarget` option whose label is exactly `label`. */
const choosing =
  (label: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label === label);
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** Pays with the Sync Ratio resource ability (`31001a.sync-ratio`), exhausting `pick` (an Interface upgrade). */
const syncUse = (state: GameState, pick: InstanceId): Payment => ({
  ability: {
    instanceId: identityOf(state, P1),
    abilityId: "31001a.sync-ratio" as never,
    costChoices: { exhausted: [pick] },
  },
});

/** Plays `code` from hand (hero form), paying `cost - 1` from other hand cards and 1 via SP//dr Suit's own Sync
 * Ratio (exhausting SP//dr, the attached upgrade, itself always an in-play Interface upgrade in hero form) —
 * `identity.test.ts`'s own Sync Ratio probe precedent. */
function playWithSyncRatio(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const spdr = playerOf(given.state, P1).identity.separatedCardInstanceId!;
  const played = settle(
    runWave5(
      given.state,
      play(P1, id, payWith(given.state, P1, cost - 1, [id]), { abilities: [syncUse(given.state, spdr)] }),
    ),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: played, id };
}

/** Plays `code` from hand, attaching it directly to `hostId` — `spiderham/support-upgrades.test.ts`'s own precedent. */
function playAttachedTo(
  state: GameState,
  code: string,
  cost: number,
  hostId: InstanceId,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(
    runWave5(given.state, play(P1, id, payWith(given.state, P1, cost, [id]), { attachToInstanceId: hostId })),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: played, id };
}

/** The first minion in the encounter deck, put into play engaged with P1 (surgery: no reveal, no When Revealed). */
function engagedMinion(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const types = new Map(WAVE5_CARDS.map((card) => [card.id as string, card.type]));
  const pile = state.encounterDecks[activeEncounterDeckId(state)]!;
  const code = pile.deck
    .map((id) => inst(state, id).cardId as string)
    .find((cardCode) => types.get(cardCode) === "minion");
  if (!code) throw new Error("no minion in the encounter deck");
  const placed = encounterCardInVillainArea(state, code);
  return { state: patchInstance(placed.state, placed.id, { engagedWith: P1, controllerId: null }), id: placed.id };
}

/** Moves the top `n` cards of P1's deck into hand (surgery), so a later play has cards to pay with. */
function drawn(state: GameState, n: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, n)], deck: p.deck.slice(n) } : p,
    ),
  };
}

/** Answers Thwip Thwip!'s stun `divide` with `shares`, recording the options it offered; anything else `firstLegal`. */
function dividing(shares: readonly string[], seen: { options?: readonly string[] }): Picker {
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "divide") return firstLegal(state);
    seen.options = choice.options.map((o) => o.optionId);
    return shares;
  };
}

/** Whether playing `id` (hero form, a legal payment) is refused for its play restriction and never offered. */
function refusedForRestriction(state: GameState, id: InstanceId, cost: number): boolean {
  const result = applyCommand(state, play(P1, id, payWith(state, P1, cost, [id])), WAVE5_DEPS);
  const actions = legalActions(state, P1, WAVE5_DEPS);
  if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
  const offered = actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
  return !result.ok && /play restriction is not met/.test(result.error.message) && !offered;
}

/** A Core precon (`coreHeroId`) seated at Rhino in hero form, with one Limitless Stamina (31023) in hand. */
function coreHeroWithLimitlessStamina(coreHeroId: string): { readonly state: GameState; readonly id: InstanceId } {
  const setup = buildCrossHeroDeck(WAVE5_CARDS, coreHeroId, "31023");
  const created = createGame(wave5Scenario("rhino", { seed: 7, players: [setup] }), WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
  const hero = settle(runWave5(opening, toHero(P1)), firstLegal, undefined, WAVE5_DEPS);
  const { state, ids } = moveToHand(hero, P1, "31023");
  return { state, id: ids[0]! };
}

describe("SP//dr's events (31004-31006, 31016, 31017, 31023)", () => {
  describe("31004.all-systems-go-action", () => {
    it("Ready each Interface upgrade you control: readies the exhausted SP//dr Suit upgrade (hero form)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const spdr = playerOf(hero, P1).identity.separatedCardInstanceId!;
      const exhausted = patchInstance(hero, spdr, { exhausted: true });
      const { state } = playFromHand(exhausted, "31004", 1, choosing("Ready each Interface upgrade you control"));
      expect(inst(state, spdr).exhausted).toBe(false);
    });

    it("Search your deck and discard pile for an Interface upgrade and add it to your hand: shuffles it in from the deck", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const interfaceUpgradeIds = ["31010", "31011", "31012", "31013"].flatMap((code) => instancesOf(hero, code));
      const inHandBefore = playerOf(hero, P1).hand.filter((id) => interfaceUpgradeIds.includes(id)).length;
      const label = "Search your deck and discard pile for an Interface upgrade and add it to your hand";
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        if (choice.prompt.kind === "chooseCards") {
          // Pick the first offered Interface upgrade (any legal one proves the search worked).
          return choice.options.slice(0, 1).map((o) => o.optionId);
        }
        return choosing(label)(s);
      };
      const { state } = playFromHand(hero, "31004", 1, pick);
      const inHandAfter = playerOf(state, P1).hand.filter((id) => interfaceUpgradeIds.includes(id)).length;
      expect(inHandAfter).toBe(inHandBefore + 1); // found and added to hand, on top of any already drawn.
    });
  });

  describe("31004.all-systems-go-action (header and both bullet lines, one Hero Action)", () => {
    it("the Hero Action offers exactly the two printed bullets as its options", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const given = moveToHand(hero, P1, "31004");
      const [id] = given.ids as [InstanceId];
      const pending = runWith(WAVE5_DEPS, given.state, play(P1, id, payWith(given.state, P1, 1, [id])));
      const choice = settleUntil(pending, "chooseOption", firstLegal, WAVE5_DEPS).pendingChoice!;
      expect(choice.options.map((o) => o.label)).toEqual([
        "Ready each Interface upgrade you control",
        "Search your deck and discard pile for an Interface upgrade and add it to your hand",
      ]);
    });
  });

  describe("31005.rapid-deployment-action", () => {
    it("without Sync Ratio: removes 3 threat from a scheme, once", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const { state } = playFromHand(withThreat, "31005", 2);
      expect(mainThreat(state)).toBe(10 - 3);
    });

    it("paid with a Sync Ratio resource: removes 3 threat from a scheme twice (6 total)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const { state } = playWithSyncRatio(withThreat, "31005", 2);
      expect(mainThreat(state)).toBe(10 - 6);
    });
  });

  describe("31006.web-trap-action", () => {
    it("without Sync Ratio: deals 5 damage to an enemy and does not stun it", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const villain = hero.villains[0]!.instanceId;
      const before = inst(hero, villain).damage;
      const { state } = playFromHand(hero, "31006", 2);
      expect(inst(state, villain).damage).toBe(before + 5);
      expect(state.instances[villain]?.statuses.stunned ?? 0).toBe(0);
    });

    it("paid with a Sync Ratio resource: deals 5 damage and stuns that enemy", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const villain = hero.villains[0]!.instanceId;
      const before = inst(hero, villain).damage;
      const { state } = playWithSyncRatio(hero, "31006", 2);
      expect(inst(state, villain).damage).toBe(before + 5);
      expect(state.instances[villain]?.statuses.stunned ?? 0).toBeGreaterThan(0);
    });
  });

  describe("31016.repurpose-action", () => {
    it("discards a Tech upgrade, readies your hero, and gets +X (the upgrade's printed cost) to the chosen power until the end of the round", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      // Energy Barrier (31018): cost 2, TECH.
      const { state: withUpgrade, id: barrier } = playAttachedTo(hero, "31018", 2, identity);
      const exhausted = patchInstance(withUpgrade, identity, { exhausted: true });
      const { state } = playFromHand(exhausted, "31016", 0, choosing("ATK"));
      expect(playerOf(state, P1).discard).toContain(barrier); // discarded as the cost.
      expect(playerOf(state, P1).playArea).not.toContain(barrier);
      expect(inst(state, identity).exhausted).toBe(false); // readied.
      // +2 ATK (Energy Barrier's own printed cost, 31018), the chosen power, until the end of the round.
      expect(statBonus(state, WAVE5_DEPS, identity, "atk")).toBe(2);
      expect(statBonus(state, WAVE5_DEPS, identity, "thw")).toBe(0);
      expect(statBonus(state, WAVE5_DEPS, identity, "def")).toBe(0);
    });
  });

  describe("31017.thwip-thwip-action", () => {
    it("deals exactly 1 damage to SP//dr (her only Web-Warrior character), then splits the 2 stuns 1 + 1 between two enemies", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: table, id: minion } = engagedMinion(hero);
      const villain = table.villains[0]!.instanceId;
      const seen: { options?: readonly string[] } = {};
      const before = inst(table, identity).damage;
      const { state } = playFromHand(table, "31017", 2, dividing([`${villain}#1`, `${minion}#1`], seen));
      expect(inst(state, identity).damage).toBe(before + 1);
      expect(inst(state, villain).statuses.stunned).toBe(1);
      expect(inst(state, minion).statuses.stunned).toBe(1);
      // Neither enemy is steady, so neither is offered a second stun card (RRG 1.8 "Status Cards", p. 41).
      expect(seen.options).toEqual([`${villain}#1`, `${minion}#1`]);
    });

    it("both stuns on one non-steady enemy is not allowed; choosing that one enemy alone stuns only it (ruling, Mar 6, 2026 (2))", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const { state: table, id: minion } = engagedMinion(hero);
      const villain = table.villains[0]!.instanceId;
      const given = moveToHand(table, P1, "31017");
      const [id] = given.ids as [InstanceId];
      const pending = runWith(WAVE5_DEPS, given.state, play(P1, id, payWith(given.state, P1, 2, [id])));
      const settled = settleUntil(pending, "divide", firstLegal, WAVE5_DEPS);
      const choice = settled.pendingChoice!;
      const both = applyCommand(
        settled,
        {
          type: "resolveChoice",
          playerId: P1,
          choiceId: choice.choiceId,
          selectedOptionIds: [`${villain}#1`, `${villain}#2`],
        },
        WAVE5_DEPS,
      );
      expect(both.ok).toBe(false); // `${villain}#2` is no option
      const one = applyCommand(
        settled,
        { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [`${villain}#1`] },
        WAVE5_DEPS,
      );
      if (!one.ok) throw new Error(one.error.message);
      const state = settle(one.state, firstLegal, undefined, WAVE5_DEPS);
      expect(inst(state, villain).statuses.stunned).toBe(1);
      expect(inst(state, minion).statuses.stunned).toBe(0);
    });

    it("with a Web-Warrior ally in play the player picks which character takes the 1 damage", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const { state: withNoir, id: noir } = playFromHand(hero, "31015", 3); // Spider-Man Noir, a Web-Warrior ally
      const given = moveToHand(drawn(withNoir, 3), P1, "31017");
      const [id] = given.ids as [InstanceId];
      const before = inst(given.state, identity).damage;
      const pay = payWith(given.state, P1, 2, [id]);
      // Two candidates: the command must name the pick.
      expect(applyCommand(given.state, play(P1, id, pay), WAVE5_DEPS).ok).toBe(false);
      const state = settle(
        runWith(WAVE5_DEPS, given.state, play(P1, id, pay, { costChoices: { damaged: [noir] } })),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(state, noir).damage).toBe(1);
      expect(inst(state, identity).damage).toBe(before);
      expect(inst(state, state.villains[0]!.instanceId).statuses.stunned).toBe(1); // the only enemy
    });

    it("is not offered, and refused, when no Web-Warrior character you control can take the damage (SP//dr holds a tough status card)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const tough = patchInstance(hero, identity, { statuses: { ...inst(hero, identity).statuses, tough: 1 } });
      const given = moveToHand(tough, P1, "31017");
      const [id] = given.ids as [InstanceId];
      const result = applyCommand(given.state, play(P1, id, payWith(given.state, P1, 2, [id])), WAVE5_DEPS);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/cannot take all of this cost's damage/); // the cost, not the payment
      const actions = legalActions(given.state, P1, WAVE5_DEPS);
      if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
      expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)).toBe(false);
    });
  });

  describe("31023.limitless-stamina-action", () => {
    it("readies your hero", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const exhausted = patchInstance(hero, identity, { exhausted: true });
      const { state } = playFromHand(exhausted, "31023", 1);
      expect(inst(state, identity).exhausted).toBe(false);
    });
  });

  describe("31023.limitless-stamina-constant (Play only if your identity has at least 14 printed hit points)", () => {
    it("SP//dr (14 printed hit points, exactly the threshold) can play it, even with damage on her", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const damaged = patchInstance(hero, identity, { damage: 6, exhausted: true });
      const given = moveToHand(damaged, P1, "31023");
      const actions = legalActions(given.state, P1, WAVE5_DEPS);
      if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
      expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.ids[0])).toBe(
        true,
      );
      const { state, id } = playFromHand(damaged, "31023", 1);
      expect(playerOf(state, P1).discard).toContain(id); // played and resolved
      expect(inst(state, identity).exhausted).toBe(false);
      expect(inst(state, identity).damage).toBe(6);
    });

    it("a Core hero with at least 14 printed hit points (She-Hulk, 15) can play it from her own deck", () => {
      const { state } = playFromAnotherHerosDeck(
        "31023",
        {
          deps: WAVE5_DEPS,
          cards: WAVE5_CARDS,
          buildScenario: (players) => wave5Scenario("rhino", { seed: 7, players }),
        },
        {
          coreHero: "core-she-hulk-aggression",
          // Her own "after you change to this form" response settles first (declined).
          setup: (s) =>
            patchInstance(settle(runWave5(s, toHero(P1)), firstLegal, undefined, WAVE5_DEPS), identityOf(s, P1), {
              exhausted: true,
            }),
        },
      );
      expect(inst(state, identityOf(state, P1)).exhausted).toBe(false);
    });

    it("a Core hero below 14 printed hit points (Spider-Man, 10) is refused, and it is never offered", () => {
      const { state, id } = coreHeroWithLimitlessStamina("core-spider-man-justice");
      expect(refusedForRestriction(state, id, 1)).toBe(true);
    });

    it("Captain Marvel (12) is refused too: the threshold is 14, not 'more than the villain' or remaining HP", () => {
      const { state, id } = coreHeroWithLimitlessStamina("core-captain-marvel-leadership");
      expect(refusedForRestriction(state, id, 1)).toBe(true);
    });
  });
});
