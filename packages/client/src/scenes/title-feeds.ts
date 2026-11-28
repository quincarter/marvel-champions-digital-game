/**
 * What the Title learns after it is drawn, and holds between redraws: the saved games (Continue and the list), the update
 * state (a newer release, a downloaded update waiting on a restart, the Steam script's record), the web game's old-save
 * notice, the latest release the news bar names and how many rooms are live. Each answer calls `changed`, so the scene
 * words the page again; every read ignores its answer once the scene has gone (`scene.sys.isActive()`).
 */
import type Phaser from "phaser";
import type { SaveMeta } from "../engine/game-storage.js";
import { fetchLiveRooms } from "../platform/live-rooms.js";
import { oldSaveNoticeWanted } from "../platform/old-save-notice.js";
import { detectPlatform } from "../platform/platform.js";
import { lastUpdateFailed, readyUpdateVersion, selfUpdateInfo, type SelfUpdate } from "../platform/self-update.js";
import { onSteamInstallChange, steamInstall, type SteamInstall } from "../platform/steam-install.js";
import { checkForUpdate, latestReleaseVersion, type AvailableUpdate } from "../platform/update-check.js";
import { dismissedUpdateVersion, isUpdateDismissed } from "../platform/update-dismissal.js";
import { appSession } from "../session.js";
import { shouldShowGamesList } from "../view/games-list-model.js";
import { RELEASE_NOTICE_FOLLOW_LATEST, RELEASE_NOTICE_VERSION, noticeVersionOf } from "../view/release-notice.js";

/** How long the saves read may take before the Title says it has not loaded (#871). A slow phone reads well inside it. */
const SAVES_STUCK_MS = 8000;
/** How often the Title asks whether a background update download has finished (`checkReady`). */
const READY_CHECK_MS = 2000;

export class TitleFeeds {
  /** The game in progress when the screen opened, if any: looked up asynchronously, the screen draws without it first. */
  continuable: SaveMeta | null = null;
  /** Every game in progress (several can be, #276), newest first, without guided lesson saves. */
  games: readonly SaveMeta[] = [];
  /** The saved games could not be read: the read failed, or is still pending `SAVES_STUCK_MS` in (iOS, #871). */
  savesStuck = false;
  /** The game the list is asking "Remove this game?" about, or null while it lists. */
  removing: string | null = null;
  removeBusy = false;
  /** Why the last Remove failed, shown in the question until it is answered again. */
  removeError: string | null = null;
  /** A newer release with an installer for this platform (native apps only), once GitHub has answered. */
  update: AvailableUpdate | null = null;
  /** The web game's "Looking for your old save?" banner, until it is closed. */
  oldSave = false;
  /** The Install for Steam script's record of this install, once read. */
  steam: SteamInstall | null = null;
  /** Whether this install updates itself, once the shell has said. */
  selfUpdate: SelfUpdate | null = null;
  /** A downloaded update waiting for the game to restart (or, for the Steam script, to quit), by its version. */
  readyVersion: string | null = null;
  /** The ready version whose banner the player closed this visit: the recheck must not bring it back. */
  readyDismissed: string | null = null;
  /** The last update was downloaded and the game quit for it, but it did not install (the old game started again). */
  updateFailed = false;
  /** The release the news bar names: the pinned one until GitHub names the latest. */
  noticeVersion = RELEASE_NOTICE_VERSION;
  /** How many public rooms were live when the Title opened (one fetch, never polled), or null before an answer. */
  liveCount: number | null = null;
  #liveAsked = false;
  /** Saves reads started, across visits: only the newest one's answer is used. */
  static #savesRead = 0;
  readonly #scene: Phaser.Scene;
  readonly #changed: () => void;

  constructor(scene: Phaser.Scene, changed: () => void) {
    this.#scene = scene;
    this.#changed = changed;
  }

  /** State from a previous visit must not survive into this one (Phaser reuses the scene instance). */
  reset(): void {
    this.continuable = null;
    this.games = [];
    this.removing = null;
    this.removeBusy = false;
    this.removeError = null;
    this.savesStuck = false;
    this.readyDismissed = null;
    this.oldSave = oldSaveNoticeWanted(detectPlatform());
  }

  /** The games the list shows: all of them, or none when Continue already is the only one (`shouldShowGamesList`). */
  listed(): readonly SaveMeta[] {
    return shouldShowGamesList(
      this.games.map((save) => save.id),
      this.continuable?.id ?? null,
    )
      ? this.games
      : [];
  }

