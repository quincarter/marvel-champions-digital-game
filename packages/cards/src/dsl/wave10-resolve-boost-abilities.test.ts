/**
 * docs/phase7-wave10.md §3.11: `resolveBoostAbilitiesOf`, "Resolve the 'Boost' ability of each minion" (Freedom
 * Fighters, `cw` 56153 and 56157), in a real Civil War game: the `resistance-spider-woman` scenario with New Avengers
 * picked, as `wave10/cw/modular/new-avengers.test.ts` plays it. The minions are the set's own scripted cards: Falcon
 * 56150 ("You are confused. If you were already confused, this card gains [boost][boost]") and Hercules 56151 ("You
 * are stunned. …"). Freedom Fighters' two abilities are registered here, written as the set's module will write them.
 *
 * Question 10 (§4.0; owner, 2026-10-11): the icons a borrowed ability gains do nothing (A, the default), with B (they
 * join the activation the resolving card is boosting) kept as the option `borrowedBoostIcons: "joinActivation"`.
 *
 * The villain phase draws the villain's boost card first, then deals each player a card, so a stack reads "boost,
 * dealt". Advance 01186 prints no boost icon and no Boost ability; Defend Hell's Kitchen 56193 (a side scheme of the
 * Hell's Kitchen set) is a harmless card to deal. Freedom Fighters prints no boost icon (a star only), and Spider-Woman's ATK is 2.
 */

import {
  activeEncounterDeckId,
  type AbilityDefinition,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, endTurn, firstLegal, identityOf, inst, patchInstance, stackEncounterDeck } from "../testing/harness.js";
import { driveEventsPicking } from "../testing/staging.js";
import { attacksBy, codeOf, flippedBoosts, revealedCodes, types } from "../wave9/testing.js";
import { SPIDER_WOMAN_SCENARIO, WAVE10_DEPS, civilWarHeroGame } from "../wave10/testing.js";
import { boost, whenRevealed } from "./abilities.js";
import { ifThen, resolveBoostAbilitiesOf, surge } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { each, not, query, varAtLeast } from "./values.js";

vi.setConfig({ testTimeout: 120_000 });

const FALCON = "56150";
const HERCULES = "56151";
const FIGHTERS = "56153";
const SPIDER_WOMAN = "56168";
const ADVANCE = "01186";
const DEFEND = "56193";

/** "When Revealed: Resolve the 'Boost' ability of each minion in play. If no 'Boost' abilities were resolved this way, this card gains surge." */
const WHEN_REVEALED = whenRevealed(
  resolveBoostAbilitiesOf(each(query("minion")), { bind: "boosts" }),
  ifThen(not(varAtLeast("boosts.count")), surge()),
);
/** "[star] Boost: Resolve the 'Boost' ability of each minion engaged with you." Answer A of question 10. */
const BOOST_A = boost(resolveBoostAbilitiesOf(each(query("minion", { engagedWith: "you" }))));
/** The same with answer B switched on. */
const BOOST_B = boost(
  resolveBoostAbilitiesOf(each(query("minion", { engagedWith: "you" })), { borrowedBoostIcons: "joinActivation" }),
);

const depsWith = (boostAbility: AbilityDefinition): EngineDeps => ({
  ...WAVE10_DEPS,
  abilities: { ...WAVE10_DEPS.abilities, "56153.when-revealed": WHEN_REVEALED, "56153.boost": boostAbility },
});
const DEPS_A = depsWith(BOOST_A);
const DEPS_B = depsWith(BOOST_B);

type Status = "stunned" | "confused" | "tough";
const hero = (s: GameState) => identityOf(s, P1);
const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const statusesOf = (s: GameState, id: InstanceId) => {
  const { stunned, confused, tough } = inst(s, id).statuses;
  return { stunned, confused, tough };
};
const withStatus = (s: GameState, id: InstanceId, name: Status, count = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: count } });

/** The Spider-Woman scenario with New Avengers as a modular set, past setup, hero form, Spider-Woman not tough. */
function game(deps: EngineDeps): GameState {
  const start = civilWarHeroGame(SPIDER_WOMAN_SCENARIO, {
    modularSetIds: ["new_avengers", "defenders", "hells_kitchen"],
    deps,
  });
  return withStatus(start, leaderOf(start), "tough", 0);
}

/** Surgery: the encounter deck's own copy of minion `code`, engaged with player 1 (no reveal, no When Revealed). */
function engaged(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: P1, faceup: true } },
    },
  };
}

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then the dealt card). */
const villainPhase = (deps: EngineDeps, state: GameState, ...stack: string[]) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));

/** The Boost abilities resolved, as the log names them: [card code, ability id]. */
const boostsResolved = (s: GameState, events: Parameters<typeof flippedBoosts>[0]) =>
  types(events, "abilityResolved")
    .filter((e) => (e.abilityId as string).endsWith(".boost"))
    .map((e) => [codeOf(s, e.instanceId), e.abilityId as string]);

