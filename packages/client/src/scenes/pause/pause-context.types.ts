import type { ControlGlyph } from "@mc/ui";
import type { LogLine } from "../../view/log-lines.js";
import type { PauseSettingRow } from "../../view/pause-search.js";
import type { RulesEntry } from "../../view/rules-reference.js";
import type { SettingsSearchResult } from "../../view/settings-search.js";
import type { CardSizeRowInfo, GuideRowInfo, SettingsRowInfo } from "../../view/settings-rows.js";
import type { PauseMode } from "../../components/pause/pause.types.js";

/** One Quick reference row (phone) as the scene knows it: what it says, and whether it opens anything. */
export interface QuickReferenceRow {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  /** Shares one line with the toggle (Music, Report, Controls): a short title in a cell, no detail, no chevron. */
  readonly compact?: true;
  /** Why it cannot open yet (the row is dimmed and does nothing). */
  readonly unavailable?: string;
  /** Whether a press opens something. */
  readonly enabled: boolean;
}

/**
 * Everything the Pause page shows that comes from the live game, the settings and the room, gathered by the scene into
 * plain data so `composePause` (`pause-compose.ts`) is a pure function of it.
 */
export interface PauseContext {
  readonly mode: PauseMode;
  readonly hasGame: boolean;
  /** The status line in this mode's own words (the phone's full line, the wide menu's shorter one). */
  readonly status: string;
  readonly blindLines: readonly string[];
  readonly adjusted: boolean;
  /** This device plays a room's game from a seat: Concede leaves the seat, Save & quit leaves. */
  readonly seatGame: boolean;
  readonly roomChat: boolean;
  readonly manualAdjustOn: boolean;
  readonly adjustLabel: string;
  readonly quitLabel: string;
  readonly concedeSentence: string;
  readonly confirmingConcede: boolean;
  readonly logExpanded: boolean;
  readonly quickExpanded: boolean;
  readonly guidedRunActive: boolean;
  readonly watchLinkLabel: string | null;
  readonly showHandLabel: string | null;
  readonly quickRows: readonly QuickReferenceRow[];
  readonly query: string;
  /** Something is typed: the results take the pane. */
  readonly searching: boolean;
  /** The worker's answer for the query; null while it is on its way. */
  readonly results: readonly SettingsSearchResult[] | null;
  readonly settingRows: readonly PauseSettingRow[];
  readonly tableRows: readonly SettingsRowInfo[];
  readonly cardSize: CardSizeRowInfo;
  readonly guideRows: readonly GuideRowInfo[];
  readonly entries: readonly RulesEntry[];
  /** The retained log, oldest first. */
  readonly logLines: readonly LogLine[];
  /** The log lines Undo could get back to, by line id. */
  readonly undoable: ReadonlyMap<string, number>;
  /** The B / Esc glyph hung on Resume (wide) or ✕ (phone), while a keyboard or pad is in use. */
  readonly cancelGlyph: ControlGlyph | undefined;
}
