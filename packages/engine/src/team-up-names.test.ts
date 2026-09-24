/**
 * docs/phase7-wave3.md §3.34: naming the characters of a Team-Up card — `TargetQuery.titled` and
 * `TargetQuery.identitySetTitled`, with the names written out or read from the card's own Team-Up keyword
 * (`CharacterNames.teamUpOf`). Synthetic identities shaped like the printed pairs:
 *
 * - a pair named by hero titles that are also their alter-ego titles (Groot and Rocket Raccoon: Flora and Fauna,
 *   `gmw` 16020/16048);
 * - a pair named by alter-ego titles (Gwen Stacy and Miles Morales: Young Love, `sm` 27019);
 * - a pair that shares a hero title, named "Hero/Alter-ego" (Black Panther/T'Challa and Black Panther/Shuri: Heart of
 *   the Panther, `bp` 51025).
 *
 * Sources: RRG 1.8 "Team-Up" (p. 43), "Identity" (p. 23: a title names only the faceup side), "Subtitle" (p. 41),
 * "Identity-Specific Card" (p. 23).
 */

import type { AnyCard, CardId, DeckContents, HeroIdentityCard, KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { validateDeck } from "./deck.js";
import { mustInstance, mustPlayer } from "./query.js";
import { matchesQuery, resolveRef, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubIdentity, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, MAIN_SCHEME, TREACHERY, VILLAIN } from "./testing/scenario.js";
import { copiesOf, playerCardIntoPlay } from "./testing/wave3.js";
import { characterTitledAs, identityCardTitledAs } from "./titles.js";

const P1 = playerId("p1");
const P2 = playerId("p2");
const n = (value: number) => ({ kind: "const", value }) as const;
const def = (definition: AbilityDefinition) => definition;

/** An identity whose hero and alter-ego faces carry the given titles. */
function identity(id: string, hero: string, alterEgo: string): HeroIdentityCard {
  const base = stubIdentity({ id, hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });
  return {
    ...base,
    name: hero,
    hero: { ...base.hero, faceName: hero },
    alterEgo: { ...base.alterEgo, faceName: alterEgo },
  };
}
const teamUp = (a: string, b: string): KeywordInstance => ({ name: "teamUp", names: [a, b] });

/** "Team-Up (A and B)": the Team-Up card's own names, `index` picking one. */
const teamUpName = (index?: 0 | 1): TargetQuery => ({
  categories: ["identity", "ally"],
  titled: { teamUpOf: { kind: "self" }, ...(index === undefined ? {} : { index }) },
});
const each = (query: TargetQuery): TargetRef => ({ kind: "each", query });

/** Two seats with the given identities, at the first player's first turn, both in hero form unless `alterEgo`. */
function twoSeats(
  a: HeroIdentityCard,
  b: HeroIdentityCard,
  cards: readonly AnyCard[],
  deps: EngineDeps,
  deck: readonly CardId[] = [],
): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, a, b, ...cards],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: copiesOf(TREACHERY.id, 30),
      players: [a, b].map((seat) => ({ identityCardId: seat.id, deck: [...DEFAULT_DECK, ...deck] })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}
const identityOf = (state: GameState, player: PlayerId): InstanceId => mustPlayer(state, player).identity.instanceId;
/** Test surgery: flips a seat's form without the voluntary change. */
function inForm(state: GameState, player: PlayerId, form: "hero" | "alterEgo"): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, identity: { ...p.identity, form } } : p)),
  };
}
const context = (state: GameState, self: InstanceId | null, controller: PlayerId): EffectContext => ({
  selfInstanceId: self,
  controllerId: controller,
  event: null,
  bindings: {},
});

// ---------------------------------------------------------------------------------------------------------------
// A pair named by titles printed on both sides (Flora and Fauna)
// ---------------------------------------------------------------------------------------------------------------

const TREE = identity("tree", "Tree", "Tree");
const RACCOON = identity("raccoon", "Raccoon", "Raccoon");
/**
 * Flora and Fauna's shape: "Place 2 growth counters on Tree (to a maximum of 10) and ready him, or place 2 charge
 * counters on a Raccoon upgrade and ready that upgrade." Each option reads its name from the keyword.
 */
const FLORA_ABILITY = stubAbility(
  "flora.action",
  def({
    trigger: { kind: "action", form: "hero" },
    effects: [
      {
        kind: "chooseOne",
        chooser: { kind: "controller" },
        options: [
          {
            label: "tree",
            effects: [
              { kind: "addCounters", target: each(teamUpName(0)), counterType: "growth", amount: n(2), upTo: n(10) },
              { kind: "ready", target: each(teamUpName(0)) },
            ],
          },
          {
            label: "raccoon upgrade",
            effects: [
              {
                kind: "chooseTarget",
                slot: "upgrade",
                chooser: { kind: "controller" },
                query: { categories: ["upgrade"], identitySetTitled: { teamUpOf: { kind: "self" }, index: 1 } },
              },
              { kind: "addCounters", target: { kind: "slot", slot: "upgrade" }, counterType: "charge", amount: n(2) },
              { kind: "ready", target: { kind: "slot", slot: "upgrade" } },
            ],
          },
        ],
      },
    ],
  }),
);
const FLORA = stubEvent({
  id: "flora",
  cost: 0,
  keywords: [teamUp("Tree", "Raccoon")],
  abilities: [FLORA_ABILITY.ref],
});
/** A card of Raccoon's identity-specific set (`aspect: "hero:raccoon"`). */
const GADGET = { ...stubUpgrade({ id: "gadget", cost: 1 }), aspect: `hero:${RACCOON.id}` } as const;
const PLAIN_GADGET = stubUpgrade({ id: "plain-gadget", cost: 1 });

