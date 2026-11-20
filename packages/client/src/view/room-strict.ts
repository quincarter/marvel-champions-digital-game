/**
 * Strict rules in a lobby room (issue #880): the host's game takes no Undo, no Back out and no Manual adjust. The
 * engine host refuses them (`SessionConfig.roomPlayMode`, `engine/session-core.ts`); this is what the screens ask so
 * they hide or grey the controls with the reason, instead of offering a press that would be refused.
 */
import type { SessionConfig } from "../engine/host.js";
import { t } from "../i18n/translate.js";

/** True for a game started from a lobby room whose rules are Strict. Single-player and plain watchable games: false. */
export const roomStrictOf = (config: Pick<SessionConfig, "roomPlayMode"> | null | undefined): boolean =>
  config?.roomPlayMode === "strict";

/** The one line that says why a control is off. */
export const strictReason = (): string => t("room.strict.reason");
