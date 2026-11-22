/**
 * Title > Mod Store (docs/custom-content-packs.md §11.6): browse the catalog of community packs, open one, install,
 * update or remove it.
 *
 * Two views in one scene. **Browse** is six tabs (All, Heroes, Scenarios, Extras, Installed, Credits) over a grid of
 * pack tiles, with a search box, a sort and tag chips over it (issue #734) and an offline notice when the catalog is the
 * saved copy; each tile leads with the pack's featured card (thumbnail, picture or generated face from its
 * `preview.json`). Credits lists the creators instead, and picking one shows their packs. **Pack** is one pack's page:
 * the featured card(s), header, scrolling text (description, credits, permission, requirement), a gallery of the pack's
 * cards (from the preview before an install, from the installed pack after), a status line (progress bar or error) and
 * the buttons its state offers.
 *
 * This scene only draws. Which packs a tab shows, what the buttons are, progress words and error words are
 * `view/mod-store-model.ts`'s; whether a pack can be installed is `packs/pack-state.ts`'s; the install itself, in a
 * worker, is `packs/install-pack.ts`'s. Every press is an `McButton`, a tab, or the list's own row tap, so a swipe that
 * ends over a control fires nothing (CLAUDE.md, no tap on finger lift), and no control sits on a scrolling region: the
 * pack page's buttons are below its text panel, not over it.
 *
 * Pad and keyboard: Back, the tabs (LB / RB step them), the search box, sort and chips, then every tile; on a pack page,
 * Back then its buttons.
 */
import Phaser from "phaser";
import {
  customCardPrefix,
  officialCardsByPictureCode,
  parsePackAchievements,
  parsePackCardImagePath,
  type AnyCard,
  type PackIndex,
} from "@mc/content";
import { accent, hit, ink, motion, signal, surface, typeRole } from "../tokens.js";
import {
  CAMPAIGN_TOP_BAR,
  bangers,
  campaignFrame,
  drawPicture,
  drawTopBar,
  drawnPictureKey,
  heroPicture,
  isPhoneWidth,
  preloadDrawnPicture,
} from "../ui/campaign-chrome.js";
import { isPictureSettled, onPictureLoadFailed } from "../art/pictures.js";
import { PictureWait, settleWithin } from "../ui/picture-wait.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { GlyphHints, specsForShortcuts } from "../ui/glyph-hints.js";
import { McButton, McScrollPanel, McTabs, McTextInput, fitText, fitWrapped } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { fadeScreenIn, goToScreen, holdScreenFor } from "../ui/transitions.js";
import { ListScroll } from "../view/list-scroll.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { extrasRowCount, extrasTileAt, extrasTileRect, type ExtrasGrid } from "../view/extras-model.js";
import {
  LOADING_TEXT,
  LOAD_FAILED_TEXT,
  MOD_STORE_TABS,
  modStoreTabLabel,
  modStoreTabRowsOf,
  OFFLINE_NOTICE,
  actionsOf,
  emptyTextOf,
  errorTextOf,
  modStoreGridOf,
  featuredFacesOf,
  packPageOf,
  progressOf,
  coverOf,
  tileArtOf,
  tilesOf,
  type ModStoreContext,
  type ModStoreTab,
  type ModStoreTile,
  type PackAction,
  type PackCover,
} from "../view/mod-store-model.js";
import {
  EMPTY_FILTER,
  creditLineOf,
  creditsOf,
  filterTiles,
  isFiltering,
  packChips,
  packCountText,
  resultCountText,
  tagChipsOf,
  toggleTag,
  type CreatorCredit,
  type ModStoreFilter,
} from "../view/mod-store-browse.js";
import { t } from "../i18n/translate.js";
import { drawSearchField, drawSearchToggle } from "./roster-panel.js";
import { McChipRail } from "../ui/chip-rail.js";
import { RailScroll } from "../view/rail-scroll.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { loadCatalog } from "../packs/catalog.js";
import { notePackUpdates } from "../packs/pack-updates.js";
import { LatestRead } from "../view/latest-read.js";
import {
  failedIdsOf,
  failureOf,
  nextOf,
  resultOf,
  startRun,
  stepRun,
  updateAllBarOf,
  updateAllQueueOf,
  type UpdateAllAction,
  type UpdateAllBar,
  type UpdateAllResult,
  type UpdateAllRun,
} from "../view/mod-store-update-all.js";
import { refreshUnlocks } from "../progression/progression.js";
import { installPack, type InstallProgress } from "../packs/install-pack.js";
import {
  activePackStatuses,
  onActivePackStatuses,
  refreshActivePacks,
  sharedPackStore,
} from "../packs/active-packs.js";
import { loadedPacks } from "../packs/pack-registry.js";
import {
  artFor,
  artLanguageNow,
  defaultFaceFor,
  packPictureCodes,
  type ArtSource,
  type CardFace,
} from "../art/art-source.js";
import { onPreviewArtArrived, previewPictureFor } from "../art/preview-art.js";
import { drawGeneratedFace, faceModelOf, statLineOf } from "../ui/generated-card-face.js";
import { currentCardsById, currentPool } from "../content/pool.js";
import { onPreviewArrived, previewInMemory, requestPreview } from "../packs/preview-client.js";
import { previewPictureUrl, type ParsedPackPreview } from "../packs/pack-preview.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { houseRuleFaceFor, packFileArt } from "../art/pack-art.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import {
  GALLERY_HEADING_HEIGHT,
  galleryCardCount,
  galleryCountText,
  galleryGridOf,
  galleryPictureHeight,
  galleryRowsOf,
  gallerySectionsOf,
  loadStatusOf,
  loadStatusText,
  packPageLayoutOf,
  type GalleryCard,
  type GalleryRow,
  type GallerySection,
} from "../view/pack-gallery-model.js";
import type { InspectData } from "./inspect.js";
import type { InstalledPack, PackStorage } from "../packs/pack-store.js";
import { SUPPORTED_DSL_FEATURES } from "../packs/supported-features.js";
import { CLIENT_VERSION } from "../version.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { modNoticeSeen } from "../platform/mod-notice-seen.js";
import {
  MOD_NOTICE_LINES,
  MOD_STORE_BETA_CAPTION,
  modNoticeLayoutOf,
  modNoticeControlLabelOf,
  showNoticeBeforeInstall,
  showNoticeOnOpen,
} from "../view/mod-notice.js";
import type { ModNoticeData } from "./mod-notice.js";

export interface ModStoreSceneData {
  /** Dev only (`?screen=mod-store&catalog=`): a catalog address other than the store's own. */
  readonly catalogUrl?: string;
  /** Opens straight onto this pack's page (dev jumps). */
  readonly packId?: string;
}

const TAB_HEIGHT = 44;
/** The search row and each chip row. */
const CONTROL_HEIGHT = 40;
const CHIP_GAP = 8;
const campaignTopBar = (phone: boolean): number => (phone ? CAMPAIGN_TOP_BAR.phone : CAMPAIGN_TOP_BAR.wide);
const SCROLLBAR = 12;

/** One install in flight, or the last one's failure, for the pack whose page is open. */
interface InstallState {
  readonly id: string;
  readonly progress: InstallProgress | null;
  readonly error: string | null;
}

