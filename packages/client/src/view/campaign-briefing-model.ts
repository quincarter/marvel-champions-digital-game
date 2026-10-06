/**
 * C08 Briefing (`scenes/campaign/briefing.ts`): the "HANDLED FOR YOU" list and the "DECKS" rows, built from a
 * composed attempt's real trace (`CampaignAttempt.steps`) and the log's own seats — never invented prose, per the
 * common brief ("prefer the printed instruction text + concrete values over invented prose, and omit no-op/skipped
 * steps"). Pure, over `CampaignRecord` plus a card-name lookup, so it is Vitest-tested against `seedDesignRun`
 * states without a scene.
 */
import type { CardId } from "@mc/content";
import {
  CAMPAIGN_ACCEPT,
  illegalDecksOf,
  type CampaignAttempt,
  type CampaignChoiceAnswer,
  type CampaignDefinition,
  type CampaignStepTrace,
  type DeckProblem,
  type GameSetupConfig,
  type LogValue,
} from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import {
  campaignBriefingPool,
  isPoolDestinationText,
  poolFieldsOf,
  type BriefingPoolView,
  type CardMetaOf,
  type PoolCopy,
} from "./campaign-pool-model.js";
import { campaignStepRows, type CampaignStepRow } from "./campaign-step-model.js";
import { idWords } from "./campaign-option-labels.js";
import { hiddenEvidenceEnvelope, type HiddenEvidenceEnvelope } from "./campaign-hidden-evidence-model.js";
import { sideSchemeBriefingOf, type SideSchemeBriefing } from "./campaign-side-scheme-model.js";

export type CardNameOf = (id: CardId) => string;

export interface HandledRow {
  readonly key: string;
  /** "done": happens this issue (green check). "later": held for a future issue (blue arrow). */
  readonly status: "done" | "later";
  readonly title: string;
  readonly detail: string;
  /** The printed page this row's own fact comes from, shown at the row's right edge. Omitted for a row with none
   * (a generic step/field row already names its citation in `detail`, the way the printed instruction text does). */
  readonly citation?: string;
}

/** A box's own authored "Handled for you" row (`stories/mts.ts`'s own doc comment on `IssueStory.briefingNotes`). */
export interface BriefingNoteCopy {
  readonly status: "done" | "later";
  readonly title: string;
  readonly detail: string;
  /** Read instead of `detail` on a retry, when the attempt repeated an earlier pick without asking (a `choose` with
   * `repeatOnRetry`, MC40 p. 7), so a row never says "the group picks" for a pick nobody is asked to make. */
  readonly repeatDetail?: string;
  readonly citation?: string;
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
  /**
   * A few words naming why the engine would refuse this seat's deck at setup (`deckProblemLabel`); absent for a legal
   * deck. Shown on the row before the player presses Open issue.
   */
  readonly problem?: string;
}

