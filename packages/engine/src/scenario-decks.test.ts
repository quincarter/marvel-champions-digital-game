/**
 * docs/phase7-wave2.md §3.3: scenario separate decks (the Experimental Weapons deck, the side-scheme deck) and scenario
 * cards set aside at setup. Synthetic cards, scripted with stub abilities: the main scheme's 1A `Setup:` builds each deck.
 *
 * Sources: the Red Skull rulebook, p. 5 (Experimental Weapons: "After a card from the Experimental Weapons deck enters
 * play, it is considered to be part of the encounter deck. When that card is discarded, it is placed in the encounter
 * deck discard pile.") and p. 15 (the side-scheme deck: "The side-scheme deck has its own discard pile. [...] If the
 * side-scheme deck is ever empty, shuffle the side-scheme discard pile into the side-scheme deck. There is no penalty for
 * doing this."); errata #128A (RRG 1.8 p. 66); RRG 1.8 "Set Aside" (p. 39), "Scenario-Specific Card" (p. 38).
 */

import { abilityId, encounterSetId, flat, type AnyCard, type ScenarioSeparateDeck } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import { cardsInPlay as cardsInPlayOf } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubAlly, stubAttachment, stubIdentity, stubMainScheme, stubSideScheme } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, settle, TREACHERY, VILLAIN } from "./testing/scenario.js";

const p1 = playerId("p1");
const abilities: StubAbility[] = [];
const action = (id: string, effects: readonly EffectSpec[]) => {
  const made = stubAbility(id, { trigger: { kind: "action" }, effects });
  abilities.push(made);
  return made.ref;
};

const WEAPONS = "Experimental Weapons";
const SIDE = "side-scheme";
const weapon = (id: string) => ({
  ...stubAttachment({ id, attachesTo: { kind: "villain" } }),
  encounterSetIds: [encounterSetId("experimental_weapons")],
});
const WEAPON_A = weapon("weapon-a");
const WEAPON_B = weapon("weapon-b");
const SCHEME_X = stubSideScheme({ id: "scheme-x", startingThreat: 2 });
const CAPTIVE = {
  ...stubAlly({ id: "captive", cost: 0, atk: 1, thw: 1, hp: 3 }),
  aspect: "none" as const,
  specificTo: { kind: "scenario" as const, encounterSetId: encounterSetId("taskmaster") },
};

const SETUP = stubAbility("scheme.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "buildScenarioDeck", name: WEAPONS },
    { kind: "buildScenarioDeck", name: SIDE },
  ],
});
abilities.push(SETUP);
const SCHEME = stubMainScheme({
  id: "athena",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [SETUP.ref] }],
});
const DECKS: readonly ScenarioSeparateDeck[] = [
  {
    name: WEAPONS,
    contents: { encounterSetIds: [encounterSetId("experimental_weapons")] },
    discardPile: "encounter",
    whenEmpty: "remainsEmpty",
  },
  {
    name: SIDE,
    contents: { cardType: "side_scheme" },
    discardPile: "own",
    whenEmpty: "reshuffleDiscardWithoutPenalty",
  },
];

const top = (name: string, slot: string): EffectSpec => ({
  kind: "selectCards",
  slot,
  cards: { kind: "scenarioDeck", name, top: { kind: "const", value: 1 } },
});
/** "Reveal the top card of the Experimental Weapons deck." */
const REVEAL_WEAPON = action("reveal-weapon", [
  top(WEAPONS, "w"),
  { kind: "revealCard", cards: { kind: "slot", slot: "w" }, player: { kind: "controller" } },
]);
/** "Reveal the top card of the side-scheme deck and put it into play." */
const REVEAL_SCHEME = action("reveal-scheme", [
  top(SIDE, "s"),
  { kind: "putIntoPlay", card: { kind: "slot", slot: "s" }, controller: { kind: "controller" } },
]);
const DISCARD_WEAPONS = action("discard-weapons", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["attachment"] } } },
]);
const CLEAR_SCHEMES = action("clear-schemes", [
  {
    kind: "removeThreat",
    target: { kind: "each", query: { categories: ["sideScheme"] } },
    amount: { kind: "const", value: 99 },
  },
]);
const TOOLS = [REVEAL_WEAPON, REVEAL_SCHEME, DISCARD_WEAPONS, CLEAR_SCHEMES];
const TOOLKIT = stubIdentity({
  id: "toolkit",
  hp: 30,
  atk: 1,
  thw: 1,
  def: 1,
  rec: 1,
  heroHandSize: 5,
  alterEgoHandSize: 5,
  heroAbilities: TOOLS,
  alterEgoAbilities: TOOLS,
});
const deps: EngineDeps = depsOf(...abilities);

