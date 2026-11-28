/**
 * The Mod Store's state and what it does (`scenes/mod-store.ts` only draws it): which tab, filter and pack are showing, the
 * catalog and the installed packs, and the installs, updates and removals in flight. Nothing here touches Phaser or the
 * page: the scene says how to redraw, show the heads-up and move the focus through `ModStoreHooks`.
 *
 * Whether a pack can be installed is `packs/pack-state.ts`'s; which packs a tab shows and what the buttons are is
 * `view/mod-store-model.ts`'s; the install itself, in a worker, is `packs/install-pack.ts`'s.
 */
import type { PackIndex } from "@mc/content";
import { loadCatalog } from "../../packs/catalog.js";
import { notePackUpdates } from "../../packs/pack-updates.js";
import { refreshUnlocks } from "../../progression/progression.js";
import { installPack, type InstallProgress } from "../../packs/install-pack.js";
import { refreshActivePacks, sharedPackStore } from "../../packs/active-packs.js";
import type { InstalledPack, PackStorage } from "../../packs/pack-store.js";
import { SUPPORTED_DSL_FEATURES } from "../../packs/supported-features.js";
import { CLIENT_VERSION } from "../../version.js";
import { modNoticeSeen } from "../../platform/mod-notice-seen.js";
import { showNoticeBeforeInstall } from "../../view/mod-notice.js";
import { LatestRead } from "../../view/latest-read.js";
import {
  MOD_STORE_TABS,
  errorTextOf,
  tilesOf,
  type ModStoreContext,
  type ModStoreTab,
  type ModStoreTile,
  type PackAction,
} from "../../view/mod-store-model.js";
import {
  EMPTY_FILTER,
  filterTiles,
  isFiltering,
  toggleTag,
  type CreatorCredit,
  type ModStoreFilter,
} from "../../view/mod-store-browse.js";
import {
  failedIdsOf,
  failureOf,
  nextOf,
  resultOf,
  startRun,
  stepRun,
  updateAllBarOf,
  updateAllQueueOf,
  type UpdateAllBar,
  type UpdateAllResult,
  type UpdateAllRun,
} from "../../view/mod-store-update-all.js";

/** One install in flight, or the last one's failure, for the pack whose page is open. */
export interface InstallState {
  readonly id: string;
  readonly progress: InstallProgress | null;
  readonly error: string | null;
}

/** How the controller reaches the scene: redrawing, the heads-up, the focus, and a pause. */
export interface ModStoreHooks {
  /** Draw now (a press changed what shows). */
  draw(): void;
  /** Draw once a frame, however many asked (a picture or a progress report arrived). */
  drawSoon(): void;
  /** Open the heads-up about mods; `onClose` carries on with what it held back. */
  showNotice(onClose?: () => void): void;
  focusKey(key: string): void;
  /** A pad or keyboard player has the focus ring on something. */
  hasFocus(): boolean;
  /** Leaves the store (Back from the browse view). */
  leave(): void;
  later(ms: number, run: () => void): void;
}

export interface ModStoreStart {
  readonly catalogUrl?: string | undefined;
  readonly packId?: string | undefined;
}

export class ModStoreController {
  tab: ModStoreTab = "all";
  /** A phone's search box, sort and chips are showing (`toggleFinders`). */
  findersOpen = false;
  /** The search box, tag chips, creator and sort (`view/mod-store-browse.ts`), kept across tabs and visits. */
  filter: ModStoreFilter = EMPTY_FILTER;
  packId: string | null = null;
  index: PackIndex | null = null;
  offline = false;
  status: "loading" | "ready" | "failed" = "loading";
  installed = new Map<string, InstalledPack>();
  install: InstallState | null = null;
  confirmingRemove = false;
  error: string | null = null;
  /** A removal is running: the buttons stay disabled until it ends. */
  removing = false;
  /** Update all (issue #957): the run going now, and how the last one ended. A run carries on across visits. */
  updateRun: UpdateAllRun | null = null;
  updateResult: UpdateAllResult | null = null;
  /** Goes up whenever a new filter sends the grid back to its top. */
  scrollFrom = 0;
  // The app's one store (`packs/active-packs.ts`), shared with the pool wiring. Not handled: another tab upgrading the
  // database (`onversionchange`), which `IdbPackStore` would have to close on.
  readonly store: PackStorage = sharedPackStore();
  #catalogUrl: string | undefined;
  /** Bumped for every install; only the newest run writes state, so a stale one finishing late changes nothing. */
  #installToken = 0;
  /**
   * The installed-pack reads (`view/latest-read.ts`): a load started before or during an Update all's refresh never
   * puts an older list back over a newer one.
   */
  readonly #installedReads = new LatestRead();
  readonly #hooks: ModStoreHooks;

