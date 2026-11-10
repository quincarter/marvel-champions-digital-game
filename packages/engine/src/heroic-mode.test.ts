/**
 * Heroic mode (RRG 1.8 "Modes of Play", p. 29; issue #611): "during step three of each villain phase, deal X additional
 * encounter cards to each player". Driven with stub cards.
 *
 * Sources: the same entry; the ruling of August 22, 2025 ("In Heroic Mode level 1, cards would be dealt in the order
 * ABCABC"); "Villain Phase" step 4 (p. 47), revealed "in the order in which they were dealt". Heroic against hazard icons
 * is an engine reading (issue #611 question 2): the per-player rounds first.
 */

import type { AnyCard, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId } from "./query.js";
import type { GameState } from "./state.js";
import { auditVillainPhases } from "./villain/audit.js";
import { depsOf } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const blank = (id: string) => stubTreachery({ id, boostIcons: 0 });
const HAZARD = stubSideScheme({ id: "hazard", startingThreat: 3, icons: ["hazard"], boostIcons: 0 });
const BOOST = blank("boost");
const LETTERS = ["a", "b", "c", "d", "e", "f", "g"].map(blank);
const [A, B, C, D, E, F, G] = LETTERS as [AnyCard, AnyCard, AnyCard, AnyCard, AnyCard, AnyCard, AnyCard];
const FILLER = blank("filler");

const deps: EngineDeps = depsOf();
const CARDS: readonly AnyCard[] = [HAZARD, BOOST, ...LETTERS, FILLER];
const ENCOUNTER: readonly CardId[] = [
  HAZARD.id,
  BOOST.id,
  BOOST.id,
  ...LETTERS.map((card) => card.id),
  ...Array.from({ length: 20 }, () => FILLER.id),
];

function start(options: {
  readonly heroicLevel?: number;
  readonly players: 1 | 2;
  readonly inPlay?: readonly AnyCard[];
  readonly top: readonly AnyCard[];
}): GameState {
  let state = gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, players: options.players });
  for (const card of options.inPlay ?? []) state = encounterCardInVillainArea(state, card.id).state;
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const chosen: InstanceId[] = [];
  for (const card of options.top) {
    const id = piles.deck.find((x) => state.instances[x]?.cardId === card.id && !chosen.includes(x));
    if (!id) throw new Error(`no spare ${card.id} in the encounter deck`);
    chosen.push(id);
  }
  const deck = [...chosen, ...piles.deck.filter((id) => !chosen.includes(id))];
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck } },
    scenarioRules: {
      ...state.scenarioRules,
      ...(options.heroicLevel ? { heroicLevel: options.heroicLevel } : {}),
    },
  };
}

function villainPhase(state: GameState, players: 1 | 2): readonly GameEvent[] {
  const turns = (players === 2 ? [P1, P2] : [P1]).map((playerId) => ({ type: "endTurn", playerId }) as const);
  const { session, events } = driveSession(startSession(state), deps, turns);
  expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  return events;
}

const dealt = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) =>
    e.type === "cardMoved" && e.to.kind === "dealtEncounter" ? [`${e.to.playerId} ${e.cardId}`] : [],
  );
const revealed = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [`${e.playerId} ${e.cardId}`] : []));

describe("heroic mode, step three of the villain phase", () => {
  it("deals one card each with no heroic level", () => {
    const events = villainPhase(start({ players: 2, top: [BOOST, BOOST, A, B, C] }), 2);
    expect(dealt(events)).toEqual(["p1 a", "p2 b"]);
  });

  it("deals around the table at heroic level 1, ABAB and not AABB", () => {
    const events = villainPhase(start({ heroicLevel: 1, players: 2, top: [BOOST, BOOST, A, B, C, D, E] }), 2);
    expect(dealt(events)).toEqual(["p1 a", "p2 b", "p1 c", "p2 d"]);
    // Each player reveals the cards dealt to them, in the order they were dealt.
    expect(revealed(events)).toEqual(["p1 a", "p1 c", "p2 b", "p2 d"]);
  });

  it("deals X additional cards to each player at heroic level X", () => {
    const events = villainPhase(start({ heroicLevel: 3, players: 1, top: [BOOST, A, B, C, D, E] }), 1);
    expect(dealt(events)).toEqual(["p1 a", "p1 b", "p1 c", "p1 d"]);
  });

  it("deals the hazard cards after every per-player round, in player order", () => {
    const state = start({ heroicLevel: 1, players: 2, inPlay: [HAZARD], top: [BOOST, BOOST, A, B, C, D, E, F, G] });
    expect(dealt(villainPhase(state, 2))).toEqual(["p1 a", "p2 b", "p1 c", "p2 d", "p1 e"]);
  });
});
