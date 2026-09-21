import { basicAttack, basicRecover, basicThwart, changeForm, endTurn, playCard, useAbility } from "./actions.js";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { clearChoice, createCtx, emit, updateFrame, type Ctx } from "./ctx.js";
import { discardFromHand, discardFromPlay, endGame } from "./effects.js";
import { engineError, EngineInvariantError, type EngineError } from "./errors.js";
import type { GameEvent } from "./events.js";
import { afterDiscardChoice, afterMulliganChoice, runFlow } from "./flow.js";
import { activateChosenMinion } from "./villain/phase.js";
import { instanceId } from "./ids.js";
import { getPlayer, handSize, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";

export type CommandResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: EngineError };

/**
 * The only way game state changes. Pure: same state + command + deps always
 * produce the same next state and the same events.
 */
export function applyCommand(state: GameState, command: Command, deps: EngineDeps = DEFAULT_DEPS): CommandResult {
  try {
    if (state.outcome) {
      return { ok: false, error: engineError("game_over", "the game has ended", command) };
    }
    // Conceding is exempt from the pending-choice gate on purpose: the moment a player most wants to give up is
    // mid-prompt (the defend prompt of a villain phase that has already decided the game), and there is no rules
    // reason a concession has to wait for an answer. The `state.outcome` guard above still makes a second concede an
    // error, correctly.
    if (state.pendingChoice && command.type !== "resolveChoice" && command.type !== "concede") {
      return { ok: false, error: engineError("choice_pending", "a choice must be resolved first", command) };
    }
    const ctx = createCtx(state, deps);
    const error = dispatch(ctx, command);
    if (error) return { ok: false, error };
    runFlow(ctx);
    return { ok: true, state: ctx.state, events: ctx.events };
  } catch (cause) {
    const message = cause instanceof EngineInvariantError ? cause.message : String(cause);
    return { ok: false, error: engineError("internal_error", message, command) };
  }
}

function dispatch(ctx: Ctx, command: Command): EngineError | null {
  switch (command.type) {
    case "changeForm":
      return changeForm(ctx, command);
    case "playCard":
      return playCard(ctx, command);
    case "useAbility":
      return useAbility(ctx, command);
    case "basicAttack":
      return basicAttack(ctx, command);
    case "basicThwart":
      return basicThwart(ctx, command);
    case "basicRecover":
      return basicRecover(ctx, command);
    case "endTurn":
      return endTurn(ctx, command);
    case "resolveChoice":
      return resolveChoice(ctx, command);
    case "concede":
      return concede(ctx, command);
  }
}

/**
 * The players give up. See `Command`'s own note for why this is a command rather than a client flag, and why any seat
 * may issue it; the only rules content here is who counts as seated — an eliminated player is out of the game
 * (RRG 1.8 "Player Elimination", p. 33) and has nothing left to concede.
 */
function concede(ctx: Ctx, command: Command & { type: "concede" }): EngineError | null {
  const player = getPlayer(ctx.state, command.playerId);
  if (!player) return engineError("unknown_player", `${command.playerId} is not at this table`, command);
  if (player.eliminated) return engineError("not_active_player", `${command.playerId} is out of the game`, command);
  endGame(ctx, { result: "conceded", reason: "playerConceded", byPlayerId: command.playerId });
  return null;
}

