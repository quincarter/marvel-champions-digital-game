/**
 * docs/phase7-wave2.md §17: the fourth batch of cycle 1 primitives `ability-scripting-engineer` was blocked on
 * (docs/phase7-wave2-scripting.md §6.16–§6.19), with synthetic cards. Engine code never names a card; the card names
 * in the test titles only say which printed text each shape was built for.
 *
 * Sources: RRG 1.8 "Nemesis Encounter Set" (p. 30), "Search" (p. 39), "Set Aside" (p. 39), "Defeat" (p. 15),
 * "Basic Power" (pp. 10–11), "Recover, Recovery" (p. 36), "Piercing" (p. 32), "Interrupt" (p. 25).
 */

import { flat, trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { playerId, type InstanceId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import { matchesQuery, traitsOf, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  giveCards,
  newGame,
  resolvePending,
  RESOURCE,
  runWith,
  settle,
  settleUntil,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });

const context = (deps: EngineDeps, player = p1): EffectContext => ({
  selfInstanceId: null,
  controllerId: player,
  event: null,
  bindings: {},
  deps,
});

// ---- §17.1 "their nemesis minion" ----------------------------------------------------------------------------------

describe("§17.1 `TargetQuery.nemesisMinionOf`: the minion of that player's own nemesis set", () => {
  // Two identities, each with its own nemesis set, the way a real table is dealt (RRG 1.8 "Nemesis Encounter Set",
  // p. 30: each player sets aside the cards from their associated nemesis set).
  const HERO_1 = stubIdentity({
    id: "one",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  const HERO_2 = stubIdentity({
    id: "two",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  /** "(One's nemesis minion.)" */
  const NEMESIS_1 = stubMinion({
    id: "nemesis-one",
    atk: 1,
    sch: 1,
    hp: 3,
    boostIcons: 0,
    encounterSetIds: ["one-nemesis"],
    nemesisMinion: true,
  });
  /** "(Two's nemesis minion.)" */
  const NEMESIS_2 = stubMinion({
    id: "nemesis-two",
    atk: 1,
    sch: 1,
    hp: 3,
    boostIcons: 0,
    encounterSetIds: ["two-nemesis"],
    nemesisMinion: true,
  });
  /** A second minion in the same nemesis set without the parenthetical: not "the" nemesis minion. */
  const HENCHMAN = stubMinion({
    id: "henchman",
    atk: 1,
    sch: 1,
    hp: 3,
    boostIcons: 0,
    encounterSetIds: ["one-nemesis"],
  });
  /** Flagged, but from a nemesis set nobody at this table plays. */
  const ABSENTEE = stubMinion({
    id: "absentee",
    atk: 1,
    sch: 1,
    hp: 3,
    boostIcons: 0,
    encounterSetIds: ["three-nemesis"],
    nemesisMinion: true,
  });

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
    const forP1 = (id: InstanceId) =>
      matchesQuery(state, id, { nemesisMinionOf: { kind: "controller" } }, context(deps, p1));
    const forP2 = (id: InstanceId) =>
      matchesQuery(state, id, { nemesisMinionOf: { kind: "controller" } }, context(deps, p2));

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
    const everyone = (id: InstanceId) =>
      matchesQuery(state, id, { nemesisMinionOf: { kind: "each" } }, context(deps, p1));
    const [one] = instancesOf(state, NEMESIS_1);
    const [two] = instancesOf(state, NEMESIS_2);
    expect(everyone(one as InstanceId)).toBe(true);
    expect(everyone(two as InstanceId)).toBe(true);
    for (const absentee of instancesOf(state, ABSENTEE)) expect(everyone(absentee)).toBe(false);
  });

  it("drives a real 'search the encounter deck, discard pile and set-aside area' (Kang's Wrath 4B)", () => {
    // The §10.1 `anyOf` pool, filtered by the nemesis-minion query instead of a hard-coded card name.
    const searchAbility = stubAbility(
      "search.action",
      def({
        trigger: { kind: "action" },
        effects: [
          {
            kind: "selectCards",
            slot: "found",
            cards: {
              kind: "anyOf",
              of: [
                { kind: "encounter", zones: ["deck", "discard"], filter: { nemesisMinionOf: { kind: "controller" } } },
                {
                  kind: "setAside",
                  player: { kind: "controller" },
                  filter: { nemesisMinionOf: { kind: "controller" } },
                },
              ],
            },
          },
          { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
        ],
      }),
    );
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
    const use: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: given.ids[0] as InstanceId,
      abilityId: searchAbility.ref.id,
      payment: [],
    };
    const after = settle(runWith(searchDeps, inPlay, use), undefined, searchDeps);

    const engaged = mustPlayer(after, p1).playArea.filter((id) => mustInstance(after, id).engagedWith === p1);
    expect(engaged.map((id) => mustInstance(after, id).cardId)).toEqual([NEMESIS_1.id]);
    // The other player's minion stays set aside: the query is per-player, not "any nemesis minion".
    expect(mustPlayer(after, p2).setAside.some((id) => mustInstance(after, id).cardId === NEMESIS_2.id)).toBe(true);
  });
});

// ---- §17.2 what defeated it -----------------------------------------------------------------------------------------

describe("§17.2 `characterDefeated`/`schemeDefeated`.sourceInstanceId: what defeated it, not just who", () => {
  /** "Response: After [your identity, or an event you play] defeats a minion or side scheme, add a counter." */
  const byCardAbility = stubAbility(
    "by-card.response",
    def({
      trigger: {
        kind: "response",
        forced: true,
        on: {
          on: ["characterDefeated", "schemeDefeated"],
          sourceIs: { categories: ["identity", "event"], owner: "you" },
        },
      },
      effects: [
        {
          kind: "addCounters",
          target: { kind: "identityOf", player: { kind: "controller" } },
          counterType: "byCard",
          amount: { kind: "const", value: 1 },
        },
      ],
    }),
  );
  /** The same response written the only way it could be written before: "after *you* defeat …" (any card you control). */
  const byPlayerAbility = stubAbility(
    "by-player.response",
    def({
      trigger: {
        kind: "response",
        forced: true,
        on: { on: ["characterDefeated", "schemeDefeated"], playerIs: "controller" },
      },
      effects: [
        {
          kind: "addCounters",
          target: { kind: "identityOf", player: { kind: "controller" } },
          counterType: "byPlayer",
          amount: { kind: "const", value: 1 },
        },
      ],
    }),
  );
  const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [byCardAbility.ref, byPlayerAbility.ref] });

  /** Test scaffolding, not a card: pulls one named encounter card out of the deck and puts it into play. */
  const summon = (name: string) =>
    stubAbility(
      `summon-${name}.action`,
      def({
        trigger: { kind: "action" },
        effects: [
          { kind: "selectCards", slot: "found", cards: { kind: "encounter", zones: ["deck"], filter: { name } } },
          { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
        ],
      }),
    );

  /** "Hero Action: Deal 3 damage to an enemy." — a card effect's own damage, sourced to the event card. */
  const boltAbility = stubAbility(
    "bolt.action",
    def({
      trigger: { kind: "action", form: "hero" },
      effects: [
        {
          kind: "dealDamage",
          target: { kind: "each", query: { categories: ["minion"] } },
          amount: { kind: "const", value: 3 },
        },
      ],
    }),
  );
  const BOLT = stubEvent({ id: "bolt", cost: 0, abilities: [boltAbility.ref] });
  /** "Hero Action: Remove 3 threat from a scheme." */
  const clueAbility = stubAbility(
    "clue.action",
    def({
      trigger: { kind: "action", form: "hero" },
      effects: [
        {
          kind: "removeThreat",
          target: { kind: "each", query: { categories: ["sideScheme"] } },
          amount: { kind: "const", value: 3 },
        },
      ],
    }),
  );
  const CLUE = stubEvent({ id: "clue", cost: 0, abilities: [clueAbility.ref] });

  const MINION = stubMinion({ id: "weakling", atk: 1, sch: 1, hp: 2, boostIcons: 0 });
  const SIDE = stubSideScheme({ id: "side", startingThreat: 2 });
  const ALLY_2 = stubAlly({ id: "ally2", cost: 0, atk: 2, thw: 2, hp: 3 });
  /** "When Revealed: Deal 3 damage to each ally." — a defeat the encounter side caused. */
  const nastyAbility = stubAbility(
    "nasty.when-revealed",
    def({
      trigger: { kind: "whenRevealed" },
      effects: [
        {
          kind: "dealDamage",
          target: { kind: "each", query: { categories: ["ally"] } },
          amount: { kind: "const", value: 3 },
        },
      ],
    }),
  );
  const NASTY = stubTreachery({ id: "nasty", boostIcons: 0, abilities: [nastyAbility.ref] });
  const summonMinion = summon(MINION.id);
  const summonSide = summon(SIDE.id);
  /** Test scaffolding: reveals the treachery out of the encounter deck, the way a villain phase would deal it. */
  const revealNasty = stubAbility(
    "reveal-nasty.action",
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "selectCards",
          slot: "found",
          cards: { kind: "encounter", zones: ["deck"], filter: { name: NASTY.id } },
        },
        { kind: "revealCard", cards: { kind: "slot", slot: "found" }, player: { kind: "controller" } },
      ],
    }),
  );
  const SUMMONER = stubSupport({
    id: "summoner",
    cost: 0,
    abilities: [summonMinion.ref, summonSide.ref, revealNasty.ref],
  });

  const deps = depsOf(
    byCardAbility,
    byPlayerAbility,
    boltAbility,
    clueAbility,
    summonMinion,
    summonSide,
    revealNasty,
    nastyAbility,
  );
  const counters = (state: GameState) => mustInstance(state, mustPlayer(state, p1).identity.instanceId).counters;

  /** A hero-form game with the watcher in play, a minion engaged and a side scheme in play. */
  function ready(extra: readonly CardId[] = []): { state: GameState; ids: readonly InstanceId[] } {
    const base = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [BLANK, WATCHER, SUMMONER, BOLT, CLUE, MINION, SIDE, ALLY_2, NASTY],
      deck: [
        ...copies(RESOURCE.id, 10),
        ...copies(WATCHER.id, 2),
        ...copies(SUMMONER.id, 2),
        ...copies(BOLT.id, 2),
        ...copies(CLUE.id, 2),
        ...copies(ALLY_2.id, 2),
      ],
      encounterDeck: [MINION.id, SIDE.id, NASTY.id, ...copies(BLANK.id, 13)],
      deps,
    });
    const hero = runWith(deps, base, toHero);
    const given = giveCards(hero, p1, WATCHER.id, SUMMONER.id, ...extra);
    const [watcherId, summonerId] = given.ids as readonly InstanceId[];
    let current = settle(runWith(deps, given.state, play(watcherId as InstanceId)), undefined, deps);
    current = settle(runWith(deps, current, play(summonerId as InstanceId)), undefined, deps);
    // The minion and the side scheme are put into play out of the encounter deck rather than dealt by a villain
    // phase, so this fixture has one encounter card in play and no shuffled-deck luck in it.
    for (const ability of [summonMinion, summonSide]) {
      const use: Command = {
        type: "useAbility",
        playerId: p1,
        cardInstanceId: summonerId as InstanceId,
        abilityId: ability.ref.id,
        payment: [],
      };
      current = settle(runWith(deps, current, use), undefined, deps);
    }
    return { state: current, ids: given.ids.slice(2) };
  }

  const summonerIdIn = (state: GameState) =>
    mustPlayer(state, p1).playArea.find((id) => mustInstance(state, id).cardId === SUMMONER.id) as InstanceId;
  const minionIn = (state: GameState) =>
    mustPlayer(state, p1).playArea.find((id) => mustInstance(state, id).cardId === MINION.id) as InstanceId;
  const sideIn = (state: GameState) =>
    state.villainArea.find((id) => mustInstance(state, id).cardId === SIDE.id) as InstanceId;

  it("a basic attack by your identity is a defeat by that card; an ally's attack is a defeat by the ally", () => {
    const { state } = ready([ALLY_2.id]);
    const minion = minionIn(state);
    expect(minion).toBeDefined();

    const byHero = settle(
      runWith(deps, state, {
        type: "basicAttack",
        playerId: p1,
        attackerInstanceId: mustPlayer(state, p1).identity.instanceId,
        targetInstanceId: minion,
        payment: [],
      }),
      undefined,
      deps,
    );
    expect(counters(byHero).byCard).toBe(1);
    expect(counters(byHero).byPlayer).toBe(1);

    // The same defeat, by an ally this player controls: still "you defeated it", no longer "this card defeated it".
    const allyCard = giveCards(state, p1, ALLY_2.id);
    const withAlly = settle(runWith(deps, allyCard.state, play(allyCard.ids[0] as InstanceId)), undefined, deps);
    const allyId = mustPlayer(withAlly, p1).playArea.find(
      (id) => mustInstance(withAlly, id).cardId === ALLY_2.id,
    ) as InstanceId;
    const byAlly = settle(
      runWith(deps, withAlly, {
        type: "basicAttack",
        playerId: p1,
        attackerInstanceId: allyId,
        targetInstanceId: minionIn(withAlly),
        payment: [],
      }),
      undefined,
      deps,
    );
    expect(counters(byAlly).byCard).toBeUndefined();
    expect(counters(byAlly).byPlayer).toBe(1);
  });

  it("an event's own damage is a defeat by that event card", () => {
    const { state, ids } = ready([BOLT.id]);
    const after = settle(runWith(deps, state, play(ids[0] as InstanceId)), undefined, deps);
    expect(mustPlayer(after, p1).playArea.some((id) => mustInstance(after, id).cardId === MINION.id)).toBe(false);
    expect(counters(after).byCard).toBe(1);
  });

  it("a side scheme's defeat records the thwarting character, or the card whose effect removed the threat", () => {
    const { state } = ready();
    const side = sideIn(state);
    expect(side).toBeDefined();
    const byThwart = settle(
      runWith(deps, state, {
        type: "basicThwart",
        playerId: p1,
        thwarterInstanceId: mustPlayer(state, p1).identity.instanceId,
        schemeInstanceId: side,
        payment: [],
      }),
      undefined,
      deps,
    );
    // Two basic thwarts of 2 THW each are not needed: the stub's side scheme starts at 2 threat.
    expect(counters(byThwart).byCard).toBe(1);
    expect(counters(byThwart).byPlayer).toBe(1);

    const withEvent = ready([CLUE.id]);
    const byEvent = settle(runWith(deps, withEvent.state, play(withEvent.ids[0] as InstanceId)), undefined, deps);
    expect(counters(byEvent).byCard).toBe(1);
  });

  it("a defeat the encounter side caused fires neither response: no defeating player, and an encounter card as the source", () => {
    const { state } = ready([ALLY_2.id]);
    const allyCard = giveCards(state, p1, ALLY_2.id);
    const withAlly = settle(runWith(deps, allyCard.state, play(allyCard.ids[0] as InstanceId)), undefined, deps);
    expect(mustPlayer(withAlly, p1).playArea.some((id) => mustInstance(withAlly, id).cardId === ALLY_2.id)).toBe(true);
    const use: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: summonerIdIn(withAlly),
      abilityId: revealNasty.ref.id,
      payment: [],
    };
    const after = settle(runWith(deps, withAlly, use), undefined, deps);
    expect(mustPlayer(after, p1).playArea.some((id) => mustInstance(after, id).cardId === ALLY_2.id)).toBe(false);
    expect(counters(after).byCard).toBeUndefined();
    expect(counters(after).byPlayer).toBeUndefined();
  });
});

