/**
 * What the Briefing's drawing pieces (`briefing/*.ts`, and the call and section pieces that plug into its slots) share:
 * the scene state they read, the `Column` a block is laid into, and `BriefingCtx`, the one object the scene hands them.
 * The pieces are plain functions over it; the scene stays the owner of the panel, the focus route, hover, compose,
 * answer, open and navigation.
 */
import type Phaser from "phaser";
import type { CampaignChoiceAnswer, CampaignDefinition, CampaignPendingChoice } from "@mc/engine";
import type { PictureLeases } from "../../../dom/picture-leases.js";
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import type { IssueStory } from "../../../campaign/story.js";
import type { CampaignRecord } from "../../../engine/campaign-storage.js";
import type { BriefingView } from "../../../view/campaign-briefing-model.js";
import type { HoverCardIdRect } from "../../../view/card-hover.js";
import type { Rect } from "../../../view/layout.js";
import { ROLE_BUILD_START, type RoleBuildState } from "../../../view/campaign-role-build-model.js";
import { ROLE_CALL_START, type RoleCallState } from "../../../view/campaign-role-call-model.js";
import type { FocusStop } from "../../focus-route.js";
import type { CampaignBriefingData } from "../routes.js";

/** The scrollbar's room beside a scroller (`SCROLL_GUTTER` in `@mc/ui`). */
export const SCROLL_GUTTER = 8;
/** The phone's watch toggle strip above the action bar. */
export const WATCH_STRIP_HEIGHT = 40;

/** The panel keys of the three scrollers: the phone's whole page, and the wide layout's left and right columns. */
export const PAGE_SCROLL = "briefing-page";
export const LEFT_SCROLL = "briefing-left";
export const RIGHT_SCROLL = "briefing-right";
/** Role-building's own scrollers (`calls/role-build.ts`): the card list, and the confirm step on a screen too short for it. */
export const ROLE_SCROLL = "briefing-rb-list";
export const ROLE_CONFIRM_SCROLL = "briefing-rb-confirm";
/** In the order the stick and the page keys try them: the call's own list ahead of the right pane. */
export const SCROLLERS: readonly string[] = [PAGE_SCROLL, LEFT_SCROLL, ROLE_SCROLL, ROLE_CONFIRM_SCROLL, RIGHT_SCROLL];

/** The stops Start (and A with nothing focused) takes, best first: a confirm, or the issue's Open button. */
export const FORWARD_STOPS: readonly string[] = ["rb-confirm", "role-confirm", "call-confirm", "open"];

export interface BriefingState {
  data: CampaignBriefingData;
  record: CampaignRecord | null;
  story: IssueStory | null;
  definition: CampaignDefinition | null;
  nodeIds: readonly string[];
  issueNumber: number;
  /**
   * The issue the run was on when this screen opened: null for a `choice` graph (Fear No Evil) still to pick one. The
   * pick settles the issue mid-Briefing, after the opener would have played, so its comic plays then.
   */
  nodeAtLoad: string | null;
  /** True when this issue's game is already on the table: the CTA continues it instead of opening a new one. */
  inProgress: boolean;
  /** The current unanswered question; nothing half-answered is ever shown as settled. */
  pending: CampaignPendingChoice | null;
  /** The answers accumulated across re-entries of `compose`. */
  answers: CampaignChoiceAnswer[];
  /** A multi-pick call's own selections before Confirm submits them. */
  picking: string[];
  /** The page of a long "Your call" list. */
  callPage: number;
  /** The role call's confirm step. */
  roleState: RoleCallState;
  /** Role-building's filter chip and confirm step. */
  roleBuild: RoleBuildState;
  composing: boolean;
  starting: boolean;
  /** The easier-start / mode toggle is being saved: Open waits, so the issue never opens on the pre-toggle record. */
  toggling: boolean;
  /** "Let people watch this game" (#876): starts from the Always allow setting; sent on the config at Open issue. */
  watchable: boolean;
  startError: string | null;
  /** The "which deck?" chooser EDIT DECKS opens when several seats could be meant and none is the problem. */
  seatPicker: boolean;
  /** The seats whose deck setup would refuse, computed once per composed attempt. */
  deckProblemsFor: { readonly key: unknown; readonly problems: ReadonlyMap<number, string> } | null;
}

/** A fresh state for a visit to the screen. */
export function newBriefingState(data: CampaignBriefingData, watchable: boolean): BriefingState {
  return {
    data,
    record: null,
    story: null,
    definition: null,
    nodeIds: [],
    issueNumber: 1,
    nodeAtLoad: null,
    inProgress: false,
    pending: null,
    answers: data.answers ? [...data.answers] : [],
    picking: [],
    callPage: 0,
    roleState: ROLE_CALL_START,
    roleBuild: ROLE_BUILD_START,
    composing: false,
    starting: false,
    toggling: false,
    watchable,
    startError: null,
    seatPicker: false,
    deckProblemsFor: null,
  };
}

/** Forgets the open call's own progress: a new question starts with no selection, page or confirm step. */
export function resetCallState(state: BriefingState): void {
  state.picking = [];
  state.callPage = 0;
  state.roleState = ROLE_CALL_START;
  state.roleBuild = ROLE_BUILD_START;
}

/**
 * What the layout settled on for this draw, for the blocks drawn into it. Set by `page.ts` before any slot runs.
 */