  constructor(hooks: ModStoreHooks) {
    this.#hooks = hooks;
  }

  /** Each opening of the store. The controller is made once, so an install still running from an earlier visit carries on. */
  begin(start: ModStoreStart): void {
    this.#catalogUrl = start.catalogUrl;
    this.packId = start.packId ?? null;
    // Only a stale failure goes.
    if (this.install?.error) this.install = null;
    // How the last Update all ended is news for the visit it ran in; a run still going carries on.
    if (!this.updateRun) this.updateResult = null;
    this.confirmingRemove = false;
    this.removing = false;
    this.error = null;
    this.status = "loading";
  }

  context(): ModStoreContext {
    return { appVersion: CLIENT_VERSION, supportedDslFeatures: SUPPORTED_DSL_FEATURES, installed: this.installed };
  }

  tilesOf(tab: ModStoreTab): readonly ModStoreTile[] {
    return tilesOf(this.index, this.context(), tab);
  }

  /** The tile of the pack whose page is open, or null. */
  openTile(): ModStoreTile | null {
    if (this.packId === null) return null;
    const tile = this.tilesOf("all").find((one) => one.id === this.packId) ?? null;
    // While the catalog loads a page opened by a dev jump has no tile yet: browse view, keep the id.
    if (!tile && this.status !== "loading") this.packId = null;
    return tile;
  }

  // ---- Loading -------------------------------------------------------------------------------------------------

  async load(): Promise<void> {
    this.status = "loading";
    try {
      const [catalog, read] = await Promise.all([
        // A dev override must never overwrite the real catalog's saved copy.
        loadCatalog(this.#catalogUrl ? { url: this.#catalogUrl, storage: null } : {}),
        this.#readInstalled(),
      ]);
      // `null` when the read failed: the store shows nothing installed, but the Title's count is left as it was.
      const installed = read.installed;
      this.index = catalog.index;
      this.offline = catalog.offline;
      // A newer read was kept while this load waited (an update landed): its list stands, and the badge is counted
      // from it too, never from this older read.
      const current = this.#keep(read.ticket, installed);
      // A dev catalog override is not the real store's, so it never sets the Title's update badge.
      if (!this.#catalogUrl && installed) {
        notePackUpdates(catalog.index, current ? installed : [...this.installed.values()], catalog.offline);
      }
      this.status = "ready";
    } catch {
      // No network and no saved copy: still show what is installed.
      const read = await this.#readInstalled();
      this.#keep(read.ticket, read.installed);
      this.status = "failed";
    }
    this.#hooks.drawSoon();
  }

  /** Try again after a failed load, from a tap or the pad: one load at a time. */
  retry(): void {
    if (this.status === "loading") return;
    this.status = "loading";
    this.#hooks.draw();
    void this.load();
  }

  /**
   * Reads the installed packs with a ticket taken as the read is issued; `null` when it failed. `afterChange` (after an
   * install, update or removal) fences out every earlier read.
   */
  async #readInstalled(afterChange = false): Promise<{ ticket: number; installed: readonly InstalledPack[] | null }> {
    const ticket = this.#installedReads.issue();
    if (afterChange) this.#installedReads.fence(ticket);
    const installed = await this.store.list().catch(() => null);
    return { ticket, installed };
  }

  /**
   * Keeps a read's list unless a read issued after it was kept already; true when kept. A failed read (`null`) keeps
   * nothing and moves nothing on: the last list read stands, and an older read that succeeds later may still be kept.
   */
  #keep(ticket: number, installed: readonly InstalledPack[] | null): boolean {
    if (installed === null || !this.#installedReads.keep(ticket)) return false;
    this.installed = new Map(installed.map((pack) => [pack.id, pack]));
    return true;
  }

