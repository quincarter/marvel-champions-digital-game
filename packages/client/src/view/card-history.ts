/**
 * "This card, this game" — a per-instance trace, for the Inspect overlay (D08,
 * P14; docs/phase4-screen-gaps.md §3 "W8": "Inspect: 'This card, this game':
 * where the card has been, from the game log").
 *
 * `view/log-lines.ts`'s `LogState` is deliberately narrower than this needs: it
 * drops the bookkeeping events (a card drawn, a card discarded from hand to pay
 * a cost) that never earn a line on the shared table log, because a whole-table
 * log that announced every draw would be unreadable. A single card's own
 * history is exactly the opposite ask — "where has *this* card been" wants the
 * draw and the discard-to-pay too — so this is a second, parallel fold over the
 * same event stream, kept by `scenes/board.ts` for as long as the Board scene
 * itself lives (i.e., the whole session; overlays launch on top of it, never
 * replacing it). It reuses `logLine`'s exact wording for every event the two
 * folds share, so a card's history never disagrees with what the table log
 * already said about it.
 *
 * One entry per *command* (one call to `appendCardHistory`), not per event —
 * "played, dealt 6, defeated" is one beat at the table, so it is one line here
 * too, in the mono round tag the design prints ("2.04" — round 2, the 4th beat
 * of that round). A resumed game's history starts empty from the point of
 * resume, the same limitation `LogState` already has and for the same reason:
 * neither is reconstructed from the saved log, only accumulated forward.
 */

