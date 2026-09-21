/**
 * Which of a card's status pips/tags just changed, from a fresh batch of
 * events: `statusGiven` stamps the new one on; `statusRemoved` leaves a ghost
 * of it fading where the real pip used to be. The real pip is already gone by
 * the time a draw reads this — the redraw that dropped it from `panel.statuses`
 * already ran — which is exactly why the ghost exists: without it a status
 * clearing would be silent.
 */

import type { GameEvent, InstanceId } from "@mc/engine";
import type { StatusName } from "./log-lines.js";

export type { StatusName };

export interface StatusMotion {
  readonly instanceId: InstanceId;
  readonly status: StatusName;
}

/** Statuses freshly given this batch — stamp them on. */
export function statusStampsFrom(events: readonly GameEvent[]): readonly StatusMotion[] {
  const out: StatusMotion[] = [];
  for (const event of events) {
    if (event.type === "statusGiven") out.push({ instanceId: event.instanceId, status: event.status });
  }
  return out;
}

/** Statuses freshly removed this batch — fade a ghost of each. */
export function statusGhostsFrom(events: readonly GameEvent[]): readonly StatusMotion[] {
  const out: StatusMotion[] = [];
  for (const event of events) {
    if (event.type === "statusRemoved") out.push({ instanceId: event.instanceId, status: event.status });
  }
  return out;
}
