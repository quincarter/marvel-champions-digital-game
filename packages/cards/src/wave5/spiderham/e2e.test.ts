import { createGame, replay, sessionApply, startSession, type Command, type GameSession } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  resourceAbility,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spiderHamScenario } from "./support.js";

/**
 * A real game test for Spider-Ham's own real precon (`spiderham-justice`, `packages/content/src/data/spiderham/
 * starterDecks.ts`) against Rhino (a Core scenario, seated with the wave 5 pool — `spiderHamScenario`'s own
 * `wave5Scenario` fallback, docs/phase7-wave5.md §5). Modeled on `../ironheart/e2e.test.ts` (itself modeled on
 * `../nova/e2e.test.ts`/`../sm/spider-man-morales/e2e.test.ts`): one game played entirely by the card-name-agnostic
 * greedy driver to a real outcome, one hand-scripted game that deliberately drives Spider-Ham's own signature
 * interactions, and one 2-player game against another wave 5 hero (Nova). Every scripted step is driven through
 * `sessionApply` (never bare `applyCommand`/state surgery once the session has started), so its own log always
 * replays to the same final state.
 *
 * **The scripted game's own toon-counter economy, entirely through real triggered play.** Every genuine data/state
 * edit (staging the hand, stacking the encounter deck) happens before `startSession` (`../ironheart/e2e.test.ts`'s
 * own docblock precedent: "every genuine data/state edit… happens before `startSession`"), so `replay` reproduces
 * the whole game including this setup — every counter gain/spend below is a real, logged command:
 *
 * - Round 1 (alter-ego, the default opening form): The Daily Beagle (30008) enters play, then its own Alter-Ego
 *   Action places a toon counter; Cartoon Power (the alter-ego identity face's own Response, `identity.ts`
 *   30001b) places a second after a basic recovery. Round 1's own villain-phase reveal ("I Really Want a Hot
 *   Dog!", 30024, Spider-Ham's own obligation) then spends one of those two counters through its own first option
 *   (exhaust Peter Porker and remove 1 toon counter → remove the obligation from the game entirely,
 *   `obligation-nemesis.test.ts`'s own proven seed/stack shape for reaching that branch), leaving one behind.
 * - Round 2: a form change to hero form (the round's one voluntary form change), then that leftover toon counter
 *   pays Cartoon Physics's (30009) own printed cost of 1 [physical] in full through `30001a.spider-ham-constant`
 *   (`countersAsResource("toon")`, `identity.ts` — "Each toon counter on Spider-Ham can be spent as if it were a
 *   [wild] resource"), the same `resourceAbility` shape `identity.test.ts`'s own unit test uses, here paying for a
 *   real card in a real game. Petulant Pig (30006, cost 0) then triggers a real villain attack against Spider-Ham
 *   himself (`events.ts`'s own `enemyAttack(theVillain, { against: you })`); declining to defend lets Rhino's ATK
 *   land, which fires Spider-Nonsense (the hero face's own Response, `identity.ts` 30001a: "After Spider-Ham takes
 *   any amount of damage, place 1 toon counter on him") for a fresh counter — spent immediately after on a second
 *   copy of Cartoon Physics the same way as the first, closing the loop this docblock opened with: every toon
 *   counter gained through Spider-Nonsense *and* Cartoon Power, each spent as [wild].
 */

const SEED = 2026;
const SCRIPTED_SEED = 1; // `obligation-nemesis.test.ts`'s own proven seed for revealing "I Really Want a Hot Dog!" (30024) in one `endTurn`.
const spiderHamVsRhino = (seed = SEED) => startWave5Game(spiderHamScenario("rhino", { seed }));

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

