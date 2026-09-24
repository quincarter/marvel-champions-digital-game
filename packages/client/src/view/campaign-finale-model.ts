/**
 * C11 Finale: the stat boxes and the CTA a won campaign ends on (docs/campaign-mode-design.md §10.2).
 *
 * Every number is read from the record itself, never invented. "Issues" is universal (the definition's own node
 * count against how many the log marks completed). Every other stat box is a box-declared `FinaleStatSpec`
 * (`CampaignStory.finale.stats`) computed generically here against whatever log field shape it names — never a
 * `campaignId` check. A box with no `stats` declared (or no story at all) gets `DEFAULT_FINALE_STATS`: the two
 * boxes MC10 has always shown ("Rewinds", counting lost attempts; "Allies freed", MC10's `rescuedAllies`
 * `cardList` field). A box that names a field its own log doesn't have reads 0 rather than guessing.
 */
import type { CampaignDefinition } from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import type { CampaignStory, ComicPage, FinaleStatSpec } from "../campaign/story.js";
import type { RunPageCrop } from "./campaign-run-model.js";

export interface FinaleStat {
  readonly label: string;
  readonly value: string;
}

export interface FinaleView {
  readonly issuesCompleted: number;
  readonly issuesTotal: number;
  /** In display order, after the universal "Issues" box. */
  readonly stats: readonly FinaleStat[];
  /** Whether this run's own record is already an expert-campaign run — the CTA reads "back to the saga" then. */
  readonly alreadyExpert: boolean;
}

/** MC10's own two stat boxes — the historical default for a box that declares no `finale.stats` of its own. */
export const DEFAULT_FINALE_STATS: readonly FinaleStatSpec[] = [
  { kind: "rewinds", label: "Rewinds" },
  { kind: "cardListTotal", label: "Allies freed", field: "rescuedAllies" },
];

function statValueOf(spec: FinaleStatSpec, record: CampaignRecord): string {
  switch (spec.kind) {
    case "rewinds":
      return String(record.history.filter((entry) => entry.outcome === "lost").length);
    case "cardListTotal": {
      let total = 0;
      for (const seat of record.seats) {
        const value = seat.fields[spec.field];
        if (value?.kind === "cardList") total += value.cardIds.length;
      }
      return String(total);
    }
    case "numberTotal": {
      let total = 0;
      for (const seat of record.seats) {
        const value = seat.fields[spec.field];
        if (value?.kind === "number") total += value.value;
      }
      return String(total);
    }
    case "sharedNumber": {
      const value = record.shared[spec.field];
      return String(value?.kind === "number" ? value.value : 0);
    }
  }
}

export function finaleViewOf(
  definition: CampaignDefinition,
  record: CampaignRecord,
  statSpecs: readonly FinaleStatSpec[] = DEFAULT_FINALE_STATS,
): FinaleView {
  const issuesTotal = definition.graph.nodes.length;
  const issuesCompleted = Object.values(record.position.resolved).filter((mark) => mark === "completed").length;
  const stats = statSpecs.map((spec) => ({ label: spec.label, value: statValueOf(spec, record) }));
  return { issuesCompleted, issuesTotal, stats, alreadyExpert: alreadyExpertOf(record) };
}

/** Whether the finished run was already the Expert Campaign (`CampaignModeRef.expertCampaign`). */
function alreadyExpertOf(record: CampaignRecord): boolean {
  return record.modes.campaign?.expertCampaign === true;
}

/** One hero line per seat, in seat order; a roster longer than the written lines reuses the last one (design's own rule). */
export function finaleHeroLineFor(heroLines: readonly string[], seatIndex: number): string {
  return heroLines[Math.min(seatIndex, heroLines.length - 1)] ?? "";
}

/**
 * The finale's own full comic-page spread (`CampaignStory.finale.page`), cover-fit like `RunPageCrop`: the whole
 * page as the crop target (unlike an issue's crop, which unions just its own `comicBeats`) since the finale reads
 * as one full-bleed splash, not a panel-by-panel guided read. Null for a box with no `finale.page` (MC10) or a
 * page name that doesn't match any of the box's `pages`.
 */
export function finaleSpreadCropFor(story: CampaignStory | undefined): RunPageCrop | null {
  const pageFile = story?.finale.page;
  if (!pageFile || !story?.pages) return null;
  const page: ComicPage | undefined = story.pages.find((candidate) => candidate.file === pageFile);
  if (!page) return null;
  return {
    file: page.file,
    width: page.width,
    height: page.height,
    rect: { x: 0, y: 0, w: page.width, h: page.height },
    beats: page.beats.map((beat) => beat.panel),
  };
}
