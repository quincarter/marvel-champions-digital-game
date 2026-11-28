/**
 * Past games' actions: Watch, Share, Export, Log, "Export for MC Tracker" and "Open a replay file". Each runs against the
 * visit it began in: Phaser reuses the scene, so an open still running from an earlier visit (a slow Watch, then Back and
 * in again) checks it after each wait and stands down rather than act on this one.
 */
import type Phaser from "phaser";
import type { PastGameAction, PastGameRow } from "../../view/past-games-model.js";
import { t } from "../../i18n/translate.js";
import { detectPlatform } from "../../platform/platform.js";
import { deckStorage } from "../../session.js";
import {
  deliverGameLog,
  deliverReplayFile,
  deliverTrackerCsv,
  openReplay,
  pickReplayFile,
  replayErrorKey,
} from "../../replay/replay-files.js";
import { ReplayOpenError } from "../../replay/replay-core.js";
import { exportPastGame, sharePastGame, type PastGameActionDeps } from "../../replay/past-game-actions.js";
import { deliverReplayLink, isAbort, shareFailureKey, shareLinkOf } from "../../replay/replay-share.js";
import { TRACKER_EXPORT_NAMES } from "../../view/game-label-names.js";
import { runTrackerExport } from "../../view/tracker-export.js";
import { introReplay } from "../replay-entry.js";
import { SCENES } from "../keys.js";
import type { Busy } from "./past-games-page-model.js";

/** Links shared this run, by game id: Share never uploads a game twice. */
const sharedUrls = new Map<string, string>();

/** What the actions need of the scene: its visit, its state and its way to say something. */
export interface ActionsHost {
  readonly scene: Phaser.Scene;
  /** True while `visit` is still this scene's visit and it is neither leaving nor gone. */
  current(visit: number): boolean;
  visit(): number;
  leaving(): boolean;
  busy(): Busy | null;
  /** Sets what is running, for `visit` only: a late finish from an earlier visit leaves this one's state alone. */
  setBusy(busy: Busy | null, visit?: number): void;
  say(text: string, ms?: number): void;
  sayIn(visit: number, text: string, ms?: number): void;
  /** The games the list shows now, for the tracker export. */
  rows(): readonly PastGameRow[];
  /** Stops the screen redrawing on a resize: a replay is going onto the board. */
  stopResizing(): void;
}

export class PastGamesActions {
  readonly #h: ActionsHost;

  constructor(host: ActionsHost) {
    this.#h = host;
  }

  /** What a press on a game's action does. */
  act(row: PastGameRow, action: PastGameAction): void {
    const h = this.#h;
    if (h.busy() || h.leaving()) return;
    switch (action) {
      case "watch":
        void this.#watch(row);
        break;
      case "share":
        void this.#share(row);
        break;
      case "export":
      case "log":
        void this.#export(row, action);
        break;
    }
  }

