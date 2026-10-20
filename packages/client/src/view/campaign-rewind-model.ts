/**
 * C09 Rewind: what a lost issue actually cost, and what it didn't (docs/campaign-mode-design.md §6.2, §7).
 *
 * `applyCampaignResult`'s `LossPolicy.retryBaseline: "nodeStart"` restores the log to exactly how it stood before
 * the lost attempt's instructions ran (`RewindKept`) — that's "no penalty" (MC10 p. 3) — *except* for RRG 1.8
 * p. 29's removal, which survives a retry on purpose ("even if players retry the scenario wherein that card was
 * removed"). This module never re-derives either rule: it only reads what the fold already did, by diffing the
 * finished attempt's `logBefore.removedFromCampaign` (what had been removed *before* this attempt) against the
 * record's current `removedFromCampaign` (what's removed *now*, after the fold) — the difference is exactly what
 * this lost attempt struck, and nothing else.
 */
import type { AnyCard, CardId } from "@mc/content";
import { matchesModes } from "@mc/content";
import type { CampaignCardFace, CampaignDefinition } from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";

/**
 * Short, on-brand names for a log field worth calling out by name in the KEPT line ("Units, Market cards, bounty
 * marks from #1–2.") — read off whichever fields a box's own `CampaignDefinition.logFields` actually declares, so
 * this is never hard-coded to one issue or one box (`docs/campaign-client-per-box.md` §2). A box with none of
 * these ids (MC10's per-hero TECH/Condition picks, tracked as unique choices rather than a shared pool) keeps the
 * plain "Everything from issues #1-N." line — that's not a worse answer for a box whose kept things don't reduce
 * to a short shared-currency phrase, just a different one.
 */
const KEPT_FIELD_PHRASE: Readonly<Record<string, string>> = {
  units: "Units",
  marketCards: "Market cards",
  headhunterDefeated: "bounty marks",
};

/** The `KEPT_FIELD_PHRASE` names this definition's own `logFields` actually carry, in the fields' declared order,
 * skipping any field this run's modes don't track (`whenModes`, e.g. an expert-only field in a standard run). */
function keptFieldNames(definition: CampaignDefinition, record: CampaignRecord): readonly string[] {
  const names: string[] = [];
  for (const field of definition.logFields) {
    const phrase = KEPT_FIELD_PHRASE[field.id];
    if (phrase && matchesModes(record.modes, field.whenModes)) names.push(phrase);
  }
  return names;
}

export interface RewindGoneLine {
  readonly cardId: CardId;
  readonly name: string;
  readonly face: string | null;
}

export interface RewindView {
  /** The whole campaign is lost (MC10 p. 15's expert-only Red Skull defeat) — no rewind, only the way back to the saga. */
  readonly campaignLost: boolean;
  readonly issueNumber: number;
  /** "Everything from issues #1–2." or, for issue #1, that there's nothing to keep yet. */
  readonly keptSummary: string;
  /** What this lost attempt struck from the campaign for good (RRG 1.8 p. 29) — empty when it struck nothing. */
  readonly gone: readonly RewindGoneLine[];
  /**
   * The lost attempt's own seed, for "Same hands" — the campaign counterpart of a one-shot's "Same seed, same
   * hands". A plain rewind deals a fresh shuffle (`resolveBetweenGames`' per-attempt seed); null when the entry
   * predates seeds being recorded, so the option is simply not offered.
   */
  readonly replaySeed: number | null;
  /**
   * The loss changed the campaign log itself (a defeat instruction ran: MC50 p. 19's new envelope and new evidence),
   * so the log is not the one the attempt opened with. Read by comparing the log before the attempt with the log now,
   * never by naming a box. False for every box whose retry restores the log exactly.
   */
  readonly logChanged: boolean;
  /**
   * The box's loss policy is `retryBaseline: "keepLog"` (MC60 p. 8; E30): nothing is restored, the log keeps what the
   * lost attempt left, and the players return to Campaign Setup to choose a scenario again.
   */
  readonly keepLog: boolean;
  /** Under `keepLog`: the shared log marks already drawn (as the sheet labels them), which the loss keeps. */
  readonly keptMarks: readonly string[];
}

/** The shared, player-visible log marks that hold something (a set flag, a chosen option, a non-empty list, a count). */
function drawnMarksOf(definition: CampaignDefinition, record: CampaignRecord): readonly string[] {
  const marks: string[] = [];
  for (const field of definition.logFields) {
    if (field.scope !== "shared" || field.hidden || field.working || !matchesModes(record.modes, field.whenModes)) {
      continue;
    }
    const value = record.shared[field.id];
    if (!value) continue;
    const set =
      value.kind === "flag"
        ? value.value
        : value.kind === "number"
          ? value.value > 0
          : value.kind === "cardList"
            ? value.cardIds.length > 0
            : value.kind === "strikeList"
              ? value.struck.length > 0
              : value.kind === "choice" || value.kind === "cardRef";
    if (set) marks.push(field.label);
  }
  return marks;
}

