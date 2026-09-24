/**
 * Cumulative writes are not deltas — the one fact every campaign log view model needs and none of them should have
 * to re-derive on their own.
 *
 * `CampaignStepTrace.writes`'s own doc comment says a write is recorded "as it goes into the log", and
 * `applyLogWrite` (`engine/campaign/log.ts`) stores the field's *new accumulated value* after a cumulative write,
 * not the amount that one write alone contributed:
 * - `mode: "add"` stores the field's new running total (MC16's own "units" field is written by three separate
 *   specs in one victory block, each chaining onto the *previous* write, not onto zero).
 * - `mode: "append"` on a `cardList`/`instructionList` field stores the whole list so far (GMW's `marketCards`,
 *   written once per card a seat buys in the same victory block, each write carrying every earlier purchase too).
 *
 * Reading every such write as an independent delta and summing/concatenating them double- and triple-counts every
 * write after the first, and also folds in whatever the field already held from an earlier issue — both fields are
 * cumulative across the whole campaign, not just within one fold.
 *
 * Two grouping strategies live here because two different screens need different collapsing:
 * - `lastWriteGroupsOf` collapses *every* write kind, across the *whole entry*, to its group's last occurrence
 *   (the Aftermath's own semantic: a field several instructions write in sequence only cares about where it ended
 *   up by the end of the fold, spend and award alike — its own tile never attributes a value to one instruction).
 * - `resolvedWritesOf` collapses cumulative writes (`add` numbers, `append` lists) *per step*, not across the whole
 *   entry: a step's own delta is its last write for that field+seat minus the value the *previous* step in this
 *   entry left it at (or `entry.logBefore` if no earlier step touched it). This is the difference between "the
 *   Market setup spent 4 units, then this scenario's own victory earned 3" (two rows, one per instruction, +then a
 *   grant of a hero's own cards) and pinning the whole issue's *net* to whichever instruction happened to run last
 *   — GMW's own setup (spending units earned last issue) and victory (earning units for the next one) share one
 *   history entry, so collapsing across the entry misattributes a net change to one instruction's printed text.
 *   Every other write kind/mode passes through unchanged, at every occurrence it was written, exactly as it
 *   already renders (a repeated `set`/flag write is not cumulative and was never the bug).
 */
import type { CampaignHistoryEntry, CampaignLogSnapshot, CampaignStepTrace, LogValue, LogWrite } from "@mc/engine";

/** One write, resolved for display: `value` is delta-adjusted for a cumulative write, and verbatim otherwise. */
export interface LogWriteGroup {
  readonly field: string;
  readonly seatNumber: number | null;
  readonly mode: LogWrite["mode"];
  readonly value: LogValue;
  readonly stepIndex: number;
  readonly writeIndex: number;
  readonly step: CampaignStepTrace;
}

const groupKey = (field: string, seatNumber: number | null): string => `${field}:${seatNumber ?? "shared"}`;

type LogSnapshotLike = CampaignHistoryEntry["logBefore"] | CampaignLogSnapshot;

function fieldValueOf(logBefore: LogSnapshotLike, field: string, seatNumber: number | null): LogValue | undefined {
  return seatNumber === null
    ? logBefore.shared[field]
    : logBefore.seats.find((s) => s.seatNumber === seatNumber)?.fields[field];
}

/**
 * A field's own value before this history entry's instructions ran — `entry.logBefore`, the same snapshot
 * `LossPolicy.retryBaseline: "nodeStart"` restores on a retry. 0 for a field this entry's own baseline never held
 * (never recorded yet), which is exactly what an `add` write with nothing to add onto should read as.
 */
export function baselineNumberOf(logBefore: LogSnapshotLike, field: string, seatNumber: number | null): number {
  const value = fieldValueOf(logBefore, field, seatNumber);
  return value?.kind === "number" ? value.value : 0;
}

/** Whether `write` accumulates onto whatever the field already held, rather than replacing it outright. */
function isCumulative(write: LogWrite): boolean {
  if (write.mode === "add" && write.value.kind === "number") return true;
  return write.mode === "append" && (write.value.kind === "cardList" || write.value.kind === "instructionList");
}

/** `current`, delta-adjusted against `before` (a number's difference, or a list's own prefix sliced off — a
 * cumulative write only ever grows a list, never reorders or removes from it, so `before` is always its prefix). */
