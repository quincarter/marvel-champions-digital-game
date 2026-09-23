/**
 * C08 Briefing (`scenes/campaign/briefing.ts`): the "HANDLED FOR YOU" list and the "DECKS" rows, built from a
 * composed attempt's real trace (`CampaignAttempt.steps`) and the log's own seats — never invented prose, per the
 * common brief ("prefer the printed instruction text + concrete values over invented prose, and omit no-op/skipped
 * steps"). Pure, over `CampaignRecord` plus a card-name lookup, so it is Vitest-tested against `seedDesignRun`
 * states without a scene.
 */
import type { CardId } from "@mc/content";
import type { CampaignAttempt, CampaignStepTrace } from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";
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

/** Every step of a composed attempt, rendered as the Briefing's "HANDLED FOR YOU" rows. Grants get one combined row up front; everything else follows in the attempt's own order. Steps with nothing to show (skipped, or no writes/grants/choices/removals) are dropped. */
export function handledRowsOf(
  attempt: CampaignAttempt,
  record: CampaignRecord,
  cardName: CardNameOf,
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
  return grants ? [grants, ...stepRows] : stepRows;
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

/** Both halves of the Briefing's real data, from a record whose issue is already composed (`record.attempt` set). */
export function briefingViewOf(record: CampaignRecord, cardName: CardNameOf, issueNumber: number): BriefingView | null {
  if (!record.attempt) return null;
  return {
    issueNumber,
    handled: handledRowsOf(record.attempt, record, cardName),
    decks: deckRowsOf(record, cardName),
  };
}