/** The action button's label: a `keepLog` loss goes back to Campaign Setup rather than rewinding. */
export function rewindActionLabelOf(view: Pick<RewindView, "keepLog">): string {
  return view.keepLog ? "Back to Campaign Setup ▸" : "Rewind, new shuffle ▸";
}

/** The sheet's headline (two lines). */
export function rewindHeadlineOf(view: Pick<RewindView, "keepLog" | "issueNumber">): string {
  return view.keepLog ? "Campaign\nSetup" : `Rewind\nIssue #${view.issueNumber}`;
}

/** The Rewind screen's intro line. A box told as comic pages reads "the page flips back"; a changed log says so in either. */
export function rewindIntroOf(
  view: Pick<RewindView, "logChanged"> & { readonly keepLog?: boolean },
  pageBased: boolean,
): string {
  if (view.keepLog) {
    return "This defeat has run, and the log is not rewound: it keeps every mark already drawn. You return to Campaign Setup and choose a scenario again. Change decks or aspects first if you want.";
  }
  if (view.logChanged) {
    return "This defeat changes the log, so it is not exactly as it was when you opened the issue. Change decks or aspects first if you want.";
  }
  return pageBased
    ? "The page flips back to the last panel you read. The log picks up exactly where it left off. Change decks or aspects first if you want."
    : "Same villain, same log as when you opened it. Change decks or aspects first if you want.";
}

const faceKey = (face: CampaignCardFace): string => `${face.cardId as string}\u0000${face.face ?? ""}`;

function cardNameOf(cardsById: ReadonlyMap<string, AnyCard>, face: CampaignCardFace): RewindGoneLine {
  const card = cardsById.get(face.cardId as string);
  const flipName = face.face && card && "flipSide" in card ? card.flipSide?.name : undefined;
  const name = flipName ?? card?.name ?? (face.cardId as string);
  return { cardId: face.cardId, name, face: face.face ?? null };
}

/**
 * `record` is the campaign *after* the loss has been folded (`campaignService().fold`'s `"done"` result) — the log
 * is already back at the node's start, which is exactly the state a rewind resumes from.
 */
export function rewindViewOf(
  record: CampaignRecord,
  nodeId: string,
  issueNumberOf: (nodeId: string) => number,
  cardsById: ReadonlyMap<string, AnyCard>,
  definition: CampaignDefinition,
): RewindView {
  const entry = record.history.filter((candidate) => candidate.nodeId === nodeId).at(-1);
  const before = new Set((entry?.logBefore.removedFromCampaign ?? []).map(faceKey));
  const gone = record.removedFromCampaign
    .filter((face) => !before.has(faceKey(face)))
    .map((face) => cardNameOf(cardsById, face));
  const issueNumber = issueNumberOf(nodeId);
  const names = keptFieldNames(definition, record);
  // "#1" for a single issue before this one, "#1–2" for several.
  const keptRange = issueNumber === 2 ? "#1" : `#1–${issueNumber - 1}`;
  const keptSummary =
    issueNumber <= 1
      ? "Nothing kept yet — this is issue #1."
      : names.length > 0
        ? `${names.join(", ")} from ${keptRange}.`
        : issueNumber === 2
          ? "Everything from issue #1."
          : `Everything from issues ${keptRange}.`;
  // The retry restores the shared and hidden records and each seat's fields exactly, unless a defeat instruction wrote.
  const logChanged =
    entry?.logBefore.shared !== undefined &&
    JSON.stringify([record.shared, record.hidden, (record.seats ?? []).map((seat) => seat.fields)]) !==
      JSON.stringify([
        entry.logBefore.shared,
        entry.logBefore.hidden,
        (entry.logBefore.seats ?? []).map((seat) => seat.fields),
      ]);
  const keepLog = definition.loss.retryBaseline === "keepLog";
  if (keepLog) {
    const keptMarks = drawnMarksOf(definition, record);
    return {
      campaignLost: record.status === "lost",
      issueNumber,
      keptSummary: keptMarks.length > 0 ? `${keptMarks.join(", ")}.` : "No marks drawn yet.",
      gone,
      // Setup draws anew, so a lost attempt's exact deal is not a thing to replay.
      replaySeed: null,
      logChanged: false,
      keepLog,
      keptMarks,
    };
  }
  return {
    campaignLost: record.status === "lost",
    issueNumber,
    keptSummary: logChanged && issueNumber > 1 ? `${keptSummary} Except what this defeat changed.` : keptSummary,
    gone,
    replaySeed: entry?.seed ?? null,
    logChanged,
    keepLog: false,
    keptMarks: [],
  };
}
