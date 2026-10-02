/**
 * The between-scenario step (docs/campaign-mode-design.md §10.2, `campaign-step-model.ts`): rendering what
 * `resolveBetweenGames`/`applyCampaignResult` did or are asking about, and carrying a composed log the rest of
 * the way to a playable game and back.
 *
 * Four jobs, none of which reimplements a rule:
 *  - `campaignStepRows` renders a resolved `CampaignStepTrace[]` (`CampaignAttempt.steps` mid-composition, or a
 *    `CampaignHistoryEntry.steps` once folded) into the between-games step list design §10.2 asks for: each
 *    instruction's printed `text` + `citation` + what it actually did.
 *  - `campaignChoicePrompt` is a thin, explicitly-named wrapper over `CampaignPendingChoice` — the shape a re-entry
 *    loop (`../engine/campaign-storage.ts`'s consumer) hands to a chooser UI, options and all, never computed here.
 *  - `campaignLaunchConfig` turns a composed log (`resolveBetweenGames`'s `"done"` result) into the `SessionConfig`
 *    the existing host path already knows how to start (design §7's boundary: `startGameFromLog`'s
 *    `CampaignGameInput` goes onto `SessionConfig.campaign` unchanged, so a saved campaign game replays without
 *    ever consulting the live log again).
 *  - `campaignPostGameFold` composes `campaignResultOf` + `applyCampaignResult` — the read-the-finished-game,
 *    write-the-log half of the same boundary — so a caller never has to get the two-call order right by hand.
 */
import { difficultyOf, type CardId } from "@mc/content";
import {
  applyCampaignResult,
  campaignResultOf,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDefinition,
  type CampaignDeps,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignResultMeta,
  type CampaignRunnerResult,
  type CampaignStepTrace,
  type EngineDeps,
  type GameEvent,
  type GameState,
} from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { renderLogValue, type CardNameOf } from "./campaign-log-model.js";

// ---------------------------------------------------------------------------------------------------------------
// Rendering resolved steps
// ---------------------------------------------------------------------------------------------------------------

export interface CampaignStepRow {
  readonly instructionId: string;
  readonly text: string;
  readonly citation: string;
  readonly kind: CampaignStepTrace["kind"];
  /** Why the instruction did not run — its `whenModes` gate or its `when` predicate failed — or null if it ran. */
  readonly skipped: "modes" | "condition" | null;
  /** Short, human-readable lines describing what the instruction did: one per write, choice, grant or removal. */
  readonly effects: readonly string[];
}

/** Renders a resolved step trace list — `CampaignAttempt.steps` or a `CampaignHistoryEntry.steps` — as rows. */
export function campaignStepRows(
  steps: readonly CampaignStepTrace[],
  cardName: CardNameOf = (id) => id as string,
): readonly CampaignStepRow[] {
  return steps.map((step) => ({
    instructionId: step.instructionId,
    text: step.text,
    citation: step.citation,
    kind: step.kind,
    skipped: step.skipped ?? null,
    effects: effectsOf(step, cardName),
  }));
}

/** "communityService" -> "Community Service": a raw field/slot id read back as printed-sheet-style words, the
 * same convention `campaign-aftermath-model.ts`'s `shoutLabel` uses for a log tag's own short label. */
function humanizeId(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase())
    .trim();
}

function effectsOf(step: CampaignStepTrace, cardName: CardNameOf): readonly string[] {
  if (step.skipped) return [];
  const lines: string[] = [];
  // A choice's own line below already says what got picked; a `set` write that records that exact same value into
  // a field (MC27 p. 9's `communityServicePick`: `random` into a slot, then `setField` that slot's own choice onto
  // `communityServiceDealt`) is the between-games step list's own bookkeeping, not a second fact for a player to
  // read — so it's dropped here rather than printed as a redundant "set field = value" line under the choice that
  // already says it. Matched by rendered text, not by field/slot name, so this holds for any box's instruction
  // shaped the same way, not just this one.
  const chosenText = new Set(
    step.choices
      .filter((choice) => choice.picked.length > 0)
      .map((choice) => choice.picked.map((id) => cardName(id as CardId)).join(", ")),
  );
  for (const write of step.writes) {
    // This is a raw trace of the write as it went into the log, not the fold's own delta (`campaign-log-deltas.ts`):
    // `add` stores the field's new running total, not the amount this one write alone contributed, so it's labelled
    // as such rather than read as "added N" the way the Run/Issue/Dossier screens present it.
    const rendered =
      write.mode === "add"
        ? `${renderLogValue(write.value, cardName)} (running total)`
        : renderLogValue(write.value, cardName);
    if (write.mode === "set" && chosenText.has(rendered)) continue;
    lines.push(
      `Recorded ${humanizeId(write.field)}${write.seatNumber === null ? "" : ` (seat ${write.seatNumber})`}: ${rendered}`,
    );
  }
  for (const choice of step.choices) {
    const who = choice.seatNumber === null ? "The group" : `Seat ${choice.seatNumber}`;
    // `picked` is card ids, node ids or option strings depending on the choice's source (design §5's
    // `CampaignChoiceRecord`); `cardName` is applied to all of them alike, which only matters for a caller that
    // resolves real titles — the default (identity) renders every kind exactly as recorded.
    const picked =
      choice.picked.length === 0 ? "declined" : choice.picked.map((id) => cardName(id as CardId)).join(", ");
    lines.push(
      `${who} ${choice.picked.length === 0 ? picked : `chose ${picked}`}${choice.random ? " at random" : ""} for ${humanizeId(choice.slot)}.`,
    );
  }
  for (const grant of step.grants) {
    lines.push(
      `Granted ${cardName(grant.cardId)} (${grant.permanence === "campaign" ? "for the campaign" : "for this game"}).`,
    );
  }
  for (const face of step.removedFromCampaign) {
    lines.push(`Removed ${cardName(face.cardId)}${face.face ? ` (${face.face})` : ""} from the campaign.`);
  }
  return lines;
}

