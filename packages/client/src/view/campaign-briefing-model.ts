/**
 * C08 Briefing (`scenes/campaign/briefing.ts`): the "HANDLED FOR YOU" list and the "DECKS" rows, built from a
 * composed attempt's real trace (`CampaignAttempt.steps`) and the log's own seats — never invented prose, per the
 * common brief ("prefer the printed instruction text + concrete values over invented prose, and omit no-op/skipped
 * steps"). Pure, over `CampaignRecord` plus a card-name lookup, so it is Vitest-tested against `seedDesignRun`
 * states without a scene.
 */
import type { CardId } from "@mc/content";
import type { CampaignAttempt, CampaignDefinition, CampaignStepTrace, LogValue } from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import { campaignBriefingPool, type BriefingPoolView, type CardMetaOf, type PoolCopy } from "./campaign-pool-model.js";
import { campaignStepRows, type CampaignStepRow } from "./campaign-step-model.js";

export type CardNameOf = (id: CardId) => string;

export interface HandledRow {
  readonly key: string;
  /** "done": happens this issue (green check). "later": held for a future issue (blue arrow). */
  readonly status: "done" | "later";
  readonly title: string;
  readonly detail: string;
}

export interface DeckRow {
  readonly seatNumber: number;
  readonly heroName: string;
  /** "LEADERSHIP" for one aspect, "AGG/JUS" for two or more (abbreviated, design's own shorthand). */
  readonly aspectLabel: string;
  /** The seat's own deck size — grants never count toward it (MC10 p. 3). */
  readonly deckSize: number;
  /** How many of the seat's current campaign grants are pinned into this deck. */
  readonly pinnedCount: number;
}

export interface BriefingView {
  readonly issueNumber: number;
  readonly handled: readonly HandledRow[];
  readonly decks: readonly DeckRow[];
  /** Null for a box with no campaign pool, or an issue whose own setup reads none of it back (issue #1). */
  readonly pool: BriefingPoolView | null;
}

const ASPECT_ABBREVIATION: Readonly<Record<string, string>> = {
  aggression: "AGG",
  justice: "JUS",
  leadership: "LEA",
  protection: "PRO",
  basic: "BAS",
  pool: "POOL",
};

function aspectLabelOf(aspects: readonly string[]): string {
  if (aspects.length <= 1) return (aspects[0] ?? "").toUpperCase();
  return aspects.map((aspect) => ASPECT_ABBREVIATION[aspect] ?? aspect.toUpperCase()).join("/");
}

/**
 * Whether a step's effects happen in *this* issue ("done") or are only being recorded for a later one ("later").
 * A step that grants, removes or picks something has visibly changed the game the player is about to sit down to;
 * a bare `record` (log-only) step is read as "held" — the shape a delay-counter or tally instruction takes (MC10's
 * own "held for issue #5" line). Approximate rather than a hard rule the engine states anywhere; a box whose
 * `record` steps *do* apply immediately would need a sharper signal than `kind` alone.
 */
function statusOf(step: CampaignStepTrace): "done" | "later" {
  if (step.grants.length > 0 || step.removedFromCampaign.length > 0 || step.choices.length > 0) return "done";
  if (step.kind === "inGame") return "done";
  return "later";
}

/**
 * Every campaign-log field id an effect tree reads (`kind: "campaignLog"`), walked structurally rather than by
 * shape — the same generic walk `@mc/engine`'s campaign runner uses internally (`campaign/runner.ts`'s
 * `fieldsReadBy`, not exported) to decide what a game's `CampaignLogView` needs to carry. No card or field name is
 * ever named here: an effect tree that happens not to read the log at all just returns an empty set.
 */
function fieldsReadBy(effects: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(effects)) {
    for (const item of effects) fieldsReadBy(item, found);
    return found;
  }
  if (effects !== null && typeof effects === "object") {
    const record = effects as Record<string, unknown>;
    if (record.kind === "campaignLog" && typeof record.field === "string") found.add(record.field);
    for (const value of Object.values(record)) fieldsReadBy(value, found);
  }
  return found;
}

