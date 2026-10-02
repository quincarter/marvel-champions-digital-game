/**
 * docs/phase7-wave6.md §3.61: `TriggerEvent villainStepStarting { step: "dealEncounterCards" }`, "At the start of step
 * three of the villain phase (deal encounter cards)" (Wheel of Genres, Stopped, `mojo` 39026b), driven with stub cards.
 * Its interrupts resolve after step two and before step three deals anything; the step's own deal follows and reads the
 * encounter deck, the players and the hazard icons as the interrupt left them; what the interrupt deals is extra.
 *
 * Sources: RRG 1.8 "Villain Phase" (p. 47) step 3 ("Deal one encounter card to each player"), "Hazard Icon" (p. 22),
 * "Interrupt" (p. 25).
 */

import type { AnyCard, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { auditVillainPhases } from "./villain/audit.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const tally = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "const", value: 1 },
});
const startOfStepThree = { on: "villainStepStarting", eventIs: { step: "dealEncounterCards" } } as const;

/** Wheel of Genres' deal: "Forced Interrupt: At the start of step three …, deal the first player 2 facedown encounter cards". */
const WHEEL_INTERRUPT = stubAbility("wheel.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: startOfStepThree },
  effects: [
    tally("heard"),
    { kind: "dealEncounterCard", player: { kind: "firstPlayer" }, count: { kind: "const", value: 2 } },
  ],
});
const WHEEL = stubEnvironment({ id: "wheel", abilities: [WHEEL_INTERRUPT.ref] });
/** An interrupt that changes the deck step three is about to deal from: "discard the top card of the encounter deck". */
const MILL_INTERRUPT = stubAbility("mill.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: startOfStepThree },
  effects: [{ kind: "discardEncounterCards", count: { kind: "const", value: 1 } }],
});
const MILL = stubEnvironment({ id: "mill", abilities: [MILL_INTERRUPT.ref] });
/** A response to the same timing point, which is never offered: the point has an interrupt window only. */
const ECHO_RESPONSE = stubAbility("echo.forced-response", {
  trigger: { kind: "response", forced: true, on: startOfStepThree },
  effects: [tally("answered")],
});
const ECHO = stubEnvironment({ id: "echo", abilities: [ECHO_RESPONSE.ref] });
const HAZARD = stubSideScheme({ id: "hazard", startingThreat: 3, icons: ["hazard"], boostIcons: 0 });

const blank = (id: string) => stubTreachery({ id, boostIcons: 0 });
/** Taken by the villain's boost draw in step two, one per player. */
const BOOST = blank("boost");
const [A, B, C, D, E] = ["a", "b", "c", "d", "e"].map(blank) as [AnyCard, AnyCard, AnyCard, AnyCard, AnyCard];
const FILLER = blank("filler");

const deps: EngineDeps = depsOf(WHEEL_INTERRUPT, MILL_INTERRUPT, ECHO_RESPONSE);
const CARDS: readonly AnyCard[] = [WHEEL, MILL, ECHO, HAZARD, BOOST, A, B, C, D, E, FILLER];
const ENCOUNTER: readonly CardId[] = [
  WHEEL.id,
  MILL.id,
  ECHO.id,
  HAZARD.id,
  BOOST.id,
  BOOST.id,
  ...[A, B, C, D, E].map((card) => card.id),
  ...Array.from({ length: 20 }, () => FILLER.id),
];

/** A game at the first turn with `inPlay` in the villain's area and `top` stacked on the encounter deck, first on top. */
function start(inPlay: readonly AnyCard[], top: readonly AnyCard[], players: 1 | 2 = 1): GameState {
  let state = gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, players });
  for (const card of inPlay) state = encounterCardInVillainArea(state, card.id).state;
  // A different copy for each entry (two boost cards are two cards), in the order given.
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const chosen: InstanceId[] = [];
  for (const card of top) {
    const id = piles.deck.find((x) => state.instances[x]?.cardId === card.id && !chosen.includes(x));
    if (!id) throw new Error(`no spare ${card.id} in the encounter deck`);
    chosen.push(id);
  }
  const deck = [...chosen, ...piles.deck.filter((id) => !chosen.includes(id))];
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck } } };
}