  #live(): boolean {
    return this.#scene.sys.isActive();
  }

  /**
   * Reads the newest game (Continue) and every game in progress (the list) again. Only the newest read counts: an older one
   * that lands late, or one from an earlier visit, changes nothing. A read that fails, or is still the newest and pending
   * after `SAVES_STUCK_MS`, puts up the Reload banner (#871) rather than a menu with no games on it that looks normal; a
   * read that works takes it down.
   */
  async refreshSaves(): Promise<void> {
    const read = ++TitleFeeds.#savesRead;
    let settled = false;
    this.#scene.time.delayedCall(SAVES_STUCK_MS, () => {
      if (settled || read !== TitleFeeds.#savesRead || this.savesStuck || !this.#live()) return;
      this.savesStuck = true;
      this.#changed();
    });
    const { latest, games, failed } = await appSession().store.titleSaves();
    settled = true;
    if (read !== TitleFeeds.#savesRead || !this.#live()) return;
    this.continuable = latest;
    this.games = games;
    this.savesStuck = failed;
    // A game asked about that has since gone (synced away, removed on another screen): drop the question.
    if (this.removing !== null && !games.some((save) => save.id === this.removing)) this.removing = null;
    this.#changed();
  }

  /** "Remove" confirmed: the game is retired (counts as played, cannot be resumed) and the list reads again. */
  async removeGame(id: string): Promise<void> {
    if (this.removeBusy) return;
    this.removeBusy = true;
    this.removeError = null;
    // Drawn unavailable while the write is in flight, so a second tap cannot ask twice.
    this.#changed();
    try {
      await appSession().store.retireSave(id);
      this.removing = null;
    } catch (cause) {
      this.removeError = `Could not remove it: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
    this.removeBusy = false;
    if (!this.#live()) return;
    await this.refreshSaves();
  }

  /** Asks whether a downloaded update is waiting, and shows the banner for it (on arrival, and when the panel closes). */
  checkReady(): void {
    void readyUpdateVersion().then((ready) => {
      // A version closed this visit stays closed; a newer one that becomes ready shows.
      const version = ready === this.readyDismissed ? null : ready;
      if (version === this.readyVersion || !this.#live()) return;
      this.readyVersion = version;
      this.#changed();
    });
  }

  /** One fetch of the live rooms when the Online panel is first drawn, never polled; every failure is an empty answer. */
  askLive(): void {
    if (this.#liveAsked) return;
    this.#liveAsked = true;
    void fetchLiveRooms().then((rooms) => {
      if (rooms.length === 0 || !this.#live()) return;
      this.liveCount = rooms.length;
      this.#changed();
    });
  }

  /** Starts every read the screen makes after it opens. The saves read is the scene's (it holds the fade for it). */
  start(): void {
    const unsubscribeSteam = onSteamInstallChange((install) => {
      if (!this.#live()) return;
      this.steam = install;
      this.#changed();
    });
    this.#scene.events.once("shutdown", unsubscribeSteam);
    void steamInstall().then((install) => {
      if (!install || !this.#live()) return;
      this.steam = install;
      this.#changed();
    });
    void selfUpdateInfo().then((info) => {
      if (!info || !this.#live()) return;
      this.selfUpdate = info;
      this.#changed();
    });
    this.checkReady();
    // A download left going in the background can finish while the player stays here: ask again now and then, so the
    // banner turns to "restart to apply" without leaving the screen. (Phaser stops the timer with the scene.)
    if (detectPlatform() === "tauri") {
      this.#scene.time.addEvent({ delay: READY_CHECK_MS, loop: true, callback: () => this.checkReady() });
    }
    void lastUpdateFailed().then((failed) => {
      if (!failed || !this.#live()) return;
      this.updateFailed = true;
      this.#changed();
    });
    // The news bar names the latest release once GitHub has answered.
    if (RELEASE_NOTICE_FOLLOW_LATEST) {
      void latestReleaseVersion().then((latest) => {
        this.noticeVersion = noticeVersionOf(latest);
        if (this.#live()) this.#changed();
      });
    }
    void checkForUpdate().then((update) => {
      // A banner the player closed for this very release stays closed; a newer release brings it back.
      if (!update || !this.#live() || isUpdateDismissed(update.version, dismissedUpdateVersion())) return;
      this.update = update;
      this.#changed();
    });
  }
}
