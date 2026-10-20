/**
 * Where a campaign run stands on its next issue, for the scenes that route and number it. A `linear` graph names its
 * next node from the start; a `choice` graph (Fear No Evil) names none until the briefing has drawn and the group has
 * picked one. Pure, Vitest-tested; the scenes only call these.
 */
import type { CampaignDefinition } from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import { issueNumberOf } from "../campaign/story.js";

type RunPosition = Pick<CampaignRecord, "attempt" | "position" | "status">;

/** The node the run is on: the composed attempt's, else the position's next one, else none yet. */
export const currentNodeIdOf = (record: RunPosition): string | null =>
  record.attempt?.nodeId ?? record.position.nextNodeId;

/**
 * True when an active run on a `choice` graph has no issue yet: the briefing's own compose draws and asks for it, so
 * the run goes there rather than to the Dossier. A finished run, or a linear one, never awaits a pick.
 */
export const awaitsIssuePick = (definition: Pick<CampaignDefinition, "graph">, record: RunPosition): boolean =>
  currentNodeIdOf(record) === null && definition.graph.kind === "choice" && record.status === "active";

/**
 * The 1-based number of the issue the run is on. A linear graph numbers by its fixed order; a choice graph has none,
 * so the number is the issues already settled plus this one.
 */
export function issueNumberOfRecord(definition: Pick<CampaignDefinition, "graph">, record: RunPosition): number {
  if (definition.graph.kind === "choice") return Object.keys(record.position.resolved).length + 1;
  const nodeId = currentNodeIdOf(record);
  return nodeId
    ? issueNumberOf(
        definition.graph.nodes.map((node) => node.id),
        nodeId,
      )
    : 1;
}
