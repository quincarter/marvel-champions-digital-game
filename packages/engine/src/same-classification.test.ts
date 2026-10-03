/**
 * docs/phase7-wave6.md §3.51: "If Touched is attached to a friendly character, search its owner's discard pile for an
 * event that belong's to the same classification as that character (identity-specific, aspect, or basic) → add that
 * event to your hand." (Superpower Adaptation, `rogue` 38009), as `TargetQuery.sameClassificationAs`, proven with a
 * synthetic "charm" upgrade shaped like Touched (38002).
 *
 * RRG 1.8 "Classifications" (p. 12) and "Identity-Specific Card" (p. 23: "Identity cards are identity-specific
 * cards"). Owner decision §4.1 Q29 (the default): the five aspects are one "aspect" classification; an aspect ally
 * finds any aspect event, a basic ally a basic event, a hero an identity-specific event, all in that character's
 * owner's discard pile.
 *
 * The second half pins the host-type reads Rogue's cards share with it (§3.58: "If Touched is attached to a: Minion /
 * Villain / Ally / Hero" is `refMatches(host, { categories })`): live in a constant `while` and in an `if`, hero and
 * alter-ego told apart by the host's current form, a villain apart from a minion, another player's ally an ally.
 *
 * Synthetic cards only; the engine never names a card.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand, replay, sessionApply, startSession } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { keywordsOf } from "./keywords.js";
import { mustInstance, mustPlayer } from "./query.js";
import { classificationsOf, explainQuery, selectTargets, type EffectContext } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec, Predicate, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard } from "./testing/scenario.js";
import { minionEngagedWith, playerCardIntoPlay } from "./testing/wave3.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

const ROGUE = stubIdentity({
  id: "rogue",
  hp: 10,
  atk: 1,
  thw: 1,
  def: 1,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});
const BUDDY = stubIdentity({
  id: "buddy",
  hp: 10,
  atk: 1,
  thw: 1,
  def: 1,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});

/** The host-type reads: what the charm gives Rogue, by what it is attached to (Touched's four lines' shape). */
const hostIs = (categories: TargetQuery["categories"]): Predicate => ({
  kind: "refMatches",
  ref: { kind: "host" },
  query: { categories: categories! },
});
const ROGUE_ONLY: TargetQuery = { categories: ["identity"], printedId: ROGUE.id };
const CHARM_TEXT = stubAbility("charm.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [
      { keyword: { name: "overkill" }, target: ROGUE_ONLY, while: hostIs(["minion"]) },
      { keyword: { name: "retaliate", value: 1 }, target: ROGUE_ONLY, while: hostIs(["villain"]) },
      { keyword: { name: "steady" }, target: ROGUE_ONLY, while: hostIs(["ally"]) },
      { keyword: { name: "stalwart" }, target: ROGUE_ONLY, while: hostIs(["hero"]) },
    ],
  },
  effects: [],
});
const CHARM = stubUpgrade({ id: "charm", cost: 0, abilities: [CHARM_TEXT.ref] });
const CHARM_QUERY: TargetQuery = { categories: ["upgrade"], name: "charm" };
const THE_CHARM: TargetRef = { kind: "each", query: CHARM_QUERY };
/** "The character Touched is attached to", read from a card that is not the charm (Superpower Adaptation). */
const CHARMED: TargetRef = { kind: "each", query: { categories: ["character"], hasAttachment: CHARM_QUERY } };

// Events waiting in discard piles, one per classification.
const EV_ROGUE = stubEvent({ id: "ev-rogue", cost: 0, aspect: "hero:rogue" });
const EV_BUDDY = stubEvent({ id: "ev-buddy", cost: 0, aspect: "hero:buddy" });
const EV_AGGRESSION = stubEvent({ id: "ev-aggression", cost: 0, aspect: "aggression" });
const EV_JUSTICE = stubEvent({ id: "ev-justice", cost: 0, aspect: "justice" });
const EV_POOL = stubEvent({ id: "ev-pool", cost: 0, aspect: "pool" });
const EV_BASIC = stubEvent({ id: "ev-basic", cost: 0, aspect: "basic" });
/** Identity-specific and aspect at once (Spider-Woman's Venom Blast shape: `printedAspect`). */
const EV_SPLIT = {
  ...stubEvent({ id: "ev-split", cost: 0, aspect: "hero:buddy" }),
  printedAspect: "aggression" as const,
};
/** A non-event of the right classification: Superpower Adaptation asks for an event. */
const ALLY_BASIC_SPARE = stubAlly({ id: "spare", cost: 0, atk: 1, thw: 1, hp: 1, aspect: "basic" });
const DISCARDED = [EV_ROGUE, EV_BUDDY, EV_AGGRESSION, EV_JUSTICE, EV_POOL, EV_BASIC, EV_SPLIT, ALLY_BASIC_SPARE];

