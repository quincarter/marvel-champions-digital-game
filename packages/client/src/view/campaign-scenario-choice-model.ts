/**
 * The scenario-choice board (docs/campaign-mode-design.md §10.2, `campaign-scenario-choice-model.ts`): `kind:
 * "choice"` graphs only (MC60 p. 8-9's "the order of these scenarios is not fixed") — which nodes are open to
 * choose, each one's progress marks, and which are already Completed or Failed.
 *
 * **No box with this graph shape has shipped yet.** `@mc/content`/`@mc/cards` have ingested only `trors` (MC10),
 * a `linear` graph; this module is therefore validated here against a synthetic `kind: "choice"` fixture only,
 * not against real box content, the same discipline `docs/campaign-mode-design.md` §11's own table flags for
 * every box beyond MC10 ("a `Campaign` record naming a scenario that does not exist would be exactly the kind of
 * fabricated reference this package's ingestion discipline exists to refuse"). Re-check this module's shape
 * against MC60's real definition once it lands (design §11 step 12's own acceptance gate).
 *
 * **"Available" is never evaluated here.** `CampaignGraph.available` is a between-games predicate the *engine*
 * evaluates (`resolveBetweenGames`'s own `chooseNode`); a client asking "which nodes are open?" independently
 * would be exactly the rules-duplication this project's client layer refuses to do (CLAUDE.md: "ask the engine,
 * don't reimplement the legality check"). The available set this module renders always comes from a real
 * `CampaignPendingChoice` the engine already produced — `availableNodeIdsOf` reads it out; nothing here computes
 * availability from `CampaignPosition` or the graph's own predicate.
 *
 * **The villain choice is not re-modeled.** MC60 p. 9 step 5's "which villain?" is an ordinary `CampaignPendingChoice`
 * from a node's own `composition` list, rendered exactly like any other pending choice
 * (`campaign-step-model.ts`'s `campaignChoicePrompt`) once a node has been picked — this board is only about
 * picking *which node*, the step before that.
 */
import type { CampaignDefinition, CampaignPendingChoice, CampaignPosition } from "@mc/engine";
import { CAMPAIGN_NEXT_NODE_INSTRUCTION } from "@mc/engine";

export interface CampaignChoiceNodeRow {
  readonly nodeId: string;
  readonly label: string;
  /** MC60 p. 9 step 3's progression marks on this node. */
  readonly progress: number;
  /** How many marks fail this node, or null when the box marks failure itself (`progressToFail` absent). */
  readonly progressToFail: number | null;
}

export interface CampaignChoiceBoard {
  readonly available: readonly CampaignChoiceNodeRow[];
  readonly completed: readonly CampaignChoiceNodeRow[];
  readonly failed: readonly CampaignChoiceNodeRow[];
}

/** The pending choice's `options`, when it's the runner's own "which scenario next?" prompt — `[]` otherwise. */
export function availableNodeIdsOf(choice: CampaignPendingChoice | null): readonly string[] {
  return choice && choice.instructionId === CAMPAIGN_NEXT_NODE_INSTRUCTION ? choice.options : [];
}

function nodeRowOf(definition: CampaignDefinition, position: CampaignPosition, nodeId: string): CampaignChoiceNodeRow {
  const node = definition.graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`campaign "${definition.campaignId}" has no node "${nodeId}"`);
  return {
    nodeId,
    label: node.label,
    progress: position.progress[nodeId] ?? 0,
    progressToFail: definition.graph.kind === "choice" ? (definition.graph.progressToFail ?? null) : null,
  };
}

/**
 * The board for a `choice` graph. `availableNodeIds` is the engine's own answer (`availableNodeIdsOf`, above) —
 * empty when nothing is pending, which reads correctly as "nothing open to choose right now" rather than as an
 * error.
 */
export function campaignChoiceBoard(
  definition: CampaignDefinition,
  position: CampaignPosition,
  availableNodeIds: readonly string[],
): CampaignChoiceBoard {
  if (definition.graph.kind !== "choice") {
    throw new Error(`campaign "${definition.campaignId}" is a "${definition.graph.kind}" graph, not "choice"`);
  }
  const completed: CampaignChoiceNodeRow[] = [];
  const failed: CampaignChoiceNodeRow[] = [];
  for (const [nodeId, mark] of Object.entries(position.resolved)) {
    (mark === "completed" ? completed : failed).push(nodeRowOf(definition, position, nodeId));
  }
  return {
    available: availableNodeIds.map((nodeId) => nodeRowOf(definition, position, nodeId)),
    completed,
    failed,
  };
}
