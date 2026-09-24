import {
  auditVillainPhases,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameSession,
  type GameSetupConfig,
  type GameState,
} from "@mc/engine";
import { CORE_DEPS, coreScenario } from "./core/index.js";
import { playToOutcome } from "./testing/driver.js";

/**
 * PLAN.md Phase 3 exit criteria: the opposition plays a legal, rules-correct
 * game against scripted player input, with no human operating the villain
 * side. Every game here is driven only by scripted players; the villain phase
 * runs on its own, and `auditVillainPhases` re-checks each villain phase
 * independently (step order, activations per player and form, boost cards,
 * encounter cards dealt and revealed, the first player token, and that every
 * decision made on the encounter side's behalf went to the first player).
 */

const DECKS = [
  "core-spider-man-justice",
  "core-captain-marvel-leadership",
  "core-she-hulk-aggression",
  "core-iron-man-aggression",
  "core-black-panther-protection",
] as const;

const seats = (count: number, offset: number) =>
  Array.from({ length: count }, (_, i) => ({ starterDeckId: DECKS[(i + offset) % DECKS.length] as string }));

function setup(config: GameSetupConfig): GameState {
  const created = createGame(config, CORE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return created.state;
}

function expectRulesCorrect(session: GameSession): void {
  const audit = auditVillainPhases(session.log, CORE_DEPS);
  expect(audit.violations).toEqual([]);
  expect(audit.phases.length).toBeGreaterThan(0);
  // Only the last phase may be cut short, and only by the game ending.
  expect(audit.phases.slice(0, -1).every((phase) => phase.completed)).toBe(true);
  const replayed = replay(session.log, CORE_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

/** A scripted table that never helps itself: it ends every turn and declines or takes the minimum on every choice. */
function playPassively(initial: GameState, maxCommands = 5_000): GameSession {
  let session = startSession(initial);
  for (let i = 0; i < maxCommands && !session.state.outcome; i++) {
    const { state } = session;
    const choice = state.pendingChoice;
    let command: Command;
    if (choice) {
      const selected =
        choice.prompt.kind === "declareDefender" && choice.options.some((o) => o.optionId === "decline")
          ? ["decline"]
          : choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      command = {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: selected,
      };
    } else if (state.step.phase === "player" && state.step.kind === "turn") {
      command = { type: "endTurn", playerId: state.step.activePlayerId };
    } else {
      throw new Error(`stalled at ${state.step.phase}/${state.step.kind} with no choice pending`);
    }
    const result = sessionApply(session, command, CORE_DEPS);
    if (!result.ok) throw new Error(`scripted ${command.type} rejected: ${result.error.message}`);
    session = result.session;
  }
  return session;
}

const SCENARIOS = ["rhino", "klaw", "ultron"] as const;
const DIFFICULTIES = ["standard", "expert"] as const;

// Each case plays a whole game (up to 4 seats) to an outcome and audits every villain phase. A slow case takes a
// few seconds alone, well past vitest's 5 s default once several test runs share the machine.
const FULL_GAME = { timeout: 30_000 } as const;

describe("the villain side runs itself against scripted players", FULL_GAME, () => {
  for (const scenario of SCENARIOS) {
    for (const difficulty of DIFFICULTIES) {
      for (const players of [1, 2, 3, 4]) {
        for (const seed of [11, 29]) {
          it(`${scenario} (${difficulty}), ${players} player(s), seed ${seed}: plays to an outcome with a clean villain-phase audit`, () => {
            const initial = setup(coreScenario(scenario, { difficulty, players: seats(players, seed), seed }));
            const { session, outcome } = playToOutcome(initial, CORE_DEPS);
            expect(outcome).not.toBeNull();
            expectRulesCorrect(session);
          });
        }
      }
    }
  }

  for (const scenario of SCENARIOS) {
    it(`${scenario}: against a table that only ends turns, the villain side wins on its own`, () => {
      const session = playPassively(setup(coreScenario(scenario, { players: seats(2, 0), seed: 7 })));
      expect(session.state.outcome?.result).toBe("loss");
      expectRulesCorrect(session);
    });
  }
});

describe("decisions made on the encounter side's behalf", FULL_GAME, () => {
  it("always go to the first player, and the audit records who made each one and why", () => {
    const initial = setup(coreScenario("ultron", { players: seats(4, 0), seed: 1138 }));
    const { session } = playToOutcome(initial, CORE_DEPS);
    const audit = auditVillainPhases(session.log, CORE_DEPS);
    expect(audit.violations).toEqual([]);
    const decisions = audit.phases.flatMap((phase) =>
      phase.decisions.map((d) => ({ ...d, firstPlayerId: phase.firstPlayerId })),
    );
    expect(decisions.length).toBeGreaterThan(0);
    for (const decision of decisions) {
      expect(["player", "firstPlayerTargets", "firstPlayerOrders"]).toContain(decision.authority);
    }
  });
});
