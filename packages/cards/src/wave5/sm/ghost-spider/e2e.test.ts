import {
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameSession,
} from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  payWith,
  picking,
  play,
  playerOf,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { playToOutcome } from "../../../testing/driver.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "./support.js";

/**
 * A real game test for Ghost-Spider's own real precon (`ghost-spider`, `packages/content/src/data/sm/
 * starterDecks.ts`) against Rhino (a Core scenario, seated with the wave 5 pool — `ghostSpiderScenario`'s own
 * `wave5Scenario` fallback, docs/phase7-wave5.md §5). Modeled on `wave4/vision/e2e.test.ts` and
 * `wave4/mts/two-player-e2e.test.ts`: one game played entirely by the card-name-agnostic greedy driver to a real
 * outcome, one hand-scripted game that deliberately drives her own signature interactions (a basic attack that
 * triggers an Interrupt/Response event and, through it, her own "Dizzying Reflexes"; a form change; George Stacy
 * and Parental Guidance's facedown attach; an ally; a villain-phase encounter card reveal), one game that reveals
 * her own obligation (Worried Father) from a stacked encounter deck and lets the driver carry the game to an
 * outcome around it, and one 2-player game against a Core hero. Every scripted game is driven through
 * `sessionApply` (never bare `applyCommand`/state surgery once the session has started), so its own log always
 * replays to the same final state — this exists to catch a Ghost-Spider ability that's individually well-tested
 * but breaks when the generic driver, or a specific multi-card sequence, actually drives it through a full turn
 * cycle.
 */

const SEED = 2026;
const ghostSpiderVsRhino = (seed = SEED) => startWave5Game(ghostSpiderScenario("rhino", { seed }));

/** `sessionApply`, throwing on an illegal command — every scripted step in this file goes through this, never
 * bare `applyCommand`/state surgery, so the resulting session log always replays deterministically. */