function game(): GameState {
  const result = createGame(
    {
      seed: 5,
      cards: [...DEFAULT_CARDS, TOOLKIT, SCHEME, WEAPON_A, WEAPON_B, SCHEME_X, CAPTIVE] as readonly AnyCard[],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [
        WEAPON_A.id,
        WEAPON_B.id,
        SCHEME_X.id,
        SCHEME_X.id,
        ...Array.from({ length: 10 }, () => TREACHERY.id),
      ],
      scenarioDecks: DECKS,
      setAside: [CAPTIVE.id],
      includeIdentitySets: false,
      players: [{ identityCardId: TOOLKIT.id, deck: DEFAULT_DECK }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, defaultPick, deps);
}
const use = (session: GameSession, tool: typeof REVEAL_WEAPON): GameSession => {
  const identity = session.state.players[0]!.identity.instanceId;
  const result = sessionApply(
    session,
    { type: "useAbility", playerId: p1, cardInstanceId: identity, abilityId: abilityId(tool.id), payment: [] },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  let current = result.session;
  while (current.state.pendingChoice) {
    const choice = current.state.pendingChoice;
    const answered = sessionApply(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: defaultPick(current.state),
      },
      deps,
    );
    if (!answered.ok) throw new Error(answered.error.message);
    current = answered.session;
  }
  return current;
};
const named = (state: GameState, ids: readonly InstanceId[]) =>
  ids.map((id) => mustInstance(state, id).cardId as string);

describe("scenario decks (docs/phase7-wave2.md §3.3)", () => {
  it("the 1A Setup builds each deck out of the encounter deck; nothing is built without it", () => {
    const state = game();
    expect(named(state, state.scenarioDecks[WEAPONS]!.deck).sort()).toEqual(["weapon-a", "weapon-b"]);
    expect(named(state, state.scenarioDecks[SIDE]!.deck)).toEqual(["scheme-x", "scheme-x"]);
    const encounter = named(state, activeEncounterDeck(state).deck);
    expect(encounter.some((id) => id.startsWith("weapon") || id === "scheme-x")).toBe(false);
  });

  it("Experimental Weapons: a revealed weapon enters play, is discarded to the encounter discard pile, and an empty deck reveals nothing", () => {
    let session = startSession(game());
    session = use(session, REVEAL_WEAPON);
    expect(
      cardsInPlayOf(session.state).filter((id) => mustInstance(session.state, id).cardId.startsWith("weapon")),
    ).toHaveLength(1);
    session = use(session, DISCARD_WEAPONS);
    expect(
      named(session.state, activeEncounterDeck(session.state).discard).filter((id) => id.startsWith("weapon")),
    ).toHaveLength(1);
    session = use(session, REVEAL_WEAPON);
    session = use(session, REVEAL_WEAPON);
    expect(session.state.scenarioDecks[WEAPONS]!.deck).toEqual([]);
    // "remainsEmpty": the discarded weapon is not shuffled back.
    session = use(session, DISCARD_WEAPONS);
    expect(session.state.scenarioDecks[WEAPONS]!.deck).toEqual([]);
  });

  it("the side-scheme deck: a defeated side scheme goes to its own discard pile, and the empty deck reshuffles it with no acceleration token", () => {
    let session = startSession(game());
    session = use(session, REVEAL_SCHEME);
    session = use(session, REVEAL_SCHEME);
    expect(session.state.scenarioDecks[SIDE]!.deck).toEqual([]);
    const tokens = session.state.mainScheme.accelerationTokens;
    session = use(session, CLEAR_SCHEMES);
    // Both went to the side-scheme discard pile. The first was taken straight back by the empty deck ("If the side-scheme
    // deck is ever empty"), so the second waits in the discard pile of a deck that is no longer empty.
    expect(named(session.state, session.state.scenarioDecks[SIDE]!.deck)).toEqual(["scheme-x"]);
    expect(named(session.state, session.state.scenarioDecks[SIDE]!.discard)).toEqual(["scheme-x"]);
    expect(session.state.mainScheme.accelerationTokens).toBe(tokens);
    expect(named(session.state, activeEncounterDeck(session.state).discard)).not.toContain("scheme-x");
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("scenario cards set aside at setup never enter the encounter deck (a Captive ally)", () => {
    const state = game();
    expect(named(state, state.encounterSetAside)).toContain("captive");
    expect(named(state, activeEncounterDeck(state).deck)).not.toContain("captive");
    expect(applyCommand(state, { type: "endTurn", playerId: p1 }, deps).ok).toBe(true);
  });
});