// Hosts.
const PROTECTOR = stubAlly({ id: "protector", cost: 0, atk: 1, thw: 1, hp: 3, aspect: "protection" });
const COMMONER = stubAlly({ id: "commoner", cost: 0, atk: 1, thw: 1, hp: 3, aspect: "basic" });
const SIDEKICK = stubAlly({ id: "sidekick", cost: 0, atk: 1, thw: 1, hp: 3, aspect: "hero:buddy" });
/** A Captive ally's shape: printed with no identity, aspect or basic classification (`aspect: "none"`). */
const CAPTIVE = stubAlly({ id: "captive", cost: 0, atk: 1, thw: 1, hp: 3, aspect: "none" });
const GOON = stubMinion({ id: "goon", atk: 0, sch: 0, hp: 5 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const attachTo = (id: string, to: TargetRef) => actionEvent(id, [{ kind: "attach", card: THE_CHARM, to }]);
const ATTACH_GOON = attachTo("to-goon", named("goon"));
const ATTACH_BOSS = attachTo("to-boss", { kind: "villain" });
const ATTACH_PROTECTOR = attachTo("to-protector", named("protector"));
const ATTACH_COMMONER = attachTo("to-commoner", named("commoner"));
const ATTACH_SIDEKICK = attachTo("to-sidekick", named("sidekick"));
const ATTACH_CAPTIVE = attachTo("to-captive", named("captive"));
const ATTACH_BUDDY = attachTo("to-buddy", { kind: "identityOf", player: { kind: "id", playerId: p2 } });
const FLIP_BUDDY = actionEvent("flip-buddy", [{ kind: "changeForm", player: { kind: "id", playerId: p2 } }]);
/** Superpower Adaptation's shape: a search for one event, which logs `choiceFoundNothing` when there is none. */
const ADAPT = actionEvent("adapt", [
  {
    kind: "if",
    condition: { kind: "exists", query: { categories: ["identity", "ally"], hasAttachment: CHARM_QUERY } },
    then: [
      {
        kind: "chooseCards",
        slot: "found",
        from: {
          kind: "zone",
          zone: "discard",
          player: { kind: "ownerOf", target: CHARMED },
          filter: { categories: ["event"], sameClassificationAs: CHARMED },
        },
        chooser: you,
        min: 1,
        max: 1,
      },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, to: "hand", into: you },
    ],
  },
]);
/** "If Touched is attached to a hero", as an `if` (the live read at resolution). */
const IF_HERO = actionEvent("if-hero", [
  {
    kind: "if",
    condition: { kind: "refMatches", ref: CHARMED, query: { categories: ["hero"] } },
    then: [{ kind: "addCounters", target: { kind: "identityOf", player: you }, counterType: "hero", amount: n(1) }],
  },
]);

const EVENTS = [
  ATTACH_GOON,
  ATTACH_BOSS,
  ATTACH_PROTECTOR,
  ATTACH_COMMONER,
  ATTACH_SIDEKICK,
  ATTACH_CAPTIVE,
  ATTACH_BUDDY,
  FLIP_BUDDY,
  ADAPT,
  IF_HERO,
];
const deps: EngineDeps = depsOf(CHARM_TEXT, ...EVENTS.map((e) => e.ability));
const EVENT_IDS = EVENTS.map((e) => e.card.id as CardId);
const HOSTS = [PROTECTOR, COMMONER, SIDEKICK, CAPTIVE];

function game(seed = 5): GameState {
  const config: GameSetupConfig = {
    seed,
    cards: [
      ...DEFAULT_CARDS,
      ROGUE,
      BUDDY,
      BOSS,
      LONG_SCHEME,
      BLANK,
      GOON,
      CHARM,
      ...HOSTS,
      ...DISCARDED,
      ...EVENTS.map((e) => e.card),
    ],
    villainCardId: BOSS.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: [...Array.from({ length: 12 }, () => BLANK.id as CardId), GOON.id],
    includeIdentitySets: false,
    players: [ROGUE, BUDDY].map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...EVENT_IDS, ...HOSTS.map((h) => h.id), ...DISCARDED.map((c) => c.id), CHARM.id],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

/** Every copy of the `DISCARDED` cards a player holds goes to their discard pile, and nothing else is there. */
function stockDiscards(state: GameState): GameState {
  const wanted = new Set<string>(DISCARDED.map((c) => c.id));
  const isWanted = (id: InstanceId) => wanted.has(state.instances[id]!.cardId);
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.filter((id) => !isWanted(id)),
      deck: [...p.deck, ...p.discard].filter((id) => !isWanted(id)),
      discard: [...p.hand, ...p.deck, ...p.discard].filter(isWanted),
    })),
  };
}

