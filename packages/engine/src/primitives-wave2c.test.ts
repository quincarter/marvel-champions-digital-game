/**
 * docs/phase7-wave2.md §17: the fourth batch of cycle 1 primitives `ability-scripting-engineer` was blocked on
 * (docs/phase7-wave2-scripting.md §6.16–§6.19), with synthetic cards. Engine code never names a card; the card names
 * in the test titles only say which printed text each shape was built for.
 *
 * Sources: RRG 1.8 "Nemesis Encounter Set" (p. 30), "Search" (p. 39), "Set Aside" (p. 39), "Defeat" (p. 15),
 * "Basic Power" (pp. 10–11), "Recover, Recovery" (p. 36), "Piercing" (p. 32), "Interrupt" (p. 25).
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { matchesQuery, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubIdentity, stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCards, RESOURCE, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const def = (definition: AbilityDefinition) => definition;
const play = (id: InstanceId): Command => ({ type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null });
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }] });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });

const context = (deps: EngineDeps, player = p1): EffectContext => ({ selfInstanceId: null, controllerId: player, event: null, bindings: {}, deps });

// ---- §17.1 "their nemesis minion" ----------------------------------------------------------------------------------

describe("§17.1 `TargetQuery.nemesisMinionOf`: the minion of that player's own nemesis set", () => {
  // Two identities, each with its own nemesis set, the way a real table is dealt (RRG 1.8 "Nemesis Encounter Set",
  // p. 30: each player sets aside the cards from their associated nemesis set).
  const HERO_1 = stubIdentity({ id: "one", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });
  const HERO_2 = stubIdentity({ id: "two", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });
  /** "(One's nemesis minion.)" */
  const NEMESIS_1 = stubMinion({ id: "nemesis-one", atk: 1, sch: 1, hp: 3, boostIcons: 0, encounterSetIds: ["one-nemesis"], nemesisMinion: true });
  /** "(Two's nemesis minion.)" */
  const NEMESIS_2 = stubMinion({ id: "nemesis-two", atk: 1, sch: 1, hp: 3, boostIcons: 0, encounterSetIds: ["two-nemesis"], nemesisMinion: true });
  /** A second minion in the same nemesis set without the parenthetical: not "the" nemesis minion. */
  const HENCHMAN = stubMinion({ id: "henchman", atk: 1, sch: 1, hp: 3, boostIcons: 0, encounterSetIds: ["one-nemesis"] });
  /** Flagged, but from a nemesis set nobody at this table plays. */
  const ABSENTEE = stubMinion({ id: "absentee", atk: 1, sch: 1, hp: 3, boostIcons: 0, encounterSetIds: ["three-nemesis"], nemesisMinion: true });

  const NEMESIS_CARDS = [NEMESIS_1, NEMESIS_2, HENCHMAN, ABSENTEE];
  const deps = depsOf();

  function table(): GameState {
    const result = createGame(
      {
        seed: 9,
        cards: [...DEFAULT_CARDS, VILLAIN, SCHEME, BLANK, HERO_1, HERO_2, ...NEMESIS_CARDS, ABSENTEE],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: [...copies(BLANK.id, 14), ABSENTEE.id],
        players: [
          { identityCardId: HERO_1.id, deck: DEFAULT_DECK },
          { identityCardId: HERO_2.id, deck: DEFAULT_DECK },
        ],
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    return settle(result.state, undefined, deps);
  }

  const instancesOf = (state: GameState, card: AnyCard): readonly InstanceId[] =>
    Object.values(state.instances)
      .filter((instance: CardInstance) => instance.cardId === card.id)
      .map((instance) => instance.instanceId);

  it("matches only the flagged minion of that player's own nemesis set, wherever it is", () => {
    const state = table();
    const forP1 = (id: InstanceId) => matchesQuery(state, id, { nemesisMinionOf: { kind: "controller" } }, context(deps, p1));
    const forP2 = (id: InstanceId) => matchesQuery(state, id, { nemesisMinionOf: { kind: "controller" } }, context(deps, p2));

    // Set aside at setup, out of play, and still matched: a search reaches set-aside cards (RRG 1.8 "Set Aside", p. 39).
    const [one] = instancesOf(state, NEMESIS_1);
    const [two] = instancesOf(state, NEMESIS_2);
    expect(mustPlayer(state, p1).setAside).toContain(one);
    expect(mustPlayer(state, p2).setAside).toContain(two);
    expect(forP1(one as InstanceId)).toBe(true);
    expect(forP2(one as InstanceId)).toBe(false);
    expect(forP2(two as InstanceId)).toBe(true);
    expect(forP1(two as InstanceId)).toBe(false);

    // The set's other minion prints no parenthetical, so it is not "the" nemesis minion (p. 30).
    for (const henchman of instancesOf(state, HENCHMAN)) expect(forP1(henchman)).toBe(false);
    // Flagged, but its set belongs to an identity nobody is playing.
    for (const absentee of instancesOf(state, ABSENTEE)) expect(forP1(absentee) || forP2(absentee)).toBe(false);
  });

  it("names each player's own minion under `{ kind: 'each' }`, so one query serves 'each player … their nemesis minion'", () => {
    const state = table();
    const everyone = (id: InstanceId) => matchesQuery(state, id, { nemesisMinionOf: { kind: "each" } }, context(deps, p1));
    const [one] = instancesOf(state, NEMESIS_1);
    const [two] = instancesOf(state, NEMESIS_2);
    expect(everyone(one as InstanceId)).toBe(true);
    expect(everyone(two as InstanceId)).toBe(true);
    for (const absentee of instancesOf(state, ABSENTEE)) expect(everyone(absentee)).toBe(false);
  });

  it("drives a real 'search the encounter deck, discard pile and set-aside area' (Kang's Wrath 4B)", () => {
    // The §10.1 `anyOf` pool, filtered by the nemesis-minion query instead of a hard-coded card name.
    const searchAbility = stubAbility("search.action", def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "selectCards",
          slot: "found",
          cards: {
            kind: "anyOf",
            of: [
              { kind: "encounter", zones: ["deck", "discard"], filter: { nemesisMinionOf: { kind: "controller" } } },
              { kind: "setAside", player: { kind: "controller" }, filter: { nemesisMinionOf: { kind: "controller" } } },
            ],
          },
        },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
      ],
    }));
    const SEARCHER = stubSupport({ id: "searcher", cost: 0, abilities: [searchAbility.ref] });
    const searchDeps = depsOf(searchAbility);
    const result = createGame(
      {
        seed: 9,
        cards: [...DEFAULT_CARDS, VILLAIN, SCHEME, BLANK, SEARCHER, HERO_1, HERO_2, ...NEMESIS_CARDS],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        // The absentee's copy sits in the encounter deck: a distractor the filter must not find.
        encounterDeck: [...copies(BLANK.id, 14), ABSENTEE.id],
        players: [
          { identityCardId: HERO_1.id, deck: [...copies(RESOURCE.id, 12), ...copies(SEARCHER.id, 2)] },
          { identityCardId: HERO_2.id, deck: DEFAULT_DECK },
        ],
      },
      searchDeps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const started = settle(result.state, undefined, searchDeps);
    const given = giveCards(started, p1, SEARCHER.id);
    const inPlay = settle(runWith(searchDeps, given.state, play(given.ids[0] as InstanceId)), undefined, searchDeps);
    const use: Command = { type: "useAbility", playerId: p1, cardInstanceId: given.ids[0] as InstanceId, abilityId: searchAbility.ref.id, payment: [] };
    const after = settle(runWith(searchDeps, inPlay, use), undefined, searchDeps);

    const engaged = mustPlayer(after, p1).playArea.filter((id) => mustInstance(after, id).engagedWith === p1);
    expect(engaged.map((id) => mustInstance(after, id).cardId)).toEqual([NEMESIS_1.id]);
    // The other player's minion stays set aside: the query is per-player, not "any nemesis minion".
    expect(mustPlayer(after, p2).setAside.some((id) => mustInstance(after, id).cardId === NEMESIS_2.id)).toBe(true);
  });
});
