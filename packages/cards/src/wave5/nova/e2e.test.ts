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
  play,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { moveToDiscard } from "../../testing/staging.js";
import { playToOutcome } from "../../testing/driver.js";
import { startWave5Game, WAVE5_DEPS } from "../testing.js";
import { novaScenario } from "./support.js";

/**
 * A real game test for Nova's own real precon (`nova-aggression`, `packages/content/src/data/nova/starterDecks.ts`)
 * against Rhino (a Core scenario, seated with the wave 5 pool — `novaScenario`'s own `wave5Scenario` fallback,
 * docs/phase7-wave5.md §5). Modeled on `../sm/spider-man-morales/e2e.test.ts`: one game played entirely by the
 * card-name-agnostic greedy driver to a real outcome, one hand-scripted game that deliberately drives Nova's own
 * signature interactions (Sam Alexander's own Action finding a discarded Supernova Helmet and putting it into play,
 * paid with a [wild] resource; Supernova Helmet's own Hero Resource generating [wild] and its own constant granting
 * the Aerial trait; a basic power use readying it via Nova's own Response; No Quarter's own Requirement ([physical])
 * attack and its excess-damage mill; Pitchback, only playable once Nova actually has the Aerial trait; a form
 * change; Weight of the World, Nova's own obligation, resolved when drawn and then removed by its own Alter-Ego
 * Action), and one 2-player game against Ghost-Spider (`sm`). Every scripted step is driven through `sessionApply`
 * (never bare `applyCommand`/state surgery once the session has started), so its own log always replays to the same
 * final state.
 */

