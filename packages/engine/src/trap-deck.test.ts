/**
 * docs/phase7-shadowland.md §6 M3: a second encounter-side deck gathered by trait (the trap deck), synthetic cards.
 *
 * Sources: the Shadowland insert (MC65) p. 12: "During setup, in addition to creating the encounter deck, find each
 * TRAP! treachery from the encounter deck and shuffle them together with the Deadly Contraptions set [...]"; "When a
 * player is instructed to reveal a card from the trap deck, that player reveals the top card of that deck and resolves
 * the card as normal."; "Whenever a card with the TRAP! trait would be discarded, place that card into [...] the trap
 * discard pile"; "Once the trap deck is empty, shuffle the cards in the trap discard pile together to form a new trap
 * deck. This is not considered resetting the encounter deck [...], and does not place an acceleration token". P. 13:
 * "Whenever a card without the TRAP! trait is discarded, place that card in the encounter discard pile, even if it was
 * previously drawn from the trap deck." FAQ p. 18: a surge from the trap deck reveals from the encounter deck. Both
 * piles empty: the reveal does nothing (engine reading, rules brief M3).
 */

import {
  abilityId,
  encounterSetId,
  flat,
  trait,
  type AnyCard,
  type CardId,
  type ScenarioSeparateDeck,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, discardZoneFor, mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubIdentity, stubMainScheme, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, settle, TREACHERY, VILLAIN } from "./testing/scenario.js";

const p1 = playerId("p1");
const TRAP = trait("TRAP!");
const DECK = "trap";
const abilities: StubAbility[] = [];
const action = (id: string, effects: readonly EffectSpec[]) => {
  const made = stubAbility(id, { trigger: { kind: "action" }, effects });
  abilities.push(made);
  return made.ref;
};

const trapCard = (id: string, keywords: readonly { readonly name: "surge" }[] = []) => ({
  ...stubTreachery({ id, encounterSetIds: ["shadow_labyrinth"], keywords }),
  traits: [TRAP],
});
const TRAP_A = trapCard("trap-a");
const SURGE_TRAP = trapCard("trap-surge", [{ name: "surge" }]);
/** A Deadly Contraptions card printing no TRAP!: it joins by its set, and is discarded as any other encounter card. */
const CONTRAPTION = stubTreachery({ id: "contraption", encounterSetIds: ["deadly_contraptions"] });
const SCHEME = stubMainScheme({
  id: "corridors",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TRAP_DECK: ScenarioSeparateDeck = {
  name: DECK,
  contents: { trait: TRAP, wholeEncounterSetIds: [encounterSetId("deadly_contraptions")] },
  discardPile: "own",
  whenEmpty: "reshuffleDiscardWithoutPenalty",
  discardByTrait: TRAP,
  buildAtSetup: true,
};

const topOf = (slot: string): EffectSpec => ({
  kind: "selectCards",
  slot,
  cards: { kind: "scenarioDeck", name: DECK, top: { kind: "const", value: 1 } },
});
/** "Reveal a card from the trap deck." */
const REVEAL_TRAP = action("reveal-trap", [
  topOf("t"),
  { kind: "revealCard", cards: { kind: "slot", slot: "t" }, player: { kind: "controller" } },
]);
/** "Shuffle the top card of the encounter deck into the trap deck" (a non-TRAP! card in the trap deck). */
const ENCOUNTER_INTO_TRAPS = action("encounter-into-traps", [
  {
    kind: "moveCards",
    cards: { kind: "encounter", zones: ["deck"], top: { kind: "const", value: 1 } },
    to: { scenarioDeck: DECK, at: "top" },
  },
]);
/** Moves the trap deck's top card into the encounter deck, then discards every TRAP! card of the encounter deck. */
const TRAP_INTO_ENCOUNTER = action("trap-into-encounter", [
  topOf("u"),
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "u" } }, to: "encounterDeckShuffle" },
]);
const DISCARD_ENCOUNTER_TRAPS = action("discard-encounter-traps", [
  { kind: "moveCards", cards: { kind: "encounter", zones: ["deck"], filter: { trait: TRAP } }, to: "discard" },
]);
/** Takes every card of the trap deck and its discard pile out of the game. */
const REMOVE_TRAPS = action("remove-traps", [
  { kind: "moveCards", cards: { kind: "scenarioDeck", name: DECK, zones: ["deck", "discard"] }, to: "removedFromGame" },
]);
const TOOLS = [REVEAL_TRAP, ENCOUNTER_INTO_TRAPS, TRAP_INTO_ENCOUNTER, DISCARD_ENCOUNTER_TRAPS, REMOVE_TRAPS];
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

