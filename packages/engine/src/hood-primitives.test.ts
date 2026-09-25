/**
 * docs/phase7-wave4.md §3.50+ (The Hood's own primitives), on synthetic cards shaped like the printed ones.
 *
 * - §3.50 A nemesis set with one minion and no parenthetical: that minion is the nemesis minion (RRG 1.8 "Nemesis
 *   Encounter Set", p. 30). Seek and Destroy (`hood` 24031) against any Core hero.
 * - §3.51 `enemyAttack.keywords`: "The villain attacks you. That attack gains overkill" (Total Annihilation, 24054).
 * - §3.52 `increaseDamage` and the steady-aware `hasStatus.active` (Beast Mode, Controller).
 * - §3.53 `KeywordGrantSpec.value` (Mandrill's retaliate X).
 * - §3.54 `repeatWhile`, and a card's own damage reporting the defeat it caused (Out for Blood).
 * - §3.56 `resolveSpecials.trigger: "whenRevealed"`: printed abilities only by default (Citywide Crisis, §4 Q23, user
 *   decision 2026-09-25), incite and surge too with `includeKeywords`.
 * - §3.57 `RuleSpec gainsIcon` (Secret Lair).
 * - §3.59 `putIntoPlay.bind` (Crime Pays).
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { hasKeyword, keywordTotal } from "./keywords.js";
import { mustInstance, mustPlayer } from "./query.js";
import { REPEAT_LIMIT } from "./resolve/apply-effect.js";
import { matchesQuery, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubEnvironment,
  stubIdentity,
  stubMinion,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY, DEFAULT_CARDS, DEFAULT_DECK, defaultPick, MAIN_SCHEME, settle, VILLAIN } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const context = (deps: EngineDeps): EffectContext => ({
  selfInstanceId: null,
  controllerId: p1,
  event: null,
  bindings: {},
  deps,
});

describe("§3.50 a nemesis set's only minion is its nemesis minion", () => {
  const SOLO = stubIdentity({
    id: "solo",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  /** The only minion of "solo-nemesis", printing no parenthetical (every Core nemesis set: Vulture, Whiplash, …). */
  const LONE = stubMinion({ id: "lone", atk: 1, sch: 1, hp: 3, encounterSetIds: ["solo-nemesis"] });
  const deps = depsOf();

  function table(extra: readonly ReturnType<typeof stubMinion>[] = []): GameState {
    const result = createGame(
      {
        seed: 3,
        cards: [...DEFAULT_CARDS, SOLO, LONE, ...extra],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: [],
        players: [{ identityCardId: SOLO.id, deck: DEFAULT_DECK }],
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    return settle(result.state, undefined, deps);
  }
  const loneIds = (state: GameState) =>
    Object.values(state.instances)
      .filter((i) => i.cardId === LONE.id)
      .map((i) => i.instanceId);

  it("matches the lone unflagged minion of the player's own nemesis set", () => {
    const state = table();
    const [lone] = loneIds(state);
    expect(mustPlayer(state, p1).setAside).toContain(lone);
    expect(matchesQuery(state, lone!, { nemesisMinionOf: { kind: "controller" } }, context(deps))).toBe(true);
  });

  it("with a second unflagged minion in the set, neither is 'the' nemesis minion", () => {
    const SECOND = stubMinion({ id: "second", atk: 1, sch: 1, hp: 3, encounterSetIds: ["solo-nemesis"] });
    const state = table([SECOND]);
    const [lone] = loneIds(state);
    expect(matchesQuery(state, lone!, { nemesisMinionOf: { kind: "controller" } }, context(deps))).toBe(false);
  });
});

