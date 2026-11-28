import type { ControlGlyph, McSegmentOption } from "@mc/ui";
import type { TextRange } from "../../view/settings-search-line.js";
import type { PauseEventDetail, PauseMenuId } from "./shared/pause-events.types.js";

/** Phone: one ink sheet; wide: the ink menu beside the paper pane. Set by the scene from the screen's width. */
export type PauseMode = "wide" | "phone";

/** One button of the menu column (wide) or the footer (phone). */
export interface PauseMenuItem {
  readonly id: PauseMenuId;
  readonly label: string;
  readonly kind: "primary" | "onInk";
  /** Columns the button takes: 2 is the whole width. */
  readonly span: 1 | 2;
  readonly selected?: boolean;
  /** Pinned at the foot of the column. */
  readonly foot?: boolean;
  /** The B / Esc glyph hung on Resume while a keyboard or pad is in use. */
  readonly glyph?: ControlGlyph;
}

export interface PauseHeaderInput {
  readonly title: string;
  readonly status: string;
  /** A Civil War game's scenario sheet, one line each. */
  readonly blind: readonly string[];
  /** "Adjusted: not counted toward stats", or empty. */
  readonly note: string;
  /** The phone's boxed ✕, or none. */
  readonly close: { readonly label: string; readonly glyph?: ControlGlyph } | null;
}

/** A row that opens something (a Quick reference row, a search result), or a compact cell sharing the toggle's line. */
export interface PauseLinkInput {
  readonly stop: string;
  readonly title: string;
  readonly detail: string;
  /** Where a search result was found ("Pause", "Settings"). */
  readonly place?: string;
  readonly variant: "panel" | "compact" | "result";
  /** Dimmed, and a press does nothing (a row with no target yet). */
  readonly disabled?: boolean;
  readonly titleRanges?: readonly TextRange[];
  readonly detailRanges?: readonly TextRange[];
  readonly action: PauseEventDetail;
}

export interface PauseQuickInput {
  readonly toggle: { readonly label: string; readonly open: boolean };
  readonly rows: readonly PauseLinkInput[];
}

/** A row with a switch on its right: ON / OFF, or a door ("Open"). */
export interface PauseSwitchInput {
  readonly stop: string;
  readonly title: string;
  readonly detail: string;
  /** The switch's word. */
  readonly state: string;
  readonly on: boolean;
  readonly unavailable: boolean;
  readonly action: PauseEventDetail;
}

/** A choice: a title, an optional line of detail, and one cell per option. */
export interface PauseChoiceInput {
  readonly title: string;
  readonly detail: string;
  readonly look: "cell" | "tile";
  readonly options: readonly McSegmentOption[];
}

export interface PauseTableInput {
  /** "Stop tutorial" and "Turn guide off", ahead of the Table, while a guided run is on. */
  readonly guideRun: readonly { readonly id: PauseMenuId; readonly label: string }[];
  readonly tableHeading: string;
  readonly cardSize: PauseChoiceInput;
  readonly rows: readonly PauseSwitchInput[];
  readonly guideHeading: string;
  readonly level: PauseChoiceInput | null;
  readonly guideRows: readonly PauseSwitchInput[];
}

export type PauseResultRow =
  | { readonly kind: "switch"; readonly row: PauseSwitchInput }
  | { readonly kind: "choice"; readonly row: PauseChoiceInput }
  | { readonly kind: "link"; readonly row: PauseLinkInput };

export interface PauseResultsInput {
  /** What stands in place of the groups: "Searching…" or "Nothing … matches that". */
  readonly note: string;
  readonly groups: readonly { readonly title: string; readonly rows: readonly PauseResultRow[] }[];
}

export type PauseKeywordTone = "plain" | "stunned" | "confused" | "tough";

export interface PauseKeywordInput {
  readonly id: string;
  readonly term: string;
  readonly definition: string;
  readonly tone: PauseKeywordTone;
  /** "On Spider-Man." and the card it names, for the hover. */
  readonly tail: { readonly text: string; readonly cardId: string } | null;
}

export interface PauseRulesInput {
  readonly title: string;
  readonly filtered: string;
  /** Said in place of the grid when nothing on the table carries a keyword. */
  readonly empty: string;
  readonly entries: readonly PauseKeywordInput[];
}

export interface PauseLogLineInput {
  readonly id: string;
  readonly ref: string;
  readonly words: string;
  /** Present when Undo can get back to this moment: a press rewinds there. */
  readonly stop: string | null;
}

export interface PauseLogInput {
  readonly title: string;
  readonly note: string;
  readonly empty: string;
  readonly hint: string;
  /** Newest first. */
  readonly lines: readonly PauseLogLineInput[];
}

export interface PauseConfirmInput {
  readonly sentence: string;
  readonly yes: string;
  readonly cancel: string;
}

export interface PausePageModel {
  readonly mode: PauseMode;
  /** Something is typed in the search: the results take the pane. */
  readonly searching: boolean;
  readonly header: PauseHeaderInput;
  /** Wide: the menu column; phone: the footer. */
  readonly menu: readonly PauseMenuItem[];
  readonly search: { readonly value: string; readonly placeholder: string; readonly clearLabel: string };
  readonly results: PauseResultsInput | null;
  readonly rules: PauseRulesInput;
  /** The log: "Jump to a moment" (the recent lines) beside the rules, or the Full game log when `logExpanded`. */
  readonly log: PauseLogInput;
  /** "Full game log" open: wide swaps the rules for the full log, the phone swaps the Table group. */
  readonly logExpanded: boolean;
  readonly quick: PauseQuickInput;
  readonly table: PauseTableInput;
  readonly confirm: PauseConfirmInput | null;
}
