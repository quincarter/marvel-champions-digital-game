/**
 * docs/phase7-wave1.md §3.14: attachment host resolution — every §1.6 host kind, hosts computed at the moment of
 * attaching, a card with no legal host discarded with no replacement reveal, "If you cannot, this card gains surge",
 * and ties chosen by the first player. Proven with synthetic cards.
 *
 * Sources: RRG 1.8 "Attach To" (p. 8), "Friendly" (p. 21), "First Player" (p. 19), "Printed" (p. 35); FAQ
 * "Counterspell (#30)" (p. 60); The Wrecking Crew insert, "Signature Side Schemes".
 */

import { flat, trait, type AttachmentHost, type CardId, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { attachmentHostCandidates } from "./resolve/index.js";
import type { EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubAlly,
  stubAttachment,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  giveCard,
  HERO,
  seatIdentities,
  settle,
  settleUntil,
  withEncounterPiles,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const self = { kind: "self" } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const ELITE = trait("Elite");
const AVENGER = trait("Avenger");

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(50), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const SIDE = stubSideScheme({ id: "side", startingThreat: 2, boostIcons: 0 });
const ELITE_MINION = stubMinion({ id: "elite-minion", traits: [ELITE], atk: 0, sch: 0, hp: 4, boostIcons: 0 });
const PLAIN_MINION = stubMinion({ id: "plain-minion", atk: 0, sch: 0, hp: 4, boostIcons: 0 });
const SMALL_MINION = stubMinion({ id: "small-minion", atk: 0, sch: 0, hp: 2, boostIcons: 0 });
const AVENGER_ALLY = stubAlly({ id: "avenger-ally", traits: [AVENGER], cost: 0, atk: 1, thw: 1, hp: 3 });

/** Goblin Glider: "Attach to the enemy with the highest printed hit points and without another Goblin Glider attached. If you cannot, this card gains surge." */
const GLIDER_HOST: AttachmentHost = {
  kind: "superlative",
  among: "enemy",
  order: "highest",
  measure: "printedHp",
  withoutAttachmentNamed: "glider",
};
const GLIDER_SURGE = stubAbility("glider.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "if", condition: { kind: "not", of: { kind: "isAttached", of: self } }, then: [{ kind: "gainSurge" }] },
  ],
});
const GLIDER = stubAttachment({ id: "glider", attachesTo: GLIDER_HOST, abilities: [GLIDER_SURGE.ref] });
/** Counterspell: "Attach to your hero." */
const COUNTERSPELL = stubAttachment({ id: "counterspell", attachesTo: { kind: "yourIdentity", form: "hero" } });
/** A tie among minions of equal printed hit points. */
const TIEBREAKER = stubAttachment({
  id: "tiebreaker",
  attachesTo: { kind: "superlative", among: "minion", order: "highest", measure: "printedHp" },
});

const deps: EngineDeps = depsOf(GLIDER_SURGE);

const CARDS = [
  ...DEFAULT_CARDS,
  QUIET_VILLAIN,
  LONG_SCHEME,
  BLANK,
  SIDE,
  ELITE_MINION,
  PLAIN_MINION,
  SMALL_MINION,
  AVENGER_ALLY,
  GLIDER,
  COUNTERSPELL,
  TIEBREAKER,
];

function game(options: { readonly players?: number; readonly encounter?: readonly CardId[] } = {}): GameState {
  const identities = seatIdentities(HERO, options.players ?? 1);
  const result = createGame(
    {
      seed: 6,
      cards: [...CARDS, ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: LONG_SCHEME.id,
      encounterDeck: options.encounter ?? copies(BLANK.id, 16),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, AVENGER_ALLY.id],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const ok = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
};

const context = (state: GameState, player = p1): EffectContext => ({
  selfInstanceId: null,
  controllerId: player,
  event: null,
  bindings: {},
  deps,
});
const hosts = (state: GameState, host: AttachmentHost, player = p1): readonly InstanceId[] =>
  attachmentHostCandidates(state, host, context(state, player));

/** Test surgery: the first copy of `cardId` in the encounter deck enters play (engaged with `player`, or the villain area). */
function intoPlay(
  state: GameState,
  cardId: CardId,
  player = p1,
): { readonly state: GameState; readonly id: InstanceId } {
  const deck = activeEncounterDeck(state).deck;
  const id = deck.find((candidate) => state.instances[candidate]?.cardId === cardId);
  if (!id) throw new Error(`no ${cardId} in the encounter deck`);
  const minion = state.cardPool[cardId]?.type === "minion";
  return {
    id,
    state: {
      ...withEncounterPiles(state, { deck: deck.filter((x) => x !== id) }),
      villainArea: minion ? state.villainArea : [...state.villainArea, id],
      players: state.players.map((p) =>
        minion && p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, engagedWith: minion ? player : null },
      },
    },
  };
}

/** Test surgery: `card` is attached to `host` without going through a reveal. */
function attachTo(
  state: GameState,
  cardId: CardId,
  host: InstanceId,
): { readonly state: GameState; readonly id: InstanceId } {
  const deck = activeEncounterDeck(state).deck;
  const id = deck.find((candidate) => state.instances[candidate]?.cardId === cardId);
  if (!id) throw new Error(`no ${cardId} in the encounter deck`);
  return {
    id,
    state: {
      ...withEncounterPiles(state, { deck: deck.filter((x) => x !== id) }),
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, attachedTo: host },
        [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
      },
    },
  };
}

