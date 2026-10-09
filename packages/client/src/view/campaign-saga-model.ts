/**
 * The Saga shelf (C00b): one row per `SAGA_VOLUMES` entry, each carrying everything `scenes/campaign/saga.ts`
 * needs to draw it — status, the CTA it offers, its roster and issue progress — without the scene itself touching
 * storage or a `CampaignDefinition`.
 *
 * Pure and Vitest-tested, the same discipline `campaign-list-model.ts` documents. Built on top of that module's
 * `campaignListRows` rather than reading `CampaignSummary` twice over: this is "group those rows by box, add the
 * saga's own sequencing rule".
 *
 * **Unlock rule** (design: "win a volume on Standard to open the next"): volume 1 is always open; volume N+1 opens
 * once volume N has a run *won on Standard* (`!modes.campaign?.expertCampaign`). A volume this build has no
 * `CampaignDefinition` for can never be opened regardless of the unlock rule — `campaignDefinitionOf` is the one
 * source of truth for "is this box playable here", exactly as `campaign-list-model.ts`'s own
 * `incompatibleReasonOf` uses it.
 *
 * **Progression** (`progression/unlocks.ts`) sits on top: a volume whose wave the player hasn't opened stays sealed
 * with that wave's own reason ("Beat Rhino to unlock The Rise of Red Skull"), and
 * a volume opened by hand (Settings ▸ Unlocks: one campaign, or "Unlock everything") opens regardless of the
 * Standard-win order.
 */
import { campaignDefinitionOf } from "@mc/cards";
import type { CardId } from "@mc/content";
import type { CampaignDefinition } from "@mc/engine";
import type { CampaignSummary } from "../engine/campaign-storage.js";
import { campaignListRows, type CampaignListRow } from "./campaign-list-model.js";
import { SAGA_VOLUMES, storyFor, type SagaVolume } from "../campaign/story.js";
import { lostAtNodeIdOf } from "./campaign-run-model.js";
import type { PipState } from "../ui/campaign-chrome.js";

export type SagaVolumeStatus = "live" | "done" | "fresh" | "sealed";

export interface SagaVolumeRow {
  readonly volume: SagaVolume;
  readonly status: SagaVolumeStatus;
  readonly hasDefinition: boolean;
  readonly unlocked: boolean;
  /** The run to continue/reread — the most recently updated active run for "live", most recent won run for "done". Null otherwise. */
  readonly runId: string | null;
  readonly wonStandard: boolean;
  readonly wonExpert: boolean;
  readonly canResume: boolean;
  readonly incompatibleReason: string | null;
  /** 1-based, from the run's own position — only set for "live". */
  readonly issueNumber: number | null;
  readonly totalIssues: number;
  readonly pips: readonly PipState[];
  readonly rosterNames: readonly string[];
  /**
   * Set only for the honest case: the unlock rule would open this volume (the previous one is won on Standard) but
   * this build has no `CampaignDefinition` for it yet. The tile's own generic "Sealed" chip covers every other
   * sealed volume — a still-locked one says so through `unlocked`, not through a stored reason string.
   */
  readonly lockReason: string | null;
  /**
   * The most recent lost run of an open volume that has no live or won run (a lost campaign, MC45 p. 20): the shelf says
   * so and opens it, while the volume stays "fresh" for a new roster. Null otherwise.
   */
  readonly lost: { readonly runId: string; readonly issueNumber: number } | null;
}

export interface SagaModelOptions {
  readonly definitionOf?: (campaignId: string) => CampaignDefinition | undefined;
  /** A hero identity's current display name — injected so this stays Vitest-pure, no `@mc/content` pool import. */
  readonly identityNameOf?: (id: CardId) => string;
  /** Why a box's wave is still locked (`Unlocks.campaignLock`), or null. Default: nothing is wave-locked. */
  readonly waveLockOf?: (campaignId: string) => string | null;
  /** Opened by hand in Settings ▸ Unlocks (one campaign, everything, or `?unlock=all`): opens out of order. */
  readonly openedByHandOf?: (campaignId: string) => boolean;
}

const defaultIdentityNameOf = (id: CardId): string => id as string;

function totalIssuesOf(definition: CampaignDefinition | undefined): number {
  if (definition && definition.graph.kind === "linear") return definition.graph.nodes.length;
  return 5;
}