describe("§3.51 an attack an effect initiates carries its own keywords", () => {
  const TOTAL = stubAbility("total.when-revealed", {
    trigger: { kind: "whenRevealed" },
    effects: [
      {
        kind: "enemyAttack",
        enemies: { kind: "villain" },
        against: { kind: "controller" },
        keywords: ["overkill"],
      },
    ],
  });
  const PLAIN = stubAbility("plain.when-revealed", {
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "controller" } }],
  });
  const TOTAL_CARD = stubTreachery({ id: "total", boostIcons: 0, abilities: [TOTAL.ref] });
  const PLAIN_CARD = stubTreachery({ id: "plain", boostIcons: 0, abilities: [PLAIN.ref] });
  const BLANK = stubTreachery({ id: "blank-boost", boostIcons: 0 });
  /** ATK 4 and a dashed SCH: its activation is an attack, and nothing else places threat. */
  const HITTER = stubVillain({ id: "hitter", stages: [{ hp: flat(30), atk: 4, sch: 0 }] });
  const deps = depsOf(TOTAL, PLAIN);

  /** p1 in hero form, the ally (3 hit points) in play, `card` P1's encounter card this villain phase. */
  function villainPhase(card: typeof TOTAL_CARD) {
    const base = gameAtFirstTurn({
      cards: [TOTAL_CARD, PLAIN_CARD, BLANK, HITTER],
      deps,
      villain: HITTER,
      encounter: [TOTAL_CARD.id, PLAIN_CARD.id, ...Array.from({ length: 8 }, () => BLANK.id)],
    });
    const heroes: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    const ally = playerCardIntoPlay(heroes, ALLY.id);
    // Deck top: the activation's boost card, then `card` (dealt to p1), then the treachery attack's boost card.
    const staged = onTopOfEncounterDeck(onTopOfEncounterDeck(ally.state, card.id), BLANK.id);
    let asked = 0;
    // Decline the activation attack; defend the treachery's attack with the ally.
    const pick = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "declareDefender"
        ? [asked++ === 0 ? "decline" : ally.id]
        : defaultPick(state);
    const { session, events } = driveSession(startSession(staged), deps, [{ type: "endTurn", playerId: P1 }], pick);
    return { session, events, ally: ally.id };
  }
  const spills = (events: readonly GameEvent[]) =>
    events.flatMap((e) => (e.type === "overkillSpilled" ? [e.amount] : []));

  it("'that attack gains overkill': 4 damage against a 3-hit-point defending ally spills 1 onto the hero", () => {
    const { session, events, ally } = villainPhase(TOTAL_CARD);
    expect(spills(events)).toEqual([1]);
    const identity = mustPlayer(session.state, P1).identity.instanceId;
    // 4 from the undefended activation attack, then the 1 overkill.
    expect(mustInstance(session.state, identity).damage).toBe(5);
    expect(mustPlayer(session.state, P1).discard).toContain(ally as InstanceId);
  });

  it("without the keyword the excess is lost", () => {
    const { session, events } = villainPhase(PLAIN_CARD);
    expect(spills(events)).toEqual([]);
    expect(mustInstance(session.state, mustPlayer(session.state, P1).identity.instanceId).damage).toBe(4);
  });

  it("replays to the same state", () => {
    const { session } = villainPhase(TOTAL_CARD);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

// ---- §3.52-§3.59 -------------------------------------------------------------------------------------------------

/** p1 in hero form at the first turn, `card` on top of the encounter deck behind a blank boost card. */
function heroTable(
  cards: readonly AnyCard[],
  deps: EngineDeps,
  villain = QUIET_HITTER,
  encounter?: readonly CardId[],
): GameState {
  const base = gameAtFirstTurn({
    cards: [...cards, BLANK_BOOST, villain],
    deps,
    villain,
    encounter: encounter ?? Array.from({ length: 12 }, () => BLANK_BOOST.id),
  });
  return {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
}
const BLANK_BOOST = stubTreachery({ id: "blank-boost-2", boostIcons: 0 });
/** ATK 2, SCH dashed: its activation attacks; nothing else places threat. */
const QUIET_HITTER = stubVillain({ id: "quiet-hitter", stages: [{ hp: flat(30), atk: 2, sch: 0 }] });
const endTurnP1 = { type: "endTurn", playerId: P1 } as const;
const run = (state: GameState, deps: EngineDeps, pick = defaultPick) =>
  driveSession(startSession(state), deps, [endTurnP1], pick);
const identityId = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const inVillainArea = (state: GameState, card: CardId, threat = 0): { state: GameState; id: InstanceId } =>
  encounterCardInVillainArea(state, card, threat);

describe("§3.52 increaseDamage and a steady-aware status predicate", () => {
  /** "When a stunned or confused friendly character would take any amount of damage, increase that amount by 2." */
  const MODE = stubAbility("mode.forced-interrupt", {
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "dealDamage", targetIs: { categories: ["identity", "ally"] } },
    },
    effects: [
      {
        kind: "if",
        condition: {
          kind: "or",
          of: [
            { kind: "hasStatus", of: { kind: "eventTarget" }, status: "stunned", active: true },
            { kind: "hasStatus", of: { kind: "eventTarget" }, status: "confused", active: true },
          ],
        },
        then: [{ kind: "increaseDamage", amount: { kind: "const", value: 2 } }],
      },
    ],
  });
  const MODE_CARD = stubEnvironment({ id: "mode", abilities: [MODE.ref] });
  const STEADY = stubAbility("steady.constant", {
    trigger: {
      kind: "constant",
      keywordGrants: [{ keyword: { name: "steady" }, target: { categories: ["identity"] } }],
    },
    effects: [],
  });
  const STEADY_CARD = stubEnvironment({ id: "steady-env", abilities: [STEADY.ref] });
  const deps = depsOf(MODE, STEADY);

  function attacked(stunCards: number, steady: boolean) {
    let state = heroTable([MODE_CARD, STEADY_CARD], deps, QUIET_HITTER, [
      MODE_CARD.id,
      STEADY_CARD.id,
      ...Array.from({ length: 10 }, () => BLANK_BOOST.id),
    ]);
    state = inVillainArea(state, MODE_CARD.id).state;
    if (steady) state = inVillainArea(state, STEADY_CARD.id).state;
    const id = identityId(state);
    state = {
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, statuses: { stunned: stunCards, confused: 0, tough: 0 } },
      },
    };
    return run(state, deps);
  }

  it("a stunned hero takes the villain's 2 plus 2, from the same source", () => {
    const { session, events } = attacked(1, false);
    expect(events.filter((e) => e.type === "damageIncreased")).toEqual([
      { type: "damageIncreased", targetInstanceId: identityId(session.state), amount: 2 },
    ]);
    const dealt = events.flatMap((e) => (e.type === "damageDealt" ? [e] : []));
    expect(dealt).toEqual([
      {
        type: "damageDealt",
        targetInstanceId: identityId(session.state),
        amount: 4,
        sourceInstanceId: session.state.villains[0]!.instanceId,
      },
    ]);
  });

  it("no status, no increase", () => {
    const { session } = attacked(0, false);
    expect(mustInstance(session.state, identityId(session.state)).damage).toBe(2);
  });

  it("with steady, one stun card is not stunned (RRG 1.8 'Steady', p. 41); two are", () => {
    expect(mustInstance(attacked(1, true).session.state, identityId(attacked(1, true).session.state)).damage).toBe(2);
    const two = attacked(2, true).session.state;
    expect(mustInstance(two, identityId(two)).damage).toBe(4);
  });
});