  async #refreshInstalled(retry = true): Promise<void> {
    // Installed packs join the running game's pool (not awaited: the load is validated in a worker), after every change
    // to the store, whatever becomes of the list read below.
    void refreshActivePacks();
    // The store has changed: no read issued before this one may be kept now, even if this one fails.
    const { ticket, installed } = await this.#readInstalled(true);
    if (installed === null && retry) {
      // A failed read leaves the last list standing (stale): read once more shortly.
      this.#hooks.later(1000, () => void this.#refreshInstalled(false));
      return;
    }
    // A failed read, or one a newer read has already replaced, leaves the list (and the badge) to that one.
    if (!this.#keep(ticket, installed)) return;
    if (!this.#catalogUrl && installed) notePackUpdates(this.index ?? undefined, installed, this.offline);
    // The retry lands on its own, after the install has redrawn from the old list: draw the new one.
    if (!retry) this.#hooks.drawSoon();
  }

  // ---- Browsing ------------------------------------------------------------------------------------------------

  /** Back from a pack's page returns to the list; from the list, the store is left. */
  back(): void {
    if (this.packId !== null) {
      const opened = this.packId;
      const hadFocus = this.#hooks.hasFocus();
      this.packId = null;
      this.confirmingRemove = false;
      this.error = null;
      this.#hooks.draw();
      // Back from a page puts a pad or keyboard player on the tile they opened.
      if (hadFocus) this.#hooks.focusKey(`tile:${opened}`);
      return;
    }
    this.#hooks.leave();
  }

  select(tab: ModStoreTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.#hooks.draw();
  }

  /** A new filter redraws the list from its top (a list scrolled down a long tab would show nothing). */
  setFilter(filter: ModStoreFilter): void {
    this.filter = filter;
    this.scrollFrom += 1;
    this.#hooks.drawSoon();
  }

  /** A chip: the creator's (`creator`, undoes that pick) or a tag's (`tag:<name>`). */
  pressChip(id: string): void {
    if (id === "creator") this.setFilter({ ...this.filter, creator: null });
    else if (id.startsWith("tag:")) this.setFilter({ ...this.filter, tags: toggleTag(this.filter.tags, id.slice(4)) });
  }

  clearFilter(): void {
    this.setFilter({ ...EMPTY_FILTER, sort: this.filter.sort });
  }

  toggleSort(): void {
    this.setFilter({ ...this.filter, sort: this.filter.sort === "name" ? "newest" : "name" });
  }

  /** A creator picked on Credits: every tab of theirs, from All. */
  showCreator(credit: Pick<CreatorCredit, "name">): void {
    this.filter = { ...this.filter, creator: credit.name };
    this.tab = "all";
    this.scrollFrom += 1;
    this.#hooks.draw();
    this.#hooks.focusKey("tab:all");
  }

  stepTab(direction: 1 | -1): void {
    if (this.packId !== null) return;
    const at = MOD_STORE_TABS.findIndex((tab) => tab.id === this.tab);
    const next = MOD_STORE_TABS[at + direction];
    if (next) this.select(next.id);
  }

  /** A phone's magnifier: the finders show, or fold away with whatever they narrowed. Returns whether they are now open. */
  toggleFinders(): boolean {
    const open = this.findersOpen || isFiltering(this.filter);
    this.findersOpen = !open;
    if (open) this.filter = { ...EMPTY_FILTER, sort: this.filter.sort };
    this.#hooks.draw();
    return !open;
  }

  openPack(id: string): void {
    this.packId = id;
    this.confirmingRemove = false;
    this.error = null;
    this.#hooks.draw();
  }

  // ---- Installing ----------------------------------------------------------------------------------------------

  act(tile: ModStoreTile, action: PackAction): void {
    if (!action.enabled) return;
    if (action.id === "remove") {
      this.confirmingRemove = true;
      this.#hooks.draw();
    } else if (action.id === "cancel-remove") {
      this.confirmingRemove = false;
      this.#hooks.draw();
    } else if (action.id === "confirm-remove") {
      void this.#remove(tile);
    } else if (showNoticeBeforeInstall(modNoticeSeen())) {
      // An install the player never saw the warning for waits for it.
      this.#hooks.showNotice(() => void this.#installTile(tile));
    } else {
      void this.#installTile(tile);
    }
  }

  /** Installs or updates one pack; true once it is in. */
  async #installTile(tile: Pick<ModStoreTile, "id">): Promise<boolean> {
    const entry = this.index?.packs.find((one) => one.id === tile.id);
    // Only a RUNNING install blocks another; a failed one's error is stale the moment a new run starts.
    if (!entry || (this.install && this.install.error === null)) return false;
    const token = ++this.#installToken;
    const installedVersion = this.installed.get(tile.id)?.version;
    this.install = { id: tile.id, progress: null, error: null };
    this.#hooks.draw();
    try {
      await installPack(entry, {
        store: this.store,
        onProgress: (progress) => {
          if (token !== this.#installToken) return;
          this.install = { id: tile.id, progress, error: null };
          this.#hooks.drawSoon();
        },
      });
      if (token !== this.#installToken) return false;
      await this.#refreshInstalled();
      // The install is noted for the "install a mod" achievements (docs/custom-content-packs.md section 11.12).
      void refreshUnlocks().catch(() => false);
      if (token !== this.#installToken) return false;
      this.install = null;
      this.#hooks.drawSoon();
      return true;
    } catch (error) {
      if (token !== this.#installToken) return false;
      // A failed install leaves nothing installed (§7.2.3), and a failed update leaves the old version: say so.
      this.install = { id: tile.id, progress: null, error: errorTextOf(error, installedVersion) };
      this.#hooks.drawSoon();
      return false;
    }
  }

  /** An install or a removal is running (Update all's own included). */
  busy(): boolean {
    return (this.install !== null && this.install.error === null) || this.removing || this.updateRun !== null;
  }

  async #remove(tile: ModStoreTile): Promise<void> {
    this.confirmingRemove = false;
    this.removing = true;
    this.#hooks.draw();
    try {
      await this.store.remove(tile.id);
      this.error = null;
      await this.#refreshInstalled();
      // A pack the store no longer lists has nothing left to show once it is gone.
      if (!this.index?.packs.some((entry) => entry.id === tile.id)) this.packId = null;
    } catch (error) {
      this.error = errorTextOf(error);
    }
    this.removing = false;
    this.#hooks.drawSoon();
  }

  // ---- Update all (issue #957) ---------------------------------------------------------------------------------

  /** Every installed pack with an update, one after another. A failed pack keeps its old version; Stop ends the run after the one going. */
  async updateAll(): Promise<void> {
    if (this.busy()) return;
    const queue = updateAllQueueOf(this.tilesOf("all"));
    if (queue.length === 0) return;
    if (showNoticeBeforeInstall(modNoticeSeen())) {
      this.#hooks.showNotice(() => void this.updateAll());
      return;
    }
    this.updateResult = null;
    this.updateRun = startRun(queue);
    this.#hooks.drawSoon();
    for (let item = nextOf(this.updateRun); item; item = nextOf(this.updateRun)) {
      const ok = await this.#installTile(item);
      // Why it failed, kept with the result: the next pack's install replaces `install`.
      const error = !ok && this.install?.id === item.id ? this.install.error : null;
      this.updateRun = stepRun(this.updateRun, ok, error);
      this.#hooks.drawSoon();
    }
    this.updateResult = resultOf(this.updateRun);
    this.updateRun = null;
    this.#hooks.drawSoon();
  }

  stopUpdateAll(): void {
    if (!this.updateRun || this.updateRun.stopping) return;
    this.updateRun = { ...this.updateRun, stopping: true };
    this.#hooks.drawSoon();
  }

  /**
   * The install state a pack's page shows: its own install or update, else (no install of it since) why the last
   * Update all could not update it, until a retry lands.
   */
  installStateFor(id: string): InstallState | null {
    if (this.install?.id === id) return this.install;
    const error = failureOf(this.updateResult, updateAllQueueOf(this.tilesOf("all")), id);
    return error ? { id, progress: null, error } : null;
  }

  /**
   * Whether a pack's page holds its buttons: its own install or update is running, or a removal or Update all is (the pack
   * Update all is on shows its own progress).
   */
  pageBusy(id: string): boolean {
    const running = this.installStateFor(id);
    return (running !== null && running.error === null) || this.removing || this.updateRun !== null;
  }

  /** The packs the last Update all could not update that still can be: their tiles say so. */
  failedIds(): ReadonlySet<string> {
    if (!this.updateResult) return new Set();
    return failedIdsOf(this.updateResult, updateAllQueueOf(this.tilesOf("all")));
  }

  updateAllBar(): UpdateAllBar | null {
    const run = this.updateRun;
    const current = run ? run.queue[run.done]?.id : undefined;
    return updateAllBarOf({
      pending: updateAllQueueOf(this.tilesOf("all")),
      run,
      progress: current !== undefined && this.install?.id === current ? this.install.progress : null,
      result: this.updateResult,
      busy: this.busy(),
      shown: new Set(filterTiles(this.tilesOf(this.tab), this.filter).map((tile) => tile.id)),
    });
  }

  /**
   * "Show them" on the Update all bar: failed packs the tab or the search hid. Installed lists every one of them, so it
   * opens with the search, tags and creator cleared (the sort stays), from its top.
   */
  showFailed(): void {
    this.filter = { ...EMPTY_FILTER, sort: this.filter.sort };
    this.findersOpen = false;
    this.tab = "installed";
    this.scrollFrom += 1;
    this.#hooks.draw();
  }
}
