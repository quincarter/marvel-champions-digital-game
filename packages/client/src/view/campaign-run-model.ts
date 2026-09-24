/**
 * The Run screen (C07, `scenes/campaign/run.ts`): every issue of the run, in printed order, each with the state
 * it's actually in — finished (with a result derived from `CampaignHistoryEntry`), current (up next, with its
 * story teaser), or sealed (villain hidden, MC10 p. 3's "the order of these scenarios is not fixed" campaigns
 * aside — every box this client plays is linear, and a sealed issue's villain is never read out of the story or
 * the definition here on purpose: the design's whole point is "each issue opens on a reveal").
 *
 * Pure TypeScript over a `CampaignRecord`, its `CampaignDefinition` and its `CampaignStory` (all already loaded by
 * the caller — this module touches no storage). Nothing here decides whether a node is legal to play next; that's
 * still the runner's job (`campaign-service.ts`), this only describes what's already true of the log.
 */
import type { CampaignDefinition, CampaignHistoryEntry, CampaignLog } from "@mc/engine";
import {
  issueNumberOf,
  issueStoryFor,
  type CampaignStory,
  type ComicBeatRef,
  type ComicPage,
  type ComicPanelRect,
} from "../campaign/story.js";
import type { CardNameOf } from "./campaign-log-model.js";

/**
 * Short, on-brand words for a log field, matching the design's own examples ("2 prototypes", "3 delay"). Exported
 * so `campaign-issue-model.ts` renders the same field the same way rather than falling back to the raw field id.
 */
export const FIELD_SHORT_LABEL: Readonly<Record<string, string>> = {
  delayCounters: "delay",
  experimental: "prototypes",
  rescuedAllies: "rescued",
  techUpgrade: "tech",
  basicUpgrade: "condition",
  remainingHp: "HP",
  units: "unit",
};

/**
 * MC16's "units" is a countable noun ("1 unit" / "5 units"); every other short label above reads fine unpluralized.
 * Exported so the Dossier's Wallets panel (`campaign-dossier-model.ts`) pluralizes the same currency field the
 * same way, rather than re-deciding it.
 */
export const PLURALIZED_FIELDS: ReadonlySet<string> = new Set(["units"]);

export type RunIssueStatus = "finished" | "current" | "sealed";

/**
 * Where a page-based issue's own comic page (`docs/campaign-client-per-box.md` §4) crops for The Run: the page
 * itself and the bounding rect (page-pixel space) of just the beats that issue's `comicBeats` names — a page split
 * across two issues (GMW's `02-museum`) crops each to only its own half. Never set for a box without `pages`
 * (MC10): The Run keeps its plain villain-picture columns for those, unchanged.
 */
export interface RunPageCrop {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly rect: ComicPanelRect;
  /**
   * The individual panel rects `rect` unions — a page can carry real blank/blacked-out space between two of an
   * issue's panels (GMW's `02-museum` "the alarm cutting the lights"), so the drawing side (`scenes/campaign/
   * run.ts`'s `drawPageCrop`) biases its crop window toward these rather than the union's own bare geometric
   * center, which can otherwise land squarely on that blank gutter instead of either panel.
   */
  readonly beats: readonly ComicPanelRect[];
}

export interface RunIssueRow {
  readonly nodeId: string;
  readonly number: number;
  /** The villain's billed name — only known for a finished or current issue; null while sealed. */
  readonly villain: string | null;
  readonly title: string;
  readonly status: RunIssueStatus;
  /** Finished only: whether that node resolved as a win. Null otherwise. */
  readonly won: boolean | null;
  /** Finished only: e.g. "Won · 2nd try · 3 delay". Null otherwise. */
  readonly resultLine: string | null;
  /** Current only: the Run card's speech-bubble line. Null for a page-based issue (its own crop stands in for it). */
  readonly teaser: string | null;
  /** Current only: the one-sentence pitch. Null for a page-based issue (see `pageProgressLine`). */
  readonly blurb: string | null;
  /**
   * Current only, page-based issues only: "page 2, last panel" — where the guided read leaves off, so the Run
   * reads like a bookmark rather than repeating the pitch a comic page already shows.
   */
  readonly pageProgressLine: string | null;
  /**
   * This issue's own comic-page crop, for every status (finished full colour, current highlighted, sealed
   * pixelated so nothing legible shows through) — null for a box with no `pages` or an issue with no `comicBeats`.
   */
  readonly pageCrop: RunPageCrop | null;
}

/** The smallest rect (page-pixel space) containing every one of `rects` — a page split across issues crops to it. */
function unionRect(rects: readonly ComicPanelRect[]): ComicPanelRect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** `RunPageCrop` for an issue's `comicBeats` against the box's `pages`, or null (no pages, or issue has no beats). */
function pageCropFor(
  pages: readonly ComicPage[] | undefined,
  comicBeats: readonly ComicBeatRef[] | undefined,
): RunPageCrop | null {
  if (!pages || !comicBeats || comicBeats.length === 0) return null;
  const page = pages.find((candidate) => candidate.file === comicBeats[0]!.page);
  if (!page) return null;
  const rects = comicBeats
    .filter((ref) => ref.page === page.file)
    .map((ref) => page.beats[ref.beatIndex]?.panel)
    .filter((rect): rect is ComicPanelRect => rect !== undefined);
  if (rects.length === 0) return null;
  return { file: page.file, width: page.width, height: page.height, rect: unionRect(rects), beats: rects };
}

/**
 * "page 2, last panel" / "page 2, panel 2" — 1-based on both counters, "last" once the guided read's final beat
 * for the current issue is also the page's own final beat (matches the design tile's own wording).
 */