/** Accepts the named optional response/interrupt (by ability id); declines a `declareDefender` prompt outright
 * (`identity.test.ts`'s own Spider-Nonsense test precedent for declining defense so a villain's attack actually
 * lands); pays a `payForCard` step with its own first N options; declines everything else. `../ironheart/
 * e2e.test.ts`'s own `accepting()`, extended with `obligation-nemesis.test.ts`'s own `declareDefender` handling. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Round 1's own mandatory `discardDownToHandSize` (RRG 1.8 "Hand Size", p. 20) — staging several extra cards into
 * hand up front (module docblock) pushes Peter Porker over his own printed hand size of 6, so `endTurn` offers a
 * discard choice; this keeps every card Round 2 still needs. Also picks "Exhaust Peter Porker…" for the obligation's
 * own `chooseOne` (`obligation-nemesis.test.ts`'s own `pickingLabelStartingWith` precedent, inlined here since this
 * single picker has to serve both prompts in the same `endTurn`'s settle loop). `../ironheart/e2e.test.ts`'s own
 * `discardingAnythingBut` precedent. */
const roundOneEndTurnPick =
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
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    const exhaustOption = choice.options.find((o) => o.label.startsWith("Exhaust Peter Porker"));
    if (exhaustOption) return [exhaustOption.optionId];
    return firstLegal(state);
  };

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