function deltaOf(current: LogValue, before: LogValue | undefined): LogValue {
  if (current.kind === "number") {
    return { kind: "number", value: current.value - (before?.kind === "number" ? before.value : 0) };
  }
  if (current.kind === "cardList") {
    return {
      kind: "cardList",
      cardIds: current.cardIds.slice(before?.kind === "cardList" ? before.cardIds.length : 0),
    };
  }
  if (current.kind === "instructionList") {
    return {
      kind: "instructionList",
      ids: current.ids.slice(before?.kind === "instructionList" ? before.ids.length : 0),
    };
  }
  return current;
}

/**
 * `write.value`, delta-adjusted against `logBefore` for a cumulative write; every other write is used verbatim.
 * The whole-entry counterpart of `resolvedWritesOf`'s per-step `deltaOf` — see `lastWriteGroupsOf`'s own doc.
 */
function resolvedValueOf(write: LogWrite, logBefore: LogSnapshotLike): LogValue {
  if (!isCumulative(write)) return write.value;
  return deltaOf(write.value, fieldValueOf(logBefore, write.field, write.seatNumber));
}

type HistoryEntryLike = Pick<CampaignHistoryEntry, "steps" | "logBefore">;

/**
 * Every write in `entry`, collapsed to one per `(field, seat)` group: the group's *last* write, whatever its mode,
 * in the order each group was first touched. This is the Aftermath's own semantic — see the module doc comment.
 */
export function lastWriteGroupsOf(
  entry: HistoryEntryLike,
  fieldFilter?: (fieldId: string) => boolean,
): readonly LogWriteGroup[] {
  const order: string[] = [];
  const lastByGroup = new Map<
    string,
    { write: LogWrite; stepIndex: number; writeIndex: number; step: CampaignStepTrace }
  >();
  entry.steps.forEach((step, stepIndex) => {
    if (step.skipped) return;
    step.writes.forEach((write, writeIndex) => {
      if (fieldFilter && !fieldFilter(write.field)) return;
      const key = groupKey(write.field, write.seatNumber);
      if (!lastByGroup.has(key)) order.push(key);
      lastByGroup.set(key, { write, stepIndex, writeIndex, step });
    });
  });
  return order.map((key) => {
    const found = lastByGroup.get(key)!;
    return {
      field: found.write.field,
      seatNumber: found.write.seatNumber,
      mode: found.write.mode,
      value: resolvedValueOf(found.write, entry.logBefore),
      stepIndex: found.stepIndex,
      writeIndex: found.writeIndex,
      step: found.step,
    };
  });
}

/**
 * Every write in `entry`, one row per `(step, field, seat)`: within a step, repeated writes to the same field+seat
 * collapse to that step's own last write (mirrors a single instruction's own multiple writes, e.g. the four
 * "units" writes GMW's own victory bullet makes in one step); across steps, a cumulative write's delta is taken
 * against a *running* baseline this function carries step to step — the value the previous step in this entry left
 * that field+seat at, falling back to `entry.logBefore` for the first step that ever touches it. A non-cumulative
 * write (`set`/flag/etc.) still passes through verbatim, but also advances the running baseline, so a later
 * cumulative write in the same entry deltas against wherever a `set` actually left the field. See the module doc
 * comment for why this per-step accounting differs from `lastWriteGroupsOf`'s whole-entry collapse.
 */
export function resolvedWritesOf(
  entry: HistoryEntryLike,
  fieldFilter?: (fieldId: string) => boolean,
): readonly LogWriteGroup[] {
  const running = new Map<string, LogValue>();
  const resolved: LogWriteGroup[] = [];
  entry.steps.forEach((step, stepIndex) => {
    if (step.skipped) return;
    // The step's own last write per field+seat — a step's earlier write to the same group is superseded within
    // the step itself, the same way `combine` already folds them into one stored value.
    const order: string[] = [];
    const lastInStep = new Map<string, { write: LogWrite; writeIndex: number }>();
    step.writes.forEach((write, writeIndex) => {
      if (fieldFilter && !fieldFilter(write.field)) return;
      const key = groupKey(write.field, write.seatNumber);
      if (!lastInStep.has(key)) order.push(key);
      lastInStep.set(key, { write, writeIndex });
    });
    for (const key of order) {
      const { write, writeIndex } = lastInStep.get(key)!;
      const before = running.has(key) ? running.get(key) : fieldValueOf(entry.logBefore, write.field, write.seatNumber);
      const value = isCumulative(write) ? deltaOf(write.value, before) : write.value;
      running.set(key, write.value);
      resolved.push({
        field: write.field,
        seatNumber: write.seatNumber,
        mode: write.mode,
        value,
        stepIndex,
        writeIndex,
        step,
      });
    }
  });
  return resolved;
}
