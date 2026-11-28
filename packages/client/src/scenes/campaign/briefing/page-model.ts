
/**
 * The Briefing page model: everything `views/briefing/mc-briefing-page` shows, built from the scene state. The page and its elements
 * render this and decide nothing; legality (what a deck setup refuses, what a call offers) is the engine answer, read from the
 * campaign service and the pending choice.
 */
import type Phaser from "phaser";
import type { DecksModel } from "../../../components/briefing/mc-briefing-decks/mc-briefing-decks.types.js";
import type { HandledModel } from "../../../components/briefing/mc-briefing-handled/mc-briefing-handled.types.js";
import type { PictureLeases } from "../../../dom/picture-leases.js";
import type { CampaignRecord } from "../../../engine/campaign-storage.js";
import { t } from "../../../i18n/translate.js";
import { campaignFrame } from "../../../ui/campaign-chrome.js";
import { DECK_NOTE_EXEMPT, type BriefingView } from "../../../view/campaign-briefing-model.js";
import type { WaitingPanel } from "../../../view/campaign-modular-call-model.js";
import type { BriefingPageModel } from "../../../views/briefing/mc-briefing-page/mc-briefing-page.types.js";
import { callModelOf, callShapeOf, isGenreSetPick } from "./calls/call-model.js";
import { artOf, bottomModelOf, seatPickerOf, topBarOf } from "./chrome-model.js";
import type { BriefingState } from "./context.js";
import { briefingTextIn, waitingNoteIn } from "./copy.js";
import type { BriefingHints } from "./hints.js";
import { NO_SECTIONS, poolModelOf, sectionsModelOf } from "./sections/sections-model.js";
import { speakerModelOf } from "./speaker-model.js";
import { briefingViewFor } from "./view-of.js";

const countOf = (row: BriefingView["decks"][number]): string =>
  row.pinnedCount > 0 ? t("briefing.decks.pinned", { size: row.deckSize, pinned: row.pinnedCount }) : `${row.deckSize}`;

export interface PageModelInput {
  readonly scene: Phaser.Scene;
  readonly state: BriefingState;
  readonly leases: PictureLeases;
  readonly hints: BriefingHints;
  /** The seats whose deck setup would refuse, by the engine own check. */
  readonly deckProblems: (record: CampaignRecord) => ReadonlyMap<number, string>;
}

/** The page for the state now; null before the run is loaded. */
export function pageModelOf(input: PageModelInput): BriefingPageModel | null {
  const { scene, state, leases, hints } = input;
  const record = state.record;
  if (!record) return null;
  const frame = campaignFrame(scene);
  const phone = frame.phone;
  const problems = input.deckProblems(record);
  const view = briefingViewFor(state, input.deckProblems);
  const pending = state.pending;
  const shape = pending ? callShapeOf(state, pending, phone) : { seatCall: false, ownsScroll: false };
  const plan = {
    hasPool: !!view?.pool,
    seatCall: shape.seatCall || shape.ownsScroll,
    callOwnsScroll: shape.ownsScroll,
  };
  const text = briefingTextIn();
  // What an unfilled panel says while the issue waits on a call, or is still composing.
  const genre = !!pending && isGenreSetPick(state, pending);
  const waiting = (panel: WaitingPanel): string | null =>
    view ? null : waitingNoteIn(panel, pending ? "asking" : "composing", genre);
  const handled: HandledModel = {
    rows: view ? view.handled.map((row) => text.handledRow(row)) : [],
    waiting: waiting("handled"),
  };
  const decks: DecksModel = {
    rows: view
      ? view.decks.map((row) => ({
          seat: row.seatNumber,
          title: `${row.heroName.toLocaleUpperCase()} · ${row.aspectLabel}`,
          count: countOf(row),
          problem: row.problem ? text.deckProblem(row.problem) : null,
        }))
      : [],
    note: text.deckNote(view?.deckNote ?? DECK_NOTE_EXEMPT),
    waiting: waiting("decks"),
  };
  const bottom = bottomModelOf(state, record, problems, hints.glyph("open"), phone);
  return {
    phone,
    topBar: topBarOf(scene, state, record, frame, hints.glyph("back")),
    art: artOf(record, leases),
    plan,
    speaker: plan.seatCall ? null : speakerModelOf(state, leases),
    pool: plan.hasPool && view?.pool ? poolModelOf(view.pool, leases) : null,
    handled,
    decks,
    sections: plan.seatCall ? NO_SECTIONS : sectionsModelOf(state, view, leases, phone),
    call: pending ? callModelOf({ state, pending, leases, hints, phone }) : null,
    composing: !pending && state.composing ? t("briefing.composing") : null,
    ...bottom,
    seatPicker: seatPickerOf(state, record),
  };
}
