/**
 * `EffectSpec gainSurge.target`: another card's ability gives surge to the card being revealed. Synthetic cards shaped
 * like "Forced Interrupt: When a [Relic] card is revealed, it gains surge. (Limit once per phase.)" on a side scheme,
 * and a treachery whose When Revealed puts that side scheme into play.
 *
 * Sources: RRG 1.8 "Surge" (p. 42); "Limit" (pp. 26 to 27): a limit counts the uses of that ability on that card, so
 * a card of the trait revealed before the scheme entered play used nothing; "Interrupt" (p. 25).
 */
import { trait, type CardId, type TreacheryCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { PlayerId } from "./ids.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
} from "./testing/wave3.js";

const RELIC = trait("Relic");

const GATE_INTERRUPT = stubAbility("gate.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "encounterCardRevealing", targetIs: { trait: RELIC } },
  },
  limit: { count: 1, period: "phase" },
  effects: [{ kind: "gainSurge", target: { kind: "eventTarget" } }],
});
const GATE = stubSideScheme({ id: "gate", startingThreat: 3, abilities: [GATE_INTERRUPT.ref] });

const relic = (id: string, abilities: TreacheryCard["abilities"] = []): TreacheryCard => ({
  ...stubTreachery({ id, boostIcons: 0, abilities }),
  traits: [RELIC],
});
// Distinct cards rather than copies: `onTopOfEncounterDeck` moves the first copy it finds.
const SHARD = relic("shard");
const SHARD_2 = relic("shard-2");
/** A Relic whose When Revealed puts the gate into play: revealed before the gate was there. */
const KEY_REVEALED = stubAbility("key.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "selectCards", slot: "gate", cards: { kind: "encounter", zones: ["deck"], filter: { name: GATE.name } } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "gate" }, controller: { kind: "controller" } },
  ],
});
const KEY = relic("key", [KEY_REVEALED.ref]);
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const BLANK_2 = stubTreachery({ id: "blank-2", boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const FILLER_2 = stubTreachery({ id: "filler-2", boostIcons: 0 });
const REST = stubTreachery({ id: "rest", boostIcons: 0 });

const deps: EngineDeps = depsOf(GATE_INTERRUPT, KEY_REVEALED);
const CARDS = [GATE, SHARD, SHARD_2, KEY, BLANK, BLANK_2, FILLER, FILLER_2, REST];
const ENCOUNTER: readonly CardId[] = [
  GATE.id,
  KEY.id,
  SHARD.id,
  SHARD_2.id,
  BLANK.id,
  BLANK_2.id,
  FILLER.id,
  FILLER_2.id,
  ...copiesOf(REST.id, 20),
];
const start = (players: 1 | 2 = 1): GameState => gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, players });
const stacked = (state: GameState, cards: readonly CardId[]): GameState =>
  [...cards].reverse().reduce((current, card) => onTopOfEncounterDeck(current, card), state);

/** Plays out the villain phase: every reveal in order, and the cards that were granted surge. */
function villainPhase(state: GameState, players: readonly PlayerId[] = [P1]) {
  const { session, events } = driveSession(
    startSession(state),
    deps,
    players.map((playerId) => ({ type: "endTurn", playerId })),
  );
  const cardOf = (id: string): string => String(session.state.instances[id as never]?.cardId);
  const revealed = events.flatMap((event: GameEvent) =>
    event.type === "encounterCardRevealed" ? [String(event.cardId)] : [],
  );
  const granted = events.flatMap((event) => (event.type === "surgeGranted" ? [cardOf(event.instanceId)] : []));
  return { state: session.state, revealed, granted };
}

describe("gainSurge with a target: 'when a [Relic] card is revealed, it gains surge (limit once per phase)'", () => {
  it("with the scheme in play, the Relic revealed gains surge and the next card is revealed", () => {
    const state = encounterCardInVillainArea(start(), GATE.id).state;
    // The villain's boost card, then the player's card, then the card it surges into.
    const run = villainPhase(stacked(state, [FILLER.id, SHARD.id, BLANK.id]));
    expect(run.revealed).toEqual(["shard", "blank"]);
    expect(run.granted).toEqual(["shard"]);
  });

  it("once per phase: a second Relic revealed that phase gains nothing", () => {
    const state = encounterCardInVillainArea(start(), GATE.id).state;
    const run = villainPhase(stacked(state, [FILLER.id, SHARD.id, SHARD_2.id, BLANK.id]));
    expect(run.revealed).toEqual(["shard", "shard-2"]);
    expect(run.granted).toEqual(["shard"]);
  });

  it("a card without the trait gains nothing and does not use the limit", () => {
    const state = encounterCardInVillainArea(start(2), GATE.id).state;
    // Two boost cards, then p1's blank, then p2's Relic, then the card it surges into.
    const run = villainPhase(stacked(state, [FILLER.id, FILLER_2.id, BLANK.id, SHARD.id, BLANK_2.id]), [P1, P2]);
    expect(run.revealed).toEqual(["blank", "shard", "blank-2"]);
    expect(run.granted).toEqual(["shard"]);
  });

  it("a Relic revealed before the scheme entered play used nothing: the next Relic that phase gains surge", () => {
    // p1 reveals the key (a Relic), which puts the gate into play; p2 then reveals a Relic in the same phase.
    const run = villainPhase(stacked(start(2), [FILLER.id, FILLER_2.id, KEY.id, SHARD.id, BLANK.id]), [P1, P2]);
    expect(run.state.villainArea.map((id) => String(run.state.instances[id]?.cardId))).toContain("gate");
    expect(run.revealed).toEqual(["key", "shard", "blank"]);
    expect(run.granted).toEqual(["shard"]);
  });

  it("without the scheme nothing gains surge", () => {
    const run = villainPhase(stacked(start(), [FILLER.id, SHARD.id, BLANK.id]));
    expect(run.revealed).toEqual(["shard"]);
    expect(run.granted).toEqual([]);
  });
});