function game(traps: readonly CardId[] = [TRAP_A.id, TRAP_A.id, CONTRAPTION.id]): GameState {
  const result = createGame(
    {
      seed: 11,
      cards: [...DEFAULT_CARDS, TOOLKIT, SCHEME, TRAP_A, SURGE_TRAP, CONTRAPTION] as readonly AnyCard[],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [...traps, ...Array.from({ length: 10 }, () => TREACHERY.id)],
      scenarioDecks: [TRAP_DECK],
      includeIdentitySets: false,
      players: [{ identityCardId: TOOLKIT.id, deck: DEFAULT_DECK }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return settle(result.state, defaultPick, deps);
}

/** Uses `tool`, answering every prompt with the default pick; returns the session and the events it logged. */
function use(session: GameSession, tool: typeof REVEAL_TRAP): { session: GameSession; events: GameEvent[] } {
  const identity = session.state.players[0]!.identity.instanceId;
  const events: GameEvent[] = [];
  const result = sessionApply(
    session,
    { type: "useAbility", playerId: p1, cardInstanceId: identity, abilityId: abilityId(tool.id), payment: [] },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  events.push(...result.events);
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
    events.push(...answered.events);
    current = answered.session;
  }
  return { session: current, events };
}
const named = (state: GameState, ids: readonly InstanceId[]) =>
  ids.map((id) => mustInstance(state, id).cardId as string).sort();
const traps = (state: GameState) => state.scenarioDecks[DECK]!;

describe("a trait-gathered encounter-side deck: the trap deck (docs/phase7-shadowland.md §6 M3)", () => {
  it("is built at setup from the encounter deck's TRAP! cards and the whole named set, with no card text asking", () => {
    const state = game();
    expect(named(state, traps(state).deck)).toEqual(["contraption", "trap-a", "trap-a"]);
    expect(traps(state).discard).toEqual([]);
    expect(named(state, activeEncounterDeck(state).deck).every((id) => id === "treachery")).toBe(true);
    // Each trap card keeps its encounter home: the deck routes discards by trait, not by home.
    for (const id of traps(state).deck) expect(mustInstance(state, id).home.kind).toBe("encounterDeck");
  });

  it("reveals its top card; a TRAP! card goes to the trap discard pile, a card without it to the encounter discard", () => {
    let session = startSession(game());
    const encounterDeckSize = activeEncounterDeck(session.state).deck.length;
    for (let i = 0; i < 3; i++) {
      const top = traps(session.state).deck[0]!;
      const { session: next, events } = use(session, REVEAL_TRAP);
      session = next;
      expect(events).toContainEqual(expect.objectContaining({ type: "encounterCardRevealed", instanceId: top }));
    }
    // All three resolved: the two TRAP! cards to the trap discard pile, the trait-less contraption to the other.
    expect(activeEncounterDeck(session.state).deck).toHaveLength(encounterDeckSize);
    expect(named(session.state, activeEncounterDeck(session.state).discard)).toEqual(["contraption"]);
    // The trap deck emptied with the third reveal; its discard pile was shuffled into a new deck at once.
    expect(named(session.state, [...traps(session.state).deck, ...traps(session.state).discard])).toEqual([
      "trap-a",
      "trap-a",
    ]);
  });

  it("a non-TRAP! card placed in the trap deck is discarded to the encounter discard pile when revealed from it", () => {
    let session = startSession(game());
    const moved = activeEncounterDeck(session.state).deck[0]!;
    session = use(session, ENCOUNTER_INTO_TRAPS).session;
    expect(traps(session.state).deck[0]).toBe(moved);
    expect(discardZoneFor(session.state, moved)).toEqual({
      kind: "encounterDiscard",
      deckId: session.state.encounterDeckOrder[0],
    });
    session = use(session, REVEAL_TRAP).session;
    expect(activeEncounterDeck(session.state).discard).toContain(moved);
    expect(traps(session.state).discard).not.toContain(moved);
  });

  it("a TRAP! card discarded from the encounter deck goes to the trap discard pile", () => {
    let session = startSession(game([TRAP_A.id]));
    const moved = traps(session.state).deck[0]!;
    session = use(session, TRAP_INTO_ENCOUNTER).session;
    expect(activeEncounterDeck(session.state).deck).toContain(moved);
    expect(discardZoneFor(session.state, moved)).toEqual({ kind: "scenarioDiscard", name: DECK });
    // The trap deck is empty and its discard pile too until the discard below, which then refills the deck at once.
    session = use(session, DISCARD_ENCOUNTER_TRAPS).session;
    expect(activeEncounterDeck(session.state).discard).not.toContain(moved);
    expect(traps(session.state).deck).toEqual([moved]);
  });

  it("TRAP! cards discarded together into an empty trap deck's pile are shuffled into the new deck together", () => {
    let session = startSession(game([TRAP_A.id, TRAP_A.id]));
    const both = [...traps(session.state).deck];
    session = use(session, TRAP_INTO_ENCOUNTER).session;
    session = use(session, TRAP_INTO_ENCOUNTER).session;
    expect(traps(session.state).deck).toEqual([]);
    const { session: next, events } = use(session, DISCARD_ENCOUNTER_TRAPS);
    expect(events.filter((event) => event.type === "scenarioDeckReset")).toHaveLength(1);
    expect([...traps(next.state).deck].sort()).toEqual([...both].sort());
    expect(traps(next.state).discard).toEqual([]);
  });

  it("an empty trap deck reshuffles its discard pile without the card resolving, with no encounter deck reset or acceleration token", () => {
    let session = startSession(game([TRAP_A.id, TRAP_A.id]));
    session = use(session, REVEAL_TRAP).session;
    expect(traps(session.state).deck).toHaveLength(1);
    expect(traps(session.state).discard).toHaveLength(1);
    const tokens = session.state.mainScheme.accelerationTokens;
    const last = traps(session.state).deck[0]!;
    const { session: next, events } = use(session, REVEAL_TRAP);
    session = next;
    const kinds = events.map((event) => event.type);
    expect(kinds.filter((type) => type === "scenarioDeckReset")).toHaveLength(1);
    expect(kinds).not.toContain("accelerationTokenAdded");
    // The reset happened as the last card left to resolve: it took the other card only, and the last one was discarded
    // after it, into the pile of a deck that is no longer empty.
    const intoTrapDiscard = events.findIndex(
      (event) => event.type === "cardMoved" && event.instanceId === last && event.to.kind === "scenarioDiscard",
    );
    expect(intoTrapDiscard).toBeGreaterThan(-1);
    expect(kinds.indexOf("scenarioDeckReset")).toBeLessThan(intoTrapDiscard);
    expect(traps(session.state).deck).toHaveLength(1);
    expect(traps(session.state).discard).toEqual([last]);
    expect(session.state.mainScheme.accelerationTokens).toBe(tokens);
    expect(activeEncounterDeck(session.state).discard).toEqual([]);
  });

  it("a surge on a card from the trap deck deals the next card from the encounter deck", () => {
    let session = startSession(game([SURGE_TRAP.id, TRAP_A.id]));
    // Put the surge card on top: reveal until it is next (the deck holds two cards).
    if (mustInstance(session.state, traps(session.state).deck[0]!).cardId !== SURGE_TRAP.id)
      session = use(session, REVEAL_TRAP).session;
    expect(mustInstance(session.state, traps(session.state).deck[0]!).cardId).toBe(SURGE_TRAP.id);
    const trapCards = traps(session.state).deck.length + traps(session.state).discard.length;
    const encounterTop = activeEncounterDeck(session.state).deck[0]!;
    const { session: next, events } = use(session, REVEAL_TRAP);
    session = next;
    expect(events).toContainEqual(expect.objectContaining({ type: "surgeTriggered" }));
    expect(activeEncounterDeck(session.state).deck).not.toContain(encounterTop);
    // Nothing more came from the trap deck: its cards are all still in the deck or its discard pile.
    expect(traps(session.state).deck.length + traps(session.state).discard.length).toBe(trapCards);
  });

  it("with the trap deck and its discard pile both empty, the reveal does nothing", () => {
    let session = startSession(game());
    session = use(session, REMOVE_TRAPS).session;
    expect(traps(session.state).deck).toEqual([]);
    const before = session.state;
    const { session: next, events } = use(session, REVEAL_TRAP);
    expect(events.some((event) => event.type === "encounterCardRevealed")).toBe(false);
    expect(next.state.outcome).toBe(before.outcome);
    expect(activeEncounterDeck(next.state)).toEqual(activeEncounterDeck(before));
  });

  it("replays to the same state, and serializes as plain data", () => {
    let session = startSession(game());
    session = use(session, ENCOUNTER_INTO_TRAPS).session;
    session = use(session, REVEAL_TRAP).session;
    session = use(session, REVEAL_TRAP).session;
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
    expect(JSON.parse(JSON.stringify(session.state.scenarioDecks))).toEqual(session.state.scenarioDecks);
    expect(traps(session.state).discardByTrait).toBe(TRAP);
  });

  it("refuses a trait-routed deck without a discard pile of its own", () => {
    const result = createGame(
      {
        seed: 1,
        cards: [...DEFAULT_CARDS, TOOLKIT, SCHEME, TRAP_A] as readonly AnyCard[],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: [TRAP_A.id],
        scenarioDecks: [{ ...TRAP_DECK, discardPile: "encounter", whenEmpty: "remainsEmpty" }],
        includeIdentitySets: false,
        players: [{ identityCardId: TOOLKIT.id, deck: DEFAULT_DECK }],
      },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});