describe("§3.11 `resolveBoostAbilitiesOf`", () => {
  it("builds the labeled resolve; the option is carried only when named", () => {
    expect(resolveBoostAbilitiesOf(each(query("minion")), { bind: "boosts" })).toEqual({
      kind: "resolveSpecials",
      of: { kind: "each", query: { categories: ["minion"] } },
      trigger: "boost",
      bind: "boosts",
    });
    expect(resolveBoostAbilitiesOf(each(query("minion")), { borrowedBoostIcons: "joinActivation" })).toEqual({
      kind: "resolveSpecials",
      of: { kind: "each", query: { categories: ["minion"] } },
      trigger: "boost",
      borrowedBoostIcons: "joinActivation",
    });
  });

  it("Freedom Fighters' two abilities are valid definitions, and the count is a value the script may read", () => {
    for (const definition of [WHEN_REVEALED, BOOST_A, BOOST_B]) expect(validateDefinition(definition)).toEqual([]);
  });

  it("the validator refuses the option on another kind, an unknown name, and the other kinds' options", () => {
    const base = { kind: "resolveSpecials", of: { kind: "self" } } as const;
    expect(validateDefinition(whenRevealed({ ...base, borrowedBoostIcons: "joinActivation" }))).toEqual([
      'resolveSpecials: `borrowedBoostIcons` is for `trigger: "boost"`',
    ]);
    expect(
      validateDefinition(whenRevealed({ ...base, trigger: "boost", borrowedBoostIcons: "always" as "nothing" })),
    ).toEqual(['resolveSpecials boost: `borrowedBoostIcons` is "nothing" or "joinActivation"']);
    expect(
      validateDefinition(
        whenRevealed({ ...base, trigger: "boost", asIf: { remainingHpAtLeast: 1 }, excludeKeywords: ["surge"] }),
      ),
    ).toEqual([
      "resolveSpecials boost: `asIf` is not read for a Boost ability",
      "resolveSpecials boost: `excludeKeywords` is for When Revealed abilities",
    ]);
  });
});

describe("Freedom Fighters (56153) When Revealed, in a Civil War game", () => {
  it("Falcon and Hercules in play: both Boost abilities resolve on the revealing player; no surge", () => {
    const falcon = engaged(game(DEPS_A), FALCON);
    const hercules = engaged(falcon.state, HERCULES);
    expect(statusesOf(hercules.state, hero(hercules.state))).toEqual({ stunned: 0, confused: 0, tough: 0 });
    const { state, events } = villainPhase(DEPS_A, hercules.state, ADVANCE, FIGHTERS, DEFEND);
    expect(revealedCodes(state, events)).toEqual([FIGHTERS]);
    expect(boostsResolved(state, events)).toEqual([
      [FALCON, "56150.boost"],
      [HERCULES, "56151.boost"],
    ]);
    expect(statusesOf(state, hero(state))).toEqual({ stunned: 1, confused: 1, tough: 0 });
    expect(types(events, "statusGiven").map((e) => [e.instanceId, e.status])).toEqual([
      [hero(state), "confused"],
      [hero(state), "stunned"],
    ]);
    expect(types(events, "surgeTriggered")).toEqual([]);
    // The minions are where they were: in play, engaged, faceup, never turned up or discarded as boost cards.
    for (const id of [falcon.id, hercules.id]) {
      expect(state.players[0]!.playArea).toContain(id);
      expect(inst(state, id)).toMatchObject({ engagedWith: P1, faceup: true });
    }
    expect(flippedBoosts(events).map((f) => codeOf(state, f.instanceId))).toEqual([ADVANCE]);
  });

  it("no minion in play: the count is 0, so the card gains surge and one more card is revealed", () => {
    const { state, events } = villainPhase(DEPS_A, game(DEPS_A), ADVANCE, FIGHTERS, DEFEND);
    expect(boostsResolved(state, events)).toEqual([]);
    expect(statusesOf(state, hero(state))).toEqual({ stunned: 0, confused: 0, tough: 0 });
    expect(types(events, "surgeTriggered").map((e) => codeOf(state, e.instanceId))).toEqual([FIGHTERS]);
    expect(revealedCodes(state, events)).toEqual([FIGHTERS, DEFEND]);
  });
});

describe("Freedom Fighters (56153) Boost, as the leader's boost card with Falcon engaged and the player confused", () => {
  const boosted = (deps: EngineDeps) => {
    const falcon = engaged(game(deps), FALCON);
    const confused = withStatus(falcon.state, hero(falcon.state), "confused");
    return { ...villainPhase(deps, confused, FIGHTERS, DEFEND), falcon: falcon.id };
  };

  it("question 10, A (the default): Falcon's gained icons do nothing; Spider-Woman attacks for 2 + 0", () => {
    const { state, events, falcon } = boosted(DEPS_A);
    expect(boostsResolved(state, events)).toEqual([
      [FIGHTERS, "56153.boost"],
      [FALCON, "56150.boost"],
    ]);
    expect(flippedBoosts(events).map((f) => [codeOf(state, f.instanceId), f.boostIcons])).toEqual([[FIGHTERS, 0]]);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    // Already confused: no second status card. Falcon stays in play and then attacks for its own ATK 2.
    expect(statusesOf(state, hero(state))).toEqual({ stunned: 0, confused: 1, tough: 0 });
    expect(inst(state, falcon)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(attacksBy(state, events, FALCON)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(inst(state, hero(state)).damage).toBe(4);
  });

  it('question 10, B (`borrowedBoostIcons: "joinActivation"`): the icons join her attack, 2 + 2', () => {
    const { state, events } = boosted(DEPS_B);
    expect(boostsResolved(state, events)).toEqual([
      [FIGHTERS, "56153.boost"],
      [FALCON, "56150.boost"],
    ]);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
    expect(statusesOf(state, hero(state))).toEqual({ stunned: 0, confused: 1, tough: 0 });
    expect(attacksBy(state, events, FALCON)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(inst(state, hero(state)).damage).toBe(6);
  });

  it("question 10, either answer: a player who was not confused gains no icon and becomes confused", () => {
    for (const deps of [DEPS_A, DEPS_B]) {
      const falcon = engaged(game(deps), FALCON);
      const { state, events } = villainPhase(deps, falcon.state, FIGHTERS, DEFEND);
      expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
      expect(statusesOf(state, hero(state))).toEqual({ stunned: 0, confused: 1, tough: 0 });
    }
  });
});
