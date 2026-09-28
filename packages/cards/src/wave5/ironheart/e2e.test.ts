import { createGame, replay, sessionApply, startSession, type Command, type GameSession } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { startWave5Game, WAVE5_DEPS } from "../testing.js";
import { ironheartScenario } from "./support.js";

/**
 * A real game test for Ironheart's own real precon (`ironheart-leadership`, `packages/content/src/data/ironheart/
 * starterDecks.ts`) against Rhino (a Core scenario, seated with the wave 5 pool — `ironheartScenario`'s own
 * `wave5Scenario` fallback, docs/phase7-wave5.md §5). Modeled on `../nova/e2e.test.ts` (itself modeled on `../sm/
 * spider-man-morales/e2e.test.ts`): one game played entirely by the card-name-agnostic greedy driver to a real
 * outcome, one hand-scripted game that deliberately drives Ironheart's own signature interactions, and one
 * 2-player game against Nova (`nova-aggression`). Every scripted step is driven through `sessionApply` (never bare
 * `applyCommand`/state surgery once the session has started), so its own log always replays to the same final
 * state.
 *
 * **Level Up! (Version 1 → 2 → 3) through real play, with a documented seed for the bulk of the 12 total progress
 * counters it costs.** Child Prodigy is "Limit once per round" (`identity.ts`), so earning both Level Up!s' own
 * combined cost (6 + 6 = 12 progress counters) purely through repeated Child Prodigy rounds would need roughly a
 * dozen real rounds of nothing but "change form, spend a resource, end turn" — replayable, but adding test runtime
 * without exercising anything `identity.test.ts`'s own per-round Child Prodigy tests don't already cover in
 * isolation. Instead, this game pre-loads the identity with 12 progress counters *before* `startSession` — a
 * genuine data edit that becomes part of the session's own `log.initialState` (`../nova/e2e.test.ts`'s own
 * docblock precedent for "every genuine data/state edit… happens before `startSession`"), the same kind of setup
 * `identity.test.ts`'s own unit tests already use via `patchInstance` before a `use` call, just applied once up
 * front here instead of per-test. What *is* exercised through real, logged play in this file: Child Prodigy's own
 * increment (adding a 13th counter on top of the seeded 12, plus a second increment from Stroke of Genius's own
 * "after you spend this card" Response when it pays Child Prodigy's cost); both `swapIdentity` calls themselves
 * (`29001a.level-up`/`29002a.level-up`, each a real `useAbility` command, in the same round since Version 1's own
 * Level Up! already readies Ironheart before Version 2's own Level Up! cost needs her ready again); Maximum
 * Efficiency (`29003a.maximum-efficiency`, Version 3 only); a Hero Action attack (Photon Beam, `29006`) placing a
 * fresh progress counter Maximum Efficiency then spends; a form change (Round 2's own alter-ego-to-hero switch);
 * and the obligation (A Minor Setback, `29028`, resolved in Round 1's own villain phase against a genuine progress
 * counter on Riri Williams, its own success branch — `obligation-nemesis.test.ts`'s own proven seed/stack shape for
 * revealing it in one `endTurn`, reused here as `SCRIPTED_SEED`).
 */

const SEED = 2026;
const SCRIPTED_SEED = 1; // `obligation-nemesis.test.ts`'s own proven seed for revealing A Minor Setback (29028) in one `endTurn`.
const ironheartVsRhino = (seed = SEED) => startWave5Game(ironheartScenario("rhino", { seed }));

const ADVANCE = "01186";

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

/** Accepts the named optional response/interrupt/trigger (by ability id) or a specific target instance id; declines
 * everything else — `../nova/e2e.test.ts`'s own `accepting()`, ported here for the scripted game. */
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

/** Round 1's own mandatory `discardDownToHandSize` (RRG 1.8 "Hand Size", p. 20) — staging four extra cards into
 * hand up front (module docblock) pushes Riri Williams over her own printed hand size of 6, so `endTurn` offers a
 * discard choice; this keeps every card Round 2 still needs (`../nova/e2e.test.ts`'s own `discardingAnythingBut`
 * precedent). */
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

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