/** Whether a log value is worth a row at all — an empty card list or a zero count says nothing happened. */
function isMeaningfulValue(value: LogValue | undefined): boolean {
  if (!value) return false;
  switch (value.kind) {
    case "number":
      return value.value !== 0;
    case "flag":
      return value.value === true;
    case "cardList":
      return value.cardIds.length > 0;
    case "strikeList":
      return value.struck.length > 0;
    case "cardState":
      return Object.keys(value.cards).length > 0;
    case "instructionList":
      return value.ids.length > 0;
    case "text":
      return value.value.length > 0;
    case "choice":
      return value.option.length > 0;
    case "cardRef":
      return true;
  }
}

/** A compact figure for a title ("2", not "Emergency Teleporter, Upgrade Attack") — the count for a list, the number for a number. */
function compactValueOf(value: LogValue): string {
  switch (value.kind) {
    case "number":
      return String(value.value);
    case "flag":
      return value.value ? "yes" : "no";
    case "cardList":
      return String(value.cardIds.length);
    case "strikeList":
      return String(value.struck.length);
    case "cardState":
      return String(Object.keys(value.cards).length);
    case "instructionList":
      return String(value.ids.length);
    case "choice":
      return value.option;
    case "text":
      return value.value;
    case "cardRef":
      return "1";
  }
}

/**
 * Rows built from campaign-log fields rather than from a `CampaignStepTrace` — generic over any box's log fields,
 * naming none of them:
 *  - one ✓ row per composed in-game instruction (`attempt.input.instructions`) that reads a field with a
 *    meaningful current value, titled from the field's own printed label and that value, detailed with the
 *    instruction's own printed sentence;
 *  - one → row per shared field with a meaningful value that *this* issue's instructions never read but a
 *    *later* node's own setup does — "held for issue #N", N being that node's 1-based position in the graph,
 *    detailed with that later instruction's own printed sentence.
 */
function fieldLogRowsOf(
  attempt: CampaignAttempt,
  record: CampaignRecord,
  definition: CampaignDefinition,
  nodeIds: readonly string[],
): readonly HandledRow[] {
  const fieldLabel = (id: string): string => definition.logFields.find((field) => field.id === id)?.label ?? id;

  const readThisIssue = new Set<string>();
  const nowRows: HandledRow[] = [];
  for (const instruction of attempt.input.instructions) {
    const fields = fieldsReadBy(instruction.effects);
    if (fields.size === 0) continue;
    const parts: string[] = [];
    for (const fieldId of fields) {
      readThisIssue.add(fieldId);
      const value = record.shared[fieldId];
      if (isMeaningfulValue(value)) parts.push(`${fieldLabel(fieldId)}: ${compactValueOf(value!)}`);
    }
    if (parts.length === 0) continue;
    nowRows.push({
      key: `field:${instruction.instructionId}`,
      status: "done",
      title: parts.join("; "),
      detail: instruction.text,
    });
  }

  const currentIndex = nodeIds.indexOf(attempt.nodeId);
  const laterRows: HandledRow[] = [];
  if (currentIndex >= 0) {
    for (const [fieldId, value] of Object.entries(record.shared)) {
      if (readThisIssue.has(fieldId) || !isMeaningfulValue(value)) continue;
      for (let index = currentIndex + 1; index < nodeIds.length; index++) {
        const node = definition.graph.nodes.find((candidate) => candidate.id === nodeIds[index]);
        if (!node) continue;
        const candidates = [...(definition.everyNodeSetup ?? []), ...(node.composition ?? []), ...node.setup];
        const found = candidates.find(
          (instruction) => instruction.step.kind === "inGame" && fieldsReadBy(instruction.step.effects).has(fieldId),
        );
        if (!found) continue;
        laterRows.push({
          key: `field-later:${fieldId}`,
          status: "later",
          title: `${fieldLabel(fieldId)}: ${compactValueOf(value!)} — held for issue #${index + 1}`,
          detail: found.text,
        });
        break;
      }
    }
  }
  return [...nowRows, ...laterRows];
}

/** One row for the seats' current campaign grants — MC10 p. 3's "start in play" TECH/Basic Condition upgrades. */
function grantsRowOf(record: CampaignRecord, cardName: CardNameOf): HandledRow | null {
  const withGrants = record.seats.filter((seat) => seat.grants.length > 0);
  if (withGrants.length === 0) return null;
  const detail = withGrants
    .map(
      (seat) => `${cardName(seat.identityCardId)}: ${seat.grants.map((grant) => cardName(grant.cardId)).join(", ")}.`,
    )
    .join(" ");
  return { key: "grants", status: "done", title: "Setup cards start in play", detail };
}