  async #watch(row: PastGameRow): Promise<void> {
    const h = this.#h;
    const visit = h.visit();
    h.setBusy({ id: row.id, action: "watch" }, visit);
    try {
      const host = await openReplay({ kind: "stored", gameId: row.id });
      if (!h.current(visit)) return host.dispose();
      h.stopResizing();
      await introReplay(h.scene, host, SCENES.pastGames);
    } catch (cause) {
      h.setBusy(null, visit);
      h.sayIn(visit, t(replayErrorKey(cause)));
    }
  }

  /** The actions' steps (`replay/past-game-actions.ts`), each standing down once `visit` is no longer this one. */
  #deps(visit: number): PastGameActionDeps {
    return {
      open: (gameId) => openReplay({ kind: "stored", gameId }),
      current: () => this.#h.current(visit),
      deliverFile: deliverReplayFile,
      deliverLog: deliverGameLog,
      shareLink: (bytes) => shareLinkOf(bytes, detectPlatform() !== "web"),
    };
  }

  /** Writes a game's replay file (or its log) and hands it out through the shell's own route. */
  async #export(row: PastGameRow, kind: "export" | "log"): Promise<void> {
    const h = this.#h;
    const visit = h.visit();
    h.setBusy({ id: row.id, action: kind }, visit);
    try {
      const outcome = await exportPastGame(row.id, kind, this.#deps(visit));
      if (outcome.kind === "delivered" && outcome.stopsAt !== null) {
        h.sayIn(visit, t("pastGames.partialLog", { n: outcome.stopsAt }), 8000);
      }
    } catch (cause) {
      if (!isAbort(cause)) {
        console.warn("past game export failed", cause);
        // A game that won't open says why (its packs gone, a damaged save); a write that failed says so.
        h.sayIn(visit, t(cause instanceof ReplayOpenError ? replayErrorKey(cause) : "replay.exportFailed"));
      }
    } finally {
      h.setBusy(null, visit);
    }
  }

  async #share(row: PastGameRow): Promise<void> {
    const h = this.#h;
    const cached = sharedUrls.get(row.id);
    if (cached) {
      await this.#deliverLink(cached);
      return;
    }
    const visit = h.visit();
    h.setBusy({ id: row.id, action: "share" }, visit);
    let url: string | null = null;
    try {
      const shared = await sharePastGame(row.id, this.#deps(visit));
      if (shared.ok === "stale") return;
      if (!shared.ok) {
        h.sayIn(visit, t(shareFailureKey(shared.failure)));
        return;
      }
      url = shared.url;
      sharedUrls.set(row.id, url);
    } catch (cause) {
      if (!isAbort(cause)) {
        console.warn("past game share failed", cause);
        h.sayIn(visit, t(cause instanceof ReplayOpenError ? replayErrorKey(cause) : "replay.link.offline"));
      }
      return;
    } finally {
      h.setBusy(null, visit);
    }
    if (url && h.current(visit)) await this.#deliverLink(url);
  }

  async #deliverLink(url: string): Promise<void> {
    const delivered = await deliverReplayLink(url, t("replay.title"));
    if (delivered === "copied") this.#h.say(t("replay.link.copied"));
    else if (delivered === "manual") this.#h.say(`${t("replay.link.manual")} ${url}`, 30_000);
  }

  /**
   * "Export for MC Tracker (CSV)" (#757): the games the list shows now (the filter's), as one spreadsheet file, handed out
   * by the shell's own route (save dialog, Android Save, share sheet or download).
   */
  async exportTracker(): Promise<void> {
    const h = this.#h;
    if (h.busy() || h.leaving()) return;
    const visit = h.visit();
    const saves = h.rows().map((row) => row.save);
    h.setBusy({ id: "", action: "tracker" }, visit);
    try {
      const outcome = await runTrackerExport({
        saves,
        names: TRACKER_EXPORT_NAMES,
        listDecks: () => deckStorage().list(),
        isCurrent: () => h.current(visit),
        deliver: deliverTrackerCsv,
        now: Date.now,
      });
      if (outcome.kind === "left") return;
      if (outcome.kind === "none") return h.sayIn(visit, t("pastGames.exportTrackerNone"));
      h.sayIn(
        visit,
        outcome.games === 1 ? t("pastGames.exportTrackerOne") : t("pastGames.exportTrackerDone", { n: outcome.games }),
      );
    } catch (cause) {
      if (!isAbort(cause)) {
        console.warn("MC Tracker export failed", cause);
        h.sayIn(visit, t("replay.exportFailed"));
      }
    } finally {
      h.setBusy(null, visit);
    }
  }

  /** "Open a replay file": a replay someone else made, watched on the board; Exit comes back here. */
  async openFile(): Promise<void> {
    const h = this.#h;
    if (h.busy() || h.leaving()) return;
    const visit = h.visit();
    h.setBusy({ id: "", action: "file" }, visit);
    try {
      const picked = await pickReplayFile();
      if (picked === null || !h.current(visit)) return h.setBusy(null, visit);
      if (picked === "unreadable") {
        h.setBusy(null, visit);
        return h.sayIn(visit, t("replay.error.damaged"));
      }
      // From here the file is being put on the board, which Back waits for (the picker itself never holds Back).
      h.setBusy({ id: "", action: "watch" }, visit);
      const host = await openReplay({ kind: "file", bytes: picked });
      if (!h.current(visit)) return host.dispose();
      h.stopResizing();
      await introReplay(h.scene, host, SCENES.pastGames);
    } catch (cause) {
      h.setBusy(null, visit);
      h.sayIn(visit, t(replayErrorKey(cause)));
    }
  }
}