export interface BriefingView {
  readonly issueNumber: number;
  readonly handled: readonly HandledRow[];
  readonly decks: readonly DeckRow[];
  /** Null for a box with no campaign pool, or an issue whose own setup reads none of it back (issue #1). */
  readonly pool: BriefingPoolView | null;
  /** The hidden-evidence envelope (docs/campaign-mode-design.md §Q4; MC50 p. 5). Null for a box with no hidden field. */
  readonly hiddenEvidence: HiddenEvidenceEnvelope | null;
  /** The per-scenario player-side-scheme choice and what carries in (`campaign-side-scheme-model.ts`). Null for a box without one. */
  readonly sideScheme: SideSchemeBriefing | null;
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
/**
 * A field the briefing names by what the player does with it, not by the sheet's own label: MC32's `captives` (the
 * CAPTIVE allies recorded in #2, which pp. 12/16/19 let a player shuffle into a deck) and `heldAllies` (the allies that
 * ended under Find the Prisoners or Rescue Captives, struck from the campaign at #3). A row with this wording is its
 * own row (never folded into one "A: n; B: m" title), with its own one-line meaning.
 */
const BRIEFING_FIELD_WORDS: Readonly<Record<string, { readonly label: string; readonly detail: string }>> = {
  captives: { label: "Captives recorded", detail: "Each may be shuffled into any player's deck." },
  heldAllies: { label: "Allies struck", detail: "Out of the campaign for good." },
};

function fieldLogRowsOf(
  attempt: CampaignAttempt,
  record: CampaignRecord,
  definition: CampaignDefinition,
  nodeIds: readonly string[],
): readonly HandledRow[] {
  const fieldLabel = (id: string): string =>
    BRIEFING_FIELD_WORDS[id]?.label ?? definition.logFields.find((field) => field.id === id)?.label ?? id;
  // A campaign-pool field (`campaign-pool-model.ts`'s own detection) is never shown here: its own field label is
  // the *add-to-pool* sentence ("Cosmo added to campaign pool"), which reads as if this row were adding the card
  // when the instruction it's citing is actually the pool's *read-back* ("If Cosmo is in the campaign pool, put
  // him into play…") — "From the pool" already shows that, in its own, correct words.
  const poolFieldIds = new Set(poolFieldsOf(definition).map((field) => field.fieldId));

  const readThisIssue = new Set<string>();
  const nowRows: HandledRow[] = [];
  for (const instruction of attempt.input.instructions) {
    const fields = [...fieldsReadBy(instruction.effects)].filter((fieldId) => !poolFieldIds.has(fieldId));
    if (fields.length === 0) continue;
    const parts: string[] = [];
    for (const fieldId of fields) {
      readThisIssue.add(fieldId);
      const value = record.shared[fieldId];
      if (!isMeaningfulValue(value)) continue;
      const words = BRIEFING_FIELD_WORDS[fieldId];
      if (words) {
        nowRows.push({
          key: `field:${instruction.instructionId}:${fieldId}`,
          status: "done",
          title: `${words.label}: ${compactValueOf(value!)}`,
          detail: words.detail,
        });
      } else {
        parts.push(`${fieldLabel(fieldId)}: ${compactValueOf(value!)}`);
      }
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
      if (readThisIssue.has(fieldId) || !isMeaningfulValue(value) || poolFieldIds.has(fieldId)) continue;
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
/**
 * A pooled card's own grant (Shawarma's `poolDeckGrant`, MC21 p. 17/21/25) is never named here: "From the pool"
 * already shows it, correctly, as "shuffled into their deck" rather than the MC10-only "start in play" wording this
 * row prints — listing it here too would say the same card lands in two different places.
 */
function grantsRowOf(record: CampaignRecord, cardName: CardNameOf, definition?: CampaignDefinition): HandledRow | null {
  const poolNames = definition ? new Set(poolFieldsOf(definition).map((field) => field.name)) : new Set<string>();
  // Only a grant the campaign keeps (MC10 p. 3's TECH/Basic Condition upgrades) starts in play. A "this game" grant is
  // a card added to the deck for that game (MC32 p. 5's role-building): its own per-seat row says so, and listing it
  // here too said it started in play.
  const lines = record.seats
    .map((seat) => {
      const names = seat.grants
        .filter((grant) => grant.permanence !== "thisGame")
        .map((grant) => cardName(grant.cardId))
        .filter((name) => !poolNames.has(name));
      return names.length > 0 ? `${cardName(seat.identityCardId)}: ${names.join(", ")}.` : null;
    })
    .filter((line): line is string => line !== null);
  if (lines.length === 0) return null;
  return { key: "grants", status: "done", title: "Setup cards start in play", detail: lines.join(" ") };
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * A step in which seats picked cards that were then granted "for this game" (Mutant Genesis's role-building, MC32
 * p. 5) as one row per seat, in a sentence a player would write: "Colossus (Brawler) added Get Over Here! and Marked
 * to the deck for this game." Null for any other step, which keeps the generic trace rows. The role is the one the
 * seat took in this attempt's own steps, else its `role` log field.
 */
function grantedPickRowsOf(
  attempt: CampaignAttempt,
  record: CampaignRecord,
  step: CampaignStepTrace,
  cardName: CardNameOf,
  status: "done" | "later",
): readonly HandledRow[] | null {
  if (step.skipped || step.choices.length === 0) return null;
  const grantedThisGame = new Set(
    step.grants.filter((grant) => grant.permanence === "thisGame").map((grant) => grant.cardId as string),
  );
  const picksCard = step.choices.some((choice) => choice.picked.some((id) => grantedThisGame.has(id)));
  // A role-building pick every seat declined has no granted card to find, and reads the same way as one that did: nothing
  // added. (Otherwise it fell through to the generic log line "Seat 1 declined for Role Event.")
  const allDeclined = step.choices.every((choice) => choice.picked.length === 0 && /^role/i.test(choice.slot));
  if ((!picksCard && !allDeclined) || step.choices.some((choice) => choice.seatNumber === null)) return null;
  const seatNumbers = [...new Set(step.choices.map((choice) => choice.seatNumber as number))];
  return seatNumbers.map((seatNumber) => {
    const seat = record.seats.find((candidate) => candidate.seatNumber === seatNumber);
    const hero = seat ? cardName(seat.identityCardId) : `Seat ${seatNumber}`;
    const roleChoice = attempt.steps
      .flatMap((other) => other.choices)
      .reverse()
      .find((choice) => choice.seatNumber === seatNumber && choice.slot === "role");
    const field = seat?.fields["role"];
    const roleId = roleChoice?.picked[0] ?? (field?.kind === "choice" ? field.option : undefined);
    const who = roleId ? `${hero} (${roleWords(roleId)})` : hero;
    const names = step.choices
      .filter((choice) => choice.seatNumber === seatNumber)
      .flatMap((choice) => choice.picked)
      .filter((id) => grantedThisGame.has(id))
      .map((id) => cardName(id as CardId));
    return {
      key: `${step.instructionId}:seat${seatNumber}`,
      status,
      title:
        names.length > 0
          ? `${who} added ${joinNames(names)} to the deck for this game.`
          : `${who} added nothing to the deck this game.`,
      detail: "Role-building cards don't count toward deck size.",
      citation: step.citation,
    };
  });
}

const roleWords = idWords;

/**
 * A step in which seats chose a campaign role, or drew a random role upgrade, as one sentence per seat in the same
 * voice as `grantedPickRowsOf`: "Colossus took the Brawler role." and "Colossus (Brawler) drew Brazen Defense as a
 * role upgrade." (not "Seat 1 chose brawler for Role"). Null for any other step, which keeps the generic rows.
 */
function rolePickRowsOf(
  attempt: CampaignAttempt,
  record: CampaignRecord,
  step: CampaignStepTrace,
  cardName: CardNameOf,
  status: "done" | "later",
): readonly HandledRow[] | null {
  if (step.skipped || step.choices.length === 0) return null;
  const roleSlots = new Set(["role", "roleUpgrade"]);
  if (!step.choices.every((choice) => roleSlots.has(choice.slot) && choice.seatNumber !== null)) return null;
  const roleOf = (seatNumber: number): string | null => {
    const taken = attempt.steps
      .flatMap((other) => other.choices)
      .reverse()
      .find((choice) => choice.seatNumber === seatNumber && choice.slot === "role");
    const field = record.seats.find((seat) => seat.seatNumber === seatNumber)?.fields["role"];
    const id = taken?.picked[0] ?? (field?.kind === "choice" ? field.option : undefined);
    return id ? roleWords(id) : null;
  };
  return step.choices.map((choice) => {
    const seatNumber = choice.seatNumber as number;
    const seat = record.seats.find((candidate) => candidate.seatNumber === seatNumber);
    const hero = seat ? cardName(seat.identityCardId) : `Seat ${seatNumber}`;
    const picked = choice.picked[0];
    let title: string;
    if (choice.slot === "role") {
      title = picked ? `${hero} took the ${roleWords(picked)} role.` : `${hero} took no role.`;
    } else {
      const role = roleOf(seatNumber);
      const who = role ? `${hero} (${role})` : hero;
      title = picked
        ? `${who} ${choice.random ? "drew" : "took"} ${cardName(picked as CardId)} as a role upgrade.`
        : `${who} had no role upgrade to draw.`;
    }
    return {
      key: `${step.instructionId}:seat${seatNumber}:${choice.slot}`,
      status,
      title,
      detail: "",
      citation: step.citation,
    };
  });
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
/**
 * `handledRowsOf`'s own generic assembly, always available as the fallback a box with no `briefingNotes` gets.
 * Split out so `handledRowsOf` can choose it over a box's authored notes without duplicating the wiring.
 */
function genericHandledRowsOf(
  attempt: CampaignAttempt,
  record: CampaignRecord,
  cardName: CardNameOf,
  definition?: CampaignDefinition,
  nodeIds: readonly string[] = [],
): readonly HandledRow[] {
  const grants = grantsRowOf(record, cardName, definition);
  const statusById = new Map(attempt.steps.map((step) => [step.instructionId, statusOf(step)] as const));
  const rows = campaignStepRows(attempt.steps, cardName);
  const stepRows = rows
    // The grants row above already covers every `grantCard`-only step; one that only granted would otherwise
    // repeat the same cards a second time. A pool-reading step ("If Cosmo is in the campaign pool, …") is already
    // shown, in better words, under "From the pool" — `isPoolDestinationText` is the same detection that section
    // uses, so a box with no pool at all never has a row match it.
    .filter((row) => {
      const step = attempt.steps.find((candidate) => candidate.instructionId === row.instructionId);
      if (step && step.grants.length > 0 && step.writes.length === 0 && step.choices.length === 0) return false;
      return !isPoolDestinationText(row.text);
    })
    .flatMap((row): readonly HandledRow[] => {
      const step = attempt.steps.find((candidate) => candidate.instructionId === row.instructionId);
      const rowStatus = statusById.get(row.instructionId) ?? "done";
      const sentences = step
        ? (grantedPickRowsOf(attempt, record, step, cardName, rowStatus) ??
          rolePickRowsOf(attempt, record, step, cardName, rowStatus))
        : null;
      if (sentences) return sentences;
      const plain = stepRowOf(row, statusById);
      return plain ? [plain] : [];
    });
  const fieldRows = definition ? fieldLogRowsOf(attempt, record, definition, nodeIds) : [];
  return [...(grants ? [grants] : []), ...stepRows, ...fieldRows];
}

/**
 * `briefingNotes`: a box's own authored replacement for this issue's whole "Handled for you" list (design tiles
 * 24/26's "Pool resolved in printed order" / "Infinity Gauntlet attached to Thanos" / "Pool keeps growing") — a
 * pool box's own automated setup is specific enough (which environments, which order) that the generic per-step/
 * per-field rows above read as a spreadsheet instead of a briefing. Present and non-empty, it *replaces* the
 * generic assembly rather than appending to it, so the box's author owns the whole list once they write it rather
 * than fighting duplicate rows the generic assembly still produces. Absent (every non-pool box, and a pool box
 * before its story is written), the generic assembly is exactly what rendered before this option existed.
 */
export function handledRowsOf(
  attempt: CampaignAttempt,
  record: CampaignRecord,
  cardName: CardNameOf,
  definition?: CampaignDefinition,
  nodeIds: readonly string[] = [],
  briefingNotes?: readonly BriefingNoteCopy[],
): readonly HandledRow[] {
  if (briefingNotes && briefingNotes.length > 0) {
    const repeated = attempt.steps.some((step) => step.choices.some((choice) => choice.repeated === true));
    return briefingNotes.map(({ repeatDetail, ...note }, index) => ({
      key: `note:${index}`,
      ...note,
      detail: repeated && repeatDetail ? repeatDetail : note.detail,
    }));
  }
  return genericHandledRowsOf(attempt, record, cardName, definition, nodeIds);
}

/** One short, true label per `validateDeck` problem code; a code not listed reads as the generic "Deck not legal". */
const PROBLEM_WORDS: Readonly<Record<string, string>> = {
  invalid_quantity: "Bad card quantity",
  duplicate_entry: "Card listed twice",
  unknown_card: "Unknown card in deck",
  not_an_identity: "Not a hero identity",
  identity_in_deck: "Identity card in deck",
  not_a_player_card: "Encounter card in deck",
  linked_card: "Linked card in deck",
  separate_deck_card: "Separate-deck card in deck",
  campaign_card: "Campaign card not allowed",
  campaign_card_not_granted: "Campaign card not granted",
  campaign_identity_locked: "Hero can't change",
  campaign_removed_card: "Holds a removed card",
  campaign_prohibited_card: "Holds a barred card",
  campaign_deck_frozen: "Deck is frozen",
  scenario_card: "Scenario card in deck",
  competitive_card: "Competitive card in deck",
  aspect_choice: "Aspect choice not legal",
  aspect_restriction: "Off-aspect cards",
  other_identity_card: "Another hero's card",
  identity_set_mismatch: "Identity set not exact",
  copy_limit: "Too many copies",
  unique_match: "Duplicate unique card",
  missing_card_data: "Card data missing",
};

/** `validateDeck`'s own size sentence, "The deck has 39 cards; a deck must have between 40 and 50 ...". */
const SIZE_SENTENCE = /has (\d+) cards?; a deck must have between (\d+) and (\d+)/;

function problemWords(problem: DeckProblem): string {
  if (problem.code === "deck_size") {
    // The row prints every non-granted line, but permanent cards (Solid) don't count toward size, so the count that
    // matters is the engine's own, read off its message rather than recomputed here.
    const size = SIZE_SENTENCE.exec(problem.message);
    if (size) return `Has ${size[1]} cards, needs ${size[2]}-${size[3]}`;
  }
  return PROBLEM_WORDS[problem.code] ?? "Deck not legal";
}

/** A few words for a deck's refusals, from the engine's own problem codes; "+N" when more than one kind fails. */
export function deckProblemLabel(problems: readonly DeckProblem[]): string {
  const first = problems[0];
  if (!first) return "";
  const kinds = new Set(problems.map((problem) => problem.code));
  const words = problemWords(first);
  return kinds.size > 1 ? `${words} +${kinds.size - 1}` : words;
}

/**
 * The seats whose deck the engine would refuse when this composed issue opens, by `seatNumber` (`illegalDecksOf` is
 * `createGame`'s own check, so the Briefing says before the press what the press would say). Empty when every deck is
 * legal. `config` is the composed `SessionConfig`'s players and campaign input, plus the card pool.
 */
export function deckProblemsOf(
  record: CampaignRecord,
  config: Pick<GameSetupConfig, "players" | "campaign" | "cards">,
): ReadonlyMap<number, string> {
  const out = new Map<number, string>();
  for (const illegal of illegalDecksOf(config)) {
    const seat = record.seats[illegal.seatIndex];
    if (seat) out.set(seat.seatNumber, deckProblemLabel(illegal.problems));
  }
  return out;
}

/**
 * The calls a composed attempt already answered, as answers a re-compose replays — so a deck edit (which throws the
 * attempt away, `discardAttempt`) re-asks nothing the player already decided. A drawn `random` op comes back as its
 * accept token; the draw itself is the log's own RNG, restored with the attempt, so it reproduces and cannot be
 * rerolled by editing a deck and returning. An answer the recompose no longer asks is ignored by the engine.
 */
export function answersOfAttempt(attempt: CampaignAttempt): readonly CampaignChoiceAnswer[] {
  return attempt.steps.flatMap((step) =>
    step.choices.map((choice) => ({
      instructionId: step.instructionId,
      slot: choice.slot,
      seatNumber: choice.seatNumber,
      picked: choice.random ? [CAMPAIGN_ACCEPT] : choice.picked,
    })),
  );
}

export function deckRowsOf(
  record: CampaignRecord,
  cardName: CardNameOf,
  problems: ReadonlyMap<number, string> = new Map(),
): readonly DeckRow[] {
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
      ...(problems.has(seat.seatNumber) ? { problem: problems.get(seat.seatNumber) as string } : {}),
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
  briefingNotes?: readonly BriefingNoteCopy[],
  deckProblems?: ReadonlyMap<number, string>,
): BriefingView | null {
  if (!record.attempt) return null;
  const node = definition?.graph.nodes.find((candidate) => candidate.id === record.attempt!.nodeId);
  const isFinale = definition ? nodeIds[nodeIds.length - 1] === record.attempt.nodeId : false;
  return {
    issueNumber,
    handled: handledRowsOf(record.attempt, record, cardName, definition, nodeIds, briefingNotes),
    pool:
      definition && node
        ? campaignBriefingPool(record, definition, node, cardTypeOf, isFinale, poolCopy, firstPlayerName)
        : null,
    decks: deckRowsOf(record, cardName, deckProblems),
    hiddenEvidence: definition ? hiddenEvidenceEnvelope(record, definition, cardName) : null,
    sideScheme: definition ? sideSchemeBriefingOf({ definition, record, cardName }) : null,
  };
}
