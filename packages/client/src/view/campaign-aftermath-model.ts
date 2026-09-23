/**
 * C05/C06 Aftermath's victory-choice groups (docs/campaign-mode-design.md §7, §10.2).
 *
 * `resolveBetweenGames`/`applyCampaignResult` ask one seat at a time — a later seat's options depend on an earlier
 * seat's pick (`excludeGranted`), so the runner can never offer every seat's choice in one call. The design shows
 * every seat's column at once (`Campaign - Desktop.dc.html`'s "EACH HERO TAKES ONE"), so this module is the pure
 * state that reconciles the two: an `AftermathChoiceGroup` remembers the printed choice's full option catalog (the
 * very first real prompt the engine returned, before anyone had picked anything) and every seat's own decision —
 * confirmed once the engine has actually accepted it, local until then. A seat the engine hasn't reached yet is
 * shown the catalog minus whatever any other seat has already decided, its options marked "taken" rather than
 * removed, exactly as the common brief asks.
 *
 * **Nothing here invents an answer.** `offersAnswer` is the guard a caller runs before sending a locally-decided
 * pick to a real `fold`/`compose` call: if the engine's real prompt doesn't actually offer what the UI guessed, the
 * caller surfaces the mismatch instead of sending it — this module only ever proposes what `answerFor` derives
 * from a seat's own recorded decision, never a synthesized one.
 */
import type { AnyCard, CardId } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignHistoryEntry, CampaignLog, CampaignPendingChoice } from "@mc/engine";

export interface AftermathOption {
  readonly cardId: CardId;
  readonly name: string;
  readonly effect: string;
}

export type AftermathSeatDecision =
  | { readonly kind: "undecided" }
  | { readonly kind: "picked"; readonly cardId: CardId }
  | { readonly kind: "declined" };

export type AftermathColumnStatus =
  /** The seat the engine is actually blocked on right now — its options are the real, engine-computed list. */
  | "current"
  /** A seat the engine has not been asked about yet — its options are guessed from the catalog. */
  | "pending"
  /** The engine has already accepted this seat's answer. */
  | "confirmed";

export interface AftermathOptionRow {
  readonly option: AftermathOption;
  /** The hero name of the seat that already holds this card, or null if it's still up for grabs. */
  readonly takenByHeroName: string | null;
  readonly selected: boolean;
}

export interface AftermathColumn {
  readonly seatNumber: number;
  readonly heroName: string;
  readonly status: AftermathColumnStatus;
  readonly rows: readonly AftermathOptionRow[];
  readonly decision: AftermathSeatDecision;
  readonly optional: boolean;
}

export interface AftermathSeat {
  readonly seatNumber: number;
  readonly heroName: string;
}

export interface AftermathChoiceGroup {
  readonly instructionId: string;
  readonly slot: string;
  readonly text: string;
  readonly citation: string;
  readonly optional: boolean;
  /** The full option list, captured once from the first real prompt this group ever saw. */
  readonly catalog: readonly AftermathOption[];
  readonly seatOrder: readonly number[];
  /** The seat the engine is actually blocked on right now. */
  readonly currentSeatNumber: number;
  readonly confirmedSeatNumbers: readonly number[];
  readonly decisions: Readonly<Record<number, AftermathSeatDecision>>;
}

/** True when `pending` is still asking about the printed choice `group` is already showing. */
export function continuesGroup(
  group: Pick<AftermathChoiceGroup, "instructionId" | "slot">,
  pending: Pick<CampaignPendingChoice, "instructionId" | "slot">,
): boolean {
  return pending.instructionId === group.instructionId && pending.slot === group.slot;
}

/** A fresh group from the first real pending choice seen for a printed victory choice. */
export function startAftermathGroup(
  pending: CampaignPendingChoice,
  seats: readonly AftermathSeat[],
  optionOf: (cardId: CardId) => AftermathOption,
): AftermathChoiceGroup {
  const catalog = pending.options.map((id) => optionOf(id as CardId));
  const decisions: Record<number, AftermathSeatDecision> = {};
  for (const seat of seats) decisions[seat.seatNumber] = { kind: "undecided" };
  return {
    instructionId: pending.instructionId,
    slot: pending.slot,
    text: pending.text,
    citation: pending.citation,
    optional: pending.optional,
    catalog,
    seatOrder: seats.map((seat) => seat.seatNumber),
    currentSeatNumber: pending.seatNumber ?? seats[0]?.seatNumber ?? 0,
    confirmedSeatNumbers: [],
    decisions,
  };
}