function pageProgressLineFor(
  pages: readonly ComicPage[] | undefined,
  comicBeats: readonly ComicBeatRef[] | undefined,
): string | null {
  if (!pages || !comicBeats || comicBeats.length === 0) return null;
  const lastRef = comicBeats[comicBeats.length - 1]!;
  const pageIndex = pages.findIndex((candidate) => candidate.file === lastRef.page);
  const page = pages[pageIndex];
  if (pageIndex < 0 || !page) return null;
  const isLastOfPage = lastRef.beatIndex === page.beats.length - 1;
  const panel = isLastOfPage ? "last panel" : `panel ${lastRef.beatIndex + 1}`;
  return `Up next · page ${pageIndex + 1}, ${panel}`;
}

export interface CampaignRunModel {
  readonly campaignName: string;
  readonly box: string;
  /** The current issue's 1-based number, or the total once the run has no issue left to play. */
  readonly issueNumber: number;
  readonly totalIssues: number;
  readonly issues: readonly RunIssueRow[];
  /** True once the run has resolved (won or lost) — no current issue left to open. */
  readonly finished: boolean;
  readonly won: boolean;
  readonly lost: boolean;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** A short, honest detail line for a won attempt, from what its steps actually wrote — never invented. */
function detailFor(entry: CampaignHistoryEntry, cardName: CardNameOf): string | null {
  for (const step of entry.steps) {
    for (const write of step.writes) {
      if (write.value.kind === "number" && write.value.value > 0) {
        const base = FIELD_SHORT_LABEL[write.field] ?? write.field;
        const label = PLURALIZED_FIELDS.has(write.field) && write.value.value !== 1 ? `${base}s` : base;
        return `${write.value.value} ${label}`;
      }
    }
  }
  const grants = entry.steps.flatMap((step) => step.grants);
  if (grants.length > 0) {
    return grants.length === 1 ? `${cardName(grants[0]!.cardId)}` : `${grants.length} cards granted`;
  }
  return null;
}

function resultLineFor(nodeId: string, history: readonly CampaignHistoryEntry[], cardName: CardNameOf): string {
  const attempts = history.filter((entry) => entry.nodeId === nodeId);
  const winning = attempts.find((entry) => entry.outcome === "won") ?? attempts[attempts.length - 1];
  if (!winning || winning.outcome !== "won") return attempts.length > 0 ? "Lost" : "";
  const detail = detailFor(winning, cardName);
  const tryNumber = attempts.indexOf(winning) + 1;
  const head = tryNumber <= 1 ? "Won" : `Won on ${ordinal(tryNumber)} try`;
  return detail ? `${head} · ${detail}` : head;
}

export function campaignRunModel(
  record: CampaignLog & { readonly name: string; readonly box: string },
  definition: CampaignDefinition,
  story: CampaignStory | undefined,
  cardName: CardNameOf = (id) => id as string,
): CampaignRunModel {
  const nodeIds = definition.graph.nodes.map((node) => node.id);
  const currentId = record.position.nextNodeId;
  const issues: RunIssueRow[] = definition.graph.nodes.map((node) => {
    const resolved = record.position.resolved[node.id];
    const isCurrent = node.id === currentId;
    const status: RunIssueStatus = isCurrent ? "current" : resolved ? "finished" : "sealed";
    const issueStory = issueStoryFor(definition.campaignId as string, node.id);
    const title = issueStory?.title ?? node.label;
    // A page-based issue's own crop is just art layout — never a spoiler on its own (it's shown pixelated while
    // sealed) — so it's computed for every status alike, unlike `villain`/`title` below which stay hidden on
    // purpose until the issue is at least current.
    const pageCrop = pageCropFor(story?.pages, issueStory?.comicBeats);
    if (status === "finished") {
      return {
        nodeId: node.id,
        number: issueNumberOf(nodeIds, node.id),
        villain: issueStory?.villain ?? node.label,
        title,
        status,
        won: resolved === "completed",
        resultLine: resultLineFor(node.id, record.history, cardName),
        teaser: null,
        blurb: null,
        pageProgressLine: null,
        pageCrop,
      };
    }
    if (status === "current") {
      return {
        nodeId: node.id,
        number: issueNumberOf(nodeIds, node.id),
        villain: issueStory?.villain ?? node.label,
        title,
        status,
        won: null,
        resultLine: null,
        // A page-based issue reads its own crop as the pitch, so the speech-bubble teaser and blurb (written for
        // the plain villain-picture column) are dropped in favor of `pageProgressLine`.
        teaser: pageCrop ? null : (issueStory?.teaser ?? null),
        blurb: pageCrop ? null : (issueStory?.blurb ?? null),
        pageProgressLine: pageProgressLineFor(story?.pages, issueStory?.comicBeats),
        pageCrop,
      };
    }
    return {
      nodeId: node.id,
      number: issueNumberOf(nodeIds, node.id),
      villain: null,
      title: "Sealed",
      status,
      won: null,
      resultLine: null,
      teaser: null,
      blurb: null,
      pageProgressLine: null,
      pageCrop,
    };
  });
  const currentIndex = currentId ? nodeIds.indexOf(currentId) : -1;
  return {
    campaignName: record.name,
    box: record.box,
    issueNumber: currentIndex >= 0 ? currentIndex + 1 : nodeIds.length,
    totalIssues: nodeIds.length,
    issues,
    finished: currentId === null,
    won: record.status === "won",
    lost: record.status === "lost",
  };
}
