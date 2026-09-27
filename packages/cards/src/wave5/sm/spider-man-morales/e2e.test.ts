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
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { moveToDiscard } from "../../../testing/staging.js";
import { playToOutcome } from "../../../testing/driver.js";
import { startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { spiderManMoralesScenario } from "./support.js";

/**
 * A real game test for Spider-Man / Miles Morales's own real precon (`spider-man-morales`, `packages/content/src/
 * data/sm/starterDecks.ts`) against Rhino (a Core scenario, seated with the wave 5 pool — `spiderManMoralesScenario`'s
 * own `wave5Scenario` fallback, docs/phase7-wave5.md §5). Modeled on `../ghost-spider/e2e.test.ts`: one game played
 * entirely by the card-name-agnostic greedy driver to a real outcome, one hand-scripted game that deliberately
 * drives his own signature interactions (a form change back to alter-ego that shuffles a discarded "Spider-Man"
 * card home; a S.H.I.E.L.D. support; a basic attack that triggers Power Within's own Response and, through it,
 * Venom Blast; Web-Shot paid with a [energy] resource resolving Venom Blast a second time; Swing In paid with a
 * [mental] resource resolving Spider Camouflage; a villain-phase encounter card reveal; his own obligation, Keeping
 * Secrets, resolved when drawn), and one 2-player game against Ghost-Spider (both `sm` precons). Every scripted
 * step is driven through `sessionApply` (never bare `applyCommand`/state surgery once the session has started), so
 * its own log always replays to the same final state.
 */

const SEED = 2026;
const milesVsRhino = (seed = SEED) => startWave5Game(spiderManMoralesScenario("rhino", { seed }));

/** `sessionApply`, throwing on an illegal command — every scripted step in this file goes through this, never bare
 * `applyCommand`/state surgery, so the resulting session log always replays deterministically. */
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

/** Accepts the named optional response/interrupt (by ability id) or a specific target instance id; declines
 * everything else — `support-upgrades-allies.test.ts`'s own `accepting()`, ported here for the scripted game. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Accepts every offered `chooseTriggers` window, then hands a `chooseCards` prompt exactly `want` — the two-step
 * shape `identity.test.ts`'s own `accepting` uses for `27030b`'s "shuffle a Spider-Man card home" response. */
const acceptingFormChangeShuffle =
  (...want: readonly string[]): Picker =>
  (state) => {
    const prompt = state.pendingChoice?.prompt;
    if (prompt?.kind === "chooseTriggers") return state.pendingChoice!.options.map((o) => o.optionId);
    if (prompt?.kind === "chooseCards") return want;
    return firstLegal(state);
  };

/** Picks the "Exhaust Miles Morales" branch of Keeping Secrets' own "Choose:" — `obligation-nemesis.test.ts`'s own
 * `pickingLabelStartingWith("Exhaust")`, ported here for the villain-phase reveal step. */
const revealingKeepingSecrets: Picker = (state) => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  if (choice.prompt.kind === "chooseOption") {
    const found = choice.options.find((o) => o.label.startsWith("Exhaust"));
    if (found) return [found.optionId];
  }
  return firstLegal(state);
};

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

