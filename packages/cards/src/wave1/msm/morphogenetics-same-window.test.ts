/**
 * Issue #804: an event Morphogenetics (05001a) returns to hand is a fresh copy, and may be played again in response to
 * the same occurrence. RRG 1.8 "Response" (p. 38) and "Triggering Condition" (p. 45): each response is used once per
 * occurrence per card, and several copies may each answer it. FFG ruling (RRG 1.0-1.4 rulings, Ms. Marvel): Wiggle Room
 * retrieved with Morphogenetics "can be played again in response to the same instance. It's the same as if you had 2
 * copies".
 *
 * Real content: Ms. Marvel (Protection) in hero form against Rhino. She plays Clear the Area (04049) on the main scheme
 * with 1 threat; Turn the Tide (15015) answers the removal of its last threat by her thwart. And the ruling's own case,
 * in an interrupt window: Rhino attacks her and Wiggle Room (05005) prevents 3 of the damage, twice.
 */

import { applyCommand, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  identityOf,
  inst,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { conjure, DEPS, game, villainOf } from "../../wave7/rulings-2026-10-06-harness.js";

const TURN_THE_TIDE = "15015.turn-the-tide-response";
const MORPHOGENETICS = "05001a.morphogenetics";

interface Run {
  readonly state: GameState;
  readonly turnTheTide: InstanceId;
  /** For each `chooseTriggers` prompt, the abilities it offered. */
  readonly offers: readonly (readonly string[])[];
}

/** Clear the Area clears the main scheme's last threat; Turn the Tide is played up to `plays` times. */
function clearWithTurnTheTide(opts: { readonly plays: number; readonly morph: boolean }): Run {
  let state = game("rhino", ["msm-protection"], ["bomb_scare"]);
  state = patchInstance(state, state.mainScheme.instanceId, { threat: 1 });
  const clear = conjure(state, P1, "04049");
  const tide = conjure(clear.state, P1, "15015");
  state = tide.state;
  const offers: string[][] = [];
  let played = 0;
  let morphed = false;
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") {
      const ids = choice.options.map((option) => option.optionId);
      offers.push(ids.map((id) => id.split(":").slice(1).join(":")));
      const tideOption = ids.find((id) => id === `${tide.id}:${TURN_THE_TIDE}`);
      if (tideOption && played < opts.plays) {
        played++;
        return [tideOption];
      }
      const morphOption = ids.find((id) => id.endsWith(`:${MORPHOGENETICS}`));
      if (morphOption && opts.morph && !morphed) {
        morphed = true;
        return [morphOption];
      }
      return [];
    }
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    return choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
  };
  const result = applyCommand(state, play(P1, clear.id, payWith(state, P1, 1, [clear.id, tide.id])), DEPS);
  if (!result.ok) throw new Error(result.error.message);
  return { state: settle(result.state, pick, undefined, DEPS), turnTheTide: tide.id, offers };
}

const tideOffers = (run: Run): number => run.offers.filter((ids) => ids.includes(TURN_THE_TIDE)).length;

describe("Morphogenetics returns Turn the Tide, which answers the same removal again (#804)", () => {
  it("Turn the Tide returned to hand is offered again in the same window, and a second play deals 3 more", () => {
    const run = clearWithTurnTheTide({ plays: 2, morph: true });
    const villain = villainOf(run.state);
    expect(run.state.stack).toEqual([]);
    expect(inst(run.state, run.state.mainScheme.instanceId).threat).toBe(0);
    expect(tideOffers(run)).toBe(2);
    expect(inst(run.state, villain).damage).toBe(6);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(true);
    // The second play was not returned (Ms. Marvel was exhausted): it is in the discard.
    expect(playerOf(run.state, P1).discard).toContain(run.turnTheTide);
  });

  it("returned and declined: offered again once, and nothing more resolves", () => {
    const run = clearWithTurnTheTide({ plays: 1, morph: true });
    expect(tideOffers(run)).toBe(2);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(3);
    expect(playerOf(run.state, P1).hand).toContain(run.turnTheTide);
  });

  it("without Morphogenetics, Turn the Tide is played once and not offered again", () => {
    const run = clearWithTurnTheTide({ plays: 2, morph: false });
    expect(tideOffers(run)).toBe(1);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(3);
    expect(playerOf(run.state, P1).discard).toContain(run.turnTheTide);
  });
});

const WIGGLE_ROOM = "05005.wiggle-room-interrupt";
const ADVANCE = "01186"; // 0 boost icons
const SHOCKER = "01103"; // 2 boost icons

/**
 * P1 ends her turn with Wiggle Room in hand; Rhino attacks her with `boost` as his boost card (ATK 2 plus its icons), and
 * Advance is the card she is dealt. Wiggle Room is played whenever offered and Morphogenetics used once. Settled until
 * the next player phase.
 */
function attackedWithWiggleRoom(boost: string) {
  const start = game("rhino", ["msm-protection"], ["bomb_scare"]);
  const given = conjure(stackEncounterDeck(start, boost, ADVANCE), P1, "05005");
  const wiggle = given.id;
  const identity = identityOf(given.state);
  const deckBefore = playerOf(given.state, P1).deck.length;
  let wiggleOffers = 0;
  let morphed = false;
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") {
      const ids = choice.options.map((option) => option.optionId);
      const wiggleOption = ids.find((id) => id === `${wiggle}:${WIGGLE_ROOM}`);
      if (wiggleOption) {
        wiggleOffers++;
        return [wiggleOption];
      }
      const morphOption = ids.find((id) => id.endsWith(`:${MORPHOGENETICS}`));
      if (morphOption && !morphed) {
        morphed = true;
        return [morphOption];
      }
      return [];
    }
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "discardDownToHandSize")
      return choice.options
        .map((option) => option.optionId)
        .filter((id) => id !== wiggle)
        .slice(0, choice.minSelections);
    return choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
  };
  const ended = applyCommand(given.state, endTurn(), DEPS);
  if (!ended.ok) throw new Error(ended.error.message);
  const after = settle(ended.state, pick, (s) => s.step.phase === "player" && s.pendingChoice === null, DEPS);
  return { state: after, wiggle, identity, wiggleOffers, morphed, drawn: deckBefore - playerOf(after, P1).deck.length };
}

describe("Morphogenetics returns Wiggle Room, which answers the same attack again (ruling, RRG 1.0-1.4, Ms. Marvel)", () => {
  it("4 damage: Wiggle Room prevents 3, comes back, and is played again for the rest, drawing again", () => {
    const run = attackedWithWiggleRoom(SHOCKER);
    expect(run.morphed).toBe(true);
    expect(run.wiggleOffers).toBe(2);
    expect(inst(run.state, run.identity).damage).toBe(0);
    // One more card drawn than with a single play (both runs draw the same at the end of her turn).
    expect(run.drawn).toBe(attackedWithWiggleRoom(ADVANCE).drawn + 1);
    expect(playerOf(run.state, P1).discard).toContain(run.wiggle);
  });

  it("2 damage: the first Wiggle Room prevents it all, so the returned copy is not offered again", () => {
    const run = attackedWithWiggleRoom(ADVANCE);
    expect(run.morphed).toBe(true);
    expect(run.wiggleOffers).toBe(1);
    expect(inst(run.state, run.identity).damage).toBe(0);
    expect(playerOf(run.state, P1).hand).toContain(run.wiggle);
  });
});
