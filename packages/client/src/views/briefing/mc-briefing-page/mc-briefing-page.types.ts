import type { HintGlyph, PictureSource } from "@mc/ui";
import type { MissionBriefing } from "../../../view/campaign-mission-model.js";
import type { IssueModeRow } from "../../../view/campaign-modes-model.js";
import type { ActionBarModel } from "../../../components/briefing/mc-briefing-action-bar/mc-briefing-action-bar.types.js";
import type { CallModel } from "../../../components/briefing/mc-briefing-call/mc-briefing-call.types.js";
import type { DecksModel } from "../../../components/briefing/mc-briefing-decks/mc-briefing-decks.types.js";
import type { HandledModel } from "../../../components/briefing/mc-briefing-handled/mc-briefing-handled.types.js";
import type { PoolModel } from "../../../components/briefing/mc-briefing-pool/mc-briefing-pool.types.js";
import type { SchemeSectionModel } from "../../../components/briefing/mc-briefing-scheme/mc-briefing-scheme.types.js";
import type { SeatPickerModel } from "../../../components/briefing/mc-briefing-seat-picker/mc-briefing-seat-picker.types.js";
import type { ShieldSectionModel } from "../../../components/briefing/mc-briefing-shield/mc-briefing-shield.types.js";
import type { SpeakerModel } from "../../../components/briefing/mc-briefing-speaker/mc-briefing-speaker.types.js";
import type { WatchModel } from "../../../components/briefing/mc-briefing-watch-toggle/mc-briefing-watch-toggle.types.js";

/** The ink bar across the top. */
export interface BriefingTopBarModel {
  /** "Issues" (a phone: the bare arrow). */
  readonly backLabel: string;
  /** "Briefing · Issue #2", with the campaign modes after it. */
  readonly title: string;
  /** The hidden-evidence marker, or empty. */
  readonly right: string;
  readonly backGlyph: HintGlyph | null;
  /** How far the title drops, and where it must end, to clear the dark mode tab (`sheetThemeFor`). */
  readonly titleDrop: number;
  readonly titleMaxRight: number;
}

/** The box art faded across the page, and the colour the side pane fades into. */
export interface BriefingArtModel {
  /** Null with the faded art setting off, or a box with no art. */
  readonly picture: PictureSource | null;
  /** The side pane ground (a CSS colour). */
  readonly paneGround: string;
}

/**
 * What the layout settled on for this draw: a pool fills the wide left column (and Handled for you moves right); a per-seat call
 * takes a phone column top (no speaker, handled rows or sections above it); role-building scrolls itself (the page and left column
 * do not scroll, and a phone draws no Decks panel).
 */
export interface BriefingPlan {
  readonly hasPool: boolean;
  readonly seatCall: boolean;
  readonly callOwnsScroll: boolean;
}

/** The sections a composed issue adds around the handled rows and the decks; each null (or empty) when the box or the issue has none. */
export interface BriefingSectionsModel {
  readonly scheme: SchemeSectionModel | null;
  readonly mission: MissionBriefing | null;
  readonly shield: ShieldSectionModel | null;
  /** The easier-start toggle: null when it does not apply, else whether it is on. */
  readonly easier: { readonly on: boolean } | null;
  readonly modes: readonly IssueModeRow[];
}

/** Everything the Briefing shows; the scene builds it from its state and sets it on the page. */
export interface BriefingPageModel {
  /** A phone: one scrolling page, a smaller bar and tighter gutters. Otherwise the left column and the coloured right pane. */
  readonly phone: boolean;
  readonly topBar: BriefingTopBarModel;
  readonly art: BriefingArtModel;
  readonly plan: BriefingPlan;
  /** The speaker; null with no briefing line (or under a per-seat call that takes the column top). */
  readonly speaker: SpeakerModel | null;
  readonly pool: PoolModel | null;
  readonly handled: HandledModel;
  readonly decks: DecksModel;
  readonly sections: BriefingSectionsModel;
  /** "Your call"; null with no question open. */
  readonly call: CallModel | null;
  /** "Getting issue #2 ready...": the line shown while the issue composes and no call is open. */
  readonly composing: string | null;
  readonly actionBar: ActionBarModel;
  /** The phone strip above the bar: why Open waits, or the watch toggle; null for none. */
  readonly strip: { readonly reason: string; readonly watch: WatchModel | null } | null;
  /** A start or save error, in red above the bar. */
  readonly error: string | null;
  /** The "which deck?" chooser over the page; null while closed. */
  readonly seatPicker: SeatPickerModel | null;
}
