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
 * The fix, in one place: for each `(field, seat-or-shared)` group a step list touches, only the *last* write in
 * step order matters (it already reflects every earlier one this entry made), and that last value has
 * `entry.logBefore`'s own pre-entry value subtracted back out (a number's difference, or a list's own prefix
 * sliced off), so callers see what *this fold* contributed, never the campaign's running total. `set`/`strike`/etc.
 * writes are never cumulative this way (`combine`'s own `"set"` case returns the write's value verbatim), so
 * they're used as-is.
 *
 * Two grouping strategies live here because two different screens need different collapsing:
 * - `lastWriteGroupsOf` collapses *every* write kind to its group's last occurrence (the Aftermath's own semantic:
 *   a field several instructions write in sequence only cares about where it ended up).
 * - `resolvedWritesOf` collapses *only* cumulative writes (`add` numbers, `append` lists) this way; every other
 *   write kind/mode passes through unchanged, at every occurrence it was written, exactly as it already renders
 *   (the Run, the Issue detail and the Dossier Log must not start collapsing a repeated `set`/flag write just
 *   because an unrelated cumulative write on the same field needed fixing).
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

/**
 * `write.value`, delta-adjusted against `logBefore` for a cumulative write (an `add`-mode number's difference, or
 * an `append`-mode list's own baseline sliced off the front — `appendToList` only ever grows a list, never
 * reorders or removes from it, so the baseline is always its prefix); every other write is used verbatim.
 */
function resolvedValueOf(write: LogWrite, logBefore: LogSnapshotLike): LogValue {
  if (write.mode === "add" && write.value.kind === "number") {
    return { kind: "number", value: write.value.value - baselineNumberOf(logBefore, write.field, write.seatNumber) };
  }
  if (write.mode === "append" && write.value.kind === "cardList") {
    const baseline = fieldValueOf(logBefore, write.field, write.seatNumber);
    const before = baseline?.kind === "cardList" ? baseline.cardIds : [];
    return { kind: "cardList", cardIds: write.value.cardIds.slice(before.length) };
  }
  if (write.mode === "append" && write.value.kind === "instructionList") {
    const baseline = fieldValueOf(logBefore, write.field, write.seatNumber);
    const before = baseline?.kind === "instructionList" ? baseline.ids : [];
    return { kind: "instructionList", ids: write.value.ids.slice(before.length) };
  }
  return write.value;
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
 * Every write in `entry`, in original step order, except a cumulative write (`add` on a number, `append` on a
 * list) is only kept at its group's *last* occurrence (delta-adjusted) — every other write kind/mode passes
 * through unchanged, at every occurrence, exactly as it renders today. See the module doc comment for why this
 * differs from `lastWriteGroupsOf`.
 */
export function resolvedWritesOf(
  entry: HistoryEntryLike,
  fieldFilter?: (fieldId: string) => boolean,
): readonly LogWriteGroup[] {
  const lastCumulativePos = new Map<string, { stepIndex: number; writeIndex: number }>();
  entry.steps.forEach((step, stepIndex) => {
    if (step.skipped) return;
    step.writes.forEach((write, writeIndex) => {
      if (fieldFilter && !fieldFilter(write.field)) return;
      if (!isCumulative(write)) return;
      lastCumulativePos.set(groupKey(write.field, write.seatNumber), { stepIndex, writeIndex });
    });
  });

  const resolved: LogWriteGroup[] = [];
  entry.steps.forEach((step, stepIndex) => {
    if (step.skipped) return;
    step.writes.forEach((write, writeIndex) => {
      if (fieldFilter && !fieldFilter(write.field)) return;
      if (isCumulative(write)) {
        const last = lastCumulativePos.get(groupKey(write.field, write.seatNumber));
        if (!last || last.stepIndex !== stepIndex || last.writeIndex !== writeIndex) return;
      }
      resolved.push({
        field: write.field,
        seatNumber: write.seatNumber,
        mode: write.mode,
        value: resolvedValueOf(write, entry.logBefore),
        stepIndex,
        writeIndex,
        step,
      });
    });
  });
  return resolved;
}