export class ModStoreScene extends Phaser.Scene {
  #tab: ModStoreTab = "all";
  /** A phone's search box, sort and chips are showing (`#drawPhoneBrowse`). */
  #findersOpen = false;
  /** A phone's tab row: where it was swiped to, kept across redraws. */
  readonly #tabRail = new RailScroll();
  #rails: McChipRail[] = [];
  /** The search box, tag chips, creator and sort (`view/mod-store-browse.ts`), kept across tabs and visits. */
  #filter: ModStoreFilter = EMPTY_FILTER;
  /** The search box: a DOM field kept across redraws (`scenes/seats.ts`'s pattern), so typing keeps its caret. */
  #searchInput: McTextInput | null = null;
  #packId: string | null = null;
  #catalogUrl: string | undefined;
  #index: PackIndex | null = null;
  #offline = false;
  #status: "loading" | "ready" | "failed" = "loading";
  #installed = new Map<string, InstalledPack>();
  #install: InstallState | null = null;
  #confirmingRemove = false;
  #error: string | null = null;
  // The app's one store (`packs/active-packs.ts`), shared with the pool wiring. Not handled: another tab upgrading the
  // database (`onversionchange`), which `IdbPackStore` would have to close on.
  readonly #store: PackStorage = sharedPackStore();
  /** Bumped for every install; only the newest run writes state, so a stale one finishing late changes nothing. */
  #installToken = 0;
  /** A removal is running: the buttons stay disabled until it ends. */
  #removing = false;
  /** Update all (issue #957): the run going now, and how the last one ended. A run carries on across visits. */
  #updateRun: UpdateAllRun | null = null;
  #updateResult: UpdateAllResult | null = null;
  /** The Update all bar's words and progress bar, so a progress report redraws only these. */
  #updateBarObjects: Phaser.GameObjects.GameObject[] = [];
  #updateBarRect: Rect | null = null;
  /**
   * The installed-pack reads (`view/latest-read.ts`): a load started before or during an Update all's refresh never
   * puts an older list back over a newer one.
   */
  readonly #installedReads = new LatestRead();
  /** The progress bar's objects, so a report redraws only these (the text panel keeps its scroll position). */
  #statusObjects: Phaser.GameObjects.GameObject[] = [];
  #statusRect: Rect | null = null;
  #statusQueued = false;
  #requirement: string | undefined;
  readonly #scrolls = new Map<ModStoreTab, ListScroll>();
  #buttons: McButton[] = [];
  #tabs: McTabs[] = [];
  #list: McVirtualList | null = null;
  #panel: McScrollPanel | null = null;
  /** The pack page's card gallery (an installed, loaded pack only), its rect and the cards in it, for hover and Inspect. */
  #gallery: McVirtualList | null = null;
  #galleryRect: Rect | null = null;
  #galleryGrid: ReturnType<typeof galleryGridOf> | null = null;
  #galleryRows: readonly GalleryRow[] = [];
  /** What the open page's gallery draws from: its pack, preview, picture base and every card shown by id. */
  #pageContext: {
    readonly packId: string;
    readonly preview: ParsedPackPreview | null;
    readonly base: string | undefined;
    readonly records: ReadonlyMap<string, AnyCard>;
    /** A house-rule pack: its gallery tiles are official faces, drawn in the rule's rebuilt pictures. */
    readonly rule: boolean;
  } | null = null;
  /** The featured faces on the page, for the hover popover. */
  #faceHovers: { rect: Rect; card: AnyCard; face: CardFace; art: ArtSource | undefined }[] = [];
  readonly #galleryScroll = new ListScroll();
  /** The desktop hover popover over the gallery's tiles (`ui/card-hover-preview.ts`), as in the set sheet. */
  #hover: HoverPreview | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #obstacles: Rect[] = [];
  #redrawQueued = false;
  #alive = false;

  constructor() {
    super(SCENES.modStore);
  }

  create(data: ModStoreSceneData = {}): void {
    this.#alive = true;
    this.#redrawQueued = false;
    this.#catalogUrl = data.catalogUrl;
    this.#packId = data.packId ?? null;
    // An install still running from an earlier visit carries on (the scene instance is reused); only a stale failure goes.
    if (this.#install?.error) this.#install = null;
    // How the last Update all ended is news for the visit it ran in; a run still going carries on.
    if (!this.#updateRun) this.#updateResult = null;
    this.#confirmingRemove = false;
    this.#removing = false;
    this.#statusQueued = false;
    this.#error = null;
    this.#status = "loading";
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#hints = new GlyphHints(this, () => this.#obstacles);
    // A pad that put the caret in the search box can take it out again (B, A or Start). Bound before the route, so the
    // A that focuses the field is not also read as the press that leaves it (`text-field-escape.ts`).
    bindTextFieldEscape(
      this,
      () => this.#searchInput,
      () => this.#overlayUp(),
    );
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#back(),
      // X (G / H on the keyboard) reopens the heads-up about mods.
      onToggle: () => this.#showNotice(),
      onTab: (direction) => this.#stepTab(direction),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onScroll: (_dx, dy) => {
        this.#list?.scrollByPx(dy);
        this.#gallery?.scrollByPx(dy);
        this.#panel?.scrollByPx(dy);
      },
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#searchInput?.focused ?? false),
    });
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    // A pack finishing its load (after an install, or at boot) and a picture arriving both redraw the page.
    const offStatuses = onActivePackStatuses(() => this.#requestRedraw());
    const offArrived = cardArt(this).onArrived(() => this.#requestRedraw());
    // A preview or a pack picture arriving from the pack host redraws what shows it.
    const offPreview = onPreviewArrived(() => this.#requestRedraw());
    const offPictures = onPreviewArtArrived(() => this.#requestRedraw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      offStatuses();
      offArrived();
      offPreview();
      offPictures();
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", this.#draw, this);
      this.#hints.dispose();
      this.#destroyWidgets();
      this.#searchInput?.destroy();
      this.#searchInput = null;
    });
    this.#draw();
    fadeScreenIn(this);
    // The catalog (usually the saved copy, at once) before the store fades in, not a "Loading" page swapped for it.
    holdScreenFor(this, this.#load());
    // The first time the store opens, the heads-up about mods shows over it (remembered once answered), once its two
    // portraits are in: they load while the store is held, so the notice opens with them rather than with letters
    // that turn into faces a moment later (issue #716). A portrait that never loads holds it no longer than the hold.
    // Tied to this visit, and asked again when they are in: the player may have opened the notice (About mods) and
    // answered it meanwhile, or left the store and come back.
    if (showNoticeOnOpen(modNoticeSeen())) {
      const visit = ++this.#visit;
      const portraits = settleWithin(this.#loadNoticePortraits(), motion.screenHoldMaxMs);
      holdScreenFor(this, portraits);
      void portraits.then(() => {
        if (visit === this.#visit && this.sys.isActive() && showNoticeOnOpen(modNoticeSeen())) this.#showNotice();
      });
    }
  }

  /** The mods notice's speaker portraits, loading: settles once both are in the texture manager. */
  #loadNoticePortraits(): Promise<void> {
    const wait = new PictureWait((key) => isPictureSettled(this, key));
    // A portrait that fails to load is settled too, so the notice opens without it rather than at the cap.
    const offFailures = onPictureLoadFailed(wait.arrived);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offFailures);
    const { width, height } = this.scale.gameSize;
    const layout = modNoticeLayoutOf(width, height, isPhoneWidth(formFactorFor(width, height)));
    MOD_NOTICE_LINES.forEach((line, index) => {
      const picture = heroPicture(line.identityId);
      const portrait = layout.speakers[index]?.portrait;
      if (!picture || !portrait) return;
      // The full picture the notice bakes its round portrait from (`#roundPortrait` in `scenes/mod-notice.ts`).
      if (preloadDrawnPicture(this, picture, portrait, wait.arrived) === null) {
        const key = drawnPictureKey(picture, portrait);
        if (key) wait.expect(key);
      }
    });
    const settled = wait.settled();
    void settled.then(offFailures);
    return settled;
  }

  /** Each opening of the store: the first-visit notice, opened once its portraits are in, belongs to one of them. */
  #visit = 0;

  /** Inspect or the mods notice is over the store: the list's hand cursor stands down. */
  #overlayUp(): boolean {
    return this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.modNotice);
  }

  /** Deadpool and Spider-Man's heads-up about mods, over the store; `onClose` carries on with what it held back. */
  #showNotice(onClose?: () => void): void {
    if (this.scene.isActive(SCENES.modNotice)) return;
    this.scene.launch(SCENES.modNotice, {
      from: SCENES.modStore,
      ...(onClose ? { onClose } : {}),
    } satisfies ModNoticeData);
    this.scene.bringToTop(SCENES.modNotice);
  }

  async #load(): Promise<void> {
    this.#status = "loading";
    try {
      const [catalog, read] = await Promise.all([
        // A dev override must never overwrite the real catalog's saved copy.
        loadCatalog(this.#catalogUrl ? { url: this.#catalogUrl, storage: null } : {}),
        this.#readInstalled(),
      ]);
      // `null` when the read failed: the store shows nothing installed, but the Title's count is left as it was.
      const installed = read.installed;
      this.#index = catalog.index;
      this.#offline = catalog.offline;
      // A newer read was kept while this load waited (an update landed): its list stands, and the badge is counted
      // from it too, never from this older read.
      const current = this.#keep(read.ticket, installed);
      // A dev catalog override is not the real store's, so it never sets the Title's update badge.
      if (!this.#catalogUrl && installed) {
        notePackUpdates(catalog.index, current ? installed : [...this.#installed.values()], catalog.offline);
      }
      this.#status = "ready";
    } catch {
      // No network and no saved copy: still show what is installed.
      const read = await this.#readInstalled();
      this.#keep(read.ticket, read.installed);
      this.#status = "failed";
    }
    this.#requestRedraw();
  }

  /** Try again after a failed load, from a tap or the pad: one load at a time. */
  #retry(): void {
    if (this.#status === "loading") return;
    this.#status = "loading";
    this.#draw();
    void this.#load();
  }

  /**
   * Reads the installed packs with a ticket taken as the read is issued; `null` when it failed. `afterChange` (after an
   * install, update or removal) fences out every earlier read.
   */
  async #readInstalled(afterChange = false): Promise<{ ticket: number; installed: readonly InstalledPack[] | null }> {
    const ticket = this.#installedReads.issue();
    if (afterChange) this.#installedReads.fence(ticket);
    const installed = await this.#store.list().catch(() => null);
    return { ticket, installed };
  }

  /**
   * Keeps a read's list unless a read issued after it was kept already; true when kept. A failed read (`null`) keeps
   * nothing and moves nothing on: the last list read stands, and an older read that succeeds later may still be kept.
   */
  #keep(ticket: number, installed: readonly InstalledPack[] | null): boolean {
    if (installed === null || !this.#installedReads.keep(ticket)) return false;
    this.#installed = new Map(installed.map((pack) => [pack.id, pack]));
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
      this.time.delayedCall(1000, () => void this.#refreshInstalled(false));
      return;
    }
    // A failed read, or one a newer read has already replaced, leaves the list (and the badge) to that one.
    if (!this.#keep(ticket, installed)) return;
    if (!this.#catalogUrl && installed) notePackUpdates(this.#index ?? undefined, installed, this.#offline);
    // The retry lands on its own, after the install has redrawn from the old list: draw the new one.
    if (!retry) this.#requestRedraw();
  }

  #context(): ModStoreContext {
    return { appVersion: CLIENT_VERSION, supportedDslFeatures: SUPPORTED_DSL_FEATURES, installed: this.#installed };
  }

  #scroll(tab: ModStoreTab): ListScroll {
    let scroll = this.#scrolls.get(tab);
    if (!scroll) {
      scroll = new ListScroll();
      this.#scrolls.set(tab, scroll);
    }
    return scroll;
  }

  #back(): void {
    if (this.#packId !== null) {
      const opened = this.#packId;
      const hadFocus = this.#route?.focused != null;
      this.#packId = null;
      this.#confirmingRemove = false;
      this.#error = null;
      this.#draw();
      // Back from a page puts a pad or keyboard player on the tile they opened.
      if (hadFocus) this.#route?.focusKey(`tile:${opened}`);
      return;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.title);
  }

  #select(tab: ModStoreTab): void {
    if (tab === this.#tab) return;
    this.#tab = tab;
    this.#draw();
  }

  /** A new filter redraws the list from its top (a list scrolled down a long tab would show nothing). */
  #setFilter(filter: ModStoreFilter): void {
    this.#filter = filter;
    this.#scroll(this.#tab).reset();
    this.#requestRedraw();
  }

  /** A creator picked on Credits: every tab of theirs, from All. */
  #showCreator(credit: CreatorCredit): void {
    this.#filter = { ...this.#filter, creator: credit.name };
    this.#tab = "all";
    this.#scroll("all").reset();
    this.#draw();
    this.#route?.focusKey("tab:all");
  }

  #stepTab(direction: 1 | -1): void {
    if (this.#packId !== null) return;
    const at = MOD_STORE_TABS.findIndex((tab) => tab.id === this.#tab);
    const next = MOD_STORE_TABS[at + direction];
    if (next) this.#select(next.id);
  }

  #openPack(tile: ModStoreTile): void {
    this.#packId = tile.id;
    this.#confirmingRemove = false;
    this.#error = null;
    this.#draw();
  }

  /** A picture or a progress report arriving redraws once per frame, however many arrive. */
  #requestRedraw(): void {
    if (this.#redrawQueued || !this.#alive) return;
    this.#redrawQueued = true;
    this.time.delayedCall(0, () => {
      this.#redrawQueued = false;
      this.#draw();
    });
  }

  #act(tile: ModStoreTile, action: PackAction): void {
    if (!action.enabled) return;
    if (action.id === "remove") {
      this.#confirmingRemove = true;
      this.#draw();
    } else if (action.id === "cancel-remove") {
      this.#confirmingRemove = false;
      this.#draw();
    } else if (action.id === "confirm-remove") {
      void this.#remove(tile);
    } else if (showNoticeBeforeInstall(modNoticeSeen())) {
      // An install the player never saw the warning for waits for it.
      this.#showNotice(() => void this.#installTile(tile));
    } else {
      void this.#installTile(tile);
    }
  }

  /** Installs or updates one pack; true once it is in. */
  async #installTile(tile: Pick<ModStoreTile, "id">): Promise<boolean> {
    const entry = this.#index?.packs.find((one) => one.id === tile.id);
    // Only a RUNNING install blocks another; a failed one's error is stale the moment a new run starts.
    if (!entry || (this.#install && this.#install.error === null)) return false;
    const token = ++this.#installToken;
    const installedVersion = this.#installed.get(tile.id)?.version;
    this.#install = { id: tile.id, progress: null, error: null };
    this.#draw();
    try {
      await installPack(entry, {
        store: this.#store,
        onProgress: (progress) => {
          if (token !== this.#installToken) return;
          this.#install = { id: tile.id, progress, error: null };
          this.#requestStatusRepaint();
        },
      });
      if (token !== this.#installToken) return false;
      await this.#refreshInstalled();
      // The install is noted for the "install a mod" achievements (docs/custom-content-packs.md section 11.12).
      void refreshUnlocks().catch(() => false);
      if (token !== this.#installToken) return false;
      this.#install = null;
      this.#requestRedraw();
      return true;
    } catch (error) {
      if (token !== this.#installToken) return false;
      // A failed install leaves nothing installed (§7.2.3), and a failed update leaves the old version: say so.
      this.#install = { id: tile.id, progress: null, error: errorTextOf(error, installedVersion) };
      this.#requestRedraw();
      return false;
    }
  }

  /** An install or a removal is running (Update all's own included). */
  #busy(): boolean {
    return (this.#install !== null && this.#install.error === null) || this.#removing || this.#updateRun !== null;
  }

  /**
   * Update all (issue #957): every installed pack with an update, one after another. A pack that fails keeps its old
   * version and the run goes on to the next; Stop ends it once the pack updating now is in.
   */
  async #updateAll(): Promise<void> {
    if (this.#busy()) return;
    const queue = updateAllQueueOf(tilesOf(this.#index, this.#context(), "all"));
    if (queue.length === 0) return;
    if (showNoticeBeforeInstall(modNoticeSeen())) {
      this.#showNotice(() => void this.#updateAll());
      return;
    }
    this.#updateResult = null;
    this.#updateRun = startRun(queue);
    this.#requestRedraw();
    for (let item = nextOf(this.#updateRun); item; item = nextOf(this.#updateRun)) {
      const ok = await this.#installTile(item);
      // Why it failed, kept with the result: the next pack's install replaces `#install`.
      const error = !ok && this.#install?.id === item.id ? this.#install.error : null;
      this.#updateRun = stepRun(this.#updateRun, ok, error);
      this.#requestRedraw();
    }
    this.#updateResult = resultOf(this.#updateRun);
    this.#updateRun = null;
    this.#requestRedraw();
  }

  #stopUpdateAll(): void {
    if (!this.#updateRun || this.#updateRun.stopping) return;
    this.#updateRun = { ...this.#updateRun, stopping: true };
    this.#requestRedraw();
  }

  /**
   * The install state a pack's page shows: its own install or update, else (no install of it since) why the last
   * Update all could not update it, until a retry lands.
   */
  #installStateFor(id: string): InstallState | null {
    if (this.#install?.id === id) return this.#install;
    const pending = updateAllQueueOf(tilesOf(this.#index, this.#context(), "all"));
    const error = failureOf(this.#updateResult, pending, id);
    return error ? { id, progress: null, error } : null;
  }

  /** The packs the last Update all could not update that still can be: their tiles say so. */
  #failedIds(): ReadonlySet<string> {
    if (!this.#updateResult) return new Set();
    return failedIdsOf(this.#updateResult, updateAllQueueOf(tilesOf(this.#index, this.#context(), "all")));
  }

  #updateAllBar(): UpdateAllBar | null {
    const run = this.#updateRun;
    const current = run ? run.queue[run.done]?.id : undefined;
    return updateAllBarOf({
      pending: updateAllQueueOf(tilesOf(this.#index, this.#context(), "all")),
      run,
      progress: current !== undefined && this.#install?.id === current ? this.#install.progress : null,
      result: this.#updateResult,
      busy: this.#busy(),
      shown: new Set(
        filterTiles(tilesOf(this.#index, this.#context(), this.#tab), this.#filter).map((tile) => tile.id),
      ),
    });
  }

  /**
   * "Show them" on the Update all bar: failed packs the tab or the search hid. Installed lists every one of them, so it
   * opens with the search, tags and creator cleared (the sort stays), from its top.
   */
  #showFailed(): void {
    this.#searchInput?.setValue("");
    this.#filter = { ...EMPTY_FILTER, sort: this.#filter.sort };
    this.#findersOpen = false;
    this.#tab = "installed";
    this.#scroll("installed").reset();
    this.#draw();
  }

  async #remove(tile: ModStoreTile): Promise<void> {
    this.#confirmingRemove = false;
    this.#removing = true;
    this.#draw();
    try {
      await this.#store.remove(tile.id);
      this.#error = null;
      await this.#refreshInstalled();
      // A pack the store no longer lists has nothing left to show once it is gone.
      if (!this.#index?.packs.some((entry) => entry.id === tile.id)) this.#packId = null;
    } catch (error) {
      this.#error = errorTextOf(error);
    }
    this.#removing = false;
    this.#requestRedraw();
  }

  /** A progress report redraws the status line alone, so the text panel above keeps where the player scrolled to. */
  #requestStatusRepaint(): void {
    if (this.#statusQueued || !this.#alive) return;
    this.#statusQueued = true;
    this.time.delayedCall(0, () => {
      this.#statusQueued = false;
      this.#paintStatus();
      this.#paintUpdateBar();
    });
  }

  #paintStatus(): void {
    const rect = this.#statusRect;
    if (!this.#alive || !rect || this.#packId === null) return;
    for (const object of this.#statusObjects) object.destroy();
    const before = this.children.list.length;
    const running = this.#packId === null ? null : this.#installStateFor(this.#packId);
    this.#drawStatus(running, this.#error, this.#requirement, rect);
    this.#statusObjects = this.children.list.slice(before);
  }

  #destroyWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const tabs of this.#tabs) tabs.destroy();
    this.#tabs = [];
    for (const rail of this.#rails) rail.destroy();
    this.#rails = [];
    this.#list?.destroy();
    this.#list = null;
    this.#panel?.destroy();
    this.#panel = null;
    this.#gallery?.destroy();
    this.#gallery = null;
    this.#galleryRect = null;
    this.#statusObjects = [];
    this.#statusRect = null;
    this.#updateBarObjects = [];
    this.#updateBarRect = null;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    // The search box's DOM field outlives a redraw, so its caret and what is typed stay put.
    const kept = this.#searchInput ? [this.#searchInput.gameObject] : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    resetHoverCards(this);
    this.#hints.reset();
    this.#obstacles = [];
    this.#faceHovers = [];
    this.#pageContext = null;
    this.#galleryRows = [];

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const stops = new Map<string, FocusStop>();
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);

    const tile =
      this.#packId === null
        ? null
        : (tilesOf(this.#index, this.#context(), "all").find((t) => t.id === this.#packId) ?? null);
    // While the catalog loads a page opened by a dev jump has no tile yet: browse view, keep the id.
    if (this.#packId !== null && !tile && this.#status !== "loading") this.#packId = null;

    // "About mods" at the bar's right edge: a "!" on a phone, words elsewhere.
    const aboutWidth = phone ? hit.target : 132;
    const aboutRect: Rect = {
      x: width - (phone ? 12 : 22) - aboutWidth,
      y: (campaignTopBar(phone) - hit.target) / 2,
      width: aboutWidth,
      height: hit.target,
    };
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : tile ? "◂ STORE" : "◂ TITLE",
      onBack: () => this.#back(),
      hints: this.#hints,
      title: t("title.modStore"),
      // Quin, 2026-11-13: the store and community packs are new; say so on every store screen.
      badge: "Beta",
      ...(this.#installed.size > 0 ? { right: `${this.#installed.size} installed` } : {}),
      rightInset: aboutWidth + 12,
      reserveRight: aboutWidth + 12,
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
    const order: string[] = bar.backRect ? ["back"] : [];
    const aboutPress = (): void => this.#showNotice();
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: modNoticeControlLabelOf(phone),
        type: typeRole.backLabel,
        rect: aboutRect,
        onClick: aboutPress,
      }),
    );
    this.#hints.button(this.#buttons[this.#buttons.length - 1]!, ["guide"], "ink");
    stops.set("about", { rect: aboutRect, activate: aboutPress });
    order.push("about");

    this.#searchDrawn = false;
    if (tile) this.#drawPage(tile, { width, height, phone, gutter, top: bar.height }, stops, order);
    else this.#drawBrowse({ width, height, phone, gutter, top: bar.height }, stops, order);
    // Only browse (not Credits, not a pack page) has the search box: a DOM field is not hidden by not drawing it.
    if (this.#searchInput && !this.#searchDrawn) {
      this.#searchInput.destroy();
      this.#searchInput = null;
    }
    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }

  // ---- Browse ---------------------------------------------------------------------------------------------------

  /**
   * The beta caption above the store's tabs: a comic narration box (caution yellow, ink border, a hard offset shadow,
   * square corners and no tail, so it never reads as a speech bubble). Returns the y below it, shadow included.
   */
  #drawBetaCaption(at: { x: number; y: number; width: number }, phone: boolean): number {
    const pad = phone ? 8 : 12;
    const shadow = 4;
    const boxWidth = at.width - shadow;
    const heading = this.add
      .text(
        at.x + pad,
        at.y + pad,
        MOD_STORE_BETA_CAPTION.heading.toUpperCase(),
        textStyle(bangers(phone ? 16 : 20), surface.ink.hex),
      )
      .setOrigin(0, 0)
      .setLetterSpacing(1)
      .setDepth(2);
    const bodyX = at.x + pad + heading.width + (phone ? 12 : 20);
    const body = this.add
      .text(bodyX, at.y + pad, phone ? MOD_STORE_BETA_CAPTION.phoneBody : MOD_STORE_BETA_CAPTION.body, {
        ...textStyle(typeRole.body, surface.ink.hex),
        wordWrap: { width: at.x + boxWidth - pad - bodyX, useAdvancedWrap: true },
      })
      .setOrigin(0, 0)
      .setDepth(2);
    if (phone) body.setFontSize(12);
    const boxHeight = Math.max(heading.height, body.height) + pad * 2;
    this.add
      .rectangle(at.x + shadow, at.y + shadow, boxWidth, boxHeight, surface.ink.hex)
      .setOrigin(0, 0)
      .setDepth(1);
    this.add
      .rectangle(at.x, at.y, boxWidth, boxHeight, signal.caution.hex)
      .setOrigin(0, 0)
      .setStrokeStyle(2, surface.ink.hex)
      .setDepth(1);
    // A thin ink rule sets the heading apart from the text, like a caption's lead-in.
    this.add
      .rectangle(bodyX - (phone ? 6 : 10), at.y + pad, 2, boxHeight - pad * 2, surface.ink.hex)
      .setOrigin(0, 0)
      .setDepth(2);
    return at.y + boxHeight + shadow;
  }

  #drawBrowse(
    frame: { width: number; height: number; phone: boolean; gutter: number; top: number },
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const { width, phone, gutter, top } = frame;
    const captionBottom = this.#drawBetaCaption({ x: gutter, y: top + 12, width: width - gutter * 2 }, phone);
    if (phone) {
      this.#drawPhoneBrowse(frame, captionBottom + 10, stops, order);
      return;
    }
    // Six tabs on a narrow window would cut their labels short: there they take two rows.
    const tabRows = modStoreTabRowsOf(width - gutter * 2);
    const tabRect: Rect = {
      x: gutter,
      y: captionBottom + 12,
      width: width - gutter * 2,
      height: TAB_HEIGHT * tabRows.length,
    };
    this.#tabs = tabRows.map(
      (row, index) =>
        new McTabs(this, {
          rect: { ...tabRect, y: tabRect.y + index * TAB_HEIGHT, height: TAB_HEIGHT },
          tabs: row.map((tab) => ({ id: tab.id, label: modStoreTabLabel(tab) })),
          activeId: this.#tab,
          onSelect: (id) => this.#select(id as ModStoreTab),
        }),
    );
    this.#hints.custom(
      (set, snapshot) => (set === "pad" ? specsForShortcuts(["zonePrevious", "zoneNext"], snapshot) : null),
      16,
      ({ width: glyphWidth }) => ({ x: tabRect.x + tabRect.width - glyphWidth, y: tabRect.y + tabRect.height + 11 }),
      { avoidObstacles: true },
    );
    this.#obstacles.push(tabRect);
    tabRows.forEach((row, rowIndex) => {
      const tabWidth = tabRect.width / row.length;
      row.forEach((tab, index) => {
        stops.set(`tab:${tab.id}`, {
          rect: {
            x: tabRect.x + index * tabWidth,
            y: tabRect.y + rowIndex * TAB_HEIGHT,
            width: tabWidth,
            height: TAB_HEIGHT,
          },
          activate: () => this.#select(tab.id),
        });
        order.push(`tab:${tab.id}`);
      });
    });

    this.#drawBrowseBody(frame, tabRect.y + tabRect.height + 14, true, stops, order);
  }

  /**
   * A phone's browse view (Quin, 2026-11-15: phones are short on height): the tabs as one sideways-scrolling row, as
   * Your stats draws its tabs (`ui/chip-rail.ts`), with a magnifier at its end that shows the search box, sort and tag
   * chips. They stay folded away until it is pressed, unless a search, tag or creator is narrowing the list.
   */
  #drawPhoneBrowse(
    frame: { width: number; height: number; phone: boolean; gutter: number; top: number },
    top: number,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const { width, gutter } = frame;
    const toggleSize = TAB_HEIGHT;
    const finding = this.#tab !== "credits" && this.#status !== "loading";
    const railWidth = width - gutter * 2 - (finding ? toggleSize + CHIP_GAP : 0);
    const at = MOD_STORE_TABS.findIndex((tab) => tab.id === this.#tab);
    const rail = new McChipRail(this, {
      rect: { x: gutter, y: top, width: railWidth, height: TAB_HEIGHT },
      chips: MOD_STORE_TABS.map((tab) => ({
        id: tab.id,
        text: modStoreTabLabel(tab).toUpperCase(),
        selected: tab.id === this.#tab,
        onClick: () => this.#select(tab.id),
      })),
      scroll: this.#tabRail,
    });
    this.#rails.push(rail);
    rail.scrollIntoView(at);
    MOD_STORE_TABS.forEach((tab, index) => {
      stops.set(`tab:${tab.id}`, {
        rect: () => rail.rectFor(index),
        activate: () => this.#select(tab.id),
        ensureVisible: () => rail.scrollIntoView(index),
      });
      order.push(`tab:${tab.id}`);
    });
    this.#obstacles.push({ x: gutter, y: top, width: width - gutter * 2, height: TAB_HEIGHT });
    const open = finding && (this.#findersOpen || isFiltering(this.#filter));
    if (finding) {
      const toggleRect: Rect = { x: width - gutter - toggleSize, y: top, width: toggleSize, height: toggleSize };
      drawSearchToggle(this, toggleRect, "finders-toggle", open, () => this.#toggleFinders(), this.#buttons, stops);
      order.push("finders-toggle");
    }
    this.#drawBrowseBody(frame, top + TAB_HEIGHT + 12, open, stops, order);
  }

  /** The phone's magnifier: shows or folds away the search box, sort and chips. Folding clears what they narrowed. */
  #toggleFinders(): void {
    const open = this.#findersOpen || isFiltering(this.#filter);
    this.#findersOpen = !open;
    if (open) {
      this.#searchInput?.setValue("");
      this.#filter = { ...EMPTY_FILTER, sort: this.#filter.sort };
    }
    this.#draw();
    if (!open) this.#searchInput?.focus();
  }

  /** Everything under the tabs: the offline notice, then the finders (when shown) and the grid, or Credits. */
  #drawBrowseBody(
    frame: { width: number; height: number; phone: boolean; gutter: number; top: number },
    top: number,
    finders: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const { width, height, phone, gutter } = frame;
    let listTop = top;
    if (this.#offline && this.#status === "ready") {
      const box: Rect = { x: gutter, y: listTop, width: width - gutter * 2, height: 34 };
      this.add.rectangle(box.x, box.y, box.width, box.height, surface.ink.hex).setOrigin(0, 0);
      const notice = this.add
        .text(
          box.x + 12,
          box.y + box.height / 2,
          `OFFLINE  ·  ${OFFLINE_NOTICE}`,
          textStyle(typeRole.rowTitle, surface.paper.hex),
        )
        .setOrigin(0, 0.5)
        .setFontSize(12);
      fitText(notice, box.width - 24, 12);
      listTop += box.height + 10;
    }
    if (this.#status === "ready" && this.#tab !== "credits") {
      listTop = this.#drawUpdateBar({ x: gutter, y: listTop, width: width - gutter * 2 }, phone, stops, order);
    }

    const message = (text: string, at: Rect): void => {
      this.add
        .text(at.x, at.y, text, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setFontSize(14)
        .setWordWrapWidth(at.width, true);
    };
    const restRect = (top: number): Rect => ({
      x: gutter,
      y: top,
      width: width - gutter * 2,
      height: Math.max(60, height - top - gutter),
    });

    if (this.#status === "loading") {
      message(LOADING_TEXT, restRect(listTop));
      return;
    }
    const tabTiles = tilesOf(this.#index, this.#context(), this.#tab);
    if (this.#status === "failed" && tabTiles.length === 0) {
      const at = restRect(listTop);
      message(LOAD_FAILED_TEXT, at);
      const retryRect: Rect = { x: at.x, y: at.y + 56, width: 160, height: hit.target };
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Try again",
          type: typeRole.label,
          rect: retryRect,
          onClick: () => this.#retry(),
        }),
      );
      stops.set("retry", { rect: retryRect, activate: () => this.#retry() });
      order.push("retry");
      return;
    }
    if (this.#tab === "credits") {
      this.#drawCredits(creditsOf(tabTiles), restRect(listTop), phone, stops, order);
      return;
    }
    if (tabTiles.length === 0) {
      message(emptyTextOf(this.#tab), restRect(listTop));
      return;
    }

    if (finders) {
      listTop = this.#drawFinders(tabTiles, { x: gutter, y: listTop, width: width - gutter * 2 }, phone, stops, order);
    }
    const tiles = filterTiles(tabTiles, this.#filter);
    const listRect = restRect(listTop);
    if (tiles.length === 0) {
      message(t("modStore.noMatch"), listRect);
      return;
    }

    const grid = modStoreGridOf(listRect.width - SCROLLBAR, phone);
    const rows = extrasRowCount(tiles.length, grid);
    const list: McVirtualList = new McVirtualList(this, {
      rect: listRect,
      rowHeight: grid.rowHeight,
      count: rows,
      scroll: this.#scroll(this.#tab),
      background: false,
      renderRow: (rowIndex, rect) => this.#renderRow(tiles, rowIndex, rect, grid),
      onRowActivate: (rowIndex, pointer) => {
        const index = extrasTileAt(pointer.x, rowIndex, grid, listRect.x, tiles.length);
        if (index !== null) this.#openPack(tiles[index]!);
      },
      rowPressableAt: (rowIndex, pointer) => extrasTileAt(pointer.x, rowIndex, grid, listRect.x, tiles.length) !== null,
      cursorBlocked: () => this.#overlayUp(),
    });
    this.#list = list;
    tiles.forEach((tile, index) => {
      const rowIndex = Math.floor(index / grid.columns);
      stops.set(`tile:${tile.id}`, {
        rect: () => extrasTileRect(index, grid, list.rectFor(rowIndex)),
        activate: () => this.#openPack(tile),
        ensureVisible: () => list.scrollIntoView(rowIndex),
        view: listRect,
      });
      order.push(`tile:${tile.id}`);
    });
  }

  /** The search box was drawn this frame (browse, not Credits): a frame without it destroys the DOM field. */
  #searchDrawn = false;

  /**
   * The finders over a tab's grid (issue #734): the search box and the sort, then a row of chips (the creator picked on
   * Credits, then the tab's tags, the most used first, then Clear) and the count of what shows. Returns the y below.
   */
  #drawFinders(
    tabTiles: readonly ModStoreTile[],
    at: { x: number; y: number; width: number },
    phone: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const filter = this.#filter;
    const sortWidth = phone ? 112 : 150;
    const searchRect: Rect = { x: at.x, y: at.y, width: at.width - sortWidth - CHIP_GAP, height: CONTROL_HEIGHT };
    this.#searchInput = drawSearchField(
      this,
      searchRect,
      "search",
      filter.text,
      t("modStore.search"),
      (value) => this.#setFilter({ ...this.#filter, text: value }),
      this.#searchInput,
      stops,
    );
    this.#searchDrawn = true;
    order.push("search");
    const sortRect: Rect = { x: at.x + at.width - sortWidth, y: at.y, width: sortWidth, height: CONTROL_HEIGHT };
    const stepSort = (): void =>
      this.#setFilter({ ...this.#filter, sort: this.#filter.sort === "name" ? "newest" : "name" });
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: `⇅ ${t(filter.sort === "name" ? "modStore.sort.name" : "modStore.sort.newest")}`,
        type: typeRole.label,
        rect: sortRect,
        onClick: stepSort,
      }),
    );
    stops.set("sort", { rect: sortRect, activate: stepSort });
    order.push("sort");
    this.#obstacles.push(searchRect, sortRect);

    // The chips: the creator first (picked on Credits; its ✕ undoes that), the tags, then Clear while anything narrows.
    type Chip = { id: string; label: string; selected: boolean; press: () => void };
    const chips: Chip[] = [];
    if (filter.creator !== null) {
      chips.push({
        id: "creator",
        label: `${t("modStore.byCreator", { name: filter.creator })}  ✕`,
        selected: true,
        press: () => this.#setFilter({ ...this.#filter, creator: null }),
      });
    }
    for (const chip of tagChipsOf(tabTiles, filter.tags)) {
      chips.push({
        id: `tag:${chip.tag}`,
        label: chip.on ? `✓ ${chip.tag}` : `${chip.tag} ${chip.count}`,
        selected: chip.on,
        press: () => this.#setFilter({ ...this.#filter, tags: toggleTag(this.#filter.tags, chip.tag) }),
      });
    }
    const filtering = isFiltering(filter);
    const clear: Chip | null = filtering
      ? {
          id: "clear",
          label: t("modStore.clear"),
          selected: false,
          press: () => {
            this.#searchInput?.setValue("");
            this.#setFilter({ ...EMPTY_FILTER, sort: this.#filter.sort });
          },
        }
      : null;
    const chipType = { ...typeRole.label, size: 11 };
    const measure = (label: string): number => {
      const probe = this.add.text(0, 0, label.toUpperCase(), textStyle(chipType, surface.ink.hex));
      const w = probe.width;
      probe.destroy();
      return Math.ceil(w) + 24;
    };
    // Clear keeps the first row's end: the tags pack into what is left.
    const clearWidth = clear ? measure(clear.label) : 0;
    const packed = packChips(
      chips,
      (chip) => measure(chip.label),
      at.width - (clear ? clearWidth + CHIP_GAP : 0),
      phone ? 1 : 2,
      CHIP_GAP,
    );
    const chipTop = at.y + CONTROL_HEIGHT + 10;
    const placed: { chip: Chip; rect: Rect }[] = packed.slots.map((slot) => ({
      chip: slot.item,
      rect: {
        x: at.x + slot.x,
        y: chipTop + slot.row * (CONTROL_HEIGHT + CHIP_GAP),
        width: slot.width,
        height: CONTROL_HEIGHT,
      },
    }));
    if (clear) {
      placed.push({
        chip: clear,
        rect: { x: at.x + at.width - clearWidth, y: chipTop, width: clearWidth, height: CONTROL_HEIGHT },
      });
    }
    for (const { chip, rect } of placed) {
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: chip.label,
          type: chipType,
          rect,
          selected: chip.selected,
          onClick: chip.press,
        }),
      );
      stops.set(`chip:${chip.id}`, { rect, activate: chip.press });
      order.push(`chip:${chip.id}`);
      this.#obstacles.push(rect);
    }
    const chipRows = Math.max(packed.rows, clear ? 1 : 0);
    const y = chipRows > 0 ? chipTop + chipRows * (CONTROL_HEIGHT + CHIP_GAP) - CHIP_GAP : at.y + CONTROL_HEIGHT;

    // The count: how many show, and of how many while something narrows the list.
    const shown = filterTiles(tabTiles, filter).length;
    const count = this.add
      .text(
        at.x,
        y + 8,
        resultCountText(shown, tabTiles.length, filtering).toUpperCase(),
        textStyle(typeRole.label, surface.ink.hex, ink.secondary),
      )
      .setFontSize(11);
    fitText(count, at.width, 9);
    return count.y + count.height + 8;
  }

  /** The Credits tab: one row per creator, their name, how many packs and which; a press shows their packs on All. */
  #drawCredits(
    credits: readonly CreatorCredit[],
    rect: Rect,
    phone: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const intro = this.add
      .text(rect.x, rect.y, t("modStore.credits.intro"), textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setFontSize(phone ? 12 : 14);
    fitWrapped(intro, rect.width, 2, 11);
    if (credits.length === 0) {
      this.add
        .text(rect.x, intro.y + intro.height + 12, emptyTextOf("credits"), textStyle(typeRole.body, surface.ink.hex))
        .setFontSize(14);
      return;
    }
    const top = intro.y + intro.height + 12;
    const listRect: Rect = { x: rect.x, y: top, width: rect.width, height: Math.max(60, rect.y + rect.height - top) };
    const rowHeight = phone ? 72 : 56;
    const gap = 8;
    const list: McVirtualList = new McVirtualList(this, {
      rect: listRect,
      rowHeight: rowHeight + gap,
      count: credits.length,
      scroll: this.#scroll("credits"),
      background: false,
      renderRow: (index, row) => ({
        objects: this.#drawCredit(credits[index]!, { ...row, width: row.width - SCROLLBAR, height: rowHeight }, phone),
      }),
      onRowActivate: (index) => this.#showCreator(credits[index]!),
      rowPressableAt: () => true,
      cursorBlocked: () => this.#overlayUp(),
    });
    this.#list = list;
    credits.forEach((credit, index) => {
      const key = `creator:${credit.name}`;
      stops.set(key, {
        rect: () => ({ ...list.rectFor(index), width: listRect.width - SCROLLBAR, height: rowHeight }),
        activate: () => this.#showCreator(credit),
        ensureVisible: () => list.scrollIntoView(index),
        view: listRect,
      });
      order.push(key);
    });
  }

  /** One creator's row: a red bar down the left edge, as a comic's credits box, their name, pack count and packs. */
  #drawCredit(credit: CreatorCredit, rect: Rect, phone: boolean): Phaser.GameObjects.GameObject[] {
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x + 2, rect.y + 2, 6, rect.height - 4);
    const x = rect.x + 20;
    const textWidth = rect.x + rect.width - x - 12;
    const count = this.add
      .text(
        rect.x + rect.width - 12,
        rect.y + 10,
        `${packCountText(credit.packs.length).toUpperCase()} ▸`,
        textStyle(typeRole.label, surface.ink.hex, ink.secondary),
      )
      .setOrigin(1, 0)
      .setFontSize(11);
    const name = this.add.text(x, rect.y + 6, credit.name, textStyle(bangers(phone ? 20 : 24), surface.ink.hex));
    fitText(name, textWidth - count.width - 12, 14);
    const line = this.add
      .text(x, name.y + name.height + 2, creditLineOf(credit), textStyle(typeRole.body, surface.ink.hex, 0.9))
      .setFontSize(phone ? 11 : 12);
    fitWrapped(line, textWidth, phone ? 2 : 1, 10);
    return [g, count, name, line];
  }

  #renderRow(tiles: readonly ModStoreTile[], rowIndex: number, rect: Rect, grid: ExtrasGrid): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    for (let column = 0; column < grid.columns; column += 1) {
      const tile = tiles[rowIndex * grid.columns + column];
      if (!tile) break;
      objects.push(...this.#drawTile(tile, extrasTileRect(rowIndex * grid.columns + column, grid, rect)));
    }
    return { objects };
  }

  /** The art for pack `packId`'s card `record`, or null while it loads or when there is none (the generated face then). */
  #artOf(record: AnyCard, face: CardFace, packId: string, preview: ParsedPackPreview | null, base: string | undefined) {
    const id = record.id as string;
    const own = id.startsWith(customCardPrefix(packId));
    if (own && !loadedPacks().some((pack) => pack.id === packId)) {
      // Not installed (or not loaded): the picture comes from the pack host, by URL, when the pack ships one.
      const url =
        preview && base !== undefined
          ? packPictureCodes(record, face)
              .map((code) => previewPictureUrl(preview, base, code, artLanguageNow()))
              .find((found) => found !== undefined)
          : undefined;
      return url ? previewPictureFor(url) : null;
    }
    return artFor(record, face);
  }

  /** A card face into `rect`: its picture when `art` has arrived, else the generated face from its record. */
  #drawCardFace(rect: Rect, record: AnyCard, face: CardFace, art: ArtSource | null): Phaser.GameObjects.GameObject[] {
    const key = art ? cardArt(this).request(this, art) : null;
    const image = key ? drawArt(this, key, rect) : null;
    if (image) return [image];
    return drawGeneratedFace(this, rect, faceModelOf(record, face));
  }

  /** The featured card's preview for a tile, requesting it the first time a visible tile asks. */
  #previewOf(tile: ModStoreTile): ParsedPackPreview | null {
    if (!tile.previewUrl) return null;
    const known = previewInMemory(tile.previewUrl);
    if (known === undefined) void requestPreview(tile.previewUrl, tile.id);
    return known ?? null;
  }

  /**
   * A pack's cover into `rect`, whole (contain: its title and credit stay in), centered on whatever ground is behind
   * it: the installed copy's own file first, so it shows offline, else the catalog's thumbnail. Null while it loads.
   */
  #drawCover(packId: string, cover: PackCover, rect: Rect): Phaser.GameObjects.Image | null {
    const source: ArtSource | null =
      (cover.path !== undefined ? packFileArt(packId, cover.path) : null) ??
      (cover.url !== undefined ? previewPictureFor(cover.url) : null);
    const key = source ? cardArt(this).request(this, source) : null;
    return key ? drawArt(this, key, rect) : null;
  }

  /**
   * A tile's left side, a portrait card: the pack's cover, else the catalog's thumbnail, else the featured card's
   * picture, else its generated face from the preview's record, else the pack's initial, big and faint, on ink while
   * nothing has loaded.
   */
  #drawThumb(tile: ModStoreTile, rect: Rect): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    ground.lineStyle(1, surface.paper.hex, 0.4).strokeRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10);
    objects.push(ground);
    const preview = this.#previewOf(tile);
    const art = tileArtOf(tile, preview, artLanguageNow(), ruleCardsOf(tile));
    if (art.kind === "cover") {
      const image = this.#drawCover(tile.id, art, rect);
      if (image) {
        objects.push(image);
        return objects;
      }
    }
    if (art.kind === "thumbnail") {
      const image = drawPicture(
        this,
        { key: `mod-store:${tile.id}:${art.url}`, url: art.url },
        rect,
        () => this.#requestRedraw(),
        { focusY: 0.3 },
      );
      if (image) {
        objects.push(image);
        return objects;
      }
    }
    // A pack with a cover shows the initial while the cover loads, not the featured face it would then swap away from.
    const first =
      art.kind === "cover" ? undefined : featuredFacesOf(preview, tile.baseUrl, artLanguageNow(), ruleCardsOf(tile))[0];
    if (first) {
      objects.push(
        ...this.#drawCardFace(
          rect,
          first.card,
          first.face,
          first.pictureUrl ? previewPictureFor(first.pictureUrl) : null,
        ),
      );
      return objects;
    }
    objects.push(
      this.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2, tile.name.charAt(0).toUpperCase(), {
          ...textStyle(bangers(Math.round(rect.height * 0.55)), surface.paper.hex, 0.3),
        })
        .setOrigin(0.5),
    );
    return objects;
  }

  /** The state chip, its right edge at `edge` (or its left edge, with `fromLeft`). */
  #drawChip(
    tile: ModStoreTile,
    edge: number,
    y: number,
    maxWidth: number,
    fromLeft = false,
  ): Phaser.GameObjects.GameObject[] {
    // A symbol and the words: the state never rests on color alone.
    // A pack Update all could not update says so on its own tile (issue #957), so every failure can be found.
    const failed = tile.state === "update" && this.#failedIds().has(tile.id);
    const mark = failed
      ? "!"
      : { install: "+", installed: "✓", update: "↑", "needs-app-update": "!", withdrawn: "✕" }[tile.state];
    const solid = tile.state === "install" || tile.state === "update";
    const g = this.add.graphics();
    const text = this.add
      .text(
        0,
        0,
        `${mark} ${failed ? t("modStore.updateAll.retry") : tile.stateLabel}`,
        textStyle(typeRole.label, solid ? surface.paper.hex : surface.ink.hex, 1),
      )
      .setOrigin(0, 0);
    fitText(text, maxWidth - 14, 9);
    const w = text.width + 14;
    const h = text.height + 8;
    const right = fromLeft ? edge + w : edge;
    if (solid) g.fillStyle(accent.heroRed.hex, 1).fillRect(right - w, y, w, h);
    else g.lineStyle(2, surface.ink.hex, 1).strokeRect(right - w + 1, y + 1, w - 2, h - 2);
    text.setPosition(right - w + 7, y + 4);
    return [g, text];
  }

  #drawTile(tile: ModStoreTile, rect: Rect): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    objects.push(g);

    const side = rect.height - 12;
    const artWidth = Math.round(side * (5 / 7));
    objects.push(...this.#drawThumb(tile, { x: rect.x + 6, y: rect.y + 6, width: artWidth, height: side }));

    const textX = rect.x + artWidth + 16;
    const textWidth = rect.x + rect.width - textX - 8;
    const title = this.add
      .text(textX, rect.y + 8, tile.name, textStyle(typeRole.rowTitle, surface.ink.hex))
      .setFontSize(14);
    fitText(title, textWidth, 14);
    const by = this.add
      .text(
        textX,
        rect.y + 28,
        `${tile.kindLabel} · by ${tile.creator}`,
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setFontSize(10);
    fitText(by, textWidth, 10);
    const summary = this.add
      .text(textX, rect.y + 44, tile.summary, textStyle(typeRole.body, surface.ink.hex, 0.9))
      .setFontSize(10);
    fitWrapped(summary, textWidth, 2, 10);
    const size = this.add
      .text(textX, rect.y + rect.height - 22, tile.size, textStyle(typeRole.rowTitle, surface.ink.hex, ink.secondary))
      .setFontSize(11);
    objects.push(title, by, summary, size);
    objects.push(
      ...this.#drawChip(tile, rect.x + rect.width - 8, rect.y + rect.height - 30, textWidth - size.width - 8),
    );
    return objects;
  }

  // ---- Pack page ------------------------------------------------------------------------------------------------

  #drawPage(
    tile: ModStoreTile,
    frame: { width: number; height: number; phone: boolean; gutter: number; top: number },
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const { width, height, phone, gutter, top } = frame;
    const entry = this.#index?.packs.find((one) => one.id === tile.id);
    const installed = this.#installed.get(tile.id);
    const installedAchievements = parsePackAchievements(installed?.manifest.achievements);
    const achievements =
      installedAchievements.length > 0
        ? installedAchievements
        : (loadedPacks().find((pack) => pack.id === tile.id)?.achievements ??
          this.#previewOf(tile)?.achievements ??
          []);
    const page = packPageOf(tile, entry, installed, achievements, this.#previewOf(tile)?.description);
    const running = this.#installStateFor(tile.id);
    // Update all holds every page's buttons until it ends; the pack it is on shows its own progress.
    const busy = (running !== null && running.error === null) || this.#removing || this.#updateRun !== null;

    // What the page shows of the pack: an installed, loaded pack's own data; before that (or when it did not load) the
    // preview fetched from the store, which is all there is of an uninstalled pack.
    const preview = this.#previewOf(tile);
    const packCards = loadedPacks().find((pack) => pack.id === tile.id);
    const source = packCards ?? preview;
    const rule = tile.kind === "house-rule";
    const ruleFaces = rule ? ruleFacesOf(installed, preview) : [];
    const { sections, records } = source
      ? gallerySectionsOf({
          cards: source.cards,
          decks: source.decks,
          baseCards: currentCardsById(),
          ruleFaces,
          // Set names and the scenario's own sets come from the loaded pack; a preview has none (names come from ids).
          ...(packCards
            ? {
                encounterSets: packCards.encounterSets ?? [],
                scenarioSetIds: (packCards.scenarios ?? []).flatMap(
                  (scenario) => [...scenario.encounterSetIds] as string[],
                ),
              }
            : {}),
        })
      : rule
        ? gallerySectionsOf({ cards: [], decks: [], baseCards: currentCardsById(), ruleFaces })
        : { sections: [], records: new Map<string, AnyCard>() };
    const cardCount = galleryCardCount(sections);
    const faces = featuredFacesOf(preview, tile.baseUrl, artLanguageNow(), ruleCardsOf(tile));
    const cover = coverOf(tile, preview);
    const actions = actionsOf({ tile, busy, confirmingRemove: this.#confirmingRemove });
    const layout = packPageLayoutOf({
      cover: cover !== undefined,
      width,
      height,
      phone,
      gutter,
      top,
      faceCount: faces.length,
      cardCount,
      buttonsHeight: actions.length > 0 ? hit.target : 0,
    });
    this.#pageContext = { packId: tile.id, preview, base: tile.baseUrl, records, rule };

    // The cover and the featured card(s), then the name, byline, meta and the state chip.
    if (cover && layout.cover) {
      const rect = layout.cover;
      this.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
      this.#drawCover(tile.id, cover, rect);
    }
    if (layout.squareThumb) this.#drawThumb(tile, layout.faces[0]!);
    else {
      layout.faces.forEach((rect, index) => {
        const face = faces[index]!;
        const art = packCards
          ? ((face.path ? packFileArt(tile.id, face.path) : null) ?? (rule ? null : artFor(face.card, face.face)))
          : face.pictureUrl
            ? previewPictureFor(face.pictureUrl)
            : null;
        this.#drawCardFace(rect, face.card, face.face, art);
        const outline = this.add.graphics();
        outline.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
        this.#faceHovers.push({ rect, card: face.card, face: face.face, art: art ?? undefined });
      });
    }
    const textX = layout.title.x;
    const textWidth = layout.title.width;
    const headY = layout.title.y;
    const name = this.add
      .text(textX, headY, page.title, textStyle(bangers(phone ? 24 : 32), surface.ink.hex))
      .setOrigin(0, 0);
    fitText(name, textWidth, phone ? 24 : 32);
    const by = this.add
      .text(textX, headY + name.height + 2, page.byline, textStyle(typeRole.rowTitle, surface.ink.hex))
      .setFontSize(13);
    fitText(by, textWidth, 13);
    const meta = this.add
      .text(textX, by.y + by.height + 4, page.meta, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setFontSize(11);
    fitWrapped(meta, textWidth, 2, 11);
    this.#drawChip(tile, textX, meta.y + meta.height + 8, textWidth, true);

    // The scrolling text: the load status leads (an installed pack says whether it is working, or why it is not).
    const loadStatus = loadStatusOf(
      installed !== undefined,
      activePackStatuses().find((one) => one.id === tile.id),
      tile.kind,
    );
    const body = loadStatus ? `${loadStatusText(loadStatus)}\n\n${page.body}` : page.body;
    const textRect = layout.text;
    this.add.rectangle(textRect.x, textRect.y, textRect.width, textRect.height, surface.parchment.hex).setOrigin(0, 0);
    this.#panel = new McScrollPanel(this, {
      rect: { x: textRect.x + 8, y: textRect.y + 6, width: textRect.width - 16, height: textRect.height - 12 },
      text: body,
    });
    const frameGfx = this.add.graphics();
    frameGfx
      .lineStyle(2, surface.ink.hex, 1)
      .strokeRect(textRect.x + 1, textRect.y + 1, textRect.width - 2, textRect.height - 2);

    // Footer: status line, then buttons (below the gallery, never over it).
    this.#statusRect = layout.status;
    this.#requirement = page.requirement;
    this.#paintStatus();
    const gap = 10;
    const innerWidth = width - gutter * 2;
    const buttonWidth = phone
      ? (innerWidth - gap * (actions.length - 1)) / Math.max(1, actions.length)
      : Math.min(220, (innerWidth - gap) / Math.max(1, actions.length));
    actions.forEach((action, index) => {
      const rect: Rect = {
        x: gutter + index * (buttonWidth + gap),
        y: layout.buttonsY,
        width: buttonWidth,
        height: hit.target,
      };
      const press = (): void => this.#act(tile, action);
      this.#buttons.push(
        new McButton(this, {
          kind: action.kind,
          label: action.label,
          type: typeRole.label,
          rect,
          enabled: action.enabled,
          ...(action.reason ? { reason: action.reason } : {}),
          onClick: press,
        }),
      );
      stops.set(`action:${action.id}`, { rect, activate: press });
      order.push(`action:${action.id}`);
    });

    if (layout.gallery) {
      const { count, list } = layout.gallery;
      const heading = packCards ? "CARDS" : "CARDS  ·  PREVIEW, NOT INSTALLED";
      this.add
        .text(
          count.x + 2,
          count.y + 3,
          `${heading}  ·  ${galleryCountText(cardCount)}`,
          textStyle(typeRole.label, surface.ink.hex, ink.secondary),
        )
        .setFontSize(11);
      this.#drawGallery(list, sections, phone, stops, order);
    }
  }

  // ---- The pack's cards -----------------------------------------------------------------------------------------

  /**
   * A scrolling gallery of the pack's cards in groups (hero, villain, nemesis and obligation, deck), each a face over a
   * name and type caption with its quantity. Pictures are fetched lazily as the tiles' rows scroll into view; a card
   * without one shows its generated face. A tap reads one in Inspect.
   */
  #drawGallery(
    rect: Rect,
    sections: readonly GallerySection[],
    phone: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const grid = galleryGridOf(rect.width - SCROLLBAR, phone);
    const rows = galleryRowsOf(sections, grid.columns);
    this.#galleryRect = rect;
    this.#galleryGrid = grid;
    this.#galleryRows = rows;
    const list: McVirtualList = new McVirtualList(this, {
      rect,
      rowHeight: grid.rowHeight,
      rowHeightOf: (index) => (rows[index]?.kind === "heading" ? GALLERY_HEADING_HEIGHT : grid.rowHeight),
      count: rows.length,
      scroll: this.#galleryScroll,
      background: false,
      renderRow: (rowIndex, rowRect) => {
        const row = rows[rowIndex]!;
        if (row.kind === "heading") return { objects: this.#drawGalleryHeading(row, rowRect) };
        const objects: Phaser.GameObjects.GameObject[] = [];
        row.cards.forEach((card, column) => {
          objects.push(...this.#drawGalleryTile(card, extrasTileRect(column, grid, rowRect), grid));
        });
        return { objects };
      },
      onRowActivate: (rowIndex, pointer) => {
        const row = rows[rowIndex];
        if (row?.kind !== "tiles") return;
        const column = extrasTileAt(pointer.x, 0, grid, rect.x, row.cards.length);
        if (column !== null) this.#inspectCard(row.cards[column]!);
      },
      rowPressableAt: (rowIndex, pointer) => {
        const row = rows[rowIndex];
        return row?.kind === "tiles" && extrasTileAt(pointer.x, 0, grid, rect.x, row.cards.length) !== null;
      },
      cursorBlocked: () => this.#overlayUp(),
    });
    this.#gallery = list;
    rows.forEach((row, rowIndex) => {
      if (row.kind !== "tiles") return;
      row.cards.forEach((card, column) => {
        const key = `card:${card.cardId}`;
        stops.set(key, {
          rect: () => extrasTileRect(column, grid, list.rectFor(rowIndex)),
          activate: () => this.#inspectCard(card),
          inspect: () => this.#inspectCard(card),
          ensureVisible: () => list.scrollIntoView(rowIndex),
          view: rect,
        });
        order.push(key);
      });
    });
  }

  #drawGalleryHeading(row: Extract<GalleryRow, { kind: "heading" }>, rect: Rect): Phaser.GameObjects.GameObject[] {
    const label = this.add
      .text(
        rect.x,
        rect.y + rect.height / 2,
        `${row.title}  ·  ${row.count}`,
        textStyle(typeRole.label, surface.ink.hex, 1),
      )
      .setOrigin(0, 0.5)
      .setFontSize(11);
    fitText(label, rect.width, 11);
    const rule = this.add.graphics();
    rule.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y + rect.height - 2, rect.width, 2);
    return [label, rule];
  }

  #drawGalleryTile(card: GalleryCard, rect: Rect, grid: ExtrasGrid): Phaser.GameObjects.GameObject[] {
    const context = this.#pageContext;
    const record = context?.records.get(card.cardId);
    const picture: Rect = { x: rect.x, y: rect.y, width: rect.width, height: galleryPictureHeight(grid) };
    // The pack's picture where it has one for this card and it has arrived; otherwise the generated face from the
    // record (a missing picture is a supported outcome, never a blank tile).
    const objects: Phaser.GameObjects.GameObject[] = record
      ? this.#drawCardFace(picture, record, card.face ?? defaultFaceFor(record), this.#artOfTile(record, card))
      : [];
    if (card.quantity > 1) {
      const chip = this.add.graphics();
      const text = this.add
        .text(0, 0, `×${card.quantity}`, textStyle(typeRole.label, surface.paper.hex, 1))
        .setFontSize(11);
      const w = text.width + 10;
      const h = text.height + 4;
      chip.fillStyle(surface.ink.hex, 1).fillRect(picture.x + picture.width - w, picture.y, w, h);
      text.setPosition(picture.x + picture.width - w + 5, picture.y + 2);
      objects.push(chip, text);
    }
    const name = this.add
      .text(rect.x, picture.y + picture.height + 3, card.name, textStyle(typeRole.rowTitle, surface.ink.hex, 1))
      .setFontSize(11);
    fitText(name, rect.width, 9);
    const type = this.add
      .text(rect.x, name.y + name.height, card.typeLine, textStyle(typeRole.label, surface.ink.hex, ink.secondary))
      .setFontSize(9);
    fitText(type, rect.width, 8);
    objects.push(name, type);
    return objects;
  }

  /**
   * The art for one gallery card of the page's pack (see `#artOf`). A house rule's tile is drawn in the rule's own
   * picture of the face it rebuilds: the installed pack's file, else the store's copy; null until one arrives.
   */
  #artOfTile(record: AnyCard, card?: GalleryCard): ArtSource | null {
    const context = this.#pageContext;
    if (!context) return null;
    if (context.rule && card) {
      if (loadedPacks().some((pack) => pack.id === context.packId))
        return houseRuleFaceFor(context.packId, card.cardId, artLanguageNow());
      const url =
        context.preview && context.base !== undefined
          ? previewPictureUrl(context.preview, context.base, card.cardId, artLanguageNow())
          : undefined;
      return url ? previewPictureFor(url) : null;
    }
    return this.#artOf(record, defaultFaceFor(record), context.packId, context.preview, context.base);
  }

  /**
   * Reads one card in Inspect. A card the game's pool has (installed packs, the base game) opens the full sheet; a
   * card of a pack that is not installed yet has no place in the pool, so it opens as a reference sheet from its
   * preview record: name, type line and rules text over its picture.
   */
  #inspectCard(card: GalleryCard): void {
    const record = this.#pageContext?.records.get(card.cardId);
    // A house rule's tile is keyed by the face code it rebuilds; the record is the official card it belongs to.
    if (record && currentCardsById().has(record.id as string) && !this.#pageContext?.rule) {
      this.scene.launch(SCENES.inspect, {
        card: { cardId: record.id, face: card.face ?? defaultFaceFor(record) },
      } satisfies InspectData);
    } else if (record) {
      const model = faceModelOf(record, card.face ?? defaultFaceFor(record));
      const stats = statLineOf(model.stats);
      this.scene.launch(SCENES.inspect, {
        reference: {
          title: model.name,
          text: [model.typeLine, stats, model.rulesText].filter((part) => part !== "").join("\n\n"),
          art: this.#artOfTile(record, card),
        },
      } satisfies InspectData);
    } else return;
    this.scene.bringToTop(SCENES.inspect);
  }

  /** The gallery's pictures and the featured faces on screen now, each clipped to the scrolled list, for the desktop hover popover. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const context = this.#pageContext;
    this.#faceHovers.forEach((one, index) => {
      found.set(hoverSlotOf(one.card.id as string, `face${index}`), {
        ...one.rect,
        cardId: one.card.id as string,
        face: one.face,
        card: one.card,
        ...(one.art ? { art: one.art } : {}),
        through: true,
      });
    });
    const list = this.#gallery;
    const view = this.#galleryRect;
    const grid = this.#galleryGrid;
    if (!list || !view || !grid || !context) return found;
    this.#galleryRows.forEach((row, rowIndex) => {
      if (row.kind !== "tiles") return;
      const rowRect = list.rectFor(rowIndex);
      row.cards.forEach((card, column) => {
        const tile = extrasTileRect(column, grid, rowRect);
        const picture = clipHoverRect({ ...tile, height: galleryPictureHeight(grid) }, view);
        if (!picture) return;
        const record = context.records.get(card.cardId);
        // A house rule's face shows the rule's picture, not the printed one the pool has.
        const inPool = currentCardsById().has(card.cardId) && !context.rule;
        // A card the pool does not have (a pack not installed yet) carries its own record and picture to the popover.
        const art = record && !inPool ? this.#artOfTile(record, card) : null;
        found.set(hoverSlotOf(card.cardId, row.first + column), {
          ...picture,
          cardId: record && !inPool ? (record.id as string) : card.cardId,
          ...(record && !inPool ? { card: record } : {}),
          ...(card.face ? { face: card.face } : {}),
          ...(art ? { art } : {}),
          through: true,
        });
      });
    });
    return found;
  }

  /**
   * The Update all bar over the grid (issue #957), when an installed pack has an update or a run has news: its words
   * and progress on the left, Update all or Stop on the right. Returns the y below it.
   */
  #drawUpdateBar(
    at: { x: number; y: number; width: number },
    phone: boolean,
    stops: Map<string, FocusStop>,
    order: string[],
  ): number {
    const bar = this.#updateAllBar();
    if (!bar) return at.y;
    const pad = 10;
    const actions = [bar.show, bar.action].filter((action) => action !== null);
    const widthOf = (action: UpdateAllAction): number =>
      action.id === "show-failed" ? (phone ? 112 : 150) : phone ? 128 : 200;
    // A phone with two buttons puts them in a row under the words; otherwise they sit at the bar's right.
    const below = phone && actions.length > 1;
    const sideWidth = below ? 0 : actions.reduce((sum, action) => sum + widthOf(action) + pad, 0);
    const lineRect: Rect = {
      x: at.x + pad,
      y: at.y + pad,
      width: at.width - pad * 2 - sideWidth,
      height: hit.target,
    };
    // The words first, to size the bar: a phone's narrow bar may need a third line.
    const before = this.children.list.length;
    const label = this.#drawUpdateBarText(bar, lineRect);
    const textRect: Rect = { ...lineRect, height: Math.max(hit.target, label.height) };
    if (bar.fraction === null) label.setY(textRect.y + (textRect.height - label.height) / 2);
    this.#updateBarObjects = this.children.list.slice(before);
    this.#updateBarRect = textRect;
    const rowHeight = below ? hit.target + pad : 0;
    const box: Rect = { x: at.x, y: at.y, width: at.width, height: textRect.height + pad * 2 + rowHeight };
    const panel = this.add
      .rectangle(box.x, box.y, box.width, box.height, surface.card.hex)
      .setOrigin(0, 0)
      .setStrokeStyle(2, surface.ink.hex)
      .setName("update-all-bar");
    this.children.moveBelow(panel, this.#updateBarObjects[0]!);
    const rowY = below ? textRect.y + textRect.height + pad : box.y + (box.height - hit.target) / 2;
    const rowWidth = (box.width - pad * (actions.length + 1)) / actions.length;
    // Side by side: from the bar's right edge less the buttons' widths, a pad between each.
    let cursor = box.x + box.width - sideWidth;
    actions.forEach((action, index) => {
      const width = below ? rowWidth : widthOf(action);
      const rect: Rect = {
        x: below ? box.x + pad + index * (rowWidth + pad) : cursor,
        y: rowY,
        width,
        height: hit.target,
      };
      cursor += width + pad;
      const press = (): void => {
        if (action.id === "stop") this.#stopUpdateAll();
        else if (action.id === "show-failed") this.#showFailed();
        else void this.#updateAll();
      };
      this.#buttons.push(
        new McButton(this, {
          kind: action.id === "update-all" ? "primary" : "secondary",
          label: action.id === "update-all" ? `↑ ${action.label}` : action.label,
          type: typeRole.label,
          rect,
          enabled: action.enabled,
          onClick: press,
        }),
      );
      const key = action.id === "show-failed" ? "update-all-show" : "update-all";
      stops.set(key, { rect, activate: press });
      order.push(key);
      this.#obstacles.push(rect);
    });
    return box.y + box.height + 10;
  }

  /** The bar's words (returned), and its progress bar while a run is going. */
  #drawUpdateBarText(bar: UpdateAllBar, rect: Rect): Phaser.GameObjects.Text {
    const label = this.add
      .text(rect.x, rect.y, bar.text, textStyle(typeRole.rowTitle, surface.ink.hex))
      .setFontSize(13)
      .setName("update-all-text");
    if (bar.fraction !== null) {
      fitText(label, rect.width, 11);
      const barH = 10;
      const y = rect.y + rect.height - barH - 1;
      const g = this.add.graphics();
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, y, rect.width - 2, barH);
      g.fillStyle(signal.heal.hex, 1).fillRect(rect.x + 3, y + 2, (rect.width - 6) * bar.fraction, barH - 4);
    } else {
      fitWrapped(label, rect.width, 3, 11);
      label.setY(rect.y + (rect.height - label.height) / 2);
    }
    return label;
  }

  /** A progress report redraws the bar's words and fill alone (its button stays as it is). */
  #paintUpdateBar(): void {
    const rect = this.#updateBarRect;
    if (!this.#alive || !rect || this.#packId !== null || !this.#updateRun) return;
    const bar = this.#updateAllBar();
    if (!bar) return;
    for (const object of this.#updateBarObjects) object.destroy();
    const before = this.children.list.length;
    this.#drawUpdateBarText(bar, rect);
    this.#updateBarObjects = this.children.list.slice(before);
  }

  /** The progress bar (with its words) while installing, the last failure in words, or a remove failure. */
  #drawStatus(
    running: InstallState | null,
    removeError: string | null,
    requirement: string | undefined,
    rect: Rect,
  ): void {
    const failure = running?.error ?? removeError;
    if (failure) {
      const t = this.add
        .text(rect.x, rect.y + rect.height / 2, `! ${failure}`, textStyle(typeRole.rowTitle, accent.heroRed.hex, 1))
        .setOrigin(0, 0.5)
        .setFontSize(12);
      fitWrapped(t, rect.width, 2, 12);
      t.setY(rect.y + (rect.height - t.height) / 2).setOrigin(0, 0);
      return;
    }
    if (!running) {
      if (requirement) {
        const t = this.add
          .text(rect.x, rect.y, `! ${requirement}`, textStyle(typeRole.rowTitle, surface.ink.hex, 1))
          .setFontSize(12);
        fitWrapped(t, rect.width, 2, 12);
      }
      return;
    }
    const { fraction, text } = running.progress ? progressOf(running.progress) : { fraction: 0, text: "Starting" };
    const barH = 10;
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + rect.height - barH - 1, rect.width - 2, barH);
    g.fillStyle(surface.ink.hex, 1).fillRect(
      rect.x + 3,
      rect.y + rect.height - barH + 1,
      (rect.width - 6) * fraction,
      barH - 4,
    );
    const label = this.add
      .text(rect.x, rect.y, `${text}  ${Math.round(fraction * 100)}%`, textStyle(typeRole.rowTitle, surface.ink.hex))
      .setFontSize(12);
    fitText(label, rect.width, 12);
  }
}

/** The official cards by printed picture code, for a house-rule tile's featured face (null for any other tile). */
function ruleCardsOf(tile: ModStoreTile): ReadonlyMap<string, AnyCard> | undefined {
  return tile.kind === "house-rule" ? officialCardsByPictureCode(currentPool()) : undefined;
}

/**
 * A house rule's rebuilt faces, by the official picture code each is filed under (`cards/<lang>/<code>.webp`, base
 * language): from the installed pack's files, else the store's preview. Codes no official card owns are left out.
 */
function ruleFacesOf(
  installed: InstalledPack | undefined,
  preview: ParsedPackPreview | null,
): readonly { readonly code: string; readonly card: AnyCard }[] {
  const base = installed?.manifest.languages?.base ?? preview?.languages?.base;
  const paths = installed ? installed.manifest.files.map((file) => file.path) : [...(preview?.images ?? [])];
  const cards = officialCardsByPictureCode(currentPool());
  return paths.flatMap((path) => {
    const picture = parsePackCardImagePath(path);
    const card = picture && picture.lang === base ? cards.get(picture.code) : undefined;
    return picture && card ? [{ code: picture.code, card }] : [];
  });
}
