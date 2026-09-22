/**
 * The campaign browser (docs/campaign-mode-design.md §10.2, `campaign-list-model.ts`): one row per campaign, with
 * the Continue / Abandon affordances a row can offer.
 *
 * Pure: takes the summaries `CampaignStorage.list()` already returned rather than touching storage, so it's plain
 * TypeScript with Vitest tests — the same discipline `results-history.ts` documents.
 *
 * **Compatibility is never guessed.** A row's "can this be resumed?" question is answered from two stamps a
 * `CampaignSummary` already carries: `schema` (`CampaignLog`'s own shape stamp, `CAMPAIGN_LOG_SCHEMA`) and
 * `definitionVersion` (the box's own, bumped whenever an instruction/log-field/node id changes — design §5's
 * versioning table). Neither is retried here; a client never decides whether a log is safe to resume by anything
 * other than comparing these two stamps to what this build actually has registered
 * (`@mc/cards`'s `campaignDefinitionOf`), exactly the same "ask, don't reimplement" discipline `EngineSessionCore`
 * follows for `SaveMeta.schema` (`game-storage.ts`'s `isCurrentSchema`). This module never *writes* `status`; a
 * caller that decides to retire an incompatible row still has to call `CampaignStorage.setStatus` itself.
 */
import { campaignDefinitionOf } from "@mc/cards";
import type { PlayModes } from "@mc/content";
import { CAMPAIGN_LOG_SCHEMA, type CampaignDefinition, type CampaignStatus } from "@mc/engine";
import type { CampaignSummary } from "../engine/campaign-storage.js";

export interface CampaignListRow {
  readonly id: string;
  readonly campaignId: string;
  readonly name: string;
  readonly box: string;
  readonly status: CampaignStatus;
  /** "Scenario 3 of 5" for an active linear campaign mid-run; "2 of 5 completed" otherwise (design §10.2). */
  readonly positionLabel: string;
  readonly seats: readonly { readonly seatNumber: number; readonly identityCardId: string }[];
  readonly modes: PlayModes;
  readonly updatedAt: number;
  readonly canResume: boolean;
  readonly canAbandon: boolean;
  /** Why `canResume` is false when the campaign is still `active` — null otherwise (finished, or fully compatible). */
  readonly incompatibleReason: string | null;
}

function positionLabelOf(summary: CampaignSummary, definition: CampaignDefinition | undefined): string {
  if (!definition) return "Unknown campaign";
  const total = definition.graph.nodes.length;
  const completed = Object.values(summary.position.resolved).filter((mark) => mark === "completed").length;
  if (summary.status === "active" && definition.graph.kind === "linear") {
    const index = definition.graph.nodes.findIndex((node) => node.id === summary.position.nextNodeId);
    if (index >= 0) return `Scenario ${index + 1} of ${total}`;
  }
  return `${completed} of ${total} completed`;
}

function incompatibleReasonOf(summary: CampaignSummary, definition: CampaignDefinition | undefined): string | null {
  if (summary.status !== "active") return null;
  if (!definition) return `this build has no "${summary.box}" campaign content yet`;
  if (summary.schema !== CAMPAIGN_LOG_SCHEMA) {
    return `this campaign was saved in an older log format (${summary.schema}; this build reads ${CAMPAIGN_LOG_SCHEMA})`;
  }
  if (summary.definitionVersion !== definition.version) {
    return `${summary.name}'s campaign content changed under this campaign (was version ${summary.definitionVersion}, this build has ${definition.version})`;
  }
  return null;
}

/**
 * One row per summary, in the order given — `CampaignStorage.list()` already returns most-recently-played first,
 * so this never re-sorts.
 */
export function campaignListRows(
  summaries: readonly CampaignSummary[],
  definitionOf: (campaignId: string) => CampaignDefinition | undefined = campaignDefinitionOf,
): readonly CampaignListRow[] {
  return summaries.map((summary) => {
    const definition = definitionOf(summary.campaignId as string);
    const incompatibleReason = incompatibleReasonOf(summary, definition);
    return {
      id: summary.id,
      campaignId: summary.campaignId as string,
      name: summary.name,
      box: summary.box,
      status: summary.status,
      positionLabel: positionLabelOf(summary, definition),
      seats: summary.seats,
      modes: summary.modes,
      updatedAt: summary.updatedAt,
      canResume: summary.status === "active" && incompatibleReason === null,
      canAbandon: summary.status === "active",
      incompatibleReason,
    };
  });
}
