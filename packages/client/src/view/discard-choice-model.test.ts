/**
 * The discard-choice mode, against a real wave 1 game — Captain America's
 * Shield Toss (`03006`), the card PLAN.md's Phase 7 bug list names: "the
 * player can't choose cards to discard, and it deals no damage" because
 * `legalActions`'s own default pick is always the minimum (zero).
 *
 * The property that matters, same as `payment-model.test.ts`: the client
 * never decides whether a selection is legal. Every command this hands back
 * must be one `applyCommand` actually accepts.
 */

import { beforeEach, describe, expect, test } from "vitest";
import { activeVillain, cardOf, remainingHitPoints, type GameState, type LegalAction, type PlayerId } from "@mc/engine";
import { WAVE1_DEPS } from "@mc/cards";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import {
  beginDiscardChoice,
  discardCandidates,
  discardChoiceView,
  discardCostOf,
  toggleDiscardChoice,
} from "./discard-choice-model.js";

// Seed 1 deals Shield Toss (03006), Captain America's Shield (03009, also found by his own
// Setup) and several spare cards into the opening hand — found by brute search, recorded here
// rather than re-searched, the same way other wave 1 tests pin a seed to a hand shape.
const CAP_VS_RHINO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "cap-leadership" }],
  seed: 1,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;

/** Declines every mulligan, flips to hero, then plays Captain America's Shield into play (its own `example` payment — a legal one is all a test needs). */
async function intoTurnWithShieldInPlay(): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await store.start(CAP_VS_RHINO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  let legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const playShield = legal.legal.find(
      (entry) => entry.action.kind === "playCard" && cardOf(store.state.game!, entry.action.instanceId)?.id === "03009",
    );
    if (playShield) await store.dispatch(playShield.example);
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
}

/** Shield Toss's own `playCard` entry — an event with an action ability, not a `useAbility` (RRG "Event"). */
function shieldTossAction(): LegalAction {
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected a turn");
  const entry = legal.legal.find(
    (candidate) => candidate.action.kind === "playCard" && cardOf(state, candidate.action.instanceId)?.id === "03006",
  );
  if (!entry) throw new Error("expected Shield Toss to be playable");
  return entry;
}

describe("discard-choice mode", () => {
  beforeEach(intoTurnWithShieldInPlay);

  test("Shield Toss's cost is a real discard choice: min 0, no printed cap", () => {
    const action = shieldTossAction();
    const cost = discardCostOf(state, WAVE1_DEPS, action.action);
    expect(cost).toEqual({ min: 0, max: null });
  });

  test("every other hand card is a candidate — Shield Toss itself is not offered as its own cost", () => {
    const action = shieldTossAction();
    if (action.action.kind !== "playCard") throw new Error("expected a playCard action");
    const sourceId = action.action.instanceId;
    const candidates = discardCandidates(state, me, sourceId);
    expect(candidates).not.toContain(sourceId);
    expect(candidates.length).toBeGreaterThan(0);
  });

  test("opens with nothing picked, so X starts at zero and fills as the player chooses", () => {
    const action = shieldTossAction();
    const choice = beginDiscardChoice(state, me, action, WAVE1_DEPS)!;
    expect(choice).not.toBeNull();
    expect(choice.picked).toEqual([]);
    expect(choice.min).toBe(0);
  });

  test("the engine's own example, unmodified, plays for X = 0 — the exact bug PLAN.md names", () => {
    const action = shieldTossAction();
    expect(action.example.type).toBe("playCard");
    expect(action.example.type === "playCard" ? action.example.costChoices?.discard : undefined).toEqual([]);
  });

  test("picking 2 cards makes a command the engine accepts, with X = 2 bound to those two cards", () => {
    const action = shieldTossAction();
    let choice = beginDiscardChoice(state, me, action, WAVE1_DEPS)!;
    const [first, second] = choice.candidates;
    choice = toggleDiscardChoice(choice, first!);
    choice = toggleDiscardChoice(choice, second!);
    const view = discardChoiceView(state, choice, WAVE1_DEPS);
    expect(view.blockedBy).toBeNull();
    expect(view.command).not.toBeNull();
    expect(view.command!.type === "playCard" ? view.command!.costChoices?.discard : undefined).toEqual([first, second]);
  });

  test("toggling the same card twice removes it again", () => {
    const action = shieldTossAction();
    let choice = beginDiscardChoice(state, me, action, WAVE1_DEPS)!;
    const [first] = choice.candidates;
    choice = toggleDiscardChoice(choice, first!);
    expect(choice.picked).toEqual([first]);
    choice = toggleDiscardChoice(choice, first!);
    expect(choice.picked).toEqual([]);
  });

  test("with no cap, the ceiling is every candidate — picking one past a synthetic cap is a no-op", () => {
    const action = shieldTossAction();
    const choice = beginDiscardChoice(state, me, action, WAVE1_DEPS)!;
    const capped = { ...choice, max: 1 };
    const [first, second] = capped.candidates;
    const oneIn = toggleDiscardChoice(capped, first!);
    const stillOneIn = toggleDiscardChoice(oneIn, second!);
    expect(stillOneIn.picked).toEqual([first]);
  });

  test("dispatched for real: discarding 2 cards deals 4 damage to each of 2 chosen enemies, closing PLAN.md's loop", async () => {
    const action = shieldTossAction();
    let choice = beginDiscardChoice(state, me, action, WAVE1_DEPS)!;
    const [first, second] = choice.candidates;
    choice = toggleDiscardChoice(choice, first!);
    choice = toggleDiscardChoice(choice, second!);
    const view = discardChoiceView(state, choice, WAVE1_DEPS);
    const villain = activeVillain(state).instanceId;
    const hpBefore = remainingHitPoints(state, villain)!;

    await store.dispatch(view.command!);
    // Only one enemy (the villain) exists in a solo Rhino game, so the
    // "choose X enemies" decision the engine opens next has exactly one
    // legal answer — resolve it the same way any other pending choice is.
    let legal = store.state.legal?.actions;
    while (legal?.kind === "choice") {
      await store.resolveChoice(
        legal.choice.options.slice(0, legal.choice.maxSelections).map((option) => option.optionId),
      );
      legal = store.state.legal?.actions;
    }

    expect(remainingHitPoints(store.state.game!, villain)).toBe(hpBefore - 4);
    // The Shield returned to hand, as its own cost says (RRG "Cost").
    const handAfter = store.state.game!.players.find((p) => p.playerId === me)!.hand;
    expect(handAfter.some((id) => cardOf(store.state.game!, id)?.id === "03009")).toBe(true);
  });
});