import type { EngineDeps, GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { logLine } from "./log-lines.js";
import { cardName } from "./names.js";

export interface CardHistoryEntry {
  readonly round: number;
  /** 1-based within `round`, reset at `roundStarted`. */
  readonly beat: number;
  readonly events: readonly GameEvent[];
}

export interface CardHistoryLog {
  readonly entries: readonly CardHistoryEntry[];
  readonly round: number;
  readonly beat: number;
}

export const emptyCardHistoryLog = (): CardHistoryLog => ({ entries: [], round: 0, beat: 0 });

/** Appends one command's events as one entry. A no-op for an empty batch (a redraw with nothing new). */
export function appendCardHistory(log: CardHistoryLog, events: readonly GameEvent[], cap = 300): CardHistoryLog {
  if (events.length === 0) return log;
  let round = log.round;
  let beat = log.beat;
  for (const event of events) {
    if (event.type === "roundStarted") {
      round = event.round;
      beat = 0;
    }
  }
  beat += 1;
  const entries = [...log.entries, { round, beat, events }];
  return { entries: entries.length > cap ? entries.slice(entries.length - cap) : entries, round, beat };
}

/**
 * Every instance id one event is "about" — broader than `log-lines.ts`'s own
 * needs (which only cares what a *visible* line says), because a card's own
 * history wants to know about it even where the table log stays silent (a
 * boost card flipped, a card drawn). Pure and exported for its own test.
 */
export function eventRefs(event: GameEvent): readonly InstanceId[] {
  switch (event.type) {
    case "cardMoved":
      return event.to.kind === "dealtEncounter" ? [event.instanceId] : [];
    case "cardDrawn":
    case "cardDiscardedFromHand":
    case "cardExhausted":
    case "cardReadied":
    case "cardDiscardedFromPlay":
    case "characterDefeated":
    case "schemeDefeated":
    case "villainStageAdvanced":
    case "villainFlipped":
    case "cardFlipped":
    case "encounterCardRevealed":
    case "statusGiven":
    case "leavePlayBlocked":
    case "cardPutIntoPlayFacedown":
    case "hitPointsSet":
    case "revealCancelled":
      return [event.instanceId];
    case "cardPlayed":
      return [event.instanceId];
    case "damageDealt":
    case "damagePlaced":
      return event.sourceInstanceId ? [event.targetInstanceId, event.sourceInstanceId] : [event.targetInstanceId];
    case "damagePrevented":
    case "damageHealed":
      return [event.targetInstanceId];
    case "threatPrevented":
      return [event.schemeInstanceId];
    case "threatPlaced":
    case "threatRemoved":
      return event.sourceInstanceId ? [event.schemeInstanceId, event.sourceInstanceId] : [event.schemeInstanceId];
    case "threatRemovalBlocked":
      return [event.schemeInstanceId];
    case "statusRemoved":
      return [event.instanceId];
    case "enemyActivated":
    case "activationSkipped":
      return [event.enemyInstanceId];
    case "boostCardDealt":
    case "boostCardFlipped":
      return [event.enemyInstanceId, event.instanceId];
    case "boostCancelled":
      return [event.instanceId];
    case "defenderDeclared":
      return [event.defenderInstanceId, event.attackInstanceId];
    case "defenderLeftPlay":
      return [event.defenderInstanceId, event.enemyInstanceId, event.targetInstanceId];
    case "attackResolved":
      return [event.enemyInstanceId, event.targetInstanceId];
    case "schemeResolved":
      return [event.enemyInstanceId, event.schemeInstanceId];
    case "activeVillainChanged":
      return [event.from, event.to];
    case "overkillSpilled":
      return [event.fromInstanceId, event.toInstanceId];
    case "excessDamageAsThreat":
      return [event.sourceInstanceId, event.targetInstanceId, event.schemeInstanceId];
    case "uniqueEntryBlocked":
      return [event.instanceId, event.matchedInstanceId];
    case "abilityResolved":
    case "abilityUseRecorded":
      return [event.instanceId];
    case "resourcesGenerated":
      return [event.instanceId];
    case "counterAdded":
    case "counterRemoved":
      return [event.instanceId];
    default:
      return [];
  }
}

export interface CardHistoryLine {
  readonly id: string;
  /** "2.04" — round, then a 2-digit beat within it, as the design prints it. */
  readonly roundTag: string;
  readonly round: number;
  readonly text: string;
}

/** "Drawn." / "Discarded to pay for X.": the two beats `log-lines.ts` deliberately keeps off the shared table log. */
function siblingWording(event: GameEvent, batch: readonly GameEvent[], state: GameState): string | null {
  if (event.type === "cardDrawn") return "Drawn.";
  if (event.type === "cardDiscardedFromHand") {
    const playedFor = batch.find((sibling): sibling is Extract<GameEvent, { type: "cardPlayed" }> => sibling.type === "cardPlayed" && sibling.instanceId !== event.instanceId);
    if (playedFor) return `Discarded to pay for ${cardName(state, playedFor.instanceId)}.`;
    const abilityFor = batch.find((sibling): sibling is Extract<GameEvent, { type: "abilityResolved" }> => sibling.type === "abilityResolved" && sibling.instanceId !== event.instanceId);
    if (abilityFor) return `Discarded to pay for ${cardName(state, abilityFor.instanceId)}'s ability.`;
    return "Discarded to pay a cost.";
  }
  return null;
}

/**
 * `instanceId`'s own history, oldest first (newest last) — every batch that
 * named it, each collapsed to one line (its distinct beats joined with " · ",
 * so "played, dealt 6, defeated" reads as one row, matching the design's own
 * "Played on Vibranium Thief · 6 damage · defeated.").
 */
export function cardHistoryOf(
  log: CardHistoryLog,
  instanceId: InstanceId,
  state: GameState,
  perspectiveId: PlayerId | null,
  deps: EngineDeps,
): readonly CardHistoryLine[] {
  const lines: CardHistoryLine[] = [];
  for (const entry of log.entries) {
    const parts: string[] = [];
    for (const event of entry.events) {
      if (!eventRefs(event).includes(instanceId)) continue;
      const text = siblingWording(event, entry.events, state) ?? logLine(event, state, perspectiveId, deps)?.text ?? null;
      if (text && !parts.includes(text)) parts.push(text);
    }
    if (parts.length === 0) continue;
    lines.push({
      id: `hist-${entry.round}-${entry.beat}`,
      roundTag: `${entry.round}.${String(entry.beat).padStart(2, "0")}`,
      round: entry.round,
      text: parts.join(" · "),
    });
  }
  return lines;
}