test("Rhino (standard), solo: Spider-Ham", () => {
  const config = spiderHamScenario("rhino", { seed: SEED });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard) — Spider-Ham: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (standard), solo: Spider-Ham — a scripted playthrough of his own kit", () => {
  // Every genuine data/state edit (staging the hand, stacking the encounter deck) happens before `startSession`
  // (module docblock) — every later step below is a real, logged command.
  const base = spiderHamVsRhino(SCRIPTED_SEED);
  // Basic recovery below needs actual damage present (RRG 1.8 "Basic Power," a recovery with nothing to heal has
  // no legal target) — a genuine pre-session data edit (module docblock), the same shape `identity.test.ts`'s own
  // Cartoon Power test uses (`patchInstance(state, identity, { damage: 3 })`).
  const damaged = patchInstance(base, identityOf(base, P1), { damage: 3 });
  // The Daily Beagle (30008, cost 2) + 2 filler payment cards (30017/30019, both cost-irrelevant hand cards spent
  // generically); both copies of Cartoon Physics (30009, deckLimit 2) and Petulant Pig (30006) staged up front so
  // Round 2 below never depends on what a random opening hand happened to draw.
  const { state: handStaged, ids: stagedIds } = moveToHand(
    damaged,
    P1,
    "30008",
    "30017",
    "30019",
    "30009",
    "30009",
    "30006",
  );
  const [dailyBeagle, fillerA, fillerB, cartoonPhysicsA, cartoonPhysicsB, petulantPig] = stagedIds;
  // Round 1's own villain phase reveal — "I Really Want a Hot Dog!" (30024), Spider-Ham's own obligation.
  const initial = stackEncounterDeck(handStaged, ADVANCE, "30024");

  let session = startSession(initial);
  const identity = identityOf(session.state, P1);

  // Round 1 (alter-ego, the default opening form). Play The Daily Beagle.
  session = step(session, play(P1, dailyBeagle!, [fillerA!, fillerB!]));
  expect(inst(session.state, identity).counters.toon ?? 0).toBe(0); // not yet: entering play alone places no counter.

  // The Daily Beagle's own Alter-Ego Action: exhaust it -> place 1 toon counter on Peter Porker.
  session = step(session, use(P1, dailyBeagle!, "30008.the-daily-beagle-action"));
  expect(inst(session.state, identity).counters.toon ?? 0).toBe(1);
  expect(inst(session.state, dailyBeagle!).exhausted).toBe(true);

  // A basic recovery -> Cartoon Power's own Response places a second toon counter.
  session = step(session, { type: "basicRecover", playerId: P1 }, accepting("30001b.cartoon-power"));
  expect(inst(session.state, identity).counters.toon ?? 0).toBe(2);

  // End Round 1: the villain phase's own reveal resolves "I Really Want a Hot Dog!" — its first option (exhaust
  // Peter Porker, ready and holding a toon counter here, and remove 1 toon counter from him) removes the obligation
  // from the game entirely, spending one of the two counters above and leaving one for Round 2.
  session = step(session, endTurn(P1), roundOneEndTurnPick(cartoonPhysicsA!, cartoonPhysicsB!, petulantPig!));
  expect(session.state.round).toBe(2);
  const [obligation] = instancesOf(session.state, "30024");
  expect(obligation).toBeDefined();
  expect(session.state.removedFromGame).toContain(obligation); // the exhaust branch's own effect, not discarded.
  expect(inst(session.state, identity).counters.toon ?? 0).toBe(1); // 2 - 1 spent by the obligation.
  expect(inst(session.state, identity).exhausted).toBe(true); // the obligation's own cost paid it.

  // Round 2, the round's one voluntary form change: to hero form, for Petulant Pig below (a Hero Action).
  session = step(session, toHero(P1));
  expect(session.state.players[0]!.identity.form).toBe("hero");
  // Changing form is not itself a "ready" effect (RRG 1.8 "Alter-Ego/Hero Form", p. 8) — Peter Porker stays
  // exhausted from the obligation's own cost above; neither Cartoon Physics nor Petulant Pig below needs him ready.

  // Cartoon Physics (30009, cost 1 [physical]): paid entirely by the one remaining toon counter, spent as [wild]
  // through Spider-Ham's own resource ability (`30001a.spider-ham-constant`) — the same `resourceAbility` shape
  // `identity.test.ts`'s own unit test uses, here inside a real game.
  session = step(
    session,
    play(P1, cartoonPhysicsA!, [], { abilities: [resourceAbility(identity, "30001a.spider-ham-constant")] }),
  );
  expect(inst(session.state, identity).counters.toon ?? 0).toBe(0); // spent.
  expect(session.state.players[0]!.discard).not.toContain(cartoonPhysicsA); // an upgrade: stays in play.

  // Petulant Pig (30006, cost 0, Hero Action): "Stick your tongue out at the villain. The villain attacks you.
  // Draw 3 cards." Declining to defend lets Rhino's own attack land, which fires Spider-Nonsense (`identity.ts`
  // 30001a) for a fresh toon counter — this docblock's own "gained via Spider-Nonsense" closing beat.
  const handBeforePetulantPig = session.state.players[0]!.hand.length;
  session = step(session, play(P1, petulantPig!, []), accepting("30001a.spider-nonsense"));
  expect(inst(session.state, identity).damage).toBeGreaterThan(0); // Rhino's own attack landed, undefended.
  expect(inst(session.state, identity).counters.toon ?? 0).toBe(1); // Spider-Nonsense's own +1.
  // -1 played (0-cost), +3 drawn by Petulant Pig's own printed effect: net +2.
  expect(session.state.players[0]!.hand.length).toBe(handBeforePetulantPig - 1 + 3);

  // The second copy of Cartoon Physics, paid the same way with the toon counter Spider-Nonsense just placed —
  // every toon counter gained this game, whether from Cartoon Power, The Daily Beagle or Spider-Nonsense, spent as
  // [wild] through the identical resource ability.
  session = step(
    session,
    play(P1, cartoonPhysicsB!, [], { abilities: [resourceAbility(identity, "30001a.spider-ham-constant")] }),
  );
  expect(inst(session.state, identity).counters.toon ?? 0).toBe(0);
  expect(session.state.players[0]!.discard).not.toContain(cartoonPhysicsB);

  assertReplays(session);
});

test("Rhino (expert), solo: Spider-Ham", () => {
  // `spiderHamScenario` falls through to `wave5Scenario`'s own `coreScenario` fallback for a scenario with no `sm`
  // entry (`rhino`), whose `difficulty: "expert"` option (RRG 1.8 "Expert Mode", p. 29) is `../ironheart/
  // e2e.test.ts`'s own "(expert)" precedent, ported here — the wave definition of done's own "one expert game… to
  // an outcome, replay deep-equal" requirement, same shape as `../nova/e2e.test.ts`'s own "Rhino (expert), solo:
  // Nova". Spider-Ham has no scenario-specific expert wrinkle of his own, so this only needs the plain `difficulty`
  // option, played to a real outcome by the same card-name-agnostic greedy driver as the standard game above.
  const config = spiderHamScenario("rhino", { seed: SEED, difficulty: "expert" });
  expect(config.difficulty).toBe("expert");
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (expert) — Spider-Ham: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("2-player, standard: Spider-Ham + Nova vs Rhino", () => {
  const config = spiderHamScenario("rhino", { seed: SEED, extraPlayers: [{ starterDeckId: "nova-aggression" }] });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard, 2p) — Spider-Ham + Nova: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