/** Stacks the deck so the villain's boost card comes first and `id` is the card dealt to the last player. */
function dealtNext(state: GameState, id: InstanceId, players = 1): GameState {
  const rest = activeEncounterDeck(state).deck.filter((candidate) => candidate !== id);
  const before = rest.slice(0, players * 2 - 1);
  return withEncounterPiles(state, { deck: [...before, id, ...rest.slice(players * 2 - 1)] });
}

const endTurn = (player = p1): Command => ({ type: "endTurn", playerId: player });
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

// --- the §1.6 host kinds ----------------------------------------------------------------------------------------

describe("§3.14 every host kind resolves at the moment of attaching", () => {
  it("villain, namedVillain and villainSideScheme follow the active counter and the signature link", () => {
    const state = crewGame();
    const [wrecker, thunderball] = state.villains.map((villain) => villain.instanceId) as [InstanceId, InstanceId];
    const wreckerScheme = state.villains[0]?.signatureSideSchemeId as InstanceId;
    const thunderballScheme = state.villains[1]?.signatureSideSchemeId as InstanceId;

    expect(attachmentHostCandidates(state, { kind: "villain" }, context(state))).toEqual([wrecker]);
    expect(attachmentHostCandidates(state, { kind: "namedVillain", name: "thunderball" }, context(state))).toEqual([
      thunderball,
    ]);
    expect(attachmentHostCandidates(state, { kind: "namedVillain", name: "nobody" }, context(state))).toEqual([]);
    expect(attachmentHostCandidates(state, { kind: "villainSideScheme", of: "activeVillain" }, context(state))).toEqual(
      [wreckerScheme],
    );
    expect(
      attachmentHostCandidates(
        state,
        { kind: "villainSideScheme", of: { villainName: "thunderball" } },
        context(state),
      ),
    ).toEqual([thunderballScheme]);
  });

  it("yourIdentity is the resolving player's, and a form it is not in is no host at all (FAQ Counterspell #30)", () => {
    const start = game({ players: 2 });
    const [first, second] = start.players.map((p) => p.identity.instanceId) as [InstanceId, InstanceId];
    expect(hosts(start, { kind: "yourIdentity" })).toEqual([first]);
    expect(hosts(start, { kind: "yourIdentity" }, p2)).toEqual([second]);
    // Both players start in alter-ego form.
    expect(hosts(start, { kind: "yourIdentity", form: "hero" })).toEqual([]);
    const hero = ok(start, { type: "changeForm", playerId: p1 });
    expect(hosts(hero, { kind: "yourIdentity", form: "hero" })).toEqual([first]);
    expect(hosts(hero, { kind: "yourIdentity", form: "alterEgo" })).toEqual([]);
  });

  it("friendlyCharacter is every character the players control, and scheme covers both scheme types", () => {
    const start = game({ encounter: [PLAIN_MINION.id, SIDE.id, ...copies(BLANK.id, 14)] });
    const hero = ok(start, { type: "changeForm", playerId: p1 });
    const allyCard = giveCard(hero, p1, AVENGER_ALLY.id);
    const withAlly = runCommands(allyCard.state, deps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: allyCard.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
    const minion = intoPlay(withAlly, PLAIN_MINION.id);
    const side = intoPlay(minion.state, SIDE.id);
    const identity = mustPlayer(side.state, p1).identity.instanceId;
    const villain = side.state.villains[0]?.instanceId as InstanceId;

    const friendly = hosts(side.state, { kind: "friendlyCharacter" });
    expect(friendly).toEqual([identity, allyCard.id]);
    expect(friendly).not.toContain(minion.id);
    expect(friendly).not.toContain(villain);

    expect(hosts(side.state, { kind: "scheme" })).toEqual([side.state.mainScheme.instanceId, side.id]);
  });

  it("qualified narrows a category by trait, missing trait and a named attachment already there", () => {
    const start = game({ encounter: [ELITE_MINION.id, PLAIN_MINION.id, GLIDER.id, ...copies(BLANK.id, 13)] });
    const elite = intoPlay(start, ELITE_MINION.id);
    const plain = intoPlay(elite.state, PLAIN_MINION.id);
    const state = plain.state;

    expect(hosts(state, { kind: "qualified", category: "minion", trait: ELITE })).toEqual([elite.id]);
    expect(hosts(state, { kind: "qualified", category: "minion", withoutTrait: ELITE })).toEqual([plain.id]);

    const marked = attachTo(state, GLIDER.id, elite.id);
    expect(hosts(marked.state, { kind: "qualified", category: "minion", withoutAttachmentNamed: "glider" })).toEqual([
      plain.id,
    ]);
  });

  it("superlative ranks its pool and returns every tied card, with qualifiers applied first", () => {
    const start = game({
      encounter: [ELITE_MINION.id, PLAIN_MINION.id, SMALL_MINION.id, GLIDER.id, ...copies(BLANK.id, 12)],
    });
    const elite = intoPlay(start, ELITE_MINION.id);
    const plain = intoPlay(elite.state, PLAIN_MINION.id);
    const small = intoPlay(plain.state, SMALL_MINION.id);
    const state = small.state;
    const villain = state.villains[0]?.instanceId as InstanceId;

    // The villain's printed hit points scale per player and beat every minion's.
    expect(hosts(state, GLIDER_HOST)).toEqual([villain]);
    // Equal printed hit points tie; the smaller minion loses.
    expect(hosts(state, { kind: "superlative", among: "minion", order: "highest", measure: "printedHp" })).toEqual([
      elite.id,
      plain.id,
    ]);
    expect(hosts(state, { kind: "superlative", among: "minion", order: "lowest", measure: "printedHp" })).toEqual([
      small.id,
    ]);

    // With a glider already on the villain it is out of the pool, so the minions are ranked instead.
    const marked = attachTo(state, GLIDER.id, villain);
    expect(hosts(marked.state, GLIDER_HOST)).toEqual([elite.id, plain.id]);
  });
});

// --- the reveal procedure ---------------------------------------------------------------------------------------

// --- the wave 2 data-pipeline host requests (docs/phase7-wave2.md §7) -------------------------------------------

describe("§7 hosts added for the data pipeline's confirmed gaps", () => {
  it("'an encounter card in play' is every in-play card with no controller, and never a player's own card", () => {
    const start = game({ encounter: [ELITE_MINION.id, SIDE.id, ...copies(BLANK.id, 14)] });
    const withMinion = intoPlay(start, ELITE_MINION.id);
    const withScheme = intoPlay(withMinion.state, SIDE.id);
    const ally = giveCard(withScheme.state, p1, AVENGER_ALLY.id);
    const inPlay: GameState = {
      ...ally.state,
      players: ally.state.players.map((pl) =>
        pl.playerId === p1
          ? { ...pl, hand: pl.hand.filter((x) => x !== ally.id), playArea: [...pl.playArea, ally.id] }
          : pl,
      ),
      instances: {
        ...ally.state.instances,
        [ally.id]: { ...mustInstance(ally.state, ally.id), faceup: true, controllerId: p1 },
      },
    };
    const candidates = hosts(inPlay, { kind: "encounterCard" });
    expect(candidates).toContain(withMinion.id);
    expect(candidates).toContain(withScheme.id);
    expect(candidates).not.toContain(ally.id);
    expect(candidates).not.toContain(mustPlayer(inPlay, p1).identity.instanceId);
  });

  it("'the ally with the highest cost' ranks the ally pool by printed cost, and drops cards that print none", () => {
    const cheap = stubAlly({ id: "cheap-ally", cost: 1, atk: 1, thw: 1, hp: 3 });
    const dear = stubAlly({ id: "dear-ally", cost: 4, atk: 1, thw: 1, hp: 3 });
    const identities = seatIdentities(HERO, 1);
    const result = createGame(
      {
        seed: 7,
        cards: [...CARDS, cheap, dear, ...identities],
        villainCardId: QUIET_VILLAIN.id,
        mainSchemeCardId: LONG_SCHEME.id,
        encounterDeck: copies(BLANK.id, 16),
        players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...copies(cheap.id, 2), ...copies(dear.id, 2)] }],
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    let state = runCommands(result.state, deps).state;
    const ids: InstanceId[] = [];
    for (const card of [cheap.id, dear.id]) {
      const given = giveCard(state, p1, card);
      ids.push(given.id);
      state = {
        ...given.state,
        players: given.state.players.map((pl) =>
          pl.playerId === p1
            ? { ...pl, hand: pl.hand.filter((x) => x !== given.id), playArea: [...pl.playArea, given.id] }
            : pl,
        ),
        instances: {
          ...given.state.instances,
          [given.id]: { ...mustInstance(given.state, given.id), faceup: true, controllerId: p1 },
        },
      };
    }
    const host: AttachmentHost = { kind: "superlative", among: "ally", order: "highest", measure: "printedCost" };
    expect(hosts(state, host)).toEqual([ids[1]]);
    expect(hosts(state, { ...host, order: "lowest" })).toEqual([ids[0]]);
    // The identity is a friendly character with no printed cost, so it is no candidate at all.
    expect(
      hosts(state, { kind: "superlative", among: "friendlyCharacter", order: "highest", measure: "printedCost" }),
    ).toEqual([ids[1]]);
  });

  it("'the ally with the lowest THW' ranks allies by current THW (Possessed, storm 36038; docs/phase7-wave2.md §11.1)", () => {
    const thinker = stubAlly({ id: "thinker-ally", cost: 1, atk: 1, thw: 3, hp: 3 });
    const brawler = stubAlly({ id: "brawler-ally", cost: 1, atk: 3, thw: 1, hp: 3 });
    const identities = seatIdentities(HERO, 1);
    const result = createGame(
      {
        seed: 7,
        cards: [...CARDS, thinker, brawler, ...identities],
        villainCardId: QUIET_VILLAIN.id,
        mainSchemeCardId: LONG_SCHEME.id,
        encounterDeck: copies(BLANK.id, 16),
        players: [
          { identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...copies(thinker.id, 2), ...copies(brawler.id, 2)] },
        ],
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    let state = runCommands(result.state, deps).state;
    const ids: InstanceId[] = [];
    for (const card of [thinker.id, brawler.id]) {
      const given = giveCard(state, p1, card);
      ids.push(given.id);
      state = {
        ...given.state,
        players: given.state.players.map((pl) =>
          pl.playerId === p1
            ? { ...pl, hand: pl.hand.filter((x) => x !== given.id), playArea: [...pl.playArea, given.id] }
            : pl,
        ),
        instances: {
          ...given.state.instances,
          [given.id]: { ...mustInstance(given.state, given.id), faceup: true, controllerId: p1 },
        },
      };
    }
    const possessed: AttachmentHost = {
      kind: "superlative",
      among: "ally",
      order: "lowest",
      measure: "thw",
      withoutAttachmentNamed: "Possessed",
    };
    expect(hosts(state, possessed)).toEqual([ids[1]]);
    expect(hosts(state, { ...possessed, order: "highest" })).toEqual([ids[0]]);
  });

  it("`titleContains` matches a substring of the title showing", () => {
    const spidey = stubAlly({ id: "Spider-Woman", cost: 1, atk: 1, thw: 1, hp: 3 });
    const identities = seatIdentities(HERO, 1);
    const result = createGame(
      {
        seed: 8,
        cards: [...CARDS, spidey, ...identities],
        villainCardId: QUIET_VILLAIN.id,
        mainSchemeCardId: LONG_SCHEME.id,
        encounterDeck: copies(BLANK.id, 16),
        players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...copies(spidey.id, 2)] }],
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const started = runCommands(result.state, deps).state;
    const given = giveCard(started, p1, spidey.id);
    const state: GameState = {
      ...given.state,
      players: given.state.players.map((pl) =>
        pl.playerId === p1
          ? { ...pl, hand: pl.hand.filter((x) => x !== given.id), playArea: [...pl.playArea, given.id] }
          : pl,
      ),
      instances: {
        ...given.state.instances,
        [given.id]: { ...mustInstance(given.state, given.id), faceup: true, controllerId: p1 },
      },
    };
    expect(hosts(state, { kind: "qualified", category: "character", titleContains: "Spider" })).toEqual([given.id]);
    expect(hosts(state, { kind: "qualified", category: "character", titleContains: "Hulk" })).toEqual([]);
  });

  it("`titleContains` reads an identity's current face, not the other side of the card (docs/phase7-wave2.md §14.3)", () => {
    const spiderWomanStub = stubIdentity({
      id: "spider-woman",
      hp: 10,
      atk: 2,
      thw: 2,
      def: 2,
      rec: 3,
      heroHandSize: 5,
      alterEgoHandSize: 6,
    });
    const spiderWoman: HeroIdentityCard = {
      ...spiderWomanStub,
      name: "Spider-Woman",
      hero: { ...spiderWomanStub.hero, faceName: "Spider-Woman" },
      alterEgo: { ...spiderWomanStub.alterEgo, faceName: "Jessica Drew" },
    };
    const result = createGame(
      {
        seed: 9,
        cards: [...CARDS.filter((c) => c.type !== "hero_identity"), spiderWoman],
        villainCardId: QUIET_VILLAIN.id,
        mainSchemeCardId: LONG_SCHEME.id,
        encounterDeck: copies(BLANK.id, 16),
        includeIdentitySets: false,
        players: [{ identityCardId: spiderWoman.id, deck: [...DEFAULT_DECK, AVENGER_ALLY.id] }],
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const alterEgo = runCommands(result.state, deps).state;
    // Setup starts every player in alter-ego form (RRG 1.8 "Setup", p. 41): "Jessica Drew" is showing, not
    // "Spider-Woman" — RRG 1.8 "Identity" (p. 23), "not the other side of the card".
    expect(hosts(alterEgo, { kind: "qualified", category: "character", titleContains: "Spider" }, p1)).toEqual([]);

    const heroForm = applyCommand(alterEgo, { type: "changeForm", playerId: p1 });
    if (!heroForm.ok) throw new Error(heroForm.error.message);
    expect(hosts(heroForm.state, { kind: "qualified", category: "character", titleContains: "Spider" }, p1)).toEqual([
      mustPlayer(heroForm.state, p1).identity.instanceId,
    ]);
  });

  /**
   * docs/phase7-wave2.md §11.3, §14. "Attach to an enemy that X-23 or Honey Badger attacked this turn." (Puncture Wound
   * 43012.) The one temporal qualifier: it reads `GameState.attackedThisTurn`, written at every attack made during a
   * player's turn and cleared when each turn begins and ends (RRG 1.8 "Player Phase", p. 34).
   */
  const HERO_TITLE = HERO.hero.faceName;
  const byHero: AttachmentHost = { kind: "qualified", category: "enemy", attackedThisTurnBy: [HERO_TITLE] };

  it("`attackedThisTurnBy` matches only an enemy one of the named cards has attacked this turn", () => {
    const start = game({ encounter: [ELITE_MINION.id, PLAIN_MINION.id, ...copies(BLANK.id, 14)] });
    const attacked = intoPlay(start, ELITE_MINION.id);
    const untouched = intoPlay(attacked.state, PLAIN_MINION.id);
    const state = untouched.state;
    const identity = mustPlayer(state, p1).identity.instanceId;
    // Nothing attacked yet.
    expect(hosts(state, byHero)).toEqual([]);
    const hero = ok(state, { type: "changeForm", playerId: p1 });
    const struck = settleUntil(
      ok(hero, { type: "basicAttack", playerId: p1, attackerInstanceId: identity, targetInstanceId: attacked.id }),
      "declareDefender",
      deps,
    );
    // Recorded under the hero side's title — not the identity card's, and not the alter-ego's (RRG 1.8 "Identity", p. 23).
    expect(struck.attackedThisTurn[attacked.id]).toEqual([{ attackerInstanceId: identity, attackerTitle: HERO_TITLE }]);
    expect(hosts(struck, byHero)).toEqual([attacked.id]);
    expect(
      hosts(struck, { kind: "qualified", category: "enemy", attackedThisTurnBy: [HERO.alterEgo.faceName] }),
    ).toEqual([]);
    // The minion nobody attacked is no host, and neither is the attacked one under a different attacker's name.
    expect(hosts(struck, byHero)).not.toContain(untouched.id);
    expect(hosts(struck, { kind: "qualified", category: "enemy", attackedThisTurnBy: ["Honey Badger"] })).toEqual([]);
    // The record is cleared when the next turn begins, so "this turn" really means this one.
    const nextTurn = settle(ok(struck, { type: "endTurn", playerId: p1 }), defaultPick, deps);
    expect(nextTurn.step).toMatchObject({ phase: "player", kind: "turn" });
    expect(nextTurn.attackedThisTurn).toEqual({});
  });

  it("an attack stays recorded under the title it was made with after the attacker changes form (RRG 1.8 'Identity', p. 23)", () => {
    const start = game({ encounter: [ELITE_MINION.id, ...copies(BLANK.id, 15)] });
    const attacked = intoPlay(start, ELITE_MINION.id);
    const identity = mustPlayer(attacked.state, p1).identity.instanceId;
    const hero = ok(attacked.state, { type: "changeForm", playerId: p1 });
    const struck = settleUntil(
      ok(hero, { type: "basicAttack", playerId: p1, attackerInstanceId: identity, targetInstanceId: attacked.id }),
      "declareDefender",
      deps,
    );
    // Test surgery: the identity is now showing its alter-ego side (a card effect, or last turn's hero form flipped).
    const flipped: GameState = {
      ...struck,
      players: struck.players.map((pl) =>
        pl.playerId === p1 ? { ...pl, identity: { ...pl.identity, form: "alterEgo" } } : pl,
      ),
    };
    // The hero attacked it, so it is still a legal host, although no one is showing the hero's title any more.
    expect(hosts(flipped, byHero)).toEqual([attacked.id]);
  });

  it("an attack outside a player's turn is not recorded, so the villain phase does not read as 'this turn'", () => {
    // The villain (0 ATK) attacks first; the engaged minion's attack is the prompt after it, by which point the
    // villain's attack has fully resolved.
    const start = game({ encounter: [ELITE_MINION.id, ...copies(BLANK.id, 15)] });
    const engaged = intoPlay(start, ELITE_MINION.id);
    // In hero form, so there is a defender to ask about and each attack stops at its own defend prompt.
    const hero = ok(engaged.state, { type: "changeForm", playerId: p1 });
    const villainAttack = settleUntil(ok(hero, { type: "endTurn", playerId: p1 }), "declareDefender", deps);
    expect(villainAttack.step.phase).toBe("villain");
    const choice = villainAttack.pendingChoice;
    if (!choice) throw new Error("expected the villain's attack to ask for a defender");
    const minionAttack = ok(villainAttack, {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: ["decline"],
    });
    expect(minionAttack.pendingChoice?.prompt.kind).toBe("declareDefender");
    expect(minionAttack.attackedThisTurn).toEqual({});
  });
});

describe("§3.14 attaching as a card is revealed", () => {
  it("an attachment with no legal host is discarded, and no replacement card is revealed (FAQ Counterspell #30)", () => {
    const start = game({ encounter: [COUNTERSPELL.id, ...copies(BLANK.id, 15)] });
    const counterspell = activeEncounterDeck(start).deck.find(
      (id) => mustInstance(start, id).cardId === COUNTERSPELL.id,
    ) as InstanceId;
    // p1 is in alter-ego form, so "attach to your hero" cannot be met.
    const { state, events } = runCommands(dealtNext(start, counterspell), deps, endTurn());

    expect(activeEncounterDeck(state).discard).toContain(counterspell);
    expect(mustInstance(state, counterspell).attachedTo).toBeNull();
    expect(mustPlayer(state, p1).dealtEncounter).toEqual([]);
    // Exactly one card was revealed this villain phase: no replacement, and no surge.
    expect(ofType(events, "encounterCardRevealed")).toHaveLength(1);
    expect(ofType(events, "surgeTriggered")).toEqual([]);
  });

  it("'if you cannot, this card gains surge': the When Revealed still resolves and reads that it did not attach", () => {
    const start = game({ encounter: [GLIDER.id, GLIDER.id, ...copies(BLANK.id, 14)] });
    const villain = start.villains[0]?.instanceId as InstanceId;
    // The only enemy already carries a glider, so the revealed one has nowhere to go.
    const marked = attachTo(start, GLIDER.id, villain);
    const glider = activeEncounterDeck(marked.state).deck.find(
      (id) => mustInstance(marked.state, id).cardId === GLIDER.id,
    ) as InstanceId;
    const { state, events } = runCommands(dealtNext(marked.state, glider), deps, endTurn());

    expect(activeEncounterDeck(state).discard).toContain(glider);
    expect(mustInstance(state, glider).attachedTo).toBeNull();
    expect(ofType(events, "surgeTriggered").map((e) => e.instanceId)).toEqual([glider]);

    // With a free enemy it attaches instead, and nothing surges.
    const attached = runCommands(
      dealtNext(
        start,
        activeEncounterDeck(start).deck.find((id) => mustInstance(start, id).cardId === GLIDER.id) as InstanceId,
      ),
      deps,
      endTurn(),
    );
    expect(ofType(attached.events, "surgeTriggered")).toEqual([]);
    expect(mustInstance(attached.state, villain).attachments).toHaveLength(1);
  });

  it("a tie among legal hosts is the first player's choice on the encounter card's behalf", () => {
    const start = game({
      players: 2,
      encounter: [ELITE_MINION.id, PLAIN_MINION.id, TIEBREAKER.id, ...copies(BLANK.id, 13)],
    });
    const elite = intoPlay(start, ELITE_MINION.id, p2);
    const plain = intoPlay(elite.state, PLAIN_MINION.id, p2);
    const tiebreaker = activeEncounterDeck(plain.state).deck.find(
      (id) => mustInstance(plain.state, id).cardId === TIEBREAKER.id,
    ) as InstanceId;
    // Two players: two boost cards, then one dealt card each; p2 reveals the attachment.
    const stacked = dealtNext(plain.state, tiebreaker, 2);

    const atChoice = settleUntil(ok(ok(stacked, endTurn(p1)), endTurn(p2)), "chooseAttachmentTarget", deps);
    const choice = atChoice.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "chooseAttachmentTarget", instanceId: tiebreaker });
    expect(choice?.authority).toBe("firstPlayerTargets");
    expect(choice?.playerId).toBe(atChoice.firstPlayerId);
    expect(choice?.options.map((option) => option.optionId)).toEqual([elite.id, plain.id]);

    const chosen = ok(atChoice, {
      type: "resolveChoice",
      playerId: choice!.playerId,
      choiceId: choice!.choiceId,
      selectedOptionIds: [plain.id],
    });
    expect(mustInstance(chosen, plain.id).attachments).toContain(tiebreaker);
  });
});

