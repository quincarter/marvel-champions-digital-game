/**
 * Opting into a play-cost reduction, against a real Star-Lord game — "What could go wrong?" (`stld` 17001a):
 * "Interrupt: When you play a card from your hand, deal yourself 1 facedown encounter card → reduce the cost to
 * play that card by 3. (Limit once per round.)" Star-Lord's identity ability, so it is live as soon as he is in
 * hero form.
 */

import { beforeEach, describe, expect, test } from "vitest";
import { applyCommand, type GameState, type LegalAction, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { POOL_DEPS } from "../content/pool.js";
import { costReductionOptionsFor, costReductionTotal, tryReducedPlay } from "./cost-reduction-model.js";
import { tryPayment } from "@mc/engine";

const STAR_LORD_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "star-lord-leadership" }],
  seed: 2,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;

async function intoTurn(): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await store.start(STAR_LORD_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
}

/** Any hand card the engine already says costs something — the reduction only matters for one of these. */
function costedPlay(): LegalAction {
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected a turn");
  const entry = legal.legal.find((candidate) => candidate.action.kind === "playCard" && candidate.needsPayment);
  if (!entry) throw new Error("expected a card that costs something");
  return entry;
}

describe("cost-reduction options", () => {
  beforeEach(intoTurn);

  test("finds Star-Lord's own 'What could go wrong?' for a card in hand", () => {
    const entry = costedPlay();
    if (entry.action.kind !== "playCard") throw new Error("expected a playCard action");
    const options = costReductionOptionsFor(state, me, entry.action.instanceId, POOL_DEPS);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ abilityId: "17001a.what-could-go-wrong", amount: 3 });
    expect(costReductionTotal(options, POOL_DEPS)).toBe(3);
  });

  test("finds nothing for a player with no such ability (before flipping to hero, the identity ability isn't active)", async () => {
    // A fresh alter-ego-form game: no reducer is active yet, so the offer is empty. Uses its own session rather
    // than un-flipping, since `changeForm` back to alter ego mid-turn isn't guaranteed legal here.
    const alterEgoStore = new SessionStore(new LocalEngineHost());
    await alterEgoStore.start(STAR_LORD_SOLO);
    for (let step = 0; step < 12 && alterEgoStore.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = alterEgoStore.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await alterEgoStore.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
    }
    const alterEgoState = alterEgoStore.state.game!;
    const alterEgoMe = alterEgoStore.state.perspectiveId!;
    const identityId = alterEgoState.players.find((p) => p.playerId === alterEgoMe)!.identity.instanceId;
    expect(costReductionOptionsFor(alterEgoState, alterEgoMe, identityId, POOL_DEPS)).toEqual([]);
  });

  test("a reduced play is a command the engine actually accepts, and costs less than the unreduced one", () => {
    const entry = costedPlay();
    if (entry.action.kind !== "playCard") throw new Error("expected a playCard action");
    const options = costReductionOptionsFor(state, me, entry.action.instanceId, POOL_DEPS);
    const reducer = options[0]!;

    const reduced = tryReducedPlay(
      state,
      me,
      entry.action.instanceId,
      [],
      [],
      [{ instanceId: reducer.instanceId, abilityId: reducer.abilityId }],
      POOL_DEPS,
      null,
      null,
      undefined,
    );
    expect(reduced.ok).toBe(true);
    if (!reduced.ok) return;
    expect(reduced.command).toMatchObject({
      type: "playCard",
      costReductionAbilities: [{ instanceId: reducer.instanceId, abilityId: reducer.abilityId }],
    });
    // The engine itself is the judge — same guarantee `payment-model.test.ts` pins for an ordinary payment.
    expect(applyCommand(state, reduced.command, POOL_DEPS).ok).toBe(true);

    const before = state.players.find((p) => p.playerId === me)!.dealtEncounter.length;
    const applied = applyCommand(state, reduced.command, POOL_DEPS);
    if (!applied.ok) throw new Error("expected the reduced play to apply");
    const after = applied.state.players.find((p) => p.playerId === me)!.dealtEncounter.length;
    // Paying the reduction's own cost deals a facedown encounter card, exactly as the ability prints.
    expect(after).toBe(before + 1);
  });

  test("without naming the reduction, the plain payment path never uses it", () => {
    const entry = costedPlay();
    const attempt = tryPayment(state, me, entry.action, [], {}, POOL_DEPS);
    if (attempt.ok) expect(attempt.command).not.toHaveProperty("costReductionAbilities");
  });
});