/** p1 (Rogue) and p2 (Buddy) in hero form; a minion engaged with p1; p2 controls three host allies, p1 the fourth; p1's charm in play. */
function board(seed?: number) {
  let state = stockDiscards(game(seed));
  state = runCommands(state, deps, { type: "changeForm", playerId: p1 }).state;
  const goon = minionEngagedWith(state, GOON.id, p1);
  state = goon.state;
  const hosts: Record<string, InstanceId> = {};
  for (const host of HOSTS) {
    // The ally limit is 3 (RRG 1.8 "Ally", p. 7): the Captive-shaped ally is p1's, the rest p2's.
    const placed = playerCardIntoPlay(state, host.id, host === CAPTIVE ? p1 : p2);
    state = placed.state;
    hosts[host.id] = placed.id;
  }
  // p2 starts in alter-ego form; a card effect flips it (a voluntary change is only on its own turn).
  state = play(state, FLIP_BUDDY.card);
  const charm = playerCardIntoPlay(state, CHARM.id, p1);
  return { state: charm.state, goon: goon.id, charm: charm.id, hosts };
}

function playLogged(state: GameState, card: { readonly id: CardId }) {
  const given = giveCard(state, p1, card.id);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}
const play = (state: GameState, card: { readonly id: CardId }): GameState => playLogged(state, card).state;

const identityId = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
const cardIdOf = (state: GameState, id: InstanceId | string) => state.instances[id as InstanceId]!.cardId;
const rogueKeywords = (state: GameState) =>
  keywordsOf(state, identityId(state, p1), deps)
    .map((k) => k.name)
    .filter((name) => ["overkill", "retaliate", "steady", "stalwart"].includes(name))
    .sort();
/**
 * The card ids Superpower Adaptation's search offers, sorted: `[]` when the search ran and found nothing, `null` when
 * it never ran (the `if` failed).
 */
function offered(state: GameState): readonly string[] | null {
  const { state: after, events } = playLogged(state, ADAPT.card);
  const choice = after.pendingChoice;
  if (choice !== null) return choice.options.map((o) => cardIdOf(after, o.optionId)).sort();
  return events.some((e) => e.type === "choiceFoundNothing" && e.slot === "found") ? [] : null;
}
/** Read from p1's (Rogue's) side, as Superpower Adaptation is. */
const CONTEXT: EffectContext = {
  selfInstanceId: null,
  controllerId: p1,
  event: null,
  bindings: {},
  deps,
};
const sameAs = (state: GameState, of: TargetRef): readonly string[] =>
  selectTargets(state, { categories: ["event"], sameClassificationAs: of }, CONTEXT)
    .map((id) => cardIdOf(state, id))
    .sort();