test("Rhino (standard), solo: Spider-Man (Miles Morales)", () => {
  const config = spiderManMoralesScenario("rhino", { seed: SEED });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard) — Spider-Man (Miles Morales): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (standard), solo: Spider-Man (Miles Morales) — a scripted playthrough of his own kit", () => {
  // Every genuine data/state edit (staging hand cards, staging the discard pile, staging threat, staging the
  // encounter deck) happens before `startSession`, so it becomes part of the session's own `log.initialState` —
  // every later step is a real, logged command, and `replay` reproduces the whole game including this setup.
  const base = milesVsRhino();
  const staged = moveToHand(base, P1, "27044", "27044", "27037", "27034", "27033", "27038").state;
  const { state: discardStaged, id: peterParker } = moveToDiscard(staged, P1, "27049"); // "27049", named "Spider-Man".
  // The Break-In!'s own stage 1 target threat is 7 for a solo game (`packages/content/src/data/core/cards.ts`), so
  // 5 (comfortably under it, even after the villain phase's own threat) leaves room for Swing In's "-4" below.
  const withThreat = patchInstance(discardStaged, discardStaged.mainScheme.instanceId, { threat: 5 });
  // This round's own Power Within/Web-Shot/Swing In stun and confuse Rhino before the villain phase, so his own
  // round-1 activation is cancelled outright (the stun is removed instead of him attacking, RRG 1.8 "Stunned") —
  // no boost card is drawn for it, unlike `../ghost-spider/e2e.test.ts`'s own un-stunned Rhino. Round 1 only draws
  // its own reveal step's card (Advance, 0 boost icons, no real effect); round 2's villain is no longer stunned, so
  // it attacks normally, drawing a boost card before its own reveal step draws the real card. Stacked here as
  // [round 1 reveal, round 2 boost, round 2 reveal]: Advance, Advance, then Keeping Secrets (Miles's own
  // obligation) as round 2's real reveal.
  const initial = stackEncounterDeck(withThreat, "01186", "01186", "27056");
  const identity = identityOf(initial);
  const villain = initial.villains[0]!.instanceId;

  let session = startSession(initial);

  // Round 1, alter-ego -> hero: the round's one voluntary form change, so the basic attack below is legal.
  session = step(session, toHero(P1));

  // A S.H.I.E.L.D. support (Field Agent, 27044) into play; a second copy stays in hand as [energy] resource fodder
  // for Web-Shot below.
  const [fieldAgentA, fieldAgentB] = moveToHand(session.state, P1, "27044", "27044").ids;
  session = step(session, play(P1, fieldAgentA!, payWith(session.state, P1, 1, [fieldAgentA!, fieldAgentB!])));
  expect(cardsInPlay(session.state)).toContain(fieldAgentA);

  // Power Within (27037) attaches to the identity; a basic attack then triggers its own Response, which discards
  // it to resolve Venom Blast only (2 damage + stun) — Spider Camouflage must not also resolve (wave 5 §4.1 Q63).
  const [powerWithin] = moveToHand(session.state, P1, "27037").ids;
  session = step(session, play(P1, powerWithin!, payWith(session.state, P1, 1, [powerWithin!])));
  const damageBeforeAttack = inst(session.state, villain).damage;
  session = step(
    session,
    { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain },
    accepting("27037.power-within-response", villain),
  );
  expect(session.state.players[0]!.discard).toContain(powerWithin); // "discard Power Within" cost.
  // The basic attack's own damage plus Venom Blast's own 2.
  expect(inst(session.state, villain).damage).toBeGreaterThanOrEqual(damageBeforeAttack + 2);
  expect(inst(session.state, villain).statuses.stunned).toBeGreaterThan(0);
  expect(inst(session.state, identity).statuses.tough).toBe(0); // Spider Camouflage never resolves (Q63).

  // Web-Shot (27034) paid with a [energy] resource (Field Agent's own printed icon) resolves Venom Blast again.
  const [webShot] = moveToHand(session.state, P1, "27034").ids;
  const damageBeforeWebShot = inst(session.state, villain).damage;
  const stunnedBeforeWebShot = inst(session.state, villain).statuses.stunned;
  session = step(
    session,
    play(P1, webShot!, [fieldAgentB!, ...payWith(session.state, P1, 1, [webShot!, fieldAgentB!])]),
    accepting(villain),
  );
  // 4 (Web-Shot) + 2 (Venom Blast).
  expect(inst(session.state, villain).damage).toBe(damageBeforeWebShot + 6);
  // Already stunned from Power Within's own Venom Blast: RRG "Status Cards" caps a non-steady character at one of
  // each type, so a second stun status card is not given — `giveStatus` (`packages/engine/src/effects.ts`) is a
  // no-op here, not a stacking counter.
  expect(inst(session.state, villain).statuses.stunned).toBe(stunnedBeforeWebShot);

  // Swing In (27033) paid with a [mental] resource (Defense Mechanism's own printed icon) resolves Spider
  // Camouflage only: gives Spider-Man a tough status card and confuses the villain, with no further damage/stun.
  const [swingIn] = moveToHand(session.state, P1, "27033").ids;
  const [defenseMechanism] = moveToHand(session.state, P1, "27038").ids;
  const damageBeforeSwingIn = inst(session.state, villain).damage;
  session = step(
    session,
    play(P1, swingIn!, [defenseMechanism!, ...payWith(session.state, P1, 1, [swingIn!, defenseMechanism!])]),
    accepting(villain),
  );
  expect(mainThreat(session.state)).toBe(1); // 5 - 4 ("remove 4 threat" on a scheme).
  expect(inst(session.state, identity).statuses.tough).toBeGreaterThan(0); // "Give Spider-Man a tough status card."
  expect(inst(session.state, villain).statuses.confused).toBeGreaterThan(0); // "Confuse an enemy."
  expect(inst(session.state, villain).damage).toBe(damageBeforeSwingIn); // no Venom Blast damage this time (Q63).

  // End round 1: the villain phase's own reveal step draws Advance (staged above, no real effect); Rhino's own
  // activation is cancelled outright by the stun given above, with no operator intervention needed.
  session = step(session, { type: "endTurn", playerId: P1 });
  expect(session.state.round).toBeGreaterThanOrEqual(2);

  // Round 2, the round's one voluntary form change back to alter-ego: Miles Morales's own Response ("After you
  // change to this form, shuffle 1 Spider-Man card from your discard pile into your deck") shuffles the discarded
  // Peter Parker ally (27049, printed name "Spider-Man") home.
  const deckBefore = session.state.players[0]!.deck.length;
  session = step(session, toHero(P1), acceptingFormChangeShuffle(peterParker));
  expect(session.state.players[0]!.identity.form).toBe("alterEgo");
  expect(session.state.players[0]!.discard).not.toContain(peterParker);
  expect(session.state.players[0]!.deck.length).toBe(deckBefore + 1);

  // End round 2: the villain phase's own boost draw (a second Advance), then Keeping Secrets (Miles's own
  // obligation) is dealt to the alter-ego player as their own reveal — "Exhaust Miles Morales → remove Keeping
  // Secrets from the game" is the branch this test drives.
  session = step(session, { type: "endTurn", playerId: P1 }, revealingKeepingSecrets);
  const [obligation] = instancesOf(session.state, "27056");
  expect(obligation).toBeDefined();
  expect(session.state.removedFromGame).toContain(obligation);
  expect(session.state.round).toBeGreaterThanOrEqual(3);

  assertReplays(session);
});

test("2-player, standard: Spider-Man (Miles Morales) + Ghost-Spider vs Rhino", () => {
  const config = spiderManMoralesScenario("rhino", {
    seed: SEED,
    extraPlayers: [{ starterDeckId: "ghost-spider" }],
  });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard, 2p) — Spider-Man (Miles Morales) + Ghost-Spider: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
