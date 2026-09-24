/**
 * What each campaign screen is started with — the contract between screens built by different hands. Every screen
 * takes a `runId` (a stored `CampaignRecord.id`) and loads the record itself through `campaignService()`, so no
 * screen hands another a stale copy of the log: the store is the one source of truth, exactly as the game store is
 * for the Board.
 *
 * The flow (C00b → C11):
 *
 *   Title ─▶ Saga ─▶ Cover ─▶ (new run) Roster ─▶ Opener ─▶ Briefing ─▶ [game: setup deal → Board ⇄ Beat overlay]
 *                       │                                                    │
 *                       ├─▶ Run ─▶ Issue detail                         Game over ─▶ Aftermath ─▶ Opener (next issue)
 *                       └─▶ Dossier (overview/log/heroes/issues)                   │        └─▶ Finale (last issue)
 *                                                                                  └─▶ Rewind (a loss) ─▶ Briefing
 *
 * `CampaignDeckEdit` is reachable from Briefing, Rewind and Dossier › Heroes and returns to `returnTo`.
 */
import type { CampaignChoiceAnswer } from "@mc/engine";
import type { SCENES } from "../keys.js";

/** Where a screen goes back to, as a scene key plus that scene's own start data. */
export interface CampaignReturn {
  readonly key: (typeof SCENES)[keyof typeof SCENES];
  readonly data?: object;
}

/** C00b. Title's Campaign button. No data: the shelf is read from storage. */
export type CampaignSagaData = Record<string, never>;

/** C01. A volume's cover: an existing run (`runId`), or a fresh one to sign for (`campaignId` only). */
export interface CampaignCoverData {
  readonly campaignId: string;
  readonly runId?: string;
}

/** C02. Signing a new run of `campaignId`. `expertCampaign` is the Expert Campaign modifier (MC10 p. 17). */
export interface CampaignRosterData {
  readonly campaignId: string;
  readonly expertCampaign?: boolean;
}

/**
 * C03. The opener of the run's next issue (`record.position.nextNodeId`), continuing to Briefing. With `nodeId` it
 * is a reread of a finished issue (C07b's "Reread issue #2"): the same panels, then back to `returnTo`. With no
 * `runId` it is a read from Extras: `campaignId` names the box, `nodeId` the issue, and `returnTo` where to go after.
 */
export interface CampaignOpenerData {
  readonly runId?: string;
  readonly campaignId?: string;
  readonly nodeId?: string;
  readonly returnTo?: CampaignReturn;
}

/**
 * C08. Composes the next issue (answering its setup choices), shows decks, and starts the game. `answers`
 * carries over a bounce back from the Market screen (`market.ts`'s own doc comment): the questions already
 * answered before a Market-shaped pending choice sent the flow there, so composing resumes rather than restarts.
 */
export interface CampaignBriefingData {
  readonly runId: string;
  readonly answers?: readonly CampaignChoiceAnswer[];
}

/**
 * The Market — a between-games shopping trip built from a Market-shaped pending choice (`view/campaign-market-
 * model.ts`'s `isMarketPendingChoice`), reached only from Briefing's own composing loop. `answers` is everything
 * already decided before the Market-shaped choice appeared; this screen keeps composing from there and hands the
 * same shape back once it's done (`CampaignBriefingData.answers`).
 */
export interface CampaignMarketData {
  readonly runId: string;
  readonly answers: readonly CampaignChoiceAnswer[];
}

/**
 * C05/C06. Reached from Game over for a finished campaign game: folds the game into the log, asking the victory
 * choices (TECH, Condition, Improved) as it goes. A loss folds and hands straight on to Rewind.
 */
export interface CampaignAftermathData {
  readonly runId: string;
}

/** C09. After a lost issue has been folded (the log is back at the issue's start). */
export interface CampaignRewindData {
  readonly runId: string;
  /** The issue that was lost. */
  readonly nodeId: string;
}

/** C07. Every issue of the run. */
export interface CampaignRunData {
  readonly runId: string;
}

/** C07b. One finished issue: its attempts and what it wrote to the log. */
export interface CampaignIssueData {
  readonly runId: string;
  readonly nodeId: string;
}

export type DossierTab = "overview" | "log" | "heroes" | "issues";

/** C10/C10b/C10c. */
export interface CampaignDossierData {
  readonly runId: string;
  readonly tab?: DossierTab;
  /** Dossier › Heroes: which seat's sheet is open. */
  readonly seatNumber?: number;
}

/** C11. The run is won. */
export interface CampaignFinaleData {
  readonly runId: string;
}

/** Between issues: one seat's deck, edited under the campaign's deck rules (identity locked, grants pinned). */
export interface CampaignDeckEditData {
  readonly runId: string;
  readonly seatNumber: number;
  readonly returnTo: CampaignReturn;
}

/**
 * The frozen-deck summary (design tile 20): what `CampaignDeckEditData` becomes once MC16 p. 5's Expert freeze has
 * locked in (`scenes/campaign/deck-edit.ts` detects this from `frozenNonCampaignCardsOf`, never from `campaignId`,
 * and starts this scene instead of `deckBuilder`). Same shape as `CampaignDeckEditData` plus the seat's own title.
 */
export interface CampaignFrozenDeckData {
  readonly runId: string;
  readonly seatNumber: number;
  readonly returnTo: CampaignReturn;
  readonly title: string;
}

/** C04, launched over the Board: a villain flipped to `stage` in a campaign game. */
export interface CampaignBeatData {
  readonly campaignId: string;
  readonly nodeId: string;
  readonly stage: number;
  readonly round: number;
  /** The villain card's printed name ("Crossbones"), for the top bar. */
  readonly villainName: string;
  readonly scenarioId: string;
}