describe("§3.53 a granted keyword's live value", () => {
  const GRANT = stubAbility("x.constant", {
    trigger: {
      kind: "constant",
      keywordGrants: [
        {
          keyword: { name: "retaliate", value: 0 },
          target: { categories: ["villain"] },
          value: { kind: "count", query: { categories: ["minion"] } },
        },
      ],
    },
    effects: [],
  });
  const GRANTER = stubEnvironment({ id: "granter", abilities: [GRANT.ref] });
  const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 3 });
  const deps = depsOf(GRANT);

  it("retaliate X is the number of minions in play, and nothing at 0", () => {
    let state = heroTable([GRANTER, GOON], deps, QUIET_HITTER, [
      GRANTER.id,
      GOON.id,
      GOON.id,
      ...Array.from({ length: 8 }, () => BLANK_BOOST.id),
    ]);
    state = inVillainArea(state, GRANTER.id).state;
    const villain = state.villains[0]!.instanceId;
    expect(hasKeyword(state, villain, "retaliate", deps)).toBe(false);
    state = minionEngagedWith(state, GOON.id).state;
    expect(keywordTotal(state, villain, "retaliate", deps)).toBe(1);
    state = minionEngagedWith(state, GOON.id).state;
    expect(keywordTotal(state, villain, "retaliate", deps)).toBe(2);
  });
});