// ---- §17.3 "your basic attacks gain piercing" ----------------------------------------------------------------------

describe("§17.3 `RuleSpec attackKeywords.basicOnly`: a keyword granted to basic attacks only", () => {
  const MINION = stubMinion({ id: "tough-minion", atk: 1, sch: 1, hp: 6, boostIcons: 0 });
  const summonMinion = stubAbility(
    "summon.action",
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "selectCards",
          slot: "found",
          cards: { kind: "encounter", zones: ["deck"], filter: { name: MINION.id } },
        },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
      ],
    }),
  );
  const SUMMONER = stubSupport({ id: "summoner-2", cost: 0, abilities: [summonMinion.ref] });

  /** "Hero Action (attack): Deal 2 damage to an enemy." — an attack an event makes, not a basic attack. */
  const swingAbility = stubAbility(
    "swing.action",
    def({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
      effects: [
        {
          kind: "attack",
          target: { kind: "each", query: { categories: ["minion"] } },
          amount: { kind: "const", value: 2 },
        },
      ],
    }),
  );
  const SWING = stubEvent({ id: "swing", cost: 0, abilities: [swingAbility.ref] });

  /** "While …, your basic attacks gain piercing." */
  const basicOnlyRule = stubAbility(
    "training.constant",
    def({
      trigger: {
        kind: "constant",
        rules: [{ kind: "attackKeywords", keywords: ["piercing"], attacker: { controller: "you" }, basicOnly: true }],
      },
      effects: [],
    }),
  );
  const TRAINING = stubUpgrade({ id: "training", cost: 0, abilities: [basicOnlyRule.ref] });
  /** The same rule without `basicOnly`: "your attacks gain piercing", which over-grants. */
  const anyAttackRule = stubAbility(
    "wide-training.constant",
    def({
      trigger: {
        kind: "constant",
        rules: [{ kind: "attackKeywords", keywords: ["piercing"], attacker: { controller: "you" } }],
      },
      effects: [],
    }),
  );
  const WIDE = stubUpgrade({ id: "wide-training", cost: 0, abilities: [anyAttackRule.ref] });
  /** "Basic attacks gain piercing" with no attacker filter at all: every basic attack in the game, nothing else. */
  const anyBasicRule = stubAbility(
    "field.constant",
    def({
      trigger: { kind: "constant", rules: [{ kind: "attackKeywords", keywords: ["piercing"], basicOnly: true }] },
      effects: [],
    }),
  );
  const FIELD = stubUpgrade({ id: "field", cost: 0, abilities: [anyBasicRule.ref] });

  const ALLY_3 = stubAlly({ id: "ally3", cost: 0, atk: 2, thw: 1, hp: 3 });
  const deps = depsOf(summonMinion, swingAbility, basicOnlyRule, anyAttackRule, anyBasicRule);

  /** Hero form, the named upgrade in play, the minion in play carrying a tough status card. */
  function ready(upgrade: string, extra: readonly CardId[] = []): { state: GameState; ids: readonly InstanceId[] } {
    const base = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [BLANK, MINION, SUMMONER, SWING, TRAINING, WIDE, FIELD, ALLY_3],
      deck: [
        ...copies(RESOURCE.id, 10),
        ...copies(SUMMONER.id, 2),
        ...copies(SWING.id, 2),
        ...copies(TRAINING.id, 2),
        ...copies(WIDE.id, 2),
        ...copies(FIELD.id, 2),
        ...copies(ALLY_3.id, 2),
      ],
      encounterDeck: [MINION.id, ...copies(BLANK.id, 15)],
      deps,
    });
    const hero = runWith(deps, base, toHero);
    const given = giveCards(hero, p1, SUMMONER.id, upgrade, ...extra);
    const [summonerId, upgradeId] = given.ids as readonly InstanceId[];
    let current = settle(runWith(deps, given.state, play(summonerId as InstanceId)), undefined, deps);
    current = settle(runWith(deps, current, play(upgradeId as InstanceId)), undefined, deps);
    const use: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: summonerId as InstanceId,
      abilityId: summonMinion.ref.id,
      payment: [],
    };
    current = settle(runWith(deps, current, use), undefined, deps);
    const minion = mustPlayer(current, p1).playArea.find(
      (id) => mustInstance(current, id).cardId === MINION.id,
    ) as InstanceId;
    // A tough status card is the only observable difference piercing makes (RRG 1.8 "Piercing", p. 32).
    const tough: GameState = {
      ...current,
      instances: {
        ...current.instances,
        [minion]: { ...mustInstance(current, minion), statuses: { stunned: 0, confused: 0, tough: 1 } },
      },
    };
    return { state: tough, ids: given.ids.slice(2) };
  }

  const minionIn = (state: GameState) =>
    mustPlayer(state, p1).playArea.find((id) => mustInstance(state, id).cardId === MINION.id) as InstanceId;
  const basicAttack = (state: GameState, attacker: InstanceId): Command => ({
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: attacker,
    targetInstanceId: minionIn(state),
    payment: [],
  });

  it("a basic attack gets the keyword and an attack made by an event does not", () => {
    const { state, ids } = ready(TRAINING.id, [SWING.id]);
    const minion = minionIn(state);

    const basic = settle(
      runWith(deps, state, basicAttack(state, mustPlayer(state, p1).identity.instanceId)),
      undefined,
      deps,
    );
    expect(mustInstance(basic, minion).statuses.tough).toBe(0);
    expect(mustInstance(basic, minion).damage).toBe(2);

    // The same player, the same attacker, the same target — but the attack is the event's, so the rule misses it and
    // the tough card absorbs the whole attack.
    const byEvent = settle(runWith(deps, state, play(ids[0] as InstanceId)), undefined, deps);
    expect(mustInstance(byEvent, minion).statuses.tough).toBe(0);
    expect(mustInstance(byEvent, minion).damage).toBe(0);
  });

  it("without `basicOnly` the same rule over-grants to the event's attack (the bug it exists to fix)", () => {
    const { state, ids } = ready(WIDE.id, [SWING.id]);
    const minion = minionIn(state);
    const byEvent = settle(runWith(deps, state, play(ids[0] as InstanceId)), undefined, deps);
    expect(mustInstance(byEvent, minion).statuses.tough).toBe(0);
    expect(mustInstance(byEvent, minion).damage).toBe(2);
  });

  it("an ally's basic attack is a basic attack; an enemy's activation never is", () => {
    const { state, ids } = ready(FIELD.id, [ALLY_3.id]);
    const withAlly = settle(runWith(deps, state, play(ids[0] as InstanceId)), undefined, deps);
    const allyId = mustPlayer(withAlly, p1).playArea.find(
      (id) => mustInstance(withAlly, id).cardId === ALLY_3.id,
    ) as InstanceId;
    const byAlly = settle(runWith(deps, withAlly, basicAttack(withAlly, allyId)), undefined, deps);
    expect(mustInstance(byAlly, minionIn(byAlly)).statuses.tough).toBe(0);
    expect(mustInstance(byAlly, minionIn(byAlly)).damage).toBe(2);

    // The villain's own attack is an enemy activation, not a basic attack, so this unfiltered rule cannot reach it:
    // the hero's tough status card survives it.
    const heroId = mustPlayer(withAlly, p1).identity.instanceId;
    const toughHero: GameState = {
      ...withAlly,
      instances: {
        ...withAlly.instances,
        [heroId]: { ...mustInstance(withAlly, heroId), statuses: { stunned: 0, confused: 0, tough: 1 } },
      },
    };
    const villainPhase = settle(runWith(deps, toughHero, endTurn), undefined, deps);
    expect(mustInstance(villainPhase, heroId).statuses.tough).toBe(0);
    // The villain's 2 was absorbed by the tough card and only the engaged minion's own 1 landed. With piercing the
    // villain's attack would have discarded the card first and dealt its 2 as well.
    expect(mustInstance(villainPhase, heroId).damage).toBe(1);
  });
});

