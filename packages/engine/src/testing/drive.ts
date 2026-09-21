import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { sessionApply, startSession, type GameSession } from "../engine.js";
import type { GameEvent } from "../events.js";
import type { GameState } from "../state.js";
import { defaultPick } from "./scenario.js";

/**
 * Applies commands through a session (so the log replays), answering every pending choice with `defaultPick` before
 * and after each command. Returns the session and every event, in order.
 */
export function driveSession(
  session: GameSession,
  deps: EngineDeps,
  commands: readonly Command[] = [],
  pick: (state: GameState) => readonly string[] = defaultPick,
): { readonly session: GameSession; readonly events: readonly GameEvent[] } {
  let current = session;
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(current, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    current = result.session;
    events.push(...result.events);
  };
  const answer = (): void => {
    for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
      if (guard > 100) throw new Error("choices did not settle");
      const choice = current.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(current.state),
      });
    }
  };
  answer();
  for (const command of commands) {
    apply(command);
    answer();
  }
  return { session: current, events };
}

/** `driveSession` from a fresh session on `state`. */
export function runCommands(state: GameState, deps: EngineDeps, ...commands: readonly Command[]) {
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { state: session.state, events, session };
}

/** `runCommands` with a custom choice picker. */
export function runCommandsPicking(
  state: GameState,
  deps: EngineDeps,
  pick: (state: GameState) => readonly string[],
  ...commands: readonly Command[]
) {
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  return { state: session.state, events, session };
}