/**
 * A seat's own local decision — a no-op (returns `group` unchanged) for a seat already confirmed, for a card
 * another seat already holds, or for declining a choice that isn't optional: exactly the guard a click handler
 * needs before calling this, expressed once here instead of in every scene.
 */
export function decideForSeat(
  group: AftermathChoiceGroup,
  seatNumber: number,
  decision: AftermathSeatDecision,
): AftermathChoiceGroup {
  if (group.confirmedSeatNumbers.includes(seatNumber)) return group;
  if (decision.kind === "picked") {
    const takenByAnother = group.seatOrder.some((other) => {
      if (other === seatNumber) return false;
      const otherDecision = group.decisions[other];
      return otherDecision?.kind === "picked" && otherDecision.cardId === decision.cardId;
    });
    if (takenByAnother || !group.catalog.some((option) => option.cardId === decision.cardId)) return group;
  }
  if (decision.kind === "declined" && !group.optional) return group;
  return { ...group, decisions: { ...group.decisions, [seatNumber]: decision } };
}

/**
 * After the real `fold`/`compose` call for `confirmedSeatNumber` returns: either the next real prompt for this
 * same group (the group carries on, its `currentSeatNumber` advanced), or null — the group is finished, whether
 * because the engine moved on to a different instruction or because it has nothing left to ask at all.
 */
export function advanceAftermathGroup(
  group: AftermathChoiceGroup,
  confirmedSeatNumber: number,
  nextPending: CampaignPendingChoice | null,
): AftermathChoiceGroup | null {
  const confirmedSeatNumbers = group.confirmedSeatNumbers.includes(confirmedSeatNumber)
    ? group.confirmedSeatNumbers
    : [...group.confirmedSeatNumbers, confirmedSeatNumber];
  if (nextPending && continuesGroup(group, nextPending)) {
    return { ...group, confirmedSeatNumbers, currentSeatNumber: nextPending.seatNumber ?? group.currentSeatNumber };
  }
  return null;
}

/** Every seat has decided (picked or, for an optional choice, declined). */
export function readyToCommit(group: AftermathChoiceGroup): boolean {
  return group.seatOrder.every((seat) => group.decisions[seat]?.kind !== "undecided");
}

/** The columns the scene draws, one per seat, in seat order. */
export function aftermathColumns(
  group: AftermathChoiceGroup,
  heroNameOf: (seatNumber: number) => string,
): readonly AftermathColumn[] {
  return group.seatOrder.map((seatNumber) => {
    const decision = group.decisions[seatNumber] ?? { kind: "undecided" };
    const status: AftermathColumnStatus = group.confirmedSeatNumbers.includes(seatNumber)
      ? "confirmed"
      : seatNumber === group.currentSeatNumber
        ? "current"
        : "pending";
    const rows = group.catalog.map((option) => {
      const takenBy = group.seatOrder.find((other) => {
        if (other === seatNumber) return false;
        const otherDecision = group.decisions[other];
        return otherDecision?.kind === "picked" && otherDecision.cardId === option.cardId;
      });
      return {
        option,
        takenByHeroName: takenBy === undefined ? null : heroNameOf(takenBy),
        selected: decision.kind === "picked" && decision.cardId === option.cardId,
      };
    });
    return { seatNumber, heroName: heroNameOf(seatNumber), status, rows, decision, optional: group.optional };
  });
}

/** The answer to send for `seatNumber`, built from its own recorded decision — never from another seat's. */
export function answerFor(group: AftermathChoiceGroup, seatNumber: number): CampaignChoiceAnswer {
  const decision = group.decisions[seatNumber] ?? { kind: "undecided" };
  return {
    instructionId: group.instructionId,
    slot: group.slot,
    seatNumber,
    picked: decision.kind === "picked" ? [decision.cardId] : [],
  };
}

/**
 * The answer to send for the prompt the engine is showing *now*: the local decision of the seat `pending` names.
 * Never the group's remembered `currentSeatNumber` — the runner asks one seat at a time, so after seat 1 is sent the
 * next prompt is seat 2's, and re-sending seat 1's card as seat 2's answer is refused (it is no longer offered).
 */
export function answerForPending(group: AftermathChoiceGroup, pending: CampaignPendingChoice): CampaignChoiceAnswer {
  return answerFor(group, pending.seatNumber ?? group.currentSeatNumber);
}