describe("§3.51 classificationsOf: read off card data", () => {
  it("identity, identity set, each aspect, basic, an identity-specific card printing an aspect, none", () => {
    const { state, goon, hosts } = board();
    const ofCard = (cardId: string) => {
      const id = (Object.keys(state.instances) as InstanceId[]).find((i) => state.instances[i]!.cardId === cardId)!;
      return classificationsOf(state, id);
    };
    expect(classificationsOf(state, identityId(state, p1))).toEqual(["identitySpecific"]);
    expect(classificationsOf(state, identityId(state, p2))).toEqual(["identitySpecific"]);
    expect(ofCard(EV_ROGUE.id)).toEqual(["identitySpecific"]);
    expect(ofCard(EV_AGGRESSION.id)).toEqual(["aspect"]);
    expect(ofCard(EV_JUSTICE.id)).toEqual(["aspect"]);
    expect(ofCard(EV_POOL.id)).toEqual(["aspect"]);
    expect(ofCard(EV_BASIC.id)).toEqual(["basic"]);
    expect(ofCard(EV_SPLIT.id)).toEqual(["identitySpecific", "aspect"]);
    expect(classificationsOf(state, hosts[PROTECTOR.id]!)).toEqual(["aspect"]);
    expect(classificationsOf(state, hosts[CAPTIVE.id]!)).toEqual([]);
    expect(classificationsOf(state, goon)).toEqual([]);
    expect(classificationsOf(state, state.villains[0]!.instanceId)).toEqual([]);
  });
});

describe("§3.51 sameClassificationAs (Superpower Adaptation's search)", () => {
  it("a hero host: the identity-specific events in its owner's discard pile, either identity's set", () => {
    const start = board();
    const state = play(start.state, ATTACH_BUDDY.card);
    expect(mustInstance(state, start.charm).attachedTo).toBe(identityId(state, p2));
    // p2's discard pile holds both identities' sets (test surgery); "identity-specific" is the classification, not the set.
    expect(offered(state)).toEqual([EV_BUDDY.id, EV_ROGUE.id, EV_SPLIT.id].sort());
  });

  it("an alter-ego host is still identity-specific (an identity is, in either form)", () => {
    const start = board();
    const flipped = play(play(start.state, ATTACH_BUDDY.card), FLIP_BUDDY.card);
    expect(mustPlayer(flipped, p2).identity.form).toBe("alterEgo");
    expect(offered(flipped)).toEqual([EV_BUDDY.id, EV_ROGUE.id, EV_SPLIT.id].sort());
  });

  it("an aspect ally (Protection) finds every aspect event, of any aspect, and the split card", () => {
    const start = board();
    const state = play(start.state, ATTACH_PROTECTOR.card);
    expect(offered(state)).toEqual([EV_AGGRESSION.id, EV_JUSTICE.id, EV_POOL.id, EV_SPLIT.id].sort());
  });

  it("a basic ally finds only basic events (near miss: the basic ally in the discard pile is not an event)", () => {
    const start = board();
    const state = play(start.state, ATTACH_COMMONER.card);
    expect(offered(state)).toEqual([EV_BASIC.id]);
  });

  it("an identity-specific ally finds identity-specific events", () => {
    const start = board();
    const state = play(start.state, ATTACH_SIDEKICK.card);
    expect(offered(state)).toEqual([EV_BUDDY.id, EV_ROGUE.id, EV_SPLIT.id].sort());
  });

  it("a host with none of the three (a Captive ally's shape) finds nothing", () => {
    const start = board();
    const state = play(start.state, ATTACH_CAPTIVE.card);
    expect(offered(state)).toEqual([]);
  });

  it("an enemy host: the 'friendly character' condition fails, and the query alone matches nothing", () => {
    const start = board();
    const onGoon = play(start.state, ATTACH_GOON.card);
    expect(offered(onGoon)).toBeNull();
    expect(sameAs(onGoon, CHARMED)).toEqual([]);
    const onBoss = play(start.state, ATTACH_BOSS.card);
    expect(offered(onBoss)).toBeNull();
    expect(sameAs(onBoss, { kind: "villain" })).toEqual([]);
  });

  it("the charm not attached: the ref names nothing, so nothing matches", () => {
    const { state } = board();
    expect(offered(state)).toBeNull();
    expect(sameAs(state, CHARMED)).toEqual([]);
  });

  it("the chosen event goes to the player's hand; explainQuery names the clause on a near miss", () => {
    const start = board();
    const state = play(start.state, ATTACH_COMMONER.card);
    const asked = play(state, ADAPT.card);
    const choice = asked.pendingChoice!;
    const basic = choice.options.find((o) => cardIdOf(asked, o.optionId) === EV_BASIC.id)!;
    const done = applyCommand(
      asked,
      { type: "resolveChoice", playerId: p1, choiceId: choice.choiceId, selectedOptionIds: [basic.optionId] },
      deps,
    );
    if (!done.ok) throw new Error(done.error.message);
    expect(mustPlayer(done.state, p1).hand).toContain(basic.optionId);
    expect(mustPlayer(done.state, p2).discard).not.toContain(basic.optionId);
    const justice = mustPlayer(done.state, p2).discard.find((id) => cardIdOf(done.state, id) === EV_JUSTICE.id)!;
    expect(explainQuery(done.state, justice, { categories: ["event"], sameClassificationAs: CHARMED }, CONTEXT)).toBe(
      "wrongClassification",
    );
  });
});