function villainPhase(state: GameState, players: 1 | 2 = 1) {
  const turns = (players === 2 ? [P1, P2] : [P1]).map((playerId) => ({ type: "endTurn", playerId }) as const);
  return driveSession(startSession(state), deps, turns);
}

/**
 * The villain phase from the end of step two to the start of step four, as the log tells it: the step changes, the
 * timing point's own lines, its window, and every encounter card dealt (`deal <player> <card>`), in order.
 */
function stepThree(events: readonly GameEvent[]): readonly string[] {
  const lines: string[] = [];
  let open = false;
  for (const event of events) {
    if (event.type === "stepChanged") {
      if (event.to.kind === "dealEncounterCards") {
        open = true;
        lines.push(`step dealEncounterCards${event.to.announced ? " (announced)" : ""}`);
      } else if (open) {
        lines.push(`step ${event.to.kind}`);
        open = false;
      }
      continue;
    }
    if (!open) continue;
    if (event.type === "triggerEvent" && event.event.kind === "villainStepStarting") lines.push(event.phase);
    if (event.type === "windowOpened" && event.event.kind === "villainStepStarting")
      lines.push(`${event.timing} window: ${event.candidates.map((c) => c.abilityId).join(", ")}`);
    if (event.type === "cardMoved" && event.to.kind === "dealtEncounter")
      lines.push(`deal ${event.to.playerId} ${event.cardId}`);
    if (event.type === "cardMoved" && event.to.kind === "encounterDiscard") lines.push(`discard ${event.cardId}`);
  }
  return lines;
}

const revealed = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [`${e.playerId} ${e.cardId}`] : []));
const counter = (state: GameState, card: AnyCard, counterType: string): number =>
  Object.values(state.instances).find((i) => i.cardId === card.id)?.counters[counterType] ?? 0;