function stepRowOf(row: CampaignStepRow, statusById: ReadonlyMap<string, "done" | "later">): HandledRow | null {
  if (row.skipped || row.effects.length === 0) return null;
  return {
    key: row.instructionId,
    status: statusById.get(row.instructionId) ?? "done",
    title: row.text,
    detail: row.effects.join(" "),
  };
}

/**
 * Every step of a composed attempt, rendered as the Briefing's "HANDLED FOR YOU" rows. Grants get one combined row
 * up front; the attempt's own between-games steps follow; then the campaign-log-driven rows (`fieldLogRowsOf`) —
 * what this issue's in-game instructions read off the log, and what a later issue is still waiting to read. Steps
 * and fields with nothing to show (skipped, no writes/grants/choices/removals, or an empty/zero value) are dropped.
 *
 * `definition` and `nodeIds` (the graph's node ids, 1-based issue order) are only needed for the "held for issue
 * #N" rows — a caller that doesn't have them handy can omit `nodeIds` and simply won't get those rows.
 */
export function handledRowsOf(
  attempt: CampaignAttempt,
  record: CampaignRecord,
  cardName: CardNameOf,
  definition?: CampaignDefinition,
  nodeIds: readonly string[] = [],
): readonly HandledRow[] {
  const grants = grantsRowOf(record, cardName);
  const statusById = new Map(attempt.steps.map((step) => [step.instructionId, statusOf(step)] as const));
  const rows = campaignStepRows(attempt.steps, cardName);
  const stepRows = rows
    // The grants row above already covers every `grantCard`-only step; one that only granted would otherwise
    // repeat the same cards a second time.
    .filter((row) => {
      const step = attempt.steps.find((candidate) => candidate.instructionId === row.instructionId);
      return !(step && step.grants.length > 0 && step.writes.length === 0 && step.choices.length === 0);
    })
    .map((row) => stepRowOf(row, statusById))
    .filter((row): row is HandledRow => row !== null);
  const fieldRows = definition ? fieldLogRowsOf(attempt, record, definition, nodeIds) : [];
  return [...(grants ? [grants] : []), ...stepRows, ...fieldRows];
}

export function deckRowsOf(record: CampaignRecord, cardName: CardNameOf): readonly DeckRow[] {
  return record.seats.map((seat) => {
    const grantedIds = new Set(seat.grants.map((grant) => grant.cardId));
    let deckSize = 0;
    let pinnedCount = 0;
    for (const line of seat.deck.cards) {
      if (grantedIds.has(line.cardId)) pinnedCount += line.quantity;
      else deckSize += line.quantity;
    }
    return {
      seatNumber: seat.seatNumber,
      heroName: cardName(seat.identityCardId),
      aspectLabel: aspectLabelOf(seat.deck.aspects),
      deckSize,
      pinnedCount,
    };
  });
}

/**
 * Both halves of the Briefing's real data, from a record whose issue is already composed (`record.attempt` set).
 * `cardTypeOf` feeds the pool panel's helps/hurts classification (`campaign-pool-model.ts`); omit it on a box with
 * no pool, or where a card lookup isn't handy yet — a pool card just reads "helps" by default (its own doc comment).
 */
export function briefingViewOf(
  record: CampaignRecord,
  cardName: CardNameOf,
  issueNumber: number,
  definition?: CampaignDefinition,
  nodeIds: readonly string[] = [],
  cardTypeOf?: CardMetaOf,
  poolCopy?: PoolCopy,
  firstPlayerName?: string,
): BriefingView | null {
  if (!record.attempt) return null;
  const node = definition?.graph.nodes.find((candidate) => candidate.id === record.attempt!.nodeId);
  const isFinale = definition ? nodeIds[nodeIds.length - 1] === record.attempt.nodeId : false;
  return {
    issueNumber,
    handled: handledRowsOf(record.attempt, record, cardName, definition, nodeIds),
    pool:
      definition && node
        ? campaignBriefingPool(record, definition, node, cardTypeOf, isFinale, poolCopy, firstPlayerName)
        : null,
    decks: deckRowsOf(record, cardName),
  };
}
