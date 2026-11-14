import { PLAYABLE_CARDS } from "@mc/content";
import { createGame, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import { firstLegal, P1, runWith, settle, type Picker } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE11_DEPS as DEPS } from "../index.js";

/** Shared helpers for the Elektra aspect and basic cards' tests (`aggression`, `basic`, `justice`, ...). */
export const SHE_HULK_AGGRESSION = "core-she-hulk-aggression";
export const CAPTAIN_MARVEL_LEADERSHIP = "core-captain-marvel-leadership";
export const SPIDER_MAN_JUSTICE = "core-spider-man-justice";
export const SANDMAN = "01102"; // Core minion: SCH 2, 4 hit points
export const SHOCKER = "01103"; // Core minion: SCH 1, 3 hit points
export const ADVANCE = "01186"; // Core treachery, boost 0

/** A Core hero (hero form, past setup) whose deck holds a copy of `code`, against Rhino. */
export function elektraAspectGame(code: string, starterDeckId: string): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame({ ...config, players: [buildCrossHeroDeck(PLAYABLE_CARDS, starterDeckId, code)] }, DEPS);
  if (!created.ok) throw new Error(`${code}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return withForm(opened, { heroForm: 0 });
}

export const drive = (s: GameState, pick: Picker, ...commands: Command[]): GameState =>
  settle(runWith(DEPS, s, ...commands), pick, undefined, DEPS);

/** Accepts every optional trigger; answers every other prompt with the first legal answer. */
export const accepting = (): Picker => (s) => {
  const choice = s.pendingChoice!;
  return choice.prompt.kind === "chooseTriggers" ? choice.options.map((o) => o.optionId) : firstLegal(s);
};

export const basicAttack = (attacker: InstanceId, target: InstanceId, playerId: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
