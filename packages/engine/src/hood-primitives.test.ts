/**
 * docs/phase7-wave4.md §3.50+ (The Hood's own primitives), on synthetic cards shaped like the printed ones.
 *
 * - §3.50 A nemesis set with one minion and no parenthetical: that minion is the nemesis minion (RRG 1.8 "Nemesis
 *   Encounter Set", p. 30). Seek and Destroy (`hood` 24031) against any Core hero.
 * - §3.51 `enemyAttack.keywords`: "The villain attacks you. That attack gains overkill" (Total Annihilation, 24054).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { matchesQuery, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubIdentity, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { ALLY, DEFAULT_CARDS, DEFAULT_DECK, defaultPick, MAIN_SCHEME, settle, VILLAIN } from "./testing/scenario.js";
import { gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay } from "./testing/wave3.js";

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