function step(session: GameSession, command: Command, pick: Picker = firstLegal): GameSession {
  const result = sessionApply(session, command, WAVE5_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
  return settleSession(result.session, pick);
}

/** Resolves every pending choice left by the last command with `pick`, each one its own logged `resolveChoice`. */
function settleSession(session: GameSession, pick: Picker): GameSession {
  let current = session;
  for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (stuck on ${current.state.pendingChoice.prompt.kind})`);
    const choice = current.state.pendingChoice;
    const result = sessionApply(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(current.state),
      },
      WAVE5_DEPS,
    );
    if (!result.ok) throw new Error(`resolveChoice rejected: ${result.error.code}: ${result.error.message}`);
    current = result.session;
  }
  return current;
}

/** Accepts the named optional response/interrupt (by ability id); declines everything else — `events-a.test.ts`'s
 * own `accepting`, ported here so this file's scripted game can drive Ghost Kick's own Response window. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

test("Rhino (standard), solo: Ghost-Spider", () => {
  const config = ghostSpiderScenario("rhino", { seed: SEED });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard) — Ghost-Spider: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (standard), solo: Ghost-Spider — a scripted playthrough of her own kit", () => {
  // Every genuine data/state edit (staging hand cards, staging the encounter deck) happens before `startSession`,
  // so it becomes part of the session's own `log.initialState` — every later step is a real, logged command, and
  // `replay` reproduces the whole game including this setup.
  const base = ghostSpiderVsRhino();
  const staged = moveToHand(base, P1, "27002", "27007", "27003", "27004", "27010").state;
  // Advance (0 boost icons) as a throwaway filler for Rhino's own automatic boost draw, then Hard to Keep Down
  // (0 boost icons, "When Revealed: Rhino heals 4 damage") as the real reveal dealt to the player round 1.
  const initial = stackEncounterDeck(staged, "01186", "01104");
  const identity = identityOf(initial);
  const villain = initial.villains[0]!.instanceId;

  let session = startSession(initial);

  // Round 1, still in alter-ego form (the default starting form): George Stacy (27007, a support) into play, then
  // Parental Guidance (27003, an Alter-Ego Action — `events-a.test.ts`'s own first test plays it without ever
  // going hero) attaches an event to him facedown. Both before the form change below, since only one voluntary
  // change is allowed per round (RRG 1.8 "Form, Change Form") and the basic attack that follows needs hero form.
  const [stacyId] = moveToHand(session.state, P1, "27007").ids;
  session = step(session, play(P1, stacyId!, payWith(session.state, P1, 1, [stacyId!])));
  const [pg, phantomFlip] = moveToHand(session.state, P1, "27003", "27004").ids;
  session = step(
    session,
    play(P1, pg!, payWith(session.state, P1, 0, [pg!])),
    picking(phantomFlip!), // several of her own events are legal to attach; name Phantom Flip explicitly.
  );
  expect(inst(session.state, phantomFlip!).attachedTo).toBe(stacyId);
  expect(inst(session.state, phantomFlip!).faceup).toBe(false);

  // The round's one voluntary form change, to hero: a basic attack that triggers Ghost Kick's own Response
  // (27002), and through it her own "Dizzying Reflexes" (27001a) readying her right back up.
  session = step(session, toHero(P1));
  const damageBefore = inst(session.state, villain).damage;
  session = step(
    session,
    { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain },
    accepting("27002.ghost-kick-response", "27001a.ghost-spider-constant"),
  );
  // 2 (Ghost-Spider's own ATK) + 6 (Ghost Kick).
  expect(inst(session.state, villain).damage).toBe(damageBefore + 8);
  expect(inst(session.state, identity).exhausted).toBe(false); // Dizzying Reflexes readied her back up.

  // Silk (27010, an ally) into play.
  const [silk] = moveToHand(session.state, P1, "27010").ids;
  session = step(session, play(P1, silk!, payWith(session.state, P1, 2, [silk!])));
  expect(cardsInPlay(session.state)).toContain(silk);

  // End the round: the villain phase reveals Hard to Keep Down (staged above), resolving its own boost draw and
  // Rhino's own activation with no operator intervention beyond declining every optional trigger/defender.
  session = step(session, { type: "endTurn", playerId: P1 });
  expect(session.state.round).toBeGreaterThanOrEqual(2);
  expect(inst(session.state, villain).damage).toBeGreaterThanOrEqual(0);

  // Round 2, still in hero form from round 1 (form persists across rounds): one form change back to alter-ego —
  // the round's own single voluntary change — then her alter-ego action (27001b, "Gwen Stacy").
  session = step(session, toHero(P1));
  const player2 = playerOf(session.state, P1);
  expect(player2.identity.form).toBe("alterEgo");
  session = step(session, {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: identity,
    abilityId: "27001b.gwen-stacy-action" as never,
    payment: [],
  });
  session = step(session, { type: "endTurn", playerId: P1 });
  expect(session.state.round).toBeGreaterThanOrEqual(3);

  assertReplays(session);
});

test("Rhino (standard), solo: Ghost-Spider — reveals her own obligation (Worried Father) when drawn", () => {
  const base = ghostSpiderVsRhino(4);
  // Advance filler for Rhino's own automatic boost draw, then Worried Father dealt to the player as their own
  // reveal round 1 (`../../../testing/staging.ts`'s own "boost card eats the bare top card" trap, worked around
  // the same way `obligation-nemesis.test.ts` does).
  const initial = stackEncounterDeck(base, "01186", "27025");
  let session = startSession(initial);
  session = step(session, toHero(P1));
  session = step(session, { type: "endTurn", playerId: P1 });

  // Worried Father resolved: George Stacy found (still only in the deck at this seed) and attached facedown to
  // the obligation, which itself sits in the alter-ego player's own zone, not `villainArea` — an obligation isn't
  // an enemy (`obligation-nemesis.test.ts`'s own first two tests confirm this same shape without going through a
  // full game). Only up to here is asserted on directly: by the time a real game reaches its own outcome, Worried
  // Father may have already been resolved further (its Alter-Ego Action moves it to `removedFromGame`) or even
  // discarded by ordinary game-end bookkeeping, so this test doesn't chase its exact final resting place.
  const [obligation] = instancesOf(session.state, "27025");
  expect(obligation).toBeDefined();
  expect(cardsInPlay(session.state)).toContain(obligation);
  const [stacy] = instancesOf(session.state, "27007");
  expect(inst(session.state, obligation!).attachments).toContain(stacy);
  expect(inst(session.state, stacy!).facedownAs).toBeTruthy();

  // Two more rounds, driven passively (decline everything optional, end every turn) — proof the obligation sitting
  // in play doesn't stall a later villain phase (its own Forced Interrupt siblings, Regenerative Research/The
  // Lizard, print the identical "villain phase begins" trigger, so a stray double-registration would surface here).
  session = step(session, { type: "endTurn", playerId: P1 });
  session = step(session, { type: "endTurn", playerId: P1 });
  expect(session.state.round).toBeGreaterThanOrEqual(3);

  assertReplays(session);
});

test("2-player, standard: Ghost-Spider + Spider-Man (Justice) vs Rhino", () => {
  const config = ghostSpiderScenario("rhino", {
    seed: SEED,
    extraPlayers: [{ starterDeckId: "core-spider-man-justice" }],
  });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard, 2p) — Ghost-Spider + Spider-Man: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (expert), solo: Ghost-Spider", () => {
  // `wave5Scenario` falls through to `coreScenario` for a scenario with no `sm` entry (`rhino`), whose own
  // `difficulty: "expert"` option (RRG 1.8 "Expert Mode", p. 29) is exactly `wave5/nova/e2e.test.ts`'s own
  // "(expert)" precedent (itself modeled on `wave4/hood/e2e.test.ts`). Ghost-Spider has no scenario-specific
  // expert wrinkle of her own against Rhino, so this only needs the plain `difficulty` option, played to a real
  // outcome by the same card-name-agnostic greedy driver as the standard game above.
  const config = ghostSpiderScenario("rhino", { seed: SEED, difficulty: "expert" });
  expect(config.difficulty).toBe("expert");
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (expert) — Ghost-Spider: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