describe("§3.54 repeatWhile, and a card's own damage reporting a defeat", () => {
  /** "Deal 1 damage to the friendly character with the fewest remaining hit points; if defeated, repeat." */
  const BLOOD = stubAbility("blood.when-revealed", {
    trigger: { kind: "whenRevealed" },
    effects: [
      {
        kind: "repeatWhile",
        while: { kind: "varAtLeast", name: "hit.defeated", amount: 1 },
        effects: [
          {
            kind: "dealDamage",
            target: {
              kind: "superlative",
              among: { kind: "each", query: { categories: ["identity", "ally"] } },
              order: "lowest",
              measure: { kind: "remainingHp", of: { kind: "slot", slot: "candidate" } },
              ties: "first",
            },
            amount: { kind: "const", value: 1 },
            bind: "hit",
          },
        ],
      },
    ],
  });
  const BLOOD_CARD = stubTreachery({ id: "blood", boostIcons: 0, abilities: [BLOOD.ref] });
  /** A runaway repeat: always true. Places 1 threat on its own side scheme each time. */
  const FOREVER = stubAbility("forever.when-revealed", {
    trigger: { kind: "whenRevealed" },
    effects: [
      {
        kind: "repeatWhile",
        while: { kind: "not", of: { kind: "exists", query: { name: "no such card" } } },
        effects: [{ kind: "placeThreat", target: { kind: "self" }, amount: { kind: "const", value: 1 } }],
      },
    ],
  });
  const FOREVER_CARD = stubSideScheme({ id: "forever", startingThreat: 0, boostIcons: 0, abilities: [FOREVER.ref] });
  const deps = depsOf(BLOOD, FOREVER);

  it("two allies at 1 remaining are defeated in turn, then the hero takes 1 and it stops", () => {
    let state = heroTable([BLOOD_CARD, FOREVER_CARD], deps, QUIET_HITTER, [
      BLANK_BOOST.id,
      BLOOD_CARD.id,
      ...Array.from({ length: 10 }, () => BLANK_BOOST.id),
    ]);
    const a = playerCardIntoPlay(state, ALLY.id);
    const b = playerCardIntoPlay(a.state, ALLY.id);
    state = b.state;
    for (const id of [a.id, b.id])
      state = { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, damage: 2 } } };
    state = onTopOfEncounterDeck(onTopOfEncounterDeck(state, BLOOD_CARD.id), BLANK_BOOST.id);
    const { session, events } = run(state, deps);
    const blood = Object.values(session.state.instances).find((i) => i.cardId === BLOOD_CARD.id)!.instanceId;
    const hits = events.flatMap((e) =>
      e.type === "damageDealt" && e.sourceInstanceId === blood ? [e.targetInstanceId] : [],
    );
    expect(hits).toEqual([a.id, b.id, identityId(state)]);
    expect(mustPlayer(session.state, P1).discard).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it(`stops after ${REPEAT_LIMIT} repetitions of a condition that never fails`, () => {
    let state = heroTable([BLOOD_CARD, FOREVER_CARD], deps, QUIET_HITTER, [
      BLANK_BOOST.id,
      FOREVER_CARD.id,
      ...Array.from({ length: 10 }, () => BLANK_BOOST.id),
    ]);
    state = onTopOfEncounterDeck(onTopOfEncounterDeck(state, FOREVER_CARD.id), BLANK_BOOST.id);
    const { session } = run(state, deps);
    const scheme = Object.values(session.state.instances).find((i) => i.cardId === FOREVER_CARD.id)!;
    expect(scheme.threat).toBe(REPEAT_LIMIT);
  });
});

