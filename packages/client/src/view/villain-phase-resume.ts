/**
 * A reload during the villain phase brings the walkthrough back (issue #989).
 *
 * The engine resolves the whole villain phase at once, so a save made mid-phase holds the finished phase, while the
 * walkthrough (`scenes/villain-phase.ts`) plays it back beat by beat and the player may not have read it yet. While the
 * walkthrough is open the Board notes, on this device, which game and which command began the phase; the overlay clears
 * the note when it closes (Start player phase, Skip, the game ending). On a resume, a note that names the resumed game
 * and a command that did begin a villain phase means the walkthrough was open: it is launched again with the phase
 * rebuilt from the save's own commands (`EngineUpdate.villainPhase`), exactly as a live phase would have had them.
 *
 * The note lives in this device's local storage rather than in the save: it is only ever about this device's open
 * walkthrough (a linked device or a watcher has its own), and the save's format, its sync and its storage stay as they
 * were. A note that no longer fits its save (an Undo past the phase, another game) is ignored.
 */
import { gameDeps } from "../content/game-deps.js";
import type { VillainPhaseSeed } from "../engine/host.js";
import type { GameEvent, InstanceId, PlayerId } from "@mc/engine";
import { NO_REFILL, trackRefill, type EndOfTurnDraws } from "./villain-end-of-turn.js";
import { appendWalkthrough, walkthroughSeededFrom, type Walkthrough } from "./villain-walkthrough.js";

/**
 * Which game's walkthrough is open, and the command count before the command that began its villain phase. Each game
 * keeps its own marker (`mc-villain-phase-open:<gameId>`), so two tabs playing two games never overwrite or clear each
 * other's (review on #901, 2026-11-24). Scope for the upper PRs: only solo play and a room's host write or use it (a
 * guest's device follows the host's pacing, and no room role exists on this branch to tell them apart).
 */
export interface VillainPhaseMarker {
  readonly gameId: string;
  readonly commandCount: number;
}

const KEY_PREFIX = "mc-villain-phase-open:";
const keyOf = (gameId: string): string => `${KEY_PREFIX}${gameId}`;

/** The browser's local storage where it exists; a sandboxed embed can throw merely reading it. */
function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Notes the walkthrough as open. Never throws: a note that cannot be kept just means no rebuild after a reload. */
export function writeVillainPhaseMarker(
  marker: VillainPhaseMarker,
  storage: Pick<Storage, "setItem"> | null = defaultStorage(),
): void {
  try {
    storage?.setItem(keyOf(marker.gameId), JSON.stringify(marker));
  } catch {
    // Storage full or blocked.
  }
}

/** `gameId`'s note, or null when there is none, no game is named, or it is not one this build wrote. */
export function readVillainPhaseMarker(
  gameId: string | null,
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): VillainPhaseMarker | null {
  if (gameId === null) return null;
  try {
    const raw = storage?.getItem(keyOf(gameId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const wanted = gameId;
    const { gameId: stored, commandCount } = parsed as { gameId?: unknown; commandCount?: unknown };
    if (typeof stored !== "string" || stored !== wanted) return null;
    if (typeof commandCount !== "number" || !Number.isInteger(commandCount)) return null;
    return commandCount < 0 ? null : { gameId: stored, commandCount };
  } catch {
    return null;
  }
}

/** `gameId`'s walkthrough closed: nothing to bring back for it. Another game's marker stays. */
export function clearVillainPhaseMarker(
  gameId: string | null,
  storage: Pick<Storage, "removeItem"> | null = defaultStorage(),
): void {
  if (gameId === null) return;
  try {
    storage?.removeItem(keyOf(gameId));
  } catch {
    // Blocked storage.
  }
}

/**
 * The phase to rebuild for a resumed game, or null: the note must name this game, and the save's last villain phase must
 * be the one the note names (an Undo or a later phase makes it stale), with commands past it to rebuild from.
 */
export function villainPhaseToRebuild(
  marker: VillainPhaseMarker | null,
  gameId: string | null,
  seed: VillainPhaseSeed | null,
): VillainPhaseSeed | null {
  if (!marker || !seed || gameId === null || marker.gameId !== gameId) return null;
  if (seed.startCommand !== marker.commandCount || seed.commands.length === 0) return null;
  // The phase must still be the last thing in the save: it began in the player phase, and no command but the last may
  // have left the villain phase (a later command means the player phase was started and the walkthrough was closed).
  if (seed.before.step.phase === "villain") return null;
  const last = seed.commands.length - 1;
  if (seed.commands.some((command, i) => i < last && command.after.step.phase !== "villain")) return null;
  return seed;
}

/**
 * The walkthrough a live phase would have accumulated by now: the beats of each command from the one that began the
 * phase, in order, each with the table as that command left it.
 */
export function walkthroughFromSeed(
  seed: VillainPhaseSeed,
  round: number,
  surgeDealt: readonly InstanceId[] | undefined,
  viewer: PlayerId | null,
): Walkthrough {
  let walkthrough = walkthroughSeededFrom(round, surgeDealt);
  for (const command of seed.commands) {
    walkthrough = appendWalkthrough(walkthrough, command.events, command.after, viewer, gameDeps(), command.states);
  }
  return walkthrough;
}

/** The store version the rebuilt phase stands at: every command of the seed has been taken in. */
export const seedVersionOf = (seed: VillainPhaseSeed): number => seed.startCommand + seed.commands.length;

/**
 * A resumed game's history cut where the villain phase began: the events before the command that began it, the events of
 * the phase's commands, and the end-of-turn refill as that command ended it. The Board folds the first part into its log
 * (and keeps that log as the one from before the phase, with the surge cards it dealt), then the rest.
 */
export function splitResumedHistory(
  history: readonly GameEvent[],
  seed: VillainPhaseSeed,
): {
  readonly before: readonly GameEvent[];
  readonly phase: readonly GameEvent[];
  readonly endOfTurn: EndOfTurnDraws | null;
} {
  const phaseEvents = seed.commands.reduce((sum, command) => sum + command.events.length, 0);
  const split = Math.max(0, history.length - phaseEvents);
  const before = history.slice(0, split);
  const endOfTurn = trackRefill(trackRefill(NO_REFILL, before).tracker, seed.commands[0]?.events ?? []).ended;
  return { before, phase: history.slice(split), endOfTurn };
}