// ---------------------------------------------------------------------------------------------------------------
// The pending choice
// ---------------------------------------------------------------------------------------------------------------

export interface CampaignChoicePrompt {
  readonly instructionId: string;
  readonly slot: string;
  readonly seatNumber: number | null;
  readonly text: string;
  readonly citation: string;
  readonly chooser: "eachSeat" | "group" | "firstPlayer";
  readonly options: readonly string[];
  readonly count: number;
  readonly optional: boolean;
}

/** A `CampaignPendingChoice` as the options-and-all prompt a chooser UI answers, re-entering with a `CampaignChoiceAnswer`. */
export function campaignChoicePrompt(choice: CampaignPendingChoice): CampaignChoicePrompt {
  return {
    instructionId: choice.instructionId,
    slot: choice.slot,
    seatNumber: choice.seatNumber,
    text: choice.text,
    citation: choice.citation,
    chooser: choice.chooser,
    options: choice.options,
    count: choice.count,
    optional: choice.optional,
  };
}

/** Either the rendered step list a composed/folded log carries, or the one choice still blocking it. */
export type CampaignStepView =
  | { readonly kind: "steps"; readonly steps: readonly CampaignStepRow[] }
  | { readonly kind: "pending"; readonly choice: CampaignChoicePrompt };

/** Renders whichever half of `CampaignRunnerResult` the caller got back, without the caller re-deriving the shape. */
export function campaignStepView<T>(
  result: CampaignRunnerResult<T>,
  stepsOf: (value: T) => readonly CampaignStepTrace[],
  cardName: CardNameOf = (id) => id as string,
): CampaignStepView {
  return result.kind === "pending"
    ? { kind: "pending", choice: campaignChoicePrompt(result.choice) }
    : { kind: "steps", steps: campaignStepRows(stepsOf(result.value), cardName) };
}

// ---------------------------------------------------------------------------------------------------------------
// Launching the next scenario
// ---------------------------------------------------------------------------------------------------------------

/**
 * A composed log (`log.attempt` present — `resolveBetweenGames`'s `"done"` result) as the `SessionConfig` the
 * existing host path starts (`session-core.ts`'s `scenarioFor` attaches `config.campaign` to `GameSetupConfig`
 * unchanged, and turns `config.campaignEncounterSets` into the composed sets' actual cards the same way). Throws
 * for a `composed` node (MC60 p. 9's villain-choice scenarios): no box with that graph shape ships yet (design
 * §11 step 7's own MC10-only scope), so there is nothing real to build a `scenarioId` from — flagged rather than
 * guessed at.
 */
export function campaignLaunchConfig(definition: CampaignDefinition, log: CampaignLog): SessionConfig {
  const start = startGameFromLog(definition, log);
  if (start.scenarioId === null) {
    throw new Error(
      `campaign node "${start.nodeId}" is a composed scenario (MC60 p. 9's chosen-villain shape); this build's ` +
        "launch path only knows a node with a fixed scenario",
    );
  }
  return {
    scenarioId: start.scenarioId,
    difficulty: difficultyOf(start.modes),
    modes: start.modes,
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: [...seat.deck],
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    campaign: start.input,
    campaignEncounterSets: start.encounterSets,
    ...(log.removedFromCampaign.length > 0
      ? { campaignRemovedCards: log.removedFromCampaign.map((face) => face.cardId) }
      : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Folding a finished game back in
// ---------------------------------------------------------------------------------------------------------------

/**
 * The other half of the boundary: reads the finished game (`campaignResultOf`) and folds the result into the log
 * (`applyCampaignResult`), in the one order that's ever correct. `answers` only matters when the victory/defeat
 * instructions themselves ask something (MC10 has none that do); a caller re-enters with the same log and an
 * enlarged `answers` list on `"pending"`, exactly as `resolveBetweenGames`'s own re-entry works.
 */
export function campaignPostGameFold(
  definition: CampaignDefinition,
  log: CampaignLog,
  finalState: GameState,
  events: readonly GameEvent[],
  meta: CampaignResultMeta,
  campaignDeps: CampaignDeps,
  engineDeps?: EngineDeps,
  answers: readonly CampaignChoiceAnswer[] = [],
): CampaignRunnerResult<CampaignLog> {
  const result = campaignResultOf(definition, log, finalState, events, engineDeps);
  return applyCampaignResult(definition, log, result, meta, campaignDeps, answers);
}
