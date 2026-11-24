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
import type { InstanceId, PlayerId } from "@mc/engine";
import { appendWalkthrough, walkthroughSeededFrom, type Walkthrough } from "./villain-walkthrough.js";

/** Which game's walkthrough is open, and the command count before the command that began its villain phase. */
export interface VillainPhaseMarker {
  readonly gameId: string;
  readonly commandCount: number;
}

const KEY = "mc-villain-phase-open";

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
    storage?.setItem(KEY, JSON.stringify(marker));
  } catch {
    // Storage full or blocked.
  }
}

/** The note, or null when there is none or it is not one this build wrote. */
export function readVillainPhaseMarker(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): VillainPhaseMarker | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { gameId, commandCount } = parsed as { gameId?: unknown; commandCount?: unknown };
    if (typeof gameId !== "string" || typeof commandCount !== "number" || !Number.isInteger(commandCount)) return null;
    return commandCount < 0 ? null : { gameId, commandCount };
  } catch {
    return null;
  }
}

/** The walkthrough closed: nothing to bring back. */
export function clearVillainPhaseMarker(storage: Pick<Storage, "removeItem"> | null = defaultStorage()): void {
  try {
    storage?.removeItem(KEY);
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