// --- helpers ----------------------------------------------------------------------------------------------------

/** Two villains, each with its signature side scheme in play, so the villain-linked hosts have something to find. */
function crewGame(): GameState {
  const wrecker = stubVillain({ id: "wrecker", stages: [{ hp: flat(10), atk: 0, sch: 0 }] });
  const thunderball = stubVillain({ id: "thunderball", stages: [{ hp: flat(10), atk: 0, sch: 0 }] });
  const wreckerScheme = stubSideScheme({ id: "wrecker-scheme", startingThreat: 1, boostIcons: 0 });
  const thunderballScheme = stubSideScheme({ id: "thunderball-scheme", startingThreat: 3, boostIcons: 0 });
  const setup = stubAbility("crew.setup", {
    trigger: { kind: "setup" },
    effects: [
      { kind: "selectCards", slot: "signature", cards: { kind: "encounterSetAside" } },
      { kind: "putIntoPlay", card: { kind: "slot", slot: "signature" }, controller: { kind: "firstPlayer" } },
    ],
  });
  const scheme = stubMainScheme({
    id: "crew-scheme",
    stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [setup.ref] }],
  });
  const crewDeps = depsOf(setup, GLIDER_SURGE);
  const result = createGame(
    {
      seed: 12,
      cards: [...DEFAULT_CARDS, wrecker, thunderball, wreckerScheme, thunderballScheme, scheme, BLANK],
      villainCardId: wrecker.id,
      villains: [
        { villainCardId: wrecker.id, encounterDeck: copies(BLANK.id, 6), signatureSideSchemeCardId: wreckerScheme.id },
        {
          villainCardId: thunderball.id,
          encounterDeck: copies(BLANK.id, 6),
          signatureSideSchemeCardId: thunderballScheme.id,
        },
      ],
      mainSchemeCardId: scheme.id,
      encounterDeck: [],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    },
    crewDeps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, crewDeps).state;
}
