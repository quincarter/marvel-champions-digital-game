/**
 * The outside fact Git Gud 44028 reads, from the local profile's game history (docs/phase7-wave7.md §4.1 Q48): the
 * previous game's result, snapshotted into each seat's `PlayerSetup.outsideFacts` at setup. Pure: it takes the list
 * `GameStorage.list()` returned.
 *
 * Only a game that finished as a win or a loss counts; an abandoned or conceded game, one still in progress and an
 * incompatible save are not results (Q48: "only games completed as a win or a loss count"), so the previous game is the
 * most recently finished won or lost one. Campaign and standalone games share one history. No such game means no fact,
 * which the engine reads as "did not win" (a first game, like a forgotten one). The spec is silent on a hot-seat table
 * with several local seats, which share the one profile: every seat gets the profile's result.
 */
import type { OutsideFacts } from "@mc/engine";
import { isLessonSave, type SaveMeta } from "./game-storage.js";

/** The profile's last finished game as a win or a loss, or null when it has none. */
export function lastFinishedResult(saves: readonly SaveMeta[]): "won" | "lost" | null {
  let latest: SaveMeta | null = null;
  for (const meta of saves) {
    if (meta.status !== "won" && meta.status !== "lost") continue;
    // A Try-it lesson is a teaching game, not a previous game.
    if (isLessonSave(meta)) continue;
    if (!latest || meta.updatedAt > latest.updatedAt) latest = meta;
  }
  return latest ? (latest.status as "won" | "lost") : null;
}

/** One entry per seat for the engine's `PlayerSetup.outsideFacts`, or null when the history says nothing. */
export function previousGameFacts(saves: readonly SaveMeta[], seats: number): readonly OutsideFacts[] | null {
  const result = lastFinishedResult(saves);
  if (result === null) return null;
  return Array.from({ length: seats }, () => ({ wonPreviousGame: result === "won" }));
}
