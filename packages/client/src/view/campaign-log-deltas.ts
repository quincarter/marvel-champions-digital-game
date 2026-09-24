/**
 * `mode: "add"` writes are cumulative, not deltas — the one fact every campaign log view model needs and none of
 * them should have to re-derive on their own.
 *
 * `CampaignStepTrace.writes`'s own doc comment says a write is recorded "as it goes into the log", and `applyLogWrite`
 * (`engine/campaign/log.ts`) stores the field's *new running total* after each `add`, not the amount that one write
 * alone contributed, because a field several instructions write in sequence (MC16's own "units" field is written by
 * three separate specs in one victory block) chains onto the *previous* write, not onto zero. Reading every `add`
 * write as an independent delta and summing them double- and triple-counts every write after the first, and also
 * folds in whatever the field already held from an earlier issue — GMW's own currency is cumulative across the
 * whole campaign.
 *
 * The fix, in one place: for each `(field, seat-or-shared)` group a step list touches, only the *last* write in
 * step order matters (it already reflects every earlier one this entry made), and for `add` mode that last value
 * has `entry.logBefore`'s own pre-entry value subtracted back out, so callers see what *this fold* contributed,
 * never the campaign's running balance. `set`/`append`/etc. writes are never cumulative this way (`combine`'s own
 * `"set"` case returns the write's value verbatim), so they're used as-is.
 *
 * Two grouping strategies live here because two different screens need different collapsing:
 * - `lastWriteGroupsOf` collapses *every* write kind to its group's last occurrence (the Aftermath's own semantic:
 *   a field several instructions write in sequence only cares about where it ended up).
 * - `resolvedWritesOf` collapses *only* `add`-mode number writes this way; every other write kind/mode passes
 *   through unchanged, at every occurrence it was written, exactly as it already renders (the Run, the Issue
 *   detail and the Dossier Log must not start collapsing a repeated `set`/`append`/flag write just because an
 *   unrelated `add` write on the same field needed fixing).
 */
import type { CampaignHistoryEntry, CampaignLogSnapshot, CampaignStepTrace, LogValue, LogWrite } from "@mc/engine";

/** One write, resolved for display: `value` is delta-adjusted for an `add`-mode number, and verbatim otherwise. */
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

/**
 * A field's own value before this history entry's instructions ran — `entry.logBefore`, the same snapshot
 * `LossPolicy.retryBaseline: "nodeStart"` restores on a retry. 0 for a field this entry's own baseline never held
 * (never recorded yet), which is exactly what an `add` write with nothing to add onto should read as.
 */
export function baselineNumberOf(
  logBefore: CampaignHistoryEntry["logBefore"] | CampaignLogSnapshot,
  field: string,
  seatNumber: number | null,
): number {
  const value =
    seatNumber === null
      ? logBefore.shared[field]
      : logBefore.seats.find((s) => s.seatNumber === seatNumber)?.fields[field];
  return value?.kind === "number" ? value.value : 0;
}

/** `write.value`, delta-adjusted against `logBefore` for an `add`-mode number; every other write is used verbatim. */
function resolvedValueOf(write: LogWrite, logBefore: CampaignHistoryEntry["logBefore"]): LogValue {
  if (write.mode === "add" && write.value.kind === "number") {
    return { kind: "number", value: write.value.value - baselineNumberOf(logBefore, write.field, write.seatNumber) };
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
 * Every write in `entry`, in original step order, except an `add`-mode number write is only kept at its group's
 * *last* occurrence (delta-adjusted) — every other write kind/mode passes through unchanged, at every occurrence,
 * exactly as it renders today. See the module doc comment for why this differs from `lastWriteGroupsOf`.
 */
export function resolvedWritesOf(
  entry: HistoryEntryLike,
  fieldFilter?: (fieldId: string) => boolean,
): readonly LogWriteGroup[] {
  const lastAddPos = new Map<string, { stepIndex: number; writeIndex: number }>();
  entry.steps.forEach((step, stepIndex) => {
    if (step.skipped) return;
    step.writes.forEach((write, writeIndex) => {
      if (fieldFilter && !fieldFilter(write.field)) return;
      if (write.mode !== "add" || write.value.kind !== "number") return;
      lastAddPos.set(groupKey(write.field, write.seatNumber), { stepIndex, writeIndex });
    });
  });

  const resolved: LogWriteGroup[] = [];
  entry.steps.forEach((step, stepIndex) => {
    if (step.skipped) return;
    step.writes.forEach((write, writeIndex) => {
      if (fieldFilter && !fieldFilter(write.field)) return;
      if (write.mode === "add" && write.value.kind === "number") {
        const last = lastAddPos.get(groupKey(write.field, write.seatNumber));
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
