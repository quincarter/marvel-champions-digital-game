/**
 * "When your turn begins" as an interrupt (The Poison, `gmw` 16125: "Forced Interrupt: When your turn begins, place 1
 * poison counter here, then take 1 damage for each poison counter here").
 *
 * - A turn beginning opens an interrupt window, then a response window, like a phase beginning (docs/phase7-wave3.md
 *   §3.2): RRG 1.8 "Interrupt" (p. 25) resolves an interrupt "immediately before that triggering condition resolves",
 *   and nothing makes a "begins" timing point response-only. "After your turn begins" (Quinjet, `cap` 03019) answers
 *   in the response window exactly as before.
 * - The "you" of an uncontrolled attachment on a player card is that card's controller (RRG 1.8 "Attachment", p. 8),
 *   and of an obligation the player whose play area it is in (RRG 1.8 "Obligation", p. 30). So "your turn" on an
 *   encounter attachment on P2's identity is P2's turn only, never P1's.
 */

import { cardId, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubObligation, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";
import { TREACHERY } from "./testing/scenario.js";

const self: TargetRef = { kind: "self" };
const n = (value: number): ValueSpec => ({ kind: "const", value });
const add = (counterType: string, amount: ValueSpec = n(1)): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount,
});
const yourTurnBegins = (timing: "interrupt" | "response", effects: readonly EffectSpec[]): AbilityDefinition => ({
  trigger: { kind: timing, forced: true, on: { on: "turnStarted", playerIs: "controller" } },
  effects,
});

// The interrupt records how many responses have resolved when it runs: 0 each time proves it runs first.
const POISON_I = stubAbility(
  "vial.interrupt",
  yourTurnBegins("interrupt", [
    add("interrupts"),
    add("responsesSeenByInterrupt", { kind: "counters", of: self, counterType: "responses" }),
  ]),
);
const POISON_R = stubAbility("vial.response", yourTurnBegins("response", [add("responses")]));
const VIAL = stubAttachment({
  id: "vial",
  attachesTo: { kind: "yourIdentity" },
  abilities: [POISON_I.ref, POISON_R.ref],
});
const QUINJET_R = stubAbility("jet.response", yourTurnBegins("response", [add("responses")]));
const JET = stubSupport({ id: "jet", cost: 0, abilities: [QUINJET_R.ref] });
const BURDEN_R = stubAbility("burden.response", yourTurnBegins("response", [add("responses")]));
const BURDEN = stubObligation({ id: "burden", abilities: [BURDEN_R.ref] });

const deps: EngineDeps = depsOf(POISON_I, POISON_R, QUINJET_R, BURDEN_R);

/** Two players at P1's first turn: the vial on P2's identity, the burden in P2's area, P1's jet in play. */
function start(): { state: GameState; vial: InstanceId; burden: InstanceId; jet: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [VIAL, JET, BURDEN],
    deps,
    players: 2,
    deck: [JET.id],
    encounter: [VIAL.id, BURDEN.id, ...copiesOf(TREACHERY.id, 30)],
  });
  const deckId = activeEncounterDeckId(base);
  const piles = base.encounterDecks[deckId]!;
  const find = (card: CardId): InstanceId => {
    const id = piles.deck.find((candidate) => base.instances[candidate]?.cardId === card);
    if (!id) throw new Error(`no ${card} in the encounter deck`);
    return id;
  };
  const vial = find(VIAL.id);
  const burden = find(BURDEN.id);
  const host = mustPlayer(base, P2).identity.instanceId;
  const surgery: GameState = {
    ...base,
    encounterDecks: {
      ...base.encounterDecks,
      [deckId]: { ...piles, deck: piles.deck.filter((id) => id !== vial && id !== burden) },
    },
    players: base.players.map((p) => (p.playerId === P2 ? { ...p, playArea: [...p.playArea, burden] } : p)),
    instances: {
      ...base.instances,
      [vial]: { ...mustInstance(base, vial), attachedTo: host, faceup: true, controllerId: null },
      [burden]: { ...mustInstance(base, burden), faceup: true, controllerId: null },
      [host]: { ...mustInstance(base, host), attachments: [...mustInstance(base, host).attachments, vial] },
    },
  };
  const jet = playerCardIntoPlay(surgery, cardId("jet"), P1);
  return { state: jet.state, vial, burden, jet: jet.id };
}

const endTurn = (playerId: PlayerId): Command => ({ type: "endTurn", playerId });
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;

describe("a turn beginning opens an interrupt window", () => {
  it("'When your turn begins' interrupts resolve before 'After your turn begins' responses", () => {
    const { state, vial } = start();
    // P1 ends their turn; P2's begins.
    const { session } = driveSession(startSession(state), deps, [endTurn(P1)]);
    expect(counters(session.state, vial)).toMatchObject({ interrupts: 1, responses: 1 });
    expect(counters(session.state, vial)["responsesSeenByInterrupt"] ?? 0).toBe(0);
  });

  it("an attachment's and an obligation's 'your turn' is their player's turn only; a player card's is unchanged", () => {
    const { state, vial, burden, jet } = start();
    const { session } = driveSession(startSession(state), deps, [endTurn(P1)]);
    // P2's turn began once; P1's first turn began before the jet was in play.
    expect(counters(session.state, vial)["interrupts"]).toBe(1);
    expect(counters(session.state, burden)["responses"]).toBe(1);
    expect(counters(session.state, jet)["responses"] ?? 0).toBe(0);
    // P2 ends; the round ends; round 2's first player is P2 (the token passes, RRG 1.8 "Villain Phase", p. 47).
    const round2 = driveSession(session, deps, [endTurn(P2)]).session;
    expect(round2.state.step).toMatchObject({ kind: "turn", activePlayerId: P2 });
    expect(counters(round2.state, vial)["interrupts"]).toBe(2);
    // P2 ends; P1's turn begins: the jet answers, the vial and the burden do not.
    const p1Turn = driveSession(round2, deps, [endTurn(P2)]).session;
    expect(p1Turn.state.step).toMatchObject({ kind: "turn", activePlayerId: P1 });
    expect(counters(p1Turn.state, jet)["responses"]).toBe(1);
    expect(counters(p1Turn.state, vial)).toMatchObject({ interrupts: 2, responses: 2 });
    expect(counters(p1Turn.state, burden)["responses"]).toBe(2);
  });

  it("the turn start's event is initiated (interrupt window) and then resolved (response window)", () => {
    const { state } = start();
    const { events } = driveSession(startSession(state), deps, [endTurn(P1)]);
    const phases = events.flatMap((event: GameEvent) =>
      event.type === "triggerEvent" && event.event.kind === "turnStarted" ? [event.phase] : [],
    );
    expect(phases).toEqual(["initiated", "resolved"]);
  });

  it("replays to the same state", () => {
    const { state } = start();
    const { session } = driveSession(startSession(state), deps, [endTurn(P1), endTurn(P2), endTurn(P2)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