const SEED = 2026;
// The scripted game below uses seed 1 (not `SEED`) for its own encounter-deck stacking: `obligation-nemesis.test.ts`'s
// own `28021.weight-of-the-world-constant` test is the proven precedent for "Weight of the World, stacked as round
// 1's own reveal (`[ADVANCE, "28021"]`, one `endTurn`), is actually dealt into play" — round 1's own villain phase
// draws more than the printed "one boost, one reveal" at some seeds (a real, seed-dependent recursive-reveal
// interaction this file does not otherwise touch), so this reuses that module's own proven seed instead of
// reverse-engineering the draw count for a fresh one.
const SCRIPTED_SEED = 1;
const novaVsRhino = (seed = SEED) => startWave5Game(novaScenario("rhino", { seed }));

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
 * everything else — `sm/spider-man-morales/e2e.test.ts`'s own `accepting()`, ported here for the scripted game. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    // A reactively-played card's own `payForCard` step (Pitchback's own cost of 1, paid when its trigger is
    // accepted) — takes the first N offered hand cards, the same "pay whatever's offered" default every other
    // wave's own `accepting()` uses (`sm/cross-hero.test.ts`, `nova/events.test.ts`).
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Round 1's own mandatory `discardDownToHandSize` (RRG 1.8 "Hand Size", p. 20) — the staged hand (`Sam Alexander's
 * Action`, plus every card round 2 goes on to play) is one over Sam Alexander's own printed hand size of 6, so
 * `endTurn` offers a discard choice; this keeps every card the rest of the game still needs (`firstLegal`'s own
 * "hand order" default would otherwise discard No Quarter, staged first). */
const discardingAnythingBut =
  (...keep: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "discardDownToHandSize") {
      const disposable = choice.options.filter((o) => !keep.includes(o.optionId)).map((o) => o.optionId);
      return disposable.length >= choice.minSelections
        ? disposable.slice(0, choice.minSelections)
        : choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
    }
    return firstLegal(state);
  };

/** Accepts every offered `chooseTriggers` window, then hands a `chooseCards` prompt exactly `want` — Sam
 * Alexander's own two-step shape (`identity.test.ts`'s own `accepting`), ported here for the scripted game. */
const findingSupernovaHelmet =
  (...want: readonly string[]): Picker =>
  (state) => {
    const prompt = state.pendingChoice?.prompt;
    if (prompt?.kind === "chooseTriggers") return state.pendingChoice!.options.map((o) => o.optionId);
    if (prompt?.kind === "chooseCards") return want;
    return firstLegal(state);
  };

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

test("Rhino (standard), solo: Nova", () => {
  const config = novaScenario("rhino", { seed: SEED });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard) — Nova: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (standard), solo: Nova — a scripted playthrough of her own kit", () => {
  // Every genuine data/state edit (staging the discard pile, staging the hand, stacking the encounter deck) happens
  // before `startSession`, so it becomes part of the session's own `log.initialState` — every later step is a real,
  // logged command, and `replay` reproduces the whole game including this setup.
  const base = novaVsRhino(SCRIPTED_SEED);
  const { state: discardStaged, id: supernovaHelmet } = moveToDiscard(base, P1, "28009"); // "28009", Supernova Helmet.
  // Every hand card this scripted game plays, staged up front (Connection to the Worldmind, No Quarter, Ms.
  // Marvel, Pitchback) — a later mid-session `moveToHand` only *finds* an instance id already in hand (a no-op
  // over an already-staged card), never genuinely relocates one: doing that after `startSession` would be state
  // surgery outside the log, exactly what this file's own docblock forbids.
  const { state: handStaged, ids: stagedIds } = moveToHand(discardStaged, P1, "28007", "28013", "28002", "28012");
  const [wildCard, noQuarter, physicalCard, pitchback] = stagedIds;
  // Round 1's own villain phase reveal — Weight of the World, Nova's own obligation (28021), dealt to the
  // alter-ego (Sam Alexander) player. Stacked as `[boost filler, real reveal]`, the exact shape `obligation-
  // nemesis.test.ts`'s own `28021.weight-of-the-world-constant` test already proves resolves in one `endTurn`, at
  // this same seed (see `SCRIPTED_SEED`'s own docblock above).
  const initial = stackEncounterDeck(handStaged, "01186", "28021");

  let session = startSession(initial);

  // Round 1 (alter-ego): Sam Alexander's own Alter-Ego Action, paid with a [wild] resource (Connection to the
  // Worldmind, 28007) → puts the discarded Supernova Helmet into play attached to Nova instead of adding it to
  // hand (its own printed "if you paid … using a [wild] resource" branch).
  const identity = identityOf(session.state);
  session = step(
    session,
    use(P1, identity, "28001b.sam-alexander-action", [{ fromHand: wildCard! }]),
    findingSupernovaHelmet(supernovaHelmet),
  );
  expect(inst(session.state, supernovaHelmet).attachedTo).toBe(identity);
  expect(session.state.players[0]!.hand).not.toContain(supernovaHelmet);

  // End round 1: the staged hand is one over Sam Alexander's own hand size, so `endTurn`'s own mandatory
  // `discardDownToHandSize` needs steering (`firstLegal`'s own "hand order" default would otherwise discard No
  // Quarter, staged first) to protect every card round 2 goes on to play. The villain phase's own reveal deals
  // Weight of the World into play.
  session = step(
    session,
    { type: "endTurn", playerId: P1 },
    discardingAnythingBut(noQuarter!, physicalCard!, pitchback!),
  );
  expect(session.state.round).toBe(2);
  const [obligation] = instancesOf(session.state, "28021").filter((id) => cardsInPlay(session.state).includes(id));
  expect(obligation).toBeDefined();

  // Round 2 (still alter-ego, its own default opening form): Weight of the World's own Alter-Ego Action — exhaust
  // Sam Alexander → remove this obligation from the game.
  session = step(session, use(P1, obligation!, "28021.weight-of-the-world-action"));
  expect(session.state.removedFromGame).toContain(obligation);
  expect(cardsInPlay(session.state)).not.toContain(obligation);
  // The identity is exhausted from that action's own cost; ready it back up before the round's own form change
  // below (a basic attack, later, needs it ready — RRG 1.8 "Attack (Basic Power)", p. 10).
  session = step(
    session,
    { type: "endTurn", playerId: P1 },
    discardingAnythingBut(noQuarter!, physicalCard!, pitchback!),
  );

  // Round 3, the round's one voluntary form change: Supernova Helmet's own constant now grants Nova the Aerial
  // trait (already attached, no `play` needed this round).
  session = step(session, toHero(P1));
  const villain = session.state.villains[0]!.instanceId;

  // No Quarter (28013, Requirement [physical], printed cost 2): a Hero Action attack dealing 4 damage, paid with a
  // [physical] card (Ms. Marvel, 28002, satisfying the Requirement) plus Supernova Helmet's own Hero Resource
  // (exhaust → generate 1 [wild], filling the cost's remaining generic slot — a wild backfills any typed
  // Requirement, `dsl`/`resources.ts`'s own "Wild Resource" docblock). Its own excess-damage mill is exercised
  // directly against Nova's own precon in `events.test.ts`, so this only needs to fire cleanly here — but
  // exhausting Supernova Helmet this way is itself the setup for Nova's own Response below.
  const villainDamageBeforeNoQuarter = inst(session.state, villain).damage;
  session = step(
    session,
    play(P1, noQuarter!, [physicalCard!], {
      abilities: [{ ability: { instanceId: supernovaHelmet, abilityId: "28009.supernova-helmet-resource" as never } }],
    }),
    accepting(villain),
  );
  expect(inst(session.state, villain).damage).toBeGreaterThanOrEqual(villainDamageBeforeNoQuarter + 4);
  expect(inst(session.state, supernovaHelmet).exhausted).toBe(true); // the resource ability's own cost.

  // Pitchback (28012, "Play only if your identity has the Aerial trait") — now legal (Supernova Helmet's own
  // constant grants Aerial), unlike Nova's own precon test without the helmet (`events.test.ts`'s own "never
  // offered" case): the same card, made playable purely by Supernova Helmet's own granted trait. A Hero Response
  // event, not a Hero Action — played reactively off "after your hero attacks", not `playCard` directly (the
  // `28011`/`28026` shape this module's own `sm/cross-hero.test.ts` precedent documents), paid with its own
  // `payForCard` step when its trigger is accepted below.
  expect(pitchback).toBeDefined();

  // A basic attack: Pitchback's own Hero Response ("after your hero attacks, deal 4 damage to an enemy") and
  // Nova's own Response ("after you use one of Nova's basic powers, ready Supernova Helmet") both fire off the
  // same attack — readying the helmet No Quarter's own payment exhausted above (not Pitchback's: Pitchback pays
  // with an ordinary hand card via `payForCard`, so there is no ordering ambiguity between the two responses).
  const villainDamageBeforeAttack = inst(session.state, villain).damage;
  session = step(
    session,
    { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain },
    accepting("28012.pitchback-response", "28001a.nova-response", villain),
  );
  expect(session.state.players[0]!.discard).toContain(pitchback); // played reactively; resolved and discarded.
  expect(inst(session.state, supernovaHelmet).exhausted).toBe(false); // Nova's own Response readied it again.
  // Nova's own basic ATK, plus Pitchback's own 4.
  expect(inst(session.state, villain).damage).toBeGreaterThan(villainDamageBeforeAttack + 4);

  assertReplays(session);
});

test("2-player, standard: Nova + Ghost-Spider vs Rhino", () => {
  const config = novaScenario("rhino", { seed: SEED, extraPlayers: [{ starterDeckId: "ghost-spider" }] });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard, 2p) — Nova + Ghost-Spider: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (expert), solo: Nova", () => {
  // `wave5Scenario` falls through to `coreScenario` for a scenario with no `sm` entry (`rhino`, module docblock
  // above); `coreScenario`'s own `difficulty: "expert"` option (RRG 1.8 "Expert Mode", p. 29 — villain stages
  // II-III instead of I-II, the pool's own Expert I/Expert II encounter sets) is exactly `wave4/hood/e2e.test.ts`'s
  // own "(expert)" precedent. Nova has no scenario-specific expert wrinkle of her own (no lettered stages, no
  // `difficultySets` choice — Rhino, unlike Venom Goblin/The Hood, needs neither), so this only needs the plain
  // `difficulty` option, played to a real outcome by the same card-name-agnostic greedy driver as the standard game
  // above.
  const config = novaScenario("rhino", { seed: SEED, difficulty: "expert" });
  expect(config.difficulty).toBe("expert");
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (expert) — Nova: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