describe("§3.34 Team-Up names written on both faces (Flora and Fauna)", () => {
  const deps = depsOf(FLORA_ABILITY);
  const cards = [FLORA, GADGET, PLAIN_GADGET];
  function start(): { state: GameState; flora: InstanceId; gadget: InstanceId; plain: InstanceId } {
    const base = inForm(
      inForm(twoSeats(TREE, RACCOON, cards, deps, [FLORA.id, GADGET.id, PLAIN_GADGET.id]), P1, "hero"),
      P2,
      "hero",
    );
    // The Raccoon upgrade and a plain one are in play under the *other* player's control, exhausted.
    const gadget = playerCardIntoPlay(base, GADGET.id, P2);
    const plain = playerCardIntoPlay(gadget.state, PLAIN_GADGET.id, P2);
    const exhausted: GameState = {
      ...plain.state,
      instances: {
        ...plain.state.instances,
        [gadget.id]: { ...mustInstance(plain.state, gadget.id), exhausted: true },
        [plain.id]: { ...mustInstance(plain.state, plain.id), exhausted: true },
        [identityOf(plain.state, P1)]: { ...mustInstance(plain.state, identityOf(plain.state, P1)), exhausted: true },
      },
    };
    const flora = giveCard(exhausted, P1, FLORA.id);
    return { state: flora.state, flora: flora.id, gadget: gadget.id, plain: plain.id };
  }
  const play = (id: InstanceId): Command => ({
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  });

  it("'place 2 growth counters on Tree and ready him' finds Tree by name 0 of the card's keyword", () => {
    const { state, flora } = start();
    const { session } = driveSession(startSession(state), deps, [play(flora)], (s) =>
      s.pendingChoice?.prompt.kind === "chooseOption"
        ? ["0"]
        : (s.pendingChoice?.options.slice(0, 1) ?? []).map((o) => o.optionId),
    );
    const tree = mustInstance(session.state, identityOf(session.state, P1));
    expect(tree.counters.growth).toBe(2);
    expect(tree.exhausted).toBe(false);
    // Raccoon (name 1) is untouched.
    expect(mustInstance(session.state, identityOf(session.state, P2)).counters.growth ?? 0).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("'a Raccoon upgrade' is a card of Raccoon's identity set, whoever controls it", () => {
    const { state, flora, gadget, plain } = start();
    const ctx = context(state, flora, P1);
    const raccoonUpgrade: TargetQuery = {
      categories: ["upgrade"],
      identitySetTitled: { teamUpOf: { kind: "self" }, index: 1 },
    };
    expect(matchesQuery(state, gadget, raccoonUpgrade, ctx)).toBe(true);
    expect(matchesQuery(state, plain, raccoonUpgrade, ctx)).toBe(false);
    const { session } = driveSession(startSession(state), deps, [play(flora)], (s) =>
      s.pendingChoice?.prompt.kind === "chooseOption"
        ? ["1"]
        : (s.pendingChoice?.options.slice(0, 1) ?? []).map((o) => o.optionId),
    );
    expect(mustInstance(session.state, gadget).counters.charge).toBe(2);
    expect(mustInstance(session.state, gadget).exhausted).toBe(false);
    expect(mustInstance(session.state, plain).exhausted).toBe(true);
  });

  it("names an ally too: a friendly character whose title or subtitle matches (RRG 1.8 'Team-Up', p. 43)", () => {
    const { state, flora } = start();
    const RACCOON_ALLY: AnyCard = {
      ...stubAlly({ id: "raccoon-ally", cost: 1, atk: 1, thw: 1, hp: 2 }),
      name: "Critter",
      subtitle: "Raccoon",
    };
    const withAlly: GameState = { ...state, cardPool: { ...state.cardPool, [RACCOON_ALLY.id]: RACCOON_ALLY } };
    const ally = {
      ...mustInstance(withAlly, identityOf(withAlly, P2)),
      instanceId: "ally-x" as InstanceId,
      cardId: RACCOON_ALLY.id,
    };
    const placed: GameState = {
      ...withAlly,
      instances: { ...withAlly.instances, [ally.instanceId]: { ...ally, counters: {}, damage: 0 } },
      players: withAlly.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: [...p.playArea, ally.instanceId] } : p,
      ),
    };
    expect(characterTitledAs(placed, ally.instanceId, "Raccoon")).toBe(true);
    expect(resolveRef(placed, each(teamUpName(1)), context(placed, flora, P1))).toEqual(
      expect.arrayContaining([identityOf(placed, P2), ally.instanceId]),
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A pair named by alter-ego titles (Young Love)
// ---------------------------------------------------------------------------------------------------------------

const GWEN = identity("gwen", "Spider-Gwen", "Gwen");
const MILES = identity("miles", "Spider-Kid", "Miles");
/** "Alter-Ego Action: Heal 3 damage each from Gwen and Miles." */
const LOVE_ABILITY = stubAbility(
  "love.action",
  def({
    trigger: { kind: "action", form: "alterEgo" },
    effects: [{ kind: "heal", target: each(teamUpName()), amount: n(3) }],
  }),
);
const LOVE = stubEvent({ id: "love", cost: 0, keywords: [teamUp("Gwen", "Miles")], abilities: [LOVE_ABILITY.ref] });

describe("§3.34 Team-Up names that are alter-ego titles (Young Love)", () => {
  const deps = depsOf(LOVE_ABILITY);
  function start(): { state: GameState; love: InstanceId } {
    const base = twoSeats(GWEN, MILES, [LOVE], deps, [LOVE.id]);
    const hurt: GameState = {
      ...base,
      instances: {
        ...base.instances,
        [identityOf(base, P1)]: { ...mustInstance(base, identityOf(base, P1)), damage: 5 },
        [identityOf(base, P2)]: { ...mustInstance(base, identityOf(base, P2)), damage: 5 },
      },
    };
    const love = giveCard(inForm(inForm(hurt, P1, "alterEgo"), P2, "alterEgo"), P1, LOVE.id);
    return { state: love.state, love: love.id };
  }
  const play = (id: InstanceId): Command => ({
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  });

  it("heals both named characters while their alter-ego sides are up", () => {
    const { state, love } = start();
    const { session } = driveSession(startSession(state), deps, [play(love)]);
    expect(mustInstance(session.state, identityOf(session.state, P1)).damage).toBe(2);
    expect(mustInstance(session.state, identityOf(session.state, P2)).damage).toBe(2);
  });

  it("an alter-ego title names only the faceup side (RRG 1.8 'Identity', p. 23): the card cannot be played", () => {
    const { state, love } = start();
    const heroP2 = inForm(state, P2, "hero");
    expect(characterTitledAs(heroP2, identityOf(heroP2, P2), "Miles")).toBe(false);
    expect(characterTitledAs(heroP2, identityOf(heroP2, P2), "Spider-Kid")).toBe(true);
    const result = applyCommand(heroP2, play(love), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("Miles");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A pair sharing a hero title, named "Hero/Alter-ego" (Heart of the Panther)
// ---------------------------------------------------------------------------------------------------------------

const PANTHER_T = identity("panther-t", "Panther", "T");
const PANTHER_S = identity("panther-s", "Panther", "S");
const HEART = stubEvent({ id: "heart", cost: 0, keywords: [teamUp("Panther/T", "Panther/S")] });
const HEART_DECK = (seat: HeroIdentityCard): DeckContents => ({
  identityCardId: seat.id,
  aspects: ["justice"],
  cards: [{ cardId: HEART.id, quantity: 1 }],
});

describe("§3.34 'Hero/Alter-ego' names one identity by both sides (Heart of the Panther)", () => {
  it("matches the identity with that hero and alter-ego, whichever side is up, and not the other one", () => {
    expect(identityCardTitledAs(PANTHER_T, "Panther/T")).toBe(true);
    expect(identityCardTitledAs(PANTHER_S, "Panther/T")).toBe(false);
    expect(identityCardTitledAs(PANTHER_T, "Panther")).toBe(true);
    const deps = depsOf();
    const state = twoSeats(PANTHER_T, PANTHER_S, [HEART], deps);
    for (const form of ["hero", "alterEgo"] as const) {
      const flipped = inForm(state, P1, form);
      expect(characterTitledAs(flipped, identityOf(flipped, P1), "Panther/T")).toBe(true);
      expect(characterTitledAs(flipped, identityOf(flipped, P1), "Panther/S")).toBe(false);
    }
  });

  it("lets either identity's deck include the card and both be in play to play it", () => {
    const deps = depsOf();
    const pool = [...DEFAULT_CARDS, PANTHER_T, PANTHER_S, HEART];
    const deckErrors = (seat: HeroIdentityCard) => {
      const verdict = validateDeck(HEART_DECK(seat), [...pool, seat]);
      return verdict.ok ? [] : verdict.problems.filter((problem) => problem.code === "team_up_identity");
    };
    expect(deckErrors(PANTHER_T)).toEqual([]);
    expect(deckErrors(identity("other", "Other", "O"))).not.toEqual([]);
    const state = twoSeats(PANTHER_T, PANTHER_S, [HEART], deps, [HEART.id]);
    const given = giveCard(inForm(state, P1, "hero"), P1, HEART.id);
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    expect(result.ok).toBe(true);
  });
});