test("Rhino (standard), solo: Ironheart", () => {
  const config = ironheartScenario("rhino", { seed: SEED });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard) — Ironheart: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (standard), solo: Ironheart — a scripted playthrough of her own kit", () => {
  // Every genuine data/state edit (seeding progress counters, staging the hand, stacking the encounter deck)
  // happens before `startSession`, so it becomes part of the session's own `log.initialState` — every later step is
  // a real, logged command, and `replay` reproduces the whole game including this setup (module docblock).
  const base = ironheartVsRhino(SCRIPTED_SEED);
  const identity = identityOf(base, P1);
  // 12 progress counters: exactly Version 1's own Level Up! cost (6) plus Version 2's own (6), so both swaps are
  // legal back-to-back in Round 2 below with no further grinding (module docblock).
  const seeded = patchInstance(base, identity, { counters: { progress: 12 } });
  // Stroke of Genius (29009, [mental], her own signature resource: "Response: after you spend this card, place 1
  // progress counter on your identity and draw 1 card") pays Round 1's own Child Prodigy; Go All Out (29017) and
  // Morale Boost (29019), both [energy], pay Round 2's own Photon Beam (cost 2).
  const { state: handStaged, ids: stagedIds } = moveToHand(seeded, P1, "29009", "29017", "29019", "29006");
  const [strokeOfGenius, energyPayerA, energyPayerB, photonBeam] = stagedIds;
  // Round 1's own villain phase reveal — A Minor Setback (29028), Ironheart's own obligation. Stacked as [boost
  // filler, real reveal], the exact shape `obligation-nemesis.test.ts`'s own `29028.obligation` test already
  // proves resolves in one `endTurn`, at this same seed (see `SCRIPTED_SEED`'s own docblock above).
  const initial = stackEncounterDeck(handStaged, ADVANCE, "29028");

  let session = startSession(initial);

  // Round 1 (alter-ego, the default opening form): Riri Williams's own Child Prodigy (Version 1: "Spend a [mental]
  // resource → place 1 progress counter"), paid with Stroke of Genius — accepting its own Response afterward
  // places a second progress counter and draws a card.
  const progressBeforeChildProdigy = inst(handStaged, identity).counters.progress ?? 0;
  session = step(
    session,
    use(P1, identity, "29001b.child-prodigy", [{ fromHand: strokeOfGenius! }]),
    accepting("29009.stroke-of-genius-response"),
  );
  expect(session.state.players[0]!.discard).toContain(strokeOfGenius); // spent, generating its own [mental].
  // +1 (Child Prodigy's own effect) +1 (Stroke of Genius's own Response).
  expect(inst(session.state, identity).counters.progress ?? 0).toBe(progressBeforeChildProdigy + 2);

  // End Round 1: the villain phase's own reveal resolves A Minor Setback — with a progress counter present
  // (just placed above), its own success branch fires: remove 1 progress counter from Riri Williams, discard this
  // card (rather than the failure branch's facedown-encounter-card/shuffle-back-in).
  const progressBeforeObligation = inst(session.state, identity).counters.progress ?? 0;
  session = step(
    session,
    { type: "endTurn", playerId: P1 },
    discardingAnythingBut(energyPayerA!, energyPayerB!, photonBeam!),
  );
  expect(session.state.round).toBe(2);
  const [obligation] = instancesOf(session.state, "29028");
  expect(obligation).toBeDefined();
  const deckId = Object.keys(session.state.encounterDecks)[0]!;
  expect(session.state.encounterDecks[deckId]!.discard).toContain(obligation); // discarded, not shuffled back in.
  expect(inst(session.state, identity).counters.progress ?? 0).toBe(progressBeforeObligation - 1);

  // Round 2, the round's one voluntary form change: to hero form, for Level Up!/Photon Beam/Maximum Efficiency
  // below (all Hero Actions).
  session = step(session, toHero(P1));
  expect(session.state.players[0]!.identity.form).toBe("hero");

  // Level Up! (Version 1 → 2): removes 6 progress counters → ready her (already ready) and swap her with Version
  // 2 Ironheart. Immediately followed, same round, by Level Up! (Version 2 → 3): removes 6 more progress counters
  // → ready her, give her a tough status card, and swap her with Version 3 Ironheart — legal back-to-back only
  // because the seeded 12 counters cover both costs (module docblock).
  const progressBeforeLevelUps = inst(session.state, identity).counters.progress ?? 0;
  expect(progressBeforeLevelUps).toBeGreaterThanOrEqual(12);
  session = step(session, use(P1, identity, "29001a.level-up"));
  expect(session.state.players[0]!.identity.cardId).toBe("29002a");
  expect(inst(session.state, identity).counters.progress ?? 0).toBe(progressBeforeLevelUps - 6);
  session = step(session, use(P1, identity, "29002a.level-up"));
  expect(session.state.players[0]!.identity.cardId).toBe("29003a");
  expect(inst(session.state, identity).counters.progress ?? 0).toBe(progressBeforeLevelUps - 12);
  expect(inst(session.state, identity).statuses.tough).toBe(1); // Version 2's own Level Up! gave her a tough status card.
  expect(inst(session.state, identity).exhausted).toBe(false); // both Level Up!s' own "ready her".

  // Photon Beam (29006, Hero Action (attack), cost 2 [energy]): deals 4 damage to the villain and places 1
  // progress counter on Ironheart (2 instead if this attack defeats that enemy — Rhino's own hit points are well
  // above 4, so this is the 1-counter branch).
  const villain = session.state.villains[0]!.instanceId;
  const villainDamageBefore = inst(session.state, villain).damage;
  const progressBeforePhotonBeam = inst(session.state, identity).counters.progress ?? 0;
  session = step(session, play(P1, photonBeam!, [energyPayerA!, energyPayerB!]));
  expect(inst(session.state, villain).damage).toBe(villainDamageBefore + 4);
  expect(inst(session.state, identity).counters.progress ?? 0).toBe(progressBeforePhotonBeam + 1);

  // Maximum Efficiency (29003a, Version 3 only, Hero Action): remove 1 progress counter from Ironheart → deal 2
  // damage to an enemy — the exact counter Photon Beam just placed above.
  const villainDamageBeforeMax = inst(session.state, villain).damage;
  const progressBeforeMax = inst(session.state, identity).counters.progress ?? 0;
  session = step(session, use(P1, identity, "29003a.maximum-efficiency"));
  expect(inst(session.state, villain).damage).toBe(villainDamageBeforeMax + 2);
  expect(inst(session.state, identity).counters.progress ?? 0).toBe(progressBeforeMax - 1);

  assertReplays(session);
});

test("Rhino (expert), solo: Ironheart", () => {
  // `ironheartScenario` falls through to `wave5Scenario`'s own `coreScenario` fallback for a scenario with no `sm`
  // entry (`rhino`), whose `difficulty: "expert"` option (RRG 1.8 "Expert Mode", p. 29) is `wave4/hood/e2e.test.ts`'s
  // own "(expert)" precedent, ported here — the wave definition of done's own "one expert game… to an outcome,
  // replay deep-equal" requirement, same shape as `../nova/e2e.test.ts`'s own "Rhino (expert), solo: Nova". Ironheart
  // has no scenario-specific expert wrinkle of her own (no lettered stages, no `difficultySets` choice), so this only
  // needs the plain `difficulty` option, played to a real outcome by the same card-name-agnostic greedy driver as the
  // standard game above.
  const config = ironheartScenario("rhino", { seed: SEED, difficulty: "expert" });
  expect(config.difficulty).toBe("expert");
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (expert) — Ironheart: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("2-player, standard: Ironheart + Nova vs Rhino", () => {
  const config = ironheartScenario("rhino", { seed: SEED, extraPlayers: [{ starterDeckId: "nova-aggression" }] });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard, 2p) — Ironheart + Nova: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