describe("§3.61 'At the start of step three of the villain phase (deal encounter cards)'", () => {
  it("its interrupt resolves before step three deals anything, and what it deals is on top of the step's own card", () => {
    const { session, events } = villainPhase(start([WHEEL], [BOOST, A, B, C, D]));
    expect(stepThree(events)).toEqual([
      "step dealEncounterCards",
      "step dealEncounterCards (announced)",
      "initiated",
      "interrupt window: wheel.forced-interrupt",
      "deal p1 a",
      "deal p1 b",
      "resolved",
      "deal p1 c",
      "step revealEncounterCards",
    ]);
    expect(revealed(events)).toEqual(["p1 a", "p1 b", "p1 c"]);
    expect(counter(session.state, WHEEL, "heard")).toBe(1);
    // The interrupt's two cards are not the step's deal: the audit counts one card for one player and no hazard icon.
    const audit = auditVillainPhases(session.log, deps);
    expect(audit.violations).toEqual([]);
    expect(audit.phases[0]?.dealt.map((d) => String(session.state.instances[d.instanceId]?.cardId))).toEqual(["c"]);
  });

  it("is announced at no other step, once per villain phase", () => {
    const first = villainPhase(start([WHEEL], [BOOST, A, B, C, BOOST, D, E, FILLER]));
    const steps = (events: readonly GameEvent[]): readonly string[] =>
      events.flatMap((e) =>
        e.type === "stepChanged" && e.from.kind !== e.to.kind
          ? [e.to.kind]
          : e.type === "triggerEvent" && e.event.kind === "villainStepStarting"
            ? [`start of step three: ${e.phase}`]
            : [],
      );
    const round = [
      "endPhaseDiscard",
      "endPhaseDraw",
      "endPhaseReady",
      "placeThreat",
      "enemyActivations",
      "dealEncounterCards",
      "start of step three: initiated",
      "start of step three: resolved",
      "revealEncounterCards",
      "passFirstPlayer",
      "endOfRound",
      "turn",
    ];
    expect(steps(first.events)).toEqual(round);
    const second = driveSession(first.session, deps, [{ type: "endTurn", playerId: P1 }]);
    expect(steps(second.events)).toEqual(round);
    expect(stepThree(second.events)).toEqual([
      "step dealEncounterCards",
      "step dealEncounterCards (announced)",
      "initiated",
      "interrupt window: wheel.forced-interrupt",
      "deal p1 d",
      "deal p1 e",
      "resolved",
      "deal p1 filler",
      "step revealEncounterCards",
    ]);
    expect(counter(second.session.state, WHEEL, "heard")).toBe(2);
    expect(auditVillainPhases(second.session.log, deps).violations).toEqual([]);
  });

  it("nothing is announced when no interrupt listens: step three logs as it always did", () => {
    const unheard = ["step dealEncounterCards", "deal p1 a", "step revealEncounterCards"];
    // The Wheel is in the encounter deck, not in play.
    const none = villainPhase(start([], [BOOST, A, B, C]));
    expect(stepThree(none.events)).toEqual(unheard);
    const change = none.events.find((e) => e.type === "stepChanged" && e.to.kind === "dealEncounterCards");
    expect(change?.type === "stepChanged" && change.to).toEqual({ phase: "villain", kind: "dealEncounterCards" });
    expect(none.events.some((e) => e.type === "triggerEvent" && e.event.kind === "villainStepStarting")).toBe(false);
    // A response to the timing point is not a listener: it has an interrupt window only.
    const answered = villainPhase(start([ECHO], [BOOST, A, B, C]));
    expect(stepThree(answered.events)).toEqual(unheard);
    expect(counter(answered.session.state, ECHO, "answered")).toBe(0);
  });

  it("opens no response window, even with an interrupt listening", () => {
    const { session, events } = villainPhase(start([WHEEL, ECHO], [BOOST, A, B, C]));
    expect(stepThree(events)).toEqual([
      "step dealEncounterCards",
      "step dealEncounterCards (announced)",
      "initiated",
      "interrupt window: wheel.forced-interrupt",
      "deal p1 a",
      "deal p1 b",
      "resolved",
      "deal p1 c",
      "step revealEncounterCards",
    ]);
    expect(counter(session.state, ECHO, "answered")).toBe(0);
  });

  it("the step's own deal reads the encounter deck as the interrupt left it", () => {
    const { session, events } = villainPhase(start([MILL], [BOOST, A, B, C]));
    expect(stepThree(events)).toEqual([
      "step dealEncounterCards",
      "step dealEncounterCards (announced)",
      "initiated",
      "interrupt window: mill.forced-interrupt",
      "discard a",
      "resolved",
      "deal p1 b",
      "step revealEncounterCards",
    ]);
    expect(revealed(events)).toEqual(["p1 b"]);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  });

  it("two players and a hazard icon: the first player's two extra cards leave the step's deal and its hazard count alone", () => {
    const { session, events } = villainPhase(start([WHEEL, HAZARD], [BOOST, BOOST, A, B, C, D, E], 2), 2);
    expect(stepThree(events)).toEqual([
      "step dealEncounterCards",
      "step dealEncounterCards (announced)",
      "initiated",
      "interrupt window: wheel.forced-interrupt",
      "deal p1 a",
      "deal p1 b",
      "resolved",
      // Step three: one card each in player order, then one for the hazard icon, to the first player.
      "deal p1 c",
      "deal p2 d",
      "deal p1 e",
      "step revealEncounterCards",
    ]);
    expect(revealed(events)).toEqual(["p1 a", "p1 b", "p1 c", "p1 e", "p2 d"]);
    const audit = auditVillainPhases(session.log, deps);
    expect(audit.violations).toEqual([]);
    expect(audit.phases[0]?.dealt.map((d) => `${d.playerId} ${session.state.instances[d.instanceId]?.cardId}`)).toEqual(
      ["p1 c", "p2 d", "p1 e"],
    );
  });

  it("replays to the same state", () => {
    const { session } = villainPhase(start([WHEEL, HAZARD], [BOOST, BOOST, A, B, C, D, E], 2), 2);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
