/**
 * Strict rules in a lobby room (issue #880): the host's game takes no Undo, no Back out and no Manual adjust. The
 * engine host refuses them (`SessionConfig.roomPlayMode`, `engine/session-core.ts`); this is what the screens ask so
 * they hide or grey the controls with the reason, instead of offering a press that would be refused.
 */
import type { SessionConfig } from "../engine/host.js";
import { t } from "../i18n/translate.js";
import type { UndoPastTurn } from "../settings.js";

/** True for a game started from a lobby room whose rules are Strict. Single-player and plain watchable games: false. */
export const roomStrictOf = (config: Pick<SessionConfig, "roomPlayMode"> | null | undefined): boolean =>
  config?.roomPlayMode === "strict";

/** The one line that says why a control is off. */
export const strictReason = (): string => t("room.strict.reason");

/**
 * True when a lobby room's game takes no Undo or Back out: Strict rules, or the host's Undo setting is Off
 * (`SessionConfig.roomUndo`). Manual adjust follows `roomStrictOf` alone.
 */
export const roomUndoOffOf = (config: Pick<SessionConfig, "roomPlayMode" | "roomUndo"> | null | undefined): boolean =>
  roomStrictOf(config) || config?.roomUndo === "off";

/** The one line that says why Undo is off: Strict rules, or the host's Undo setting. */
export const undoOffReason = (config: Pick<SessionConfig, "roomPlayMode"> | null | undefined): string =>
  roomStrictOf(config) ? strictReason() : t("room.undo.reason");

/** The cheats a game honours: a room's game takes only the host's own, and only when the room has cheats on. */
export interface EffectiveCheats {
  readonly manualAdjust: boolean;
  readonly undoPastTurn: UndoPastTurn;
}

/**
 * The host's Settings > Cheats as they apply to this game. A game outside a room is unchanged. In a room, cheats off
 * (`roomCheats`) turns both off; cheats on honours Manual adjust only in Host control (not Strict) and Undo past a turn
 * only while Undo is not Off. These come from this device's settings, so only the host's device ever reads them for a
 * room game: a guest has no game config to read them against (it follows the host's log).
 */
export function roomCheatsOf(
  settings: { readonly allowManualAdjust: boolean; readonly undoPastTurn: UndoPastTurn },
  config: Pick<SessionConfig, "room" | "roomPlayMode" | "roomUndo" | "roomCheats"> | null | undefined,
): EffectiveCheats {
  if (!config || config.room === undefined) {
    return { manualAdjust: settings.allowManualAdjust, undoPastTurn: settings.undoPastTurn };
  }
  const on = config.roomCheats === true;
  return {
    manualAdjust: on && settings.allowManualAdjust && !roomStrictOf(config),
    undoPastTurn: on && !roomUndoOffOf(config) ? settings.undoPastTurn : "off",
  };
}