/** One row per `SAGA_VOLUMES` entry, in volume order. */
export function campaignSagaRows(
  summaries: readonly CampaignSummary[],
  options: SagaModelOptions = {},
): readonly SagaVolumeRow[] {
  const definitionOf = options.definitionOf ?? campaignDefinitionOf;
  const identityNameOf = options.identityNameOf ?? defaultIdentityNameOf;
  const waveLockOf = options.waveLockOf ?? (() => null);
  const openedByHandOf = options.openedByHandOf ?? (() => false);
  const rows = campaignListRows(summaries, definitionOf);

  const rowsByCampaign = new Map<string, CampaignListRow[]>();
  for (const row of rows) {
    const list = rowsByCampaign.get(row.campaignId) ?? [];
    list.push(row);
    rowsByCampaign.set(row.campaignId, list);
  }

  let previousWonStandard = true;
  const out: SagaVolumeRow[] = [];
  for (const volume of SAGA_VOLUMES) {
    const ownRows = [...(rowsByCampaign.get(volume.campaignId) ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
    const activeRow = ownRows.find((r) => r.status === "active") ?? null;
    const wonRows = ownRows.filter((r) => r.status === "won");
    const wonStandard = wonRows.some((r) => r.modes.campaign?.expertCampaign !== true);
    const wonExpert = wonRows.some((r) => r.modes.campaign?.expertCampaign === true);
    const definition = definitionOf(volume.campaignId);
    const hasDefinition = definition !== undefined;
    const byHand = openedByHandOf(volume.campaignId);
    const waveLock = byHand ? null : waveLockOf(volume.campaignId);
    const unlocked = byHand || (previousWonStandard && waveLock === null);

    const summary = summaries.find((s) => s.id === (activeRow?.id ?? wonRows[0]?.id ?? "")) ?? null;

    let status: SagaVolumeStatus;
    let lockReason: string | null = null;
    let featuredRow: CampaignListRow | null = null;
    if (activeRow) {
      status = "live";
      featuredRow = activeRow;
    } else if (wonRows.length > 0) {
      status = "done";
      featuredRow = wonRows[0]!;
    } else if (unlocked && hasDefinition) {
      status = "fresh";
    } else {
      status = "sealed";
      if (unlocked && !hasDefinition) lockReason = "Not in this build yet";
      else if (waveLock !== null) lockReason = waveLock;
    }

    const total = totalIssuesOf(definition);
    let issueNumber: number | null = null;
    let pips: readonly PipState[] = Array.from({ length: total }, () => "empty");
    if (status === "done") pips = Array.from({ length: total }, () => "done");
    else if (status === "live" && summary && definition?.graph.kind === "linear") {
      const nodes = definition.graph.nodes;
      const index = nodes.findIndex((n) => n.id === summary.position.nextNodeId);
      issueNumber = index >= 0 ? index + 1 : null;
      pips = nodes.map((n) => {
        if (n.id === summary.position.nextNodeId) return "current";
        if (summary.position.resolved[n.id] === "completed") return "done";
        return "empty";
      });
    }

    const story = storyFor(volume.campaignId);
    const rosterNames = summary
      ? summary.seats.map((seat) => identityNameOf(seat.identityCardId as CardId))
      : (story?.castIdentityIds.map((id) => identityNameOf(id as CardId)) ?? []);

    let lost: SagaVolumeRow["lost"] = null;
    if (status === "fresh") {
      const lostRow = ownRows.find((r) => r.status === "lost");
      const lostSummary = lostRow ? summaries.find((s) => s.id === lostRow.id) : undefined;
      if (lostRow && lostSummary && definition) {
        const nodeIds = definition.graph.nodes.map((n) => n.id);
        const nodeId = lostAtNodeIdOf(lostSummary, nodeIds);
        if (nodeId) lost = { runId: lostRow.id, issueNumber: nodeIds.indexOf(nodeId) + 1 };
      }
    }

    out.push({
      volume,
      status,
      hasDefinition,
      unlocked,
      runId: featuredRow?.id ?? null,
      wonStandard,
      wonExpert,
      canResume: activeRow?.canResume ?? false,
      incompatibleReason: activeRow?.incompatibleReason ?? null,
      issueNumber,
      totalIssues: total,
      pips,
      rosterNames,
      lockReason,
      lost,
    });

    previousWonStandard = wonStandard;
  }
  return out;
}

/** The volume shown featured by default: the live one, else the first fresh one, else Vol. 1. */
export function defaultFeaturedVolume(rows: readonly SagaVolumeRow[]): number {
  return (
    rows.find((r) => r.status === "live")?.volume.number ??
    rows.find((r) => r.status === "fresh")?.volume.number ??
    rows[0]?.volume.number ??
    1
  );
}

/** How many volumes are open (playable right now) — half of the "N OF TOTAL COMPLETE · N OPEN" header label. */
export function openVolumeCount(rows: readonly SagaVolumeRow[]): number {
  return rows.filter((r) => r.status !== "sealed").length;
}

/** How many volumes are won — the other half of the header label. */
export function doneVolumeCount(rows: readonly SagaVolumeRow[]): number {
  return rows.filter((r) => r.status === "done").length;
}

/** Has any run of `campaignId` been won on Standard — the Cover screen's "Expert Campaign" unlock (MC10 p. 17). */
export function wonStandardOf(campaignId: string, summaries: readonly CampaignSummary[]): boolean {
  return summaries.some(
    (s) => s.campaignId === campaignId && s.status === "won" && s.modes.campaign?.expertCampaign !== true,
  );
}