describe("§3.56 resolving a card's When Revealed abilities on demand", () => {
  /** A side scheme: When Revealed: place 1 threat here. Incite 2, surge. */
  const OWN = stubAbility("own.when-revealed", {
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "placeThreat", target: { kind: "self" }, amount: { kind: "const", value: 1 } }],
  });
  const LOUD = stubSideScheme({
    id: "loud",
    startingThreat: 0,
    boostIcons: 0,
    keywords: [{ name: "incite", value: 2 }, { name: "surge" }],
    abilities: [OWN.ref],
  });
  const MUTE = stubSideScheme({ id: "mute", startingThreat: 0, boostIcons: 0 });
  /** Incite 2 and surge, and no printed When Revealed. */
  const KEYWORDS_ONLY = stubSideScheme({
    id: "keywords-only",
    startingThreat: 0,
    boostIcons: 0,
    keywords: [{ name: "incite", value: 2 }, { name: "surge" }],
  });
  /** "Resolve each 'When Revealed' ability on each side scheme in play. If none was resolved, place 5 threat on the main scheme." */
  const crisis = (id: string, includeKeywords: boolean) =>
    stubAbility(id, {
      trigger: { kind: "whenRevealed" },
      effects: [
        {
          kind: "resolveSpecials",
          of: { kind: "each", query: { categories: ["sideScheme"] } },
          trigger: "whenRevealed",
          ...(includeKeywords ? { includeKeywords: true } : {}),
          bind: "r",
        },
        {
          kind: "if",
          condition: { kind: "not", of: { kind: "varAtLeast", name: "r.count", amount: 1 } },
          then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 5 } }],
        },
      ],
    });
  /** Citywide Crisis as the user reads it (§4 Q23): printed When Revealed abilities only. */
  const CRISIS = crisis("crisis.when-revealed", false);
  const CRISIS_CARD = stubTreachery({ id: "crisis", boostIcons: 0, abilities: [CRISIS.ref] });
  /** The same with `includeKeywords`: incite and surge as RRG 1.8's "equivalent to … 'When Revealed'" wording has it. */
  const WIDE = crisis("wide.when-revealed", true);
  const WIDE_CARD = stubTreachery({ id: "wide", boostIcons: 0, abilities: [WIDE.ref] });
  const deps = depsOf(OWN, CRISIS, WIDE);

  function reveal(scheme: typeof LOUD, card: typeof CRISIS_CARD = CRISIS_CARD) {
    let state = heroTable([LOUD, MUTE, KEYWORDS_ONLY, CRISIS_CARD, WIDE_CARD], deps, QUIET_HITTER, [
      scheme.id,
      card.id,
      ...Array.from({ length: 10 }, () => BLANK_BOOST.id),
    ]);
    const placed = inVillainArea(state, scheme.id);
    state = onTopOfEncounterDeck(onTopOfEncounterDeck(placed.state, card.id), BLANK_BOOST.id);
    return { ...run(state, deps), scheme: placed.id };
  }
  const idOf = (state: GameState, card: typeof CRISIS_CARD) =>
    Object.values(state.instances).find((i) => i.cardId === card.id)!.instanceId;
  const threatOn = (events: readonly GameEvent[], scheme: InstanceId) =>
    events.flatMap((e) =>
      e.type === "threatPlaced" && e.schemeInstanceId === scheme ? [[e.amount, e.sourceInstanceId]] : [],
    );

  it("default (Citywide Crisis, §4 Q23): only the printed ability resolves — no incite, no surge; no fallback", () => {
    const { session, events, scheme } = reveal(LOUD);
    const main = session.state.mainScheme.instanceId;
    expect(threatOn(events, scheme)).toEqual([[1, scheme]]);
    // Step one's acceleration only: no incite 2, and the printed ability counted, so no fallback 5.
    expect(threatOn(events, main)).toEqual([[1, null]]);
    // Crisis only: no surge.
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(1);
  });

  it("default: a side scheme with only incite and surge resolves nothing, so the fallback places 5", () => {
    const { session, events, scheme } = reveal(KEYWORDS_ONLY);
    expect(threatOn(events, scheme)).toEqual([]);
    expect(threatOn(events, session.state.mainScheme.instanceId)).toEqual([
      [1, null],
      [5, idOf(session.state, CRISIS_CARD)],
    ]);
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(1);
  });

  it("includeKeywords: the side scheme's own ability, its incite 2 and its surge all resolve; no fallback threat", () => {
    const { session, events, scheme } = reveal(LOUD, WIDE_CARD);
    const main = session.state.mainScheme.instanceId;
    expect(threatOn(events, scheme)).toEqual([[1, scheme]]);
    // Step one's acceleration (source null), then the side scheme's incite 2; never the fallback 5.
    expect(threatOn(events, main)).toEqual([
      [1, null],
      [2, scheme],
    ]);
    // Crisis, then the surge's card.
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(2);
  });

  it("includeKeywords: incite and surge alone count as abilities resolved, so no fallback", () => {
    const { session, events, scheme } = reveal(KEYWORDS_ONLY, WIDE_CARD);
    expect(threatOn(events, session.state.mainScheme.instanceId)).toEqual([
      [1, null],
      [2, scheme],
    ]);
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(2);
  });

  it("with nothing to resolve, the fallback places 5", () => {
    const { session, events } = reveal(MUTE);
    expect(threatOn(events, session.state.mainScheme.instanceId)).toEqual([
      [1, null],
      [5, idOf(session.state, CRISIS_CARD)],
    ]);
  });
});

