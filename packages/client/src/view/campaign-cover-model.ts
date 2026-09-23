/**
 * The Campaign cover (C01): what `scenes/campaign/cover.ts` needs to draw a box's cover — title, blurb, roster,
 * issue pips, the next issue's billing and every CTA's enabled state — from a loaded `CampaignRecord` (or none, for
 * a fresh volume that hasn't been started) plus the box's own content and story. Pure, Vitest-tested.
 */
import type { CardId } from "@mc/content";
import type { CampaignDefinition, CampaignStatus } from "@mc/engine";
import { storyFor, type CampaignStory } from "../campaign/story.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import type { PipState } from "../ui/campaign-chrome.js";

export interface CoverModel {
  readonly campaignId: string;
  readonly boxCode: string;
  readonly name: string;
  readonly blurb: string;
  readonly tagline: string;
  /** The scenario whose villain art fronts the cover — the box's final scenario (design: Red Skull for MC10). */
  readonly villainScenarioId: string;
  readonly hasRun: boolean;
  readonly rosterNames: readonly string[];
  readonly totalIssues: number;
  readonly pips: readonly PipState[];
  /** 1-based. Null with no run, or once the run has no next issue (won/lost/abandoned). */
  readonly issueNumber: number | null;
  readonly nextIssueTitle: string | null;
  readonly nextIssueVillain: string | null;
  /** The run's terminal state, for "no next issue" — null while a run is still active, or there is no run. */
  readonly finished: CampaignStatus | null;
  /** Read Issue / Sign the roster is the only enabled action while true. */
  readonly canReadIssue: boolean;
  readonly canOpenDossier: boolean;
  readonly canOpenRun: boolean;
  readonly expertUnlocked: boolean;
}

export interface CoverModelInput {
  readonly campaignId: string;
  readonly boxCode: string;
  readonly name: string;
  readonly record: CampaignRecord | null;
  readonly definition: CampaignDefinition | undefined;
  readonly expertUnlocked: boolean;
  readonly identityNameOf?: (id: CardId) => string;
}

const defaultIdentityNameOf = (id: CardId): string => id as string;

export function coverModelOf(input: CoverModelInput): CoverModel {
  const story = storyFor(input.campaignId);
  const identityNameOf = input.identityNameOf ?? defaultIdentityNameOf;
  const record = input.record;
  const definition = input.definition;

  const linearNodes = definition?.graph.kind === "linear" ? definition.graph.nodes : null;
  const total = linearNodes?.length ?? 5;
  const finalScenarioId =
    (linearNodes?.at(-1)?.scenario.kind === "fixed"
      ? (linearNodes!.at(-1)!.scenario as { scenarioId: string }).scenarioId
      : null) ??
    story?.issues.at(-1)?.nodeId ??
    input.campaignId;

  const rosterNames = record
    ? record.seats.map((seat: { readonly identityCardId: CardId }) => identityNameOf(seat.identityCardId))
    : [];

  let issueNumber: number | null = null;
  let pips: readonly PipState[] = Array.from({ length: total }, () => "empty");
  let nextIssueTitle: string | null = null;
  let nextIssueVillain: string | null = null;
  let finished: CampaignStatus | null = null;

  if (record && linearNodes) {
    const nextNodeId = record.position.nextNodeId;
    pips = linearNodes.map((node): PipState => {
      if (node.id === nextNodeId) return "current";
      if (record.position.resolved[node.id] === "completed") return "done";
      return "empty";
    });
    if (nextNodeId) {
      const index = linearNodes.findIndex((n) => n.id === nextNodeId);
      issueNumber = index >= 0 ? index + 1 : null;
      const issueStory = story?.issues.find((i) => i.nodeId === nextNodeId) ?? null;
      nextIssueTitle = issueStory?.title ?? null;
      nextIssueVillain = issueStory?.villain ?? null;
    } else {
      finished = record.status;
      if (record.status === "won") pips = linearNodes.map(() => "done");
    }
  } else if (record) {
    finished = record.status === "active" ? null : record.status;
  }

  const canReadIssue = record !== null && issueNumber !== null;
  const canOpenDossier = record !== null;
  const canOpenRun = record !== null;

  return {
    campaignId: input.campaignId,
    boxCode: input.boxCode,
    name: input.name,
    blurb: story?.blurb ?? "",
    tagline: story?.tagline ?? "A story in five issues",
    villainScenarioId: finalScenarioId,
    hasRun: record !== null,
    rosterNames,
    totalIssues: total,
    pips,
    issueNumber,
    nextIssueTitle,
    nextIssueVillain,
    finished,
    canReadIssue,
    canOpenDossier,
    canOpenRun,
    expertUnlocked: input.expertUnlocked,
  };
}

/** Re-exported so a scene can label a fallback issue titled purely from the story, with no definition needed. */
export type { CampaignStory };