describe("§3.51 / §3.58 the host's type, read live (Touched's four lines' shape)", () => {
  it("minion → overkill only; villain → retaliate only (a villain is not a minion)", () => {
    const start = board();
    expect(rogueKeywords(start.state)).toEqual([]);
    expect(rogueKeywords(play(start.state, ATTACH_GOON.card))).toEqual(["overkill"]);
    expect(rogueKeywords(play(start.state, ATTACH_BOSS.card))).toEqual(["retaliate"]);
  });

  it("another player's ally → steady (an ally whoever controls it, the charm now p2's)", () => {
    const start = board();
    const state = play(start.state, ATTACH_PROTECTOR.card);
    expect(mustInstance(state, start.charm).controllerId).toBe(p2);
    expect(rogueKeywords(state)).toEqual(["steady"]);
  });

  it("an identity host flips hero ↔ alter-ego: stalwart while a hero, nothing while an alter-ego, live", () => {
    const start = board();
    const hero = play(start.state, ATTACH_BUDDY.card);
    expect(rogueKeywords(hero)).toEqual(["stalwart"]);
    const alterEgo = play(hero, FLIP_BUDDY.card);
    expect(rogueKeywords(alterEgo)).toEqual([]);
    expect(rogueKeywords(play(alterEgo, FLIP_BUDDY.card))).toEqual(["stalwart"]);
  });

  it("as an `if`: 'attached to a hero' is read when the ability resolves", () => {
    const start = board();
    const counted = (state: GameState) => mustInstance(state, identityId(state, p1)).counters.hero ?? 0;
    const hero = play(play(start.state, ATTACH_BUDDY.card), IF_HERO.card);
    expect(counted(hero)).toBe(1);
    const alterEgo = play(play(play(start.state, ATTACH_BUDDY.card), FLIP_BUDDY.card), IF_HERO.card);
    expect(counted(alterEgo)).toBe(0);
    expect(counted(play(play(start.state, ATTACH_PROTECTOR.card), IF_HERO.card))).toBe(0);
  });
});

describe("§3.51: nothing changes for a game without it; replay", () => {
  it("a query with no sameClassificationAs is unaffected by classification", () => {
    const { state } = board();
    const all = selectTargets(state, { categories: ["identity"] }, CONTEXT);
    expect(all).toEqual([identityId(state, p1), identityId(state, p2)]);
  });

  it("attach, flip, search and pick replay deep-equal", () => {
    const start = board(9);
    let state = start.state;
    const ids: InstanceId[] = [];
    for (const card of [ATTACH_BUDDY.card, FLIP_BUDDY.card, ADAPT.card]) {
      const given = giveCard(state, p1, card.id);
      state = given.state;
      ids.push(given.id);
    }
    let session = startSession(state);
    for (const id of ids) {
      const result = sessionApply(
        session,
        { type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null },
        deps,
      );
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    }
    const choice = session.state.pendingChoice!;
    const picked = choice.options.find((o) => cardIdOf(session.state, o.optionId) === EV_BUDDY.id)!;
    const result = sessionApply(
      session,
      { type: "resolveChoice", playerId: p1, choiceId: choice.choiceId, selectedOptionIds: [picked.optionId] },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
    expect(mustPlayer(session.state, p1).hand).toContain(picked.optionId);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
