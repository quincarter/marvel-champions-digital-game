/**
 * The Mod Store's Update all bar (issue #957): which installed packs it updates, and what the bar over the browse grid
 * says and offers before, during and after a run. Pure; the scene (`scenes/mod-store.ts`) runs the installs one after
 * another and draws what this returns.
 *
 * A pack joins the run when its page would offer an Update button (`tile.state === "update"`), the same rule as the
 * Title's count badge (`packs/pack-updates.ts`): one this game is too old for, or a withdrawn one, is left out.
 *
 * A pack that fails keeps its old version. The bar only counts the failures (a phone's bar has no room for eight names);
 * each failed pack's own tile is marked instead (`failedIdsOf`), so every one can be found and retried. A failure the
 * player has since fixed (a retry from the pack's page) drops out of both, since it no longer has an update.
 */
import type { CardLanguage } from "../art/card-language.js";
import { t, tPlural } from "../i18n/translate.js";
import type { InstallProgress } from "../packs/install-pack.js";
import { progressOf, type ModStoreTile } from "./mod-store-model.js";

export interface UpdateAllItem {
  readonly id: string;
  readonly name: string;
}

/** A pack the run could not update, and why (the words its page shows until it is retried). */
export interface UpdateAllFailure extends UpdateAllItem {
  readonly error: string | null;
}

/** A run in progress: the packs it set out to update, in order, and how far it has got. */
export interface UpdateAllRun {
  readonly queue: readonly UpdateAllItem[];
  /** How many of `queue` have finished, updated or not. `queue[done]` is the one updating now. */
  readonly done: number;
  readonly updated: number;
  /** The packs that failed to update (each keeps its old version). */
  readonly failed: readonly UpdateAllFailure[];
  /** Stop was pressed: the run ends once the pack updating now finishes. */
  readonly stopping: boolean;
}

/** How the last run ended, shown on the bar until the next one starts or the player leaves the store. */
export interface UpdateAllResult {
  readonly updated: number;
  readonly failed: readonly UpdateAllFailure[];
  readonly stopped: boolean;
}

export type UpdateAllActionId = "update-all" | "stop" | "show-failed";

export interface UpdateAllAction {
  readonly id: UpdateAllActionId;
  readonly label: string;
  readonly enabled: boolean;
}

export interface UpdateAllBar {
  /** One or two short sentences. */
  readonly text: string;
  /** The progress bar's fill (0 to 1) while a run is going, else null. */
  readonly fraction: number | null;
  readonly action: UpdateAllAction | null;
  /**
   * "Show them": failed packs the tab or the search is hiding (the bar sits over every tab), so the count always leads
   * to their marked tiles. Null when they all show below.
   */
  readonly show: UpdateAllAction | null;
}

/** The packs Update all would update, by name (the order the grid lists them). */
export function updateAllQueueOf(tiles: readonly ModStoreTile[]): readonly UpdateAllItem[] {
  return tiles
    .filter((tile) => tile.state === "update")
    .map((tile) => ({ id: tile.id, name: tile.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function startRun(queue: readonly UpdateAllItem[]): UpdateAllRun {
  return { queue, done: 0, updated: 0, failed: [], stopping: false };
}

/** The run once its current pack has finished; `error` is why it failed, kept for its page. */
export function stepRun(run: UpdateAllRun, ok: boolean, error: string | null = null): UpdateAllRun {
  const current = run.queue[run.done];
  return {
    ...run,
    done: run.done + 1,
    updated: run.updated + (ok ? 1 : 0),
    failed: ok || !current ? run.failed : [...run.failed, { ...current, error }],
  };
}

/** The pack to update next, or null when the run is over (all done, or Stop was pressed). */
export function nextOf(run: UpdateAllRun): UpdateAllItem | null {
  if (run.stopping) return null;
  return run.queue[run.done] ?? null;
}

export function resultOf(run: UpdateAllRun): UpdateAllResult {
  return { updated: run.updated, failed: run.failed, stopped: run.done < run.queue.length };
}

/**
 * The packs the last run failed to update that still have an update now: the ones whose tiles are marked. One updated
 * since (a retry from its page) or removed is no longer a failure.
 */
export function failedIdsOf(
  result: UpdateAllResult | null,
  pending: readonly Pick<UpdateAllItem, "id">[],
): ReadonlySet<string> {
  if (!result) return new Set();
  const still = new Set(pending.map((item) => item.id));
  return new Set(result.failed.map((item) => item.id).filter((id) => still.has(id)));
}

/** Why the last run could not update `id`, while it is still a failure (`failedIdsOf`); else null. */
export function failureOf(
  result: UpdateAllResult | null,
  pending: readonly Pick<UpdateAllItem, "id">[],
  id: string,
): string | null {
  if (!failedIdsOf(result, pending).has(id)) return null;
  return result?.failed.find((item) => item.id === id)?.error ?? null;
}

export interface UpdateAllBarInput {
  /** The installed packs that have an update now (`updateAllQueueOf`). */
  readonly pending: readonly UpdateAllItem[];
  readonly run: UpdateAllRun | null;
  /** The current pack's latest progress report, while a run is going. */
  readonly progress: InstallProgress | null;
  readonly result: UpdateAllResult | null;
  /** Another install or a removal is running: Update all waits for it. */
  readonly busy: boolean;
  /** The ids the grid below shows now (its tab, search and tags); a failure outside them earns "Show them". */
  readonly shown?: ReadonlySet<string>;
  readonly lang?: CardLanguage;
}

/** What the bar says and offers, or null when there is nothing to update and no run to report. */
export function updateAllBarOf({
  pending,
  run,
  progress,
  result,
  busy,
  shown,
  lang,
}: UpdateAllBarInput): UpdateAllBar | null {
  if (run) {
    const at = Math.min(run.done, run.queue.length - 1);
    const name = run.queue[at]?.name ?? "";
    const step = progress ? progressOf(progress) : { fraction: 0, text: "" };
    const total = Math.max(1, run.queue.length);
    return {
      text: t("modStore.updateAll.running", { at: at + 1, total: run.queue.length, name }, lang),
      fraction: Math.min(1, (run.done + step.fraction) / total),
      action: run.stopping
        ? { id: "stop", label: t("modStore.updateAll.stopping", undefined, lang), enabled: false }
        : { id: "stop", label: t("modStore.updateAll.stop", undefined, lang), enabled: true },
      show: null,
    };
  }
  const lines: string[] = [];
  const failedIds = failedIdsOf(result, pending);
  const failed = failedIds.size;
  const hidden = shown !== undefined && [...failedIds].some((id) => !shown.has(id));
  if (result) {
    if (result.updated > 0) lines.push(tPlural("modStore.updateAll.updated", result.updated, undefined, lang));
    if (failed > 0) {
      lines.push(tPlural("modStore.updateAll.failed", failed, undefined, lang));
    } else if (result.stopped && pending.length > 0) {
      lines.push(t("modStore.updateAll.stopped", undefined, lang));
    }
  }
  if (pending.length > 0 && !(result && (failed > 0 || result.stopped))) {
    lines.push(tPlural("modStore.updateAll.ready", pending.length, undefined, lang));
  }
  if (lines.length === 0) return null;
  return {
    text: lines.join(" "),
    fraction: null,
    action:
      pending.length > 0
        ? { id: "update-all", label: t("modStore.updateAll.button", undefined, lang), enabled: !busy }
        : null,
    show: hidden ? { id: "show-failed", label: t("modStore.updateAll.show", undefined, lang), enabled: true } : null,
  };
}