// ---- §17.4 "+2 to that power for this use" --------------------------------------------------------------------------

describe("§17.4 `basicPowerUsing` + `modifyBasicPower`: a bonus to the basic power being used", () => {
  const STRONG_VILLAIN = stubVillain({ id: "strong-villain", stages: [{ hp: flat(40), atk: 5, sch: 0 }] });
  const MINION = stubMinion({ id: "target-minion", atk: 1, sch: 1, hp: 9, boostIcons: 0 });
  const SIDE = stubSideScheme({ id: "big-side", startingThreat: 9 });
  const ALLY_4 = stubAlly({ id: "ally4", cost: 0, atk: 2, thw: 2, hp: 3 });

  const summonMinion = stubAbility(
    "summon-target.action",
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "selectCards",
          slot: "found",
          cards: { kind: "encounter", zones: ["deck"], filter: { name: MINION.id } },
        },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
      ],
    }),
  );
  const summonSide = stubAbility(
    "summon-big-side.action",
    def({
      trigger: { kind: "action" },
      effects: [
        {
          kind: "selectCards",
          slot: "found",
          cards: { kind: "encounter", zones: ["deck"], filter: { name: SIDE.id } },
        },
        { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
      ],
    }),
  );
  const SUMMONER = stubSupport({ id: "summoner-3", cost: 0, abilities: [summonMinion.ref, summonSide.ref] });

  /** "Interrupt: When you use one of your hero's basic powers, get +2 to that power for this use." */
  const growthAbility = stubAbility(
    "growth.interrupt",
    def({
      trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing", playerIs: "controller" } },
      effects: [{ kind: "modifyBasicPower", amount: { kind: "const", value: 2 } }],
    }),
  );
  const GROWTH = stubUpgrade({ id: "growth", cost: 0, abilities: [growthAbility.ref] });
  /** The same effect with no basic power being used: "Hero Action: get +2 to that power" resolves into nothing. */
  const strayAbility = stubAbility(
    "stray.action",
    def({
      trigger: { kind: "action", form: "hero" },
      effects: [{ kind: "modifyBasicPower", amount: { kind: "const", value: 2 } }],
    }),
  );
  const STRAY = stubSupport({ id: "stray", cost: 0, abilities: [strayAbility.ref] });
  /** "Hero Action (attack): Deal 2 damage to an enemy." — an ability's attack, not a use of a basic power. */
  const swingAbility = stubAbility(
    "swing2.action",
    def({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
      effects: [
        {
          kind: "attack",
          target: { kind: "each", query: { categories: ["minion"] } },
          amount: { kind: "const", value: 2 },
        },
      ],
    }),
  );
  const SWING = stubEvent({ id: "swing2", cost: 0, abilities: [swingAbility.ref] });

  const deps = depsOf(summonMinion, summonSide, growthAbility, strayAbility, swingAbility);
  const heroOf = (state: GameState) => mustPlayer(state, p1).identity.instanceId;

  function ready(
    cards: readonly CardId[],
    options: { readonly villain?: typeof VILLAIN } = {},
  ): { state: GameState; ids: readonly InstanceId[] } {
    const base = newGame({
      villain: options.villain ?? VILLAIN,
      mainScheme: SCHEME,
      extraCards: [BLANK, MINION, SIDE, SUMMONER, GROWTH, STRAY, SWING, ALLY_4],
      deck: [
        ...copies(RESOURCE.id, 10),
        ...copies(SUMMONER.id, 2),
        ...copies(GROWTH.id, 2),
        ...copies(STRAY.id, 2),
        ...copies(SWING.id, 2),
        ...copies(ALLY_4.id, 2),
      ],
      encounterDeck: [MINION.id, SIDE.id, ...copies(BLANK.id, 14)],
      deps,
    });
    const hero = runWith(deps, base, toHero);
    const given = giveCards(hero, p1, SUMMONER.id, ...cards);
    const [summonerId] = given.ids as readonly InstanceId[];
    let current = settle(runWith(deps, given.state, play(summonerId as InstanceId)), undefined, deps);
    for (const id of given.ids.slice(1)) {
      if (mustInstance(current, id).cardId === SWING.id) continue; // an event: played by the test itself
      current = settle(runWith(deps, current, play(id)), undefined, deps);
    }
    for (const ability of [summonMinion, summonSide]) {
      const use: Command = {
        type: "useAbility",
        playerId: p1,
        cardInstanceId: summonerId as InstanceId,
        abilityId: ability.ref.id,
        payment: [],
      };
      current = settle(runWith(deps, current, use), undefined, deps);
    }
    return { state: current, ids: given.ids.slice(1) };
  }

  const minionIn = (state: GameState) =>
    mustPlayer(state, p1).playArea.find((id) => mustInstance(state, id).cardId === MINION.id) as InstanceId;
  const sideIn = (state: GameState) =>
    state.villainArea.find((id) => mustInstance(state, id).cardId === SIDE.id) as InstanceId;

  it("raises a basic attack (ATK 2 → 4) and expires with that attack", () => {
    const { state } = ready([GROWTH.id]);
    const minion = minionIn(state);
    const after = settle(
      runWith(deps, state, {
        type: "basicAttack",
        playerId: p1,
        attackerInstanceId: heroOf(state),
        targetInstanceId: minion,
        payment: [],
      }),
      undefined,
      deps,
    );
    expect(mustInstance(after, minion).damage).toBe(4);
    // "For this use": the modifier is gone with the attack it belonged to (RRG 1.8 "Lasting Effects", p. 26).
    expect(after.lastingEffects).toHaveLength(0);
  });

  it("raises a basic thwart (THW 2 → 4) from the same one ability", () => {
    const { state } = ready([GROWTH.id]);
    const side = sideIn(state);
    const after = settle(
      runWith(deps, state, {
        type: "basicThwart",
        playerId: p1,
        thwarterInstanceId: heroOf(state),
        schemeInstanceId: side,
        payment: [],
      }),
      undefined,
      deps,
    );
    expect(mustInstance(after, side).threat).toBe(5);
    expect(after.lastingEffects).toHaveLength(0);
  });

  it("raises a basic defense (DEF 2 → 4) against an attack of 5, and expires with that attack", () => {
    // The villain phase also has the engaged minion attack for 1, undefended (the hero is exhausted by the defense),
    // so the measure is the difference: 5 − (2 + 2) + 1 = 2 with the bonus, 5 − 2 + 1 = 4 without it.
    const defend = (cards: readonly CardId[]): GameState => {
      const { state } = ready(cards, { villain: STRONG_VILLAIN });
      const prompted = settleUntil(runWith(deps, state, endTurn), "declareDefender", deps);
      expect(prompted.pendingChoice?.prompt.kind).toBe("declareDefender");
      return settle(resolvePending(prompted, [heroOf(state)], deps), undefined, deps);
    };
    const withBonus = defend([GROWTH.id]);
    expect(mustInstance(withBonus, heroOf(withBonus)).damage).toBe(2);
    expect(withBonus.lastingEffects).toHaveLength(0);
    const without = defend([]);
    expect(mustInstance(without, heroOf(without)).damage).toBe(4);
  });

  it("lands on the character using the power, not on the hero: an ally's own basic attack", () => {
    const { state } = ready([GROWTH.id, ALLY_4.id]);
    const ally = mustPlayer(state, p1).playArea.find(
      (id) => mustInstance(state, id).cardId === ALLY_4.id,
    ) as InstanceId;
    const minion = minionIn(state);
    const after = settle(
      runWith(deps, state, {
        type: "basicAttack",
        playerId: p1,
        attackerInstanceId: ally,
        targetInstanceId: minion,
        payment: [],
      }),
      undefined,
      deps,
    );
    expect(mustInstance(after, minion).damage).toBe(4);
    // The hero, who used no power, is unchanged.
    expect(mustInstance(after, heroOf(after)).damage).toBe(0);
  });

  it("does not fire for an attack an ability makes: only a basic power is a basic power (RRG 1.8 p. 10)", () => {
    const { state, ids } = ready([GROWTH.id, SWING.id]);
    const swing = ids.find((id) => mustInstance(state, id).cardId === SWING.id) as InstanceId;
    const minion = minionIn(state);
    const after = settle(runWith(deps, state, play(swing)), undefined, deps);
    expect(mustInstance(after, minion).damage).toBe(2);
  });

  it("does nothing at all outside a basic-power use", () => {
    const { state } = ready([STRAY.id]);
    const stray = mustPlayer(state, p1).playArea.find(
      (id) => mustInstance(state, id).cardId === STRAY.id,
    ) as InstanceId;
    const use: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: stray,
      abilityId: strayAbility.ref.id,
      payment: [],
    };
    const after = settle(runWith(deps, state, use), undefined, deps);
    expect(after.lastingEffects).toHaveLength(0);
    const minion = minionIn(after);
    const attacked = settle(
      runWith(deps, after, {
        type: "basicAttack",
        playerId: p1,
        attackerInstanceId: heroOf(after),
        targetInstanceId: minion,
        payment: [],
      }),
      undefined,
      deps,
    );
    expect(mustInstance(attacked, minion).damage).toBe(2);
  });
});

