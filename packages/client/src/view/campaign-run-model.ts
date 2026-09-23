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
import { issueNumberOf, issueStoryFor, type CampaignStory } from "../campaign/story.js";
import type { CardNameOf } from "./campaign-log-model.js";

/** Short, on-brand words for a log field, matching the design's own examples ("2 prototypes", "3 delay"). */
const FIELD_SHORT_LABEL: Readonly<Record<string, string>> = {
  delayCounters: "delay",
  experimental: "prototypes",
  rescuedAllies: "rescued",
  techUpgrade: "tech",
  basicUpgrade: "condition",
  remainingHp: "HP",
};

export type RunIssueStatus = "finished" | "current" | "sealed";

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
  /** Current only: the Run card's speech-bubble line. Null otherwise. */
  readonly teaser: string | null;
  /** Current only: the one-sentence pitch. Null otherwise. */
  readonly blurb: string | null;
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
        const label = FIELD_SHORT_LABEL[write.field] ?? write.field;
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
        teaser: issueStory?.teaser ?? null,
        blurb: issueStory?.blurb ?? null,
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