describe("§3.57 icons gained from constant abilities", () => {
  const LAIR = stubAbility("lair.constant", {
    trigger: {
      kind: "constant",
      rules: [{ kind: "gainsIcon", icon: "acceleration", target: { categories: ["enemy"] } }],
    },
    effects: [],
  });
  const LAIR_CARD = stubEnvironment({ id: "lair", abilities: [LAIR.ref] });
  const BLOCK = stubAbility("block.constant", {
    trigger: { kind: "constant", rules: [{ kind: "gainsIcon", icon: "crisis", target: { self: true } }] },
    effects: [],
  });
  const BLOCK_CARD = stubEnvironment({ id: "block", abilities: [BLOCK.ref] });
  const GOON = stubMinion({ id: "goon-2", atk: 1, sch: 1, hp: 3 });
  const deps = depsOf(LAIR, BLOCK);
  const table = () =>
    heroTable([LAIR_CARD, BLOCK_CARD, GOON], deps, QUIET_HITTER, [
      LAIR_CARD.id,
      BLOCK_CARD.id,
      GOON.id,
      ...Array.from({ length: 10 }, () => BLANK_BOOST.id),
    ]);
  const stepOne = (events: readonly GameEvent[], main: InstanceId) =>
    events.flatMap((e) =>
      e.type === "threatPlaced" && e.schemeInstanceId === main && e.sourceInstanceId === null ? [e.amount] : [],
    );

  it("step one places the stage's 1 plus 1 per enemy (the villain and one minion)", () => {
    const withGoon = minionEngagedWith(inVillainArea(table(), LAIR_CARD.id).state, GOON.id).state;
    const { events, session } = run(withGoon, deps);
    expect(stepOne(events, session.state.mainScheme.instanceId)).toEqual([3]);
  });

  it("the villain phase audit agrees (the granted icons are counted there too)", () => {
    const withGoon = minionEngagedWith(inVillainArea(table(), LAIR_CARD.id).state, GOON.id).state;
    const { session } = run(withGoon, deps);
    const audit = auditVillainPhases(session.log, deps);
    expect(audit.violations).toEqual([]);
  });

  it("a gained crisis icon stops a thwart of the main scheme", () => {
    const state = inVillainArea(table(), BLOCK_CARD.id).state;
    const scheme = state.mainScheme.instanceId;
    const withThreat = {
      ...state,
      instances: { ...state.instances, [scheme]: { ...state.instances[scheme]!, threat: 3 } },
    };
    const result = applyCommand(
      withThreat,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: identityId(withThreat), schemeInstanceId: scheme },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});

describe("§3.59 putIntoPlay reports what entered", () => {
  /** "Put the first minion in the encounter deck into play; if no minion was put into play this way, surge." */
  const PAYS = stubAbility("pays.when-revealed", {
    trigger: { kind: "whenRevealed" },
    effects: [
      {
        kind: "selectCards",
        slot: "m",
        cards: {
          kind: "atMost",
          count: { kind: "const", value: 1 },
          of: { kind: "encounter", zones: ["deck"], filter: { categories: ["minion"] } },
        },
      },
      { kind: "putIntoPlay", card: { kind: "slot", slot: "m" }, controller: { kind: "controller" }, bind: "p" },
      {
        kind: "if",
        condition: { kind: "not", of: { kind: "varAtLeast", name: "p.count", amount: 1 } },
        then: [{ kind: "gainSurge" }],
      },
    ],
  });
  const PAYS_CARD = stubTreachery({ id: "pays", boostIcons: 0, abilities: [PAYS.ref] });
  const BOSS = { ...stubMinion({ id: "boss", atk: 1, sch: 1, hp: 3 }), unique: true };
  const deps = depsOf(PAYS);

  function reveal(bossInPlay: boolean) {
    let state = heroTable([PAYS_CARD, BOSS], deps, QUIET_HITTER, [
      PAYS_CARD.id,
      BOSS.id,
      BOSS.id,
      ...Array.from({ length: 10 }, () => BLANK_BOOST.id),
    ]);
    if (bossInPlay) state = minionEngagedWith(state, BOSS.id).state;
    state = onTopOfEncounterDeck(onTopOfEncounterDeck(state, PAYS_CARD.id), BLANK_BOOST.id);
    return run(state, deps);
  }

  it("a minion that enters counts: no surge", () => {
    const { events } = reveal(false);
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(1);
  });

  it("a unique minion turned away by the unique rule did not enter: surge", () => {
    const { events } = reveal(true);
    expect(events.some((e) => e.type === "uniqueEntryBlocked")).toBe(true);
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(2);
  });
});