// ---- §17.5 a constant trait grant whose condition asks about traits -------------------------------------------------

describe("§17.5 `traitsOf`: a constant trait grant conditional on a trait query", () => {
  const BIG = trait("BIG");
  const TAGGED = trait("TAGGED");
  const BIG_HERO = stubIdentity({
    id: "big-hero",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroTraits: [BIG],
  });

  /** "While you have the BIG trait, this card gains the TAGGED trait and gets +1 ATK." */
  const selfGrant = stubAbility(
    "mirror.constant",
    def({
      trigger: {
        kind: "constant",
        traitGrants: [
          {
            trait: TAGGED,
            target: { self: true },
            while: { kind: "hasTrait", of: { kind: "identityOf", player: { kind: "controller" } }, trait: BIG },
          },
        ],
        modifiers: [
          {
            stat: "atk",
            amount: 1,
            target: { self: true },
            while: { kind: "hasTrait", of: { kind: "identityOf", player: { kind: "controller" } }, trait: BIG },
          },
        ],
      },
      effects: [],
    }),
  );
  const MIRROR = stubAlly({ id: "mirror", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [selfGrant.ref] });

  /** Two grants, each conditional on the *other* card's trait: "While <the other> has TAGGED, this card gains TAGGED." */
  const pairGrant = (id: string, otherName: string) =>
    stubAbility(
      `${id}.constant`,
      def({
        trigger: {
          kind: "constant",
          traitGrants: [
            {
              trait: TAGGED,
              target: { self: true },
              while: { kind: "hasTrait", of: { kind: "named", name: otherName }, trait: TAGGED },
            },
          ],
        },
        effects: [],
      }),
    );
  const leftGrant = pairGrant("left", "right-card");
  const rightGrant = pairGrant("right", "left-card");
  const LEFT = stubSupport({ id: "left-card", cost: 0, abilities: [leftGrant.ref] });
  const RIGHT = stubSupport({ id: "right-card", cost: 0, abilities: [rightGrant.ref] });
  /** The same pair, but this one prints the trait the other's condition asks for. */
  const PRINTED = stubSupport({ id: "right-card", cost: 0, traits: [TAGGED], abilities: [rightGrant.ref] });

  const traitsFor = (state: GameState, deps: EngineDeps, id: InstanceId) => traitsOf(state, id, deps);

  function table(
    cards: readonly AnyCard[],
    abilities: readonly ReturnType<typeof stubAbility>[],
    hand: readonly CardId[],
  ): { state: GameState; deps: EngineDeps } {
    const deps = depsOf(...abilities);
    const base = newGame({
      identity: BIG_HERO,
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [BLANK, ...cards],
      deck: [...copies(RESOURCE.id, 10), ...cards.flatMap((card) => copies(card.id, 2))],
      encounterDeck: copies(BLANK.id, 16),
      deps,
    });
    const hero = runWith(deps, base, toHero);
    const given = giveCards(hero, p1, ...hand);
    let current = given.state;
    for (const id of given.ids) current = settle(runWith(deps, current, play(id)), undefined, deps);
    return { state: current, deps };
  }

  it("grants the trait instead of recursing forever (the condition reads printed traits)", () => {
    const { state, deps } = table([MIRROR], [selfGrant], [MIRROR.id]);
    const ally = mustPlayer(state, p1).playArea.find(
      (id) => mustInstance(state, id).cardId === MIRROR.id,
    ) as InstanceId;
    // Before the guard this threw `RangeError: Maximum call stack size exceeded` for *any* card on the board.
    expect(traitsFor(state, deps, ally)).toContain(TAGGED);
    expect(traitsFor(state, deps, mustPlayer(state, p1).identity.instanceId)).toContain(BIG);
    // The stat sibling of the same shape reaches the same scan and is equally safe.
    expect(characterProfile(state, ally, deps)?.atk).toBe(2);
  });

  it("stays live: the condition is re-read, so the grant stops when the trait goes away", () => {
    const { state, deps } = table([MIRROR], [selfGrant], [MIRROR.id]);
    const ally = mustPlayer(state, p1).playArea.find(
      (id) => mustInstance(state, id).cardId === MIRROR.id,
    ) as InstanceId;
    // In alter-ego form the identity's printed traits are the alter-ego face's, which do not include BIG.
    const nextRound = settle(runWith(deps, state, endTurn), undefined, deps);
    const alterEgo = settle(runWith(deps, nextRound, { type: "changeForm", playerId: p1 }), undefined, deps);
    expect(traitsFor(alterEgo, deps, ally)).not.toContain(TAGGED);
    expect(characterProfile(alterEgo, ally, deps)?.atk).toBe(1);
  });

  it("two grants that depend on each other terminate, and neither fires", () => {
    const { state, deps } = table([LEFT, RIGHT], [leftGrant, rightGrant], [LEFT.id, RIGHT.id]);
    const left = mustPlayer(state, p1).playArea.find((id) => mustInstance(state, id).cardId === LEFT.id) as InstanceId;
    const right = mustPlayer(state, p1).playArea.find(
      (id) => mustInstance(state, id).cardId === RIGHT.id,
    ) as InstanceId;
    expect(traitsFor(state, deps, left)).not.toContain(TAGGED);
    expect(traitsFor(state, deps, right)).not.toContain(TAGGED);
  });

  it("one printed trait breaks the tie in one direction only, whichever card is asked about first", () => {
    const { state, deps } = table([LEFT, PRINTED], [leftGrant, rightGrant], [LEFT.id, PRINTED.id]);
    const left = mustPlayer(state, p1).playArea.find((id) => mustInstance(state, id).cardId === LEFT.id) as InstanceId;
    const right = mustPlayer(state, p1).playArea.find(
      (id) => mustInstance(state, id).cardId === PRINTED.id,
    ) as InstanceId;
    // The left card's condition sees the right card's *printed* trait, so it gains it; the right card's condition
    // sees only the left card's granted one, which a condition never reads, so it does not gain it twice over.
    expect(traitsFor(state, deps, left)).toContain(TAGGED);
    expect(traitsFor(state, deps, right)).toContain(TAGGED);
    // Asking in the other order gives the same answer: no result depends on which card is visited first.
    expect(traitsFor(state, deps, right).filter((t) => t === TAGGED)).toHaveLength(1);
  });
});
