/**
 * The Mod Store's Update all bar (issue #957): which installed packs it updates, and what the bar over the browse grid
 * says and offers before, during and after a run. Pure; the scene (`scenes/mod-store.ts`) runs the installs one after
 * another and draws what this returns.
 *
 * A pack joins the run when its page would offer an Update button (`tile.state === "update"`), the same rule as the
 * Title's count badge (`packs/pack-updates.ts`): one this game is too old for, or a withdrawn one, is left out.
 */
import type { CardLanguage } from "../art/card-language.js";
import { t, tPlural } from "../i18n/translate.js";
import type { InstallProgress } from "../packs/install-pack.js";
import { progressOf, type ModStoreTile } from "./mod-store-model.js";

export interface UpdateAllItem {
  readonly id: string;
  readonly name: string;
}

/** A run in progress: the packs it set out to update, in order, and how far it has got. */
export interface UpdateAllRun {
  readonly queue: readonly UpdateAllItem[];
  /** How many of `queue` have finished, updated or not. `queue[done]` is the one updating now. */
  readonly done: number;
  readonly updated: number;
  /** The names of the packs that failed to update (each keeps its old version). */
  readonly failed: readonly string[];
  /** Stop was pressed: the run ends once the pack updating now finishes. */
  readonly stopping: boolean;
}

/** How the last run ended, shown on the bar until the next one starts or the player leaves the store. */
export interface UpdateAllResult {
  readonly updated: number;
  readonly failed: readonly string[];
  readonly stopped: boolean;
}

export type UpdateAllActionId = "update-all" | "stop";

export interface UpdateAllBar {
  /** One or two short sentences. */
  readonly text: string;
  /** The progress bar's fill (0 to 1) while a run is going, else null. */
  readonly fraction: number | null;
  readonly action: { readonly id: UpdateAllActionId; readonly label: string; readonly enabled: boolean } | null;
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

/** The run once its current pack has finished. */
export function stepRun(run: UpdateAllRun, ok: boolean): UpdateAllRun {
  const current = run.queue[run.done];
  return {
    ...run,
    done: run.done + 1,
    updated: run.updated + (ok ? 1 : 0),
    failed: ok || !current ? run.failed : [...run.failed, current.name],
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

export interface UpdateAllBarInput {
  /** How many installed packs have an update now. */
  readonly pending: number;
  readonly run: UpdateAllRun | null;
  /** The current pack's latest progress report, while a run is going. */
  readonly progress: InstallProgress | null;
  readonly result: UpdateAllResult | null;
  /** Another install or a removal is running: Update all waits for it. */
  readonly busy: boolean;
  readonly lang?: CardLanguage;
}

/** What the bar says and offers, or null when there is nothing to update and no run to report. */
export function updateAllBarOf({ pending, run, progress, result, busy, lang }: UpdateAllBarInput): UpdateAllBar | null {
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
    };
  }
  const lines: string[] = [];
  if (result) {
    if (result.updated > 0) lines.push(tPlural("modStore.updateAll.updated", result.updated, undefined, lang));
    if (result.failed.length > 0) {
      lines.push(t("modStore.updateAll.failed", { names: result.failed.join(", ") }, lang));
    } else if (result.stopped && pending > 0) {
      lines.push(t("modStore.updateAll.stopped", undefined, lang));
    }
  }
  if (pending > 0 && !(result && (result.failed.length > 0 || result.stopped))) {
    lines.push(tPlural("modStore.updateAll.ready", pending, undefined, lang));
  }
  if (lines.length === 0) return null;
  return {
    text: lines.join(" "),
    fraction: null,
    action:
      pending > 0 ? { id: "update-all", label: t("modStore.updateAll.button", undefined, lang), enabled: !busy } : null,
  };
}