function resolveChoice(ctx: Ctx, command: Command & { type: "resolveChoice" }): EngineError | null {
  const choice = ctx.state.pendingChoice;
  if (!choice) return engineError("no_choice_pending", "there is no choice to resolve", command);
  if (choice.choiceId !== command.choiceId) {
    return engineError("invalid_choice", `pending choice is ${choice.choiceId}`, command);
  }
  if (choice.playerId !== command.playerId) {
    return engineError("invalid_choice", `${choice.playerId} must make this choice`, command);
  }
  const selected = command.selectedOptionIds;
  if (new Set(selected).size !== selected.length) {
    return engineError("invalid_choice", "duplicate selections", command);
  }
  if (selected.length < choice.minSelections || selected.length > choice.maxSelections) {
    return engineError(
      "invalid_choice",
      `expected ${choice.minSelections}–${choice.maxSelections} selections, got ${selected.length}`,
      command,
    );
  }
  for (const optionId of selected) {
    if (!choice.options.some((o) => o.optionId === optionId)) {
      return engineError("invalid_choice", `${optionId} is not an option`, command);
    }
  }

  clearChoice(ctx);
  emit(ctx, {
    type: "choiceResolved",
    choiceId: choice.choiceId,
    playerId: choice.playerId,
    selectedOptionIds: selected,
  });

  // A choice that belongs to a stack frame is handed straight back to that frame.
  if (choice.frameId) {
    updateFrame(ctx, choice.frameId, (frame) => ({ ...frame, answer: selected }));
    return null;
  }

  switch (choice.prompt.kind) {
    case "discardDownToHandSize": {
      for (const optionId of selected) discardFromHand(ctx, choice.playerId, instanceId(optionId));
      const player = mustPlayer(ctx.state, choice.playerId);
      if (player.hand.length > handSize(ctx.state, choice.playerId, ctx.deps)) {
        throw new EngineInvariantError("hand still exceeds hand size after discard choice");
      }
      afterDiscardChoice(ctx, choice.playerId);
      return null;
    }
    case "mulligan": {
      for (const optionId of selected) discardFromHand(ctx, choice.playerId, instanceId(optionId));
      afterMulliganChoice(ctx, choice.playerId);
      return null;
    }
    // RRG "Restricted" / "Ally Limit": the controller discards from play down to the limit.
    case "discardOverAllyLimit":
    case "discardRestricted": {
      for (const optionId of selected) discardFromPlay(ctx, instanceId(optionId));
      return null;
    }
    case "chooseMinionToActivate": {
      const picked = selected[0];
      if (!picked) return engineError("invalid_choice", "a minion must be chosen", command);
      activateChosenMinion(ctx, instanceId(picked));
      return null;
    }
    default:
      throw new EngineInvariantError(`choice ${choice.prompt.kind} has no frame to resume`);
  }
}

export interface GameLog {
  /** State immediately after setup — the replay baseline (it carries the seed and card pool). */
  readonly initialState: GameState;
  readonly commands: readonly Command[];
}

export const createLog = (initialState: GameState): GameLog => ({ initialState, commands: [] });

export const appendCommand = (log: GameLog, command: Command): GameLog => ({
  ...log,
  commands: [...log.commands, command],
});

export type ReplayResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: EngineError; readonly commandIndex: number };

export function applyCommands(
  state: GameState,
  commands: readonly Command[],
  deps: EngineDeps = DEFAULT_DEPS,
): ReplayResult {
  let current = state;
  const events: GameEvent[] = [];
  for (const [index, command] of commands.entries()) {
    const result = applyCommand(current, command, deps);
    if (!result.ok) return { ok: false, error: result.error, commandIndex: index };
    current = result.state;
    events.push(...result.events);
  }
  return { ok: true, state: current, events };
}

export const replay = (log: GameLog, deps: EngineDeps = DEFAULT_DEPS): ReplayResult =>
  applyCommands(log.initialState, log.commands, deps);

export interface GameSession {
  readonly state: GameState;
  readonly log: GameLog;
}

export const startSession = (initialState: GameState): GameSession => ({
  state: initialState,
  log: createLog(initialState),
});

export type SessionResult =
  | { readonly ok: true; readonly session: GameSession; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: EngineError };

/** Applies a command and records it, so the session can always be replayed from its log. */
export function sessionApply(session: GameSession, command: Command, deps: EngineDeps = DEFAULT_DEPS): SessionResult {
  const result = applyCommand(session.state, command, deps);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    session: { state: result.state, log: appendCommand(session.log, command) },
    events: result.events,
  };
}