export interface BriefingPlan {
  /** A phone layout: one scrolling page; otherwise the left column and the scrolling coloured right pane. */
  readonly phone: boolean;
  /** The composed attempt's view (null until an issue is composed). */
  readonly view: BriefingView | null;
  /** The issue has a campaign pool: "From the pool" fills the left column, and "Handled for you" moves to the right. */
  readonly hasPool: boolean;
  /** A per-seat call takes the column's top: no speaker, handled rows or sections above it. */
  readonly seatCall: boolean;
  /** The call scrolls itself (role-building's list): the page and left column do not scroll, and no Decks panel is drawn. */
  readonly callOwnsScroll: boolean;
}

/**
 * A column a block is laid into: its x and width, where it sits on screen and how to turn a content rect into screen
 * coordinates, so a stop, a hover card or a reveal follows the column's scroll. Blocks draw at `x` / `width` with `y`
 * running down from the `top` they are given, and return their bottom.
 */
export interface Column {
  readonly x: number;
  readonly width: number;
  readonly phone: boolean;
  /** The column's scroller key in the panel, or null for a column the page does not scroll (`callOwnsScroll`). */
  readonly scrollKey: string | null;
  /** Where the column is seen on screen: what a stop inside it is clipped to. */
  readonly view: Rect;
  /** The content y the column starts at: 0 inside a scroller, else the screen y of its view. */
  readonly origin: number;
  /** `content` (the block's own coordinates) as it is on screen now. */
  onScreen(content: Rect): Rect;
  /** Scrolls the column the least that brings `content` into view. */
  reveal(content: Rect): void;
  /**
   * Registers a control the block drew: its `activate` for the panel's press (`ctx.actions`) and its focus stop (the ring
   * follows the scroll; the stop is revealed when focused). `extra` adds `inspect`, `adjust` and the like to the stop.
   */
  control(key: string, content: Rect, activate: () => void, extra?: Partial<FocusStop>): void;
  /** Makes the card picture at `content` open the card hover popover on desktop (clipped to the column's view). */
  hover(slot: string, cardId: string, content: Rect): void;
}

export interface BriefingCtx {
  readonly scene: Phaser.Scene;
  readonly glyphs: SheetGlyphs;
  readonly leases: PictureLeases;
  /** A press of a panel part, by its key. */
  readonly actions: Map<string, () => void>;
  /** A hold on a part with `inspect`, by its key. */
  readonly inspects: Map<string, () => void>;
  readonly stops: Map<string, FocusStop>;
  /** What a hanging glyph must not cover: the buttons. */
  readonly obstacles: Rect[];
  /** The card pictures a block drew, by hover slot, each read on screen when the popover asks (it follows the scroll). */
  readonly hoverCards: Map<string, () => HoverCardIdRect | null>;
  readonly state: BriefingState;
  /** The layout of the draw in progress; null outside one. */
  plan: BriefingPlan | null;
  /** The slots calls and sections plug into (`slots.ts`). */
  readonly slots: BriefingSlots;
  /** The scroller element for a panel key, if mounted. */
  scroller(key: string): HTMLElement | null;
  /** A new `SheetBuilder`, for parts measured before they are placed. */
  builder(): SheetBuilder;
  redraw(): void;
  /** Leaves for the run page (the issues). */
  back(): void;
  /** Records the answer to the pending call and composes again (the service's own re-entry loop). */
  answer(picked: readonly string[]): void;
  /** Opens the Inspect sheet on a card; `choice` adds a "take this card" button that raises `mc-choice-toggle`. */
  inspectCard(cardId: string, choice?: { readonly optionId: string; readonly label: string }): void;
  /** Opens one seat's deck (no seat: the one a problem points at, else the "which deck?" chooser). */
  editDecks(seatNumber?: number): void;
  /** Opens the composed issue (or continues the one already on the table). */
  openIssue(): void;
  toggleEasierStart(): void;
  setIssueMode(action: string): void;
  /** The seats whose deck setup would refuse, by the engine's own check. */
  deckProblems(record: CampaignRecord): ReadonlyMap<number, string>;
}

/** A block of the page: draws into `b` from `top` in `col`, returns its bottom (`top` when it draws nothing). */
export type BriefingBlock = (ctx: BriefingCtx, b: SheetBuilder, col: Column, top: number) => number;

/** Piece B's slot: the "Your call" block, and how the pending call changes the page around it. */
export interface CallSlot {
  /** How the pending call shapes the page (called with a pending call only). */
  shape(ctx: BriefingCtx, pending: CampaignPendingChoice, phone: boolean): { seatCall: boolean; ownsScroll: boolean };
  /** "Your call": heading, the call's own controls and its Confirm / Decline; the pending call is `ctx.state.pending`. */
  draw: BriefingBlock;
  /** True when `pending` is the modular-set (genre-set) pick, which the waiting notes name. */
  isGenreSetPick?(ctx: BriefingCtx, pending: CampaignPendingChoice): boolean;
  /** A card chosen in the Inspect sheet ("Take this card", `mc-choice-toggle`). */
  onInspectTake?(ctx: BriefingCtx, optionId: string): void;
}

/** Piece C's slot: the sections a composed issue adds around the handled rows and the decks. */
export interface SectionsSlot {
  /** "From the pool" (`view.pool`, drawn only when `plan.hasPool`), the left column's own list. */
  pool: BriefingBlock;
  /** Under the speaker and handled rows (the phone's column; the wide left column only with a pool): schemes, missions, shield, easier start, and on a phone the modes. */
  main: BriefingBlock;
  /** Under the Decks (or Handled) panel in the wide right pane: schemes, missions, shield and easier start when there is no pool; the modes always. */
  aside: BriefingBlock;
}

export interface BriefingSlots {
  readonly call: CallSlot;
  readonly sections: SectionsSlot;
}
