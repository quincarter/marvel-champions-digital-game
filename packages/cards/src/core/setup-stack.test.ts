import { cardId } from "@mc/content";
import {
  applyCommand,
  applyCommands,
  createGame,
  playerId,
  type Command,
  type GameEvent,
  type GameState,
} from "@mc/engine";
import { firstLegal } from "../testing/harness.js";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import { CORE_DEPS } from "./index.js";
import { coreScenario } from "./setup.js";

/**
 * `CoreScenarioOptions.stack` → `GameSetupConfig.stack` (docs/guided-mode.md G1), with the tutorial's matchup: Core
 * Rhino, solo Spider-Man on his Justice precon.
 */
const p1 = playerId("p1");
const BLACK_CAT = cardId("01002");
const WEB_SHOOTER = cardId("01008");
const CROWD_CONTROL = cardId("01108");
const ADVANCE = cardId("01186");
// Rhino schemes in round 1's villain phase (Spider-Man is still Peter Parker), which deals him a boost card from the top
// of the encounter deck before the encounter card is dealt: the first stacked card is that boost card.
const stack = { players: { 0: [BLACK_CAT, WEB_SHOOTER] }, encounter: [CROWD_CONTROL, ADVANCE] };
const spiderMan = [{ starterDeckId: "core-spider-man-justice" }];

const codesOf = (state: GameState, ids: readonly string[]) => ids.map((id) => state.instances[id]?.cardId);
const handOf = (state: GameState) => state.players.find((player) => player.playerId === p1)?.hand ?? [];

test("coreScenario passes the stack to setup: the stacked cards open in hand and on top of the encounter deck", () => {
  const config = coreScenario("rhino", { players: spiderMan, seed: 5, stack });
  expect(config.stack).toEqual(stack);
  const created = createGame(config, CORE_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const state = created.state;
  expect(codesOf(state, handOf(state)).slice(0, 2)).toEqual([BLACK_CAT, WEB_SHOOTER]);
  const encounter = state.encounterDecks[state.encounterDeckOrder[0] as string]?.deck ?? [];
  expect(codesOf(state, encounter).slice(0, 2)).toEqual([CROWD_CONTROL, ADVANCE]);
  expect(coreScenario("rhino", { players: spiderMan, seed: 5 })).not.toHaveProperty("stack");
});

test("a stacked Core game boosts and deals from the stacked encounter cards, and replays exactly", () => {
  const setUp = () => {
    const created = createGame(coreScenario("rhino", { players: spiderMan, seed: 5, stack }), CORE_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    return created.state;
  };
  // Keep the opening hand, end the turn, and decline everything optional until the first encounter card is revealed.
  const commands: Command[] = [];
  const events: GameEvent[] = [];
  let played = setUp();
  let queued: Command | null = { type: "endTurn", playerId: p1 };
  for (let guard = 0; guard < 50 && !events.some((event) => event.type === "encounterCardRevealed"); guard++) {
    const choice = played.pendingChoice;
    const command: Command | null = choice
      ? {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: firstLegal(played),
        }
      : queued;
    if (!command) break;
    if (!choice) queued = null;
    const result = applyCommand(played, command, CORE_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    commands.push(command);
    events.push(...result.events);
    played = result.state;
  }
  const boost = events.find((event) => event.type === "boostCardDealt");
  expect(boost?.type === "boostCardDealt" && played.instances[boost.instanceId]?.cardId).toBe(CROWD_CONTROL);
  const revealed = events.find((event) => event.type === "encounterCardRevealed");
  expect(revealed?.type === "encounterCardRevealed" && revealed.cardId).toBe(ADVANCE);
  const again = applyCommands(setUp(), commands, CORE_DEPS);
  expect(again.ok && again.state).toEqual(played);
});

test("a stack code Spider-Man's deck does not hold is a setup error", () => {
  const result = createGame(
    coreScenario("rhino", { players: spiderMan, seed: 5, stack: { players: { 0: [cardId("01010a")] } } }),
    CORE_DEPS,
  );
  expect(result.ok).toBe(false);
  expect(!result.ok && result.error.code).toBe("invalid_setup");
});

test("playableScenario carries the stack for every wave's builder", () => {
  const config = playableScenario("rhino", { players: spiderMan, seed: 5, stack });
  expect(config.stack).toEqual(stack);
  const created = createGame(config, PLAYABLE_DEPS);
  expect(created.ok && codesOf(created.state, handOf(created.state)).slice(0, 2)).toEqual([BLACK_CAT, WEB_SHOOTER]);
});