/**
 * Whether `answer` is something the real `pending` choice actually offers — the guard against sending a guessed
 * pick the runner never presented. A caller that finds this false has a stale guess (another seat's real answer
 * changed what's on offer) and must re-derive the decision from `pending.options`, never send `answer` as-is.
 */
export function offersAnswer(pending: CampaignPendingChoice, answer: CampaignChoiceAnswer): boolean {
  if (answer.picked.length === 0) return pending.optional;
  return answer.picked.length <= pending.count && answer.picked.every((id) => pending.options.includes(id));
}

// ---------------------------------------------------------------------------------------------------------------
// Option catalog: card name + a short, honest effect line
// ---------------------------------------------------------------------------------------------------------------

/**
 * MC10's eight campaign upgrades (`trors.ts`'s TECH and "Basic" Condition choices) print their mechanics as a
 * "Setup." keyword line, then the effect — deriving "the first sentence" from that would read "Setup.", which
 * tells a player nothing. These eight are hand-written from the printed card text (never invented) so the option
 * rows are legible; every other card falls back to the generic derivation.
 */
const AFTERMATH_EFFECT_OVERRIDES: Readonly<Record<string, string>> = {
  "04155": "Ready and heal 5.",
  "04156": "Draw 5 cards.",
  "04157": "Fetch an ally, make it tough.",
  "04158": "5 damage to villain + your enemies.",
  "04159a": "+2 HP · hero +1 THW",
  "04160a": "+1 HP · hero +1 ATK",
  "04161a": "+3 HP · hero +1 DEF",
  "04162a": "+4 HP · alter-ego +1 REC",
};

/** The card's own first sentence, boilerplate keywords stripped, for a card with no hand-written override. */
function derivedEffectLine(text: string | undefined): string {
  if (!text) return "";
  const withoutBoilerplate = text.replace(/^(permanent\.\s*)?setup\.\s*/i, "");
  const [firstSentence] = withoutBoilerplate.split(/(?<=[.!?])\s+/);
  return (firstSentence ?? withoutBoilerplate).trim();
}

function cardText(card: AnyCard | undefined): string | undefined {
  return card && "text" in card ? card.text.current : undefined;
}

/** Builds an `AftermathOption` for `cardId` from the real card pool — name and effect line, never invented. */
export function aftermathOptionOf(cardId: CardId, cardsById: ReadonlyMap<string, AnyCard>): AftermathOption {
  const card = cardsById.get(cardId as string);
  return {
    cardId,
    name: card?.name ?? (cardId as string),
    effect: AFTERMATH_EFFECT_OVERRIDES[cardId as string] ?? derivedEffectLine(cardText(card)),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The win stamp: "ISSUE #N · WON" plus an optional "LOGGED · …" tag
// ---------------------------------------------------------------------------------------------------------------

export interface AftermathStamp {
  readonly issueNumber: number;
  /** "LOGGED · 3 DELAY COUNTERS" — the first non-zero shared numeric field this issue's victory wrote, or null. */
  readonly loggedTag: string | null;
}

/** "delayCounters" -> "DELAY COUNTERS": a field id read back as the short tag label the design's ink stamp wants. */
function shoutLabel(fieldId: string): string {
  return fieldId
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toUpperCase();
}

/**
 * The stamp for the issue just folded. `nodeId` selects the *last* history entry for that node — the one this
 * fold just appended, even for a node that was rewound and replayed. `loggedTag` is derived from the entry's own
 * `record`-kind writes, never invented: the first shared, non-hidden number a victory instruction wrote (MC10 p. 7's
 * delay-counter count is the design's own example — zero is still a logged value, so it still tags).
 */
export function aftermathStamp(
  log: CampaignLog,
  nodeId: string,
  issueNumberOf: (nodeId: string) => number,
): AftermathStamp {
  const entries = log.history.filter((entry) => entry.nodeId === nodeId);
  const entry: CampaignHistoryEntry | undefined = entries.at(-1);
  let loggedTag: string | null = null;
  if (entry) {
    for (const step of entry.steps) {
      if (step.skipped) continue;
      const write = step.writes.find((candidate) => candidate.seatNumber === null && candidate.value.kind === "number");
      if (write && write.value.kind === "number") {
        loggedTag = `LOGGED · ${write.value.value} ${shoutLabel(write.field)}`;
        break;
      }
    }
  }
  return { issueNumber: issueNumberOf(nodeId), loggedTag };
}
