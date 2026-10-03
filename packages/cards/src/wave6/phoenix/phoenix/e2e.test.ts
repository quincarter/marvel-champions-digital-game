import {
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { phoenixGame } from "./support.js";

/**
 * Whole games with Phoenix's own precon (`phoenix-justice`, `packages/content/src/data/phoenix/starterDecks.ts`),
 * modeled on `../../cyclops/cyclops/e2e.test.ts`: the card-name-agnostic greedy driver to a real outcome (solo,
 * 2-player with Cyclops, expert), and hand-scripted sessions through her kit (Psionic Bond flipping Phoenix Force to
 * Unleashed, Psychic Manipulation answering Swift Retribution, Burning Hunger revealing Dark Phoenix, Jean Grey's
 * recover flipping Phoenix Force back, Burning Hunger spending a counter while Restrained). Every scripted step goes
 * through `sessionApply`, so each log replays deep-equal.
 *
 * Psychic Rapport / Soul Sisters are not scripted here: Psychic Rapport's Team-Up needs a Cyclops card in Phoenix's own
 * deck (her precon has the Cyclops ally 34003, covered in `events.test.ts` and `../../cyclops/cyclops/cross-hero.test.ts`).
 */
const SEED = 2026;
const ADVANCE = "01186";

function settle(session: GameSession, pick: Picker): GameSession {
  let current = session;
  for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (${current.state.pendingChoice.prompt.kind})`);
    const choice = current.state.pendingChoice;
    const result = sessionApply(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(current.state),
      },
      WAVE6_DEPS,
    );
    if (!result.ok) throw new Error(`resolveChoice rejected: ${result.error.code}: ${result.error.message}`);
    current = result.session;
  }
  return current;
}

function step(session: GameSession, command: Command, pick: Picker = firstLegal): GameSession {
  const result = sessionApply(session, command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
  return settle(result.session, pick);
}

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

const forceOf = (state: GameState): InstanceId => instancesOf(state, "34002a")[0]!;
const powerOf = (state: GameState): number => inst(state, forceOf(state)).counters.power ?? 0;
const inPlay = (state: GameState, code: string): InstanceId | undefined =>
  instancesOf(state, code).find((id) => cardsInPlay(state).includes(id));

/** `n` more cards from P1's deck into the hand, to pay with. */
const stocked = (state: GameState, n: number): GameState => ({
  ...state,
  players: state.players.map((p) =>
    p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, n)], deck: p.deck.slice(n) } : p,
  ),
});

/** Takes the named optional trigger; pays a `payForCard` prompt with its first 3 options; otherwise the first legal. */
const choosing =
  (text: string): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label.includes(text) || o.optionId.includes(text));
    if (hit) return [hit.optionId];
    return state.pendingChoice?.prompt.kind === "payForCard"
      ? state.pendingChoice.options.slice(0, 3).map((o) => o.optionId)
      : firstLegal(state);
  };

function greedy(config: ReturnType<typeof wave6Scenario>) {
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE6_DEPS);
  console.info(
    `[wave6 e2e] Phoenix: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

describe("Phoenix (phoenix-justice) vs Rhino", () => {
  it("solo, standard: plays to an outcome and replays deep-equal", () => {
    greedy(wave6Scenario("rhino", { players: [{ starterDeckId: "phoenix-justice" }], seed: SEED }));
  }, 120_000);

  it("2-player, standard: Phoenix + Cyclops (Leadership)", () => {
    greedy(
      wave6Scenario("rhino", {
        players: [{ starterDeckId: "phoenix-justice" }, { starterDeckId: "cyclops-leadership" }],
        seed: SEED,
      }),
    );
  }, 120_000);

  it("solo, expert", () => {
    const config = wave6Scenario("rhino", {
      players: [{ starterDeckId: "phoenix-justice" }],
      seed: SEED,
      difficulty: "expert",
    });
    expect(config.difficulty).toBe("expert");
    greedy(config);
  }, 120_000);

  it("scripted: Psionic Bond flips Phoenix Force to Unleashed, Psychic Manipulation answers Swift Retribution, Burning Hunger reveals Dark Phoenix", () => {
    const base = withForm(stocked(phoenixGame("rhino", { seed: SEED }), 8), { heroForm: 0 });
    const prepared = patchInstance(
      patchInstance(base, forceOf(base), { flipped: false, counters: { power: 1 } }),
      base.mainScheme.instanceId,
      { threat: 3 },
    );
    const given = moveToHand(prepared, P1, "34019", "34017", "34024");
    const [swift, , downTimeInHand] = given.ids as [InstanceId, InstanceId, InstanceId];
    // The villain is stunned (as in obligation-nemesis.test.ts) so its own boost card does not take the stacked one.
    const villain = given.state.villains[0]!.instanceId;
    const stunned = patchInstance(given.state, villain, {
      statuses: { ...inst(given.state, villain).statuses, stunned: 1 },
    });
    const withHunger = stackEncounterDeck(stunned, ADVANCE, "34028", ADVANCE);
    let session = startSession(withHunger);
    const hero = identityOf(withHunger, P1);
    expect(inst(session.state, forceOf(session.state)).flipped).toBe(false);

    // Psionic Bond pays Down Time's whole cost, removing the last power counter: Phoenix Force flips (Q24).
    session = step(
      session,
      play(P1, downTimeInHand, [], { abilities: [resourceAbility(hero, "34001a.psionic-bond")] }),
    );
    expect(powerOf(session.state)).toBe(0);
    expect(inst(session.state, forceOf(session.state)).flipped).toBe(true);

    // Swift Retribution: the villain schemes; Psychic Manipulation makes that scheme remove threat instead.
    const before = mainThreat(session.state);
    session = step(session, play(P1, swift, payWith(session.state, P1, 1, [swift])), choosing("Psychic Manipulation"));
    expect(mainThreat(session.state)).toBeLessThan(before);
    expect(playerOf(session.state, P1).discard.some((id) => session.state.instances[id]!.cardId === "34017")).toBe(
      true,
    );

    // Villain phase: Burning Hunger is revealed while Unleashed, so Dark Phoenix and Consume the World come into play.
    session = step(session, { type: "endTurn", playerId: P1 });
    expect(inPlay(session.state, "34029")).toBeDefined();
    expect(inPlay(session.state, "34030")).toBeDefined();
    expect(session.state.removedFromGame).toContain(instancesOf(session.state, "34028")[0]);
    session = step(session, { type: "endTurn", playerId: P1 });
    assertReplays(session);
  });

  it("scripted: Jean Grey's basic recover places the 4th power counter and flips Phoenix Force back to Restrained", () => {
    const base = phoenixGame("rhino", { seed: SEED });
    const unleashed = patchInstance(
      patchInstance(base, forceOf(base), { flipped: true, counters: { power: 3 } }),
      identityOf(base, P1),
      { damage: 3 },
    );
    let session = startSession(unleashed);
    session = step(session, { type: "basicRecover", playerId: P1 }, (state) => {
      const options = state.pendingChoice?.options ?? [];
      return options.length > 0 ? [options[0]!.optionId] : [];
    });
    expect(powerOf(session.state)).toBe(4);
    expect(inst(session.state, forceOf(session.state)).flipped).toBe(false);
    session = step(session, { type: "endTurn", playerId: P1 });
    assertReplays(session);
  });

  it("scripted: Burning Hunger while Restrained removes a power counter instead, and Dark Phoenix stays away", () => {
    const base = phoenixGame("rhino", { seed: SEED });
    const restrained = patchInstance(base, forceOf(base), { flipped: false, counters: { power: 3 } });
    let session = startSession(stackEncounterDeck(restrained, ADVANCE, "34028", ADVANCE));
    session = step(session, { type: "endTurn", playerId: P1 });
    expect(powerOf(session.state)).toBe(2);
    expect(inPlay(session.state, "34029")).toBeUndefined();
    session = step(session, { type: "endTurn", playerId: P1 });
    assertReplays(session);
  });
});
