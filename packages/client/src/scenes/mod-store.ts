/**
 * Title > Mod Store (docs/custom-content-packs.md §11.6): browse the catalog of community packs, open one, install,
 * update or remove it.
 *
 * Two views in one scene. **Browse** is six tabs (All, Heroes, Scenarios, Extras, Installed, Credits) over a grid of
 * pack tiles, with a search box, a sort and tag chips over it (issue #734) and an offline notice when the catalog is the
 * saved copy; each tile leads with the pack's featured card (thumbnail, picture, or the pack's initial). Credits lists
 * the creators instead, and picking one shows their packs. **Pack** is one pack's page: the featured card(s), header,
 * scrolling text (description, credits, permission, requirement), a gallery of the pack's cards (from the preview before
 * an install, from the installed pack after), a status line (progress bar or error) and the buttons its state offers.
 *
 * This scene only draws. Which packs a tab shows, what the buttons are, progress words and error words are
 * `view/mod-store-model.ts`'s; whether a pack can be installed is `packs/pack-state.ts`'s; the install itself, in a
 * worker, is `packs/install-pack.ts`'s.
 *
 * Everything under the top bar is one Lit panel over the canvas (`mc-sheet`, `dom/dom-region.ts`), built at the rects the
 * layout models give: the tab rails (`mc-tab-rail`), the search box (`mc-search-field`, a real input), the tag chips
 * (`mc-filter-bar`), the pack tiles (`mc-media-row`), the pictures (`mc-picture-tile`) and the lists, which scroll
 * natively. The top bar and its Back and About buttons stay Phaser. Every press is a tap, so a swipe that ends over a
 * control fires nothing (CLAUDE.md, no tap on finger lift), and no control sits on a scrolling region: the pack page's
 * buttons are below its text panel, not over it.
 *
 * Pad and keyboard: Back, About, the tabs (LB / RB step them), the search box, sort and chips, then every tile; on a pack
 * page, Back then its buttons and the gallery's cards.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSearchDetail, McSearchFocusDetail, McSearchField, McSheet } from "@mc/ui";
import {
  customCardPrefix,
  officialCardsByPictureCode,
  parsePackAchievements,
  parsePackCardImagePath,
  type AnyCard,
  type PackIndex,
} from "@mc/content";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder, type Measured } from "../dom/sheet-builder.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { accent, hit, ink, motion, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import {
  CAMPAIGN_TOP_BAR,
  bangers,
  campaignFrame,
  drawTopBar,
  drawnPictureKey,
  heroPicture,
  isPhoneWidth,
  preloadDrawnPicture,
} from "../ui/campaign-chrome.js";
import { isPictureSettled, onPictureLoadFailed } from "../art/pictures.js";
import { PictureWait, settleWithin } from "../ui/picture-wait.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf } from "../ui/theme.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McButton } from "../ui/widgets.js";
import { fadeScreenIn, goToScreen, holdScreenFor } from "../ui/transitions.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { extrasRowCount, extrasTileRect } from "../view/extras-model.js";
import {
  MOD_STORE_TABS,
  modStoreTabLabel,
  modStoreTabRowsOf,
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
import { faceModelOf, statLineOf } from "../ui/generated-card-face.js";
import { currentCardsById, currentPool } from "../content/pool.js";
import { onPreviewArrived, previewInMemory, requestPreview } from "../packs/preview-client.js";
import { previewPictureUrl, type ParsedPackPreview } from "../packs/pack-preview.js";
import { PackLeases, houseRuleFaceFor, packFileArt, refreshPackArt } from "../art/pack-art.js";
import { onArtChange } from "../language-change.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import {
  GALLERY_HEADING_HEIGHT,
  galleryCardCount,
  galleryFocusKey,
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
  /** The scene Back returns to from the list (a screen that sent the player here, such as the room lobby); the Title otherwise. */
  readonly returnTo?: string;
}

const TAB_HEIGHT = 44;
/** The search row and each chip row. */
const CONTROL_HEIGHT = 40;
const CHIP_GAP = 8;
const campaignTopBar = (phone: boolean): number => (phone ? CAMPAIGN_TOP_BAR.phone : CAMPAIGN_TOP_BAR.wide);
const SCROLLBAR = 12;
const INK = surface.ink.hex;
const PAPER = surface.paper.hex;
const PARCHMENT = surface.parchment.hex;

/** The lists the panel scrolls, by their element key (`list:<key>`). */
type ListKey = "grid" | "credits" | "gallery" | "text";

/** One install in flight, or the last one's failure, for the pack whose page is open. */
interface InstallState {
  readonly id: string;
  readonly progress: InstallProgress | null;
  readonly error: string | null;
}

export class ModStoreScene extends Phaser.Scene {
  #tab: ModStoreTab = "all";
  /** A phone's search box, sort and chips are showing (`#toggleFinders`). */
  #findersOpen = false;
  /** The search box, tag chips, creator and sort (`view/mod-store-browse.ts`), kept across tabs and visits. */
  #filter: ModStoreFilter = EMPTY_FILTER;
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
  /**
   * The installed-pack reads (`view/latest-read.ts`): a load started before or during an Update all's refresh never
   * puts an older list back over a newer one.
   */
  readonly #installedReads = new LatestRead();
  #requirement: string | undefined;
  /** The panel: everything under the top bar, one Lit sheet made once a visit. */
  #region: DomRegion<McSheet> | null = null;
  /** The parts being built (the panel's top level, or a list's own while one is drawn). */
  #b!: SheetBuilder;
  /** What a press on each key does, this draw. */
  readonly #actions = new Map<string, () => void>();
  /** The list being drawn, if any, and where each list sits on the screen. */
  #listKey: ListKey | null = null;
  readonly #listViews: Partial<Record<ListKey, Rect>> = {};
  /** What each list was scrolled to, by what it shows (a tab's grid, a pack's gallery), kept across redraws and tabs. */
  readonly #scrollMem = new Map<string, number>();
  /** The memory id each drawn list reads and writes. */
  readonly #listIds = new Map<ListKey, string>();
  readonly #leases = new PackLeases();
  /** The page's cards, for the hover popover: where each picture sits (the screen's coordinates, list unscrolled). */
  #galleryHovers: { readonly slot: string; readonly rect: Rect; readonly data: Omit<HoverCardIdRect, keyof Rect> }[] =
    [];
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
  /** The desktop hover popover over the gallery's tiles (`ui/card-hover-preview.ts`), as in the set sheet. */
  #hover: HoverPreview | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #stops = new Map<string, FocusStop>();
  #order: string[] = [];
  #area: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** The caret is in the search box (the route and the pad stand aside while it is). */
  #searchFocused = false;
  #redrawQueued = false;
  #alive = false;
  #returnTo: string = SCENES.title;
  /** Where a pack tile's grid sits, for a stop to find its tile again after the page. */
  #buttons: McButton[] = [];

  constructor() {
    super(SCENES.modStore);
  }

  create(data: ModStoreSceneData = {}): void {
    this.#alive = true;
    this.#redrawQueued = false;
    this.#region = null;
    this.#searchFocused = false;
    this.#catalogUrl = data.catalogUrl;
    this.#packId = data.packId ?? null;
    this.#returnTo = data.returnTo ?? SCENES.title;
    // An install still running from an earlier visit carries on (the scene instance is reused); only a stale failure goes.
    if (this.#install?.error) this.#install = null;
    // How the last Update all ended is news for the visit it ran in; a run still going carries on.
    if (!this.#updateRun) this.#updateResult = null;
    this.#confirmingRemove = false;
    this.#removing = false;
    this.#error = null;
    this.#status = "loading";
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#hints = new GlyphHints(this);
    // A pad that put the caret in the search box can take it out again (B, A or Start). Bound before the route, so the
    // A that focuses the field is not also read as the press that leaves it (`text-field-escape.ts`).
    bindTextFieldEscape(
      this,
      () => ({
        focused: this.#searchFocused,
        blur: () => this.#searchField()?.blurInput(),
      }),
      () => this.#overlayUp(),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#back(),
      // X (G / H on the keyboard) reopens the heads-up about mods.
      onToggle: () => this.#showNotice(),
      onTab: (direction) => this.#stepTab(direction),
      onPage: (direction) => this.#scrollList(direction * Math.max(80, this.#area.height * 0.6)),
      onScroll: (_dx, dy) => this.#scrollList(dy),
      blocked: () => this.scene.isActive(SCENES.inspect) || this.#searchFocused,
    });
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    // A pack finishing its load (after an install, or at boot) and a picture arriving both redraw the page.
    const offStatuses = onActivePackStatuses(() => this.#requestRedraw());
    const offArt = onArtChange(() => this.#requestRedraw());
    // A preview or a pack picture arriving from the pack host redraws what shows it.
    const offPreview = onPreviewArrived(() => this.#requestRedraw());
    const offPictures = onPreviewArtArrived(() => this.#requestRedraw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      offStatuses();
      offArt();
      offPreview();
      offPictures();
      this.#leases.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", this.#draw, this);
      this.#hints.dispose();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
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
    goToScreen(this, this.#returnTo);
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
          this.#requestRedraw();
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

  // ---- The panel ------------------------------------------------------------------------------------------------

  #press(key: string, run: () => void): void {
    this.#actions.set(key, run);
  }

  /** A line of label type (capitals, tracked) at `size`, fitted to `width`. */
  #label(x: number, y: number, text: string, size: number, width: number, alpha = 1): Measured {
    return this.#b.text(x, y, text, typeRole.label, { size, color: INK, fitWidth: width, alpha });
  }

  /** A button with its press and focus stop. A button that cannot be used now stays drawn, dimmed, and says why on hover. */
  #button(options: {
    readonly key: string;
    readonly rect: Rect;
    readonly label: string;
    readonly look: "primary" | "secondary" | "quiet" | "onInk";
    readonly type?: TypeSpec;
    readonly run: () => void;
    readonly selected?: boolean;
    readonly enabled?: boolean;
    readonly reason?: string;
  }): void {
    const enabled = options.enabled ?? true;
    const run = enabled ? options.run : (): void => undefined;
    this.#press(options.key, run);
    this.#b.button({
      key: options.key,
      rect: options.rect,
      label: options.label,
      look: options.look,
      type: options.type ?? typeRole.label,
      ...(options.selected ? { selected: true } : {}),
      ...(enabled ? {} : { disabled: options.reason ?? (true as const) }),
    });
    this.#stop(options.key, options.rect, run);
  }

  /**
   * A focus stop. In a scrolling list its box is read off the panel, so it follows the scroll, and taking focus scrolls it
   * into view; `rect` is then in the list's content space.
   */
  #stop(key: string, rect: Rect, activate: () => void, extra: Partial<FocusStop> = {}): void {
    const list = this.#listKey;
    if (list === null) {
      this.#stops.set(key, { rect, activate, ...extra });
      this.#order.push(key);
      return;
    }
    const view = this.#listViews[list]!;
    this.#stops.set(key, {
      rect: () => this.#elementRect(key, { ...rect, y: rect.y + view.y }),
      activate,
      ...extra,
      view: () => this.#elementRect(`list:${list}`, view),
      ensureVisible: () => this.#region?.element.elementOf(key)?.scrollIntoView({ block: "nearest" }),
    });
    this.#order.push(key);
  }

  /** An element of the panel in game coordinates, or `fallback` while it is not drawn. */
  #elementRect(key: string, fallback: Rect): Rect {
    const region = this.#region;
    const found = region?.element.elementOf(key);
    return region && found ? region.rectOf(found) : fallback;
  }

  /** The search box's element, while it is drawn. */
  #searchField(): McSearchField | null {
    return (this.#region?.element.elementOf("search") as McSearchField | null) ?? null;
  }

  #scroller(key: ListKey): HTMLElement | null {
    return this.#region?.element.elementOf(`list:${key}`) ?? null;
  }

  /** The right stick and Page Up / Down: the list on screen (the gallery, then the grid, then the text). */
  #scrollList(pixels: number): void {
    const key = (["gallery", "grid", "credits", "text"] as const).find((k) => this.#scroller(k) !== null);
    if (key) this.#scroller(key)?.scrollBy({ top: pixels });
  }

  /** Where a list was scrolled to is kept by what it shows. */
  #rememberScrolls(): void {
    for (const [key, id] of this.#listIds) {
      const element = this.#scroller(key);
      if (element) this.#scrollMem.set(id, element.scrollTop);
    }
  }

  #afterMount(): void {
    for (const [key, id] of this.#listIds) {
      const element = this.#scroller(key);
      const kept = this.#scrollMem.get(id) ?? 0;
      if (element && element.scrollTop !== kept) element.scrollTop = kept;
    }
  }

  /** A scrolling list in `rect`: its parts are built at the list's own coordinates (`top` 0), `build` returns the height. */
  #list(key: ListKey, id: string, inner: Rect, build: (x: number, width: number) => number): void {
    const rect: Rect = { x: inner.x, y: inner.y, width: inner.width - SCROLLBAR, height: inner.height };
    const outer = this.#b;
    this.#listViews[key] = inner;
    this.#listIds.set(key, id);
    this.#listKey = key;
    try {
      outer.scrollFit(`list:${key}`, rect, (list) => {
        this.#b = list;
        return build(rect.x, rect.width);
      });
    } finally {
      this.#b = outer;
      this.#listKey = null;
    }
  }

  /** A box in the screen's coordinates from one drawn in the list being built (its content space). */
  #inScreen(rect: Rect): Rect {
    const list = this.#listKey;
    return list === null ? rect : { ...rect, y: rect.y + this.#listViews[list]!.y };
  }

  #scroll(tab: ModStoreTab): { reset: () => void } {
    return { reset: () => this.#scrollMem.set(`grid:${tab}`, 0) };
  }

  /** The pictures the popover can show now: the featured faces, and the gallery's, clipped to the scrolled list. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
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
    const view = this.#listViews.gallery;
    if (!view) return found;
    const scrolled = this.#scroller("gallery")?.scrollTop ?? 0;
    for (const one of this.#galleryHovers) {
      const picture = clipHoverRect({ ...one.rect, y: one.rect.y - scrolled }, view);
      if (picture) found.set(one.slot, { ...picture, ...one.data, through: true });
    }
    return found;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#rememberScrolls();
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    this.#hints.reset();
    this.#actions.clear();
    this.#leases.begin();
    this.#listIds.clear();
    this.#faceHovers = [];
    this.#galleryHovers = [];
    this.#pageContext = null;
    this.#stops = new Map();
    this.#order = [];

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);

    const tile =
      this.#packId === null
        ? null
        : (tilesOf(this.#index, this.#context(), "all").find((one) => one.id === this.#packId) ?? null);
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
      backLabel: phone ? "◂" : tile ? t("modStore.back.store") : t("modStore.back.title"),
      onBack: () => this.#back(),
      hints: this.#hints,
      title: t("title.modStore"),
      // Quin, 2026-11-13: the store and community packs are new; say so on every store screen.
      badge: "Beta",
      ...(this.#installed.size > 0 ? { right: t("modStore.installedCount", { count: this.#installed.size }) } : {}),
      rightInset: aboutWidth + 12,
      reserveRight: aboutWidth + 12,
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) this.#stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
    if (bar.backRect) this.#order.push("back");
    const aboutPress = (): void => this.#showNotice();
    const about = new McButton(this, {
      kind: "onInk",
      label: modNoticeControlLabelOf(phone),
      type: typeRole.backLabel,
      rect: aboutRect,
      onClick: aboutPress,
    });
    this.#buttons.push(about);
    this.#hints.button(about, ["guide"], "ink");
    this.#stops.set("about", { rect: aboutRect, activate: aboutPress });
    this.#order.push("about");

    // Under the bar: one panel, built at the layout's own rects.
    const area: Rect = { x: 0, y: bar.height, width, height: height - bar.height };
    this.#area = area;
    this.#b = new SheetBuilder(this.game, { x: area.x, y: area.y }, isDesktopType);
    if (tile) this.#drawPage(tile, { width, height, phone, gutter, top: bar.height });
    else this.#drawBrowse({ width, height, phone, gutter, top: bar.height });

    // Rendered before the route reads its stops, so a stop inside a list can find its element.
    this.#mount(area);
    this.#leases.end();
    this.#afterMount();
    this.#route?.set(this.#order, this.#stops);
    this.#hover?.onDraw();
  }

  /** Hands the built parts to the panel (made once, so a list's scroll survives a redraw) and renders them now. */
  #mount(area: Rect): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      element.addEventListener("mc-inspect", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      // A pack picture's blob URL went stale before its lazy image loaded: read it again, once (McSheet's retry).
      element.addEventListener("mc-image-error", (event) => {
        const { key, src } = (event as CustomEvent<{ key: string; src: string | null }>).detail;
        refreshPackArt(key, src ?? undefined);
      });
      element.addEventListener("mc-search", (event) => {
        const { value } = (event as CustomEvent<McSearchDetail>).detail;
        if (value !== this.#filter.text) this.#setFilter({ ...this.#filter, text: value });
      });
      element.addEventListener("mc-search-focus", (event) => {
        this.#searchFocused = (event as CustomEvent<McSearchFocusDetail>).detail.focused;
      });
      this.#region = new DomRegion(this, element, area);
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas; the popover itself
      // is drawn in the canvas, so it is left out of the panel to be seen through it.
      this.#region.forwardMouseMoves();
      this.#region.setHoles(() => {
        const popover = this.#hover?.shownRect;
        return popover ? [popover] : [];
      });
    }
    this.#region.setRect(area);
    this.#region.element.nodes = this.#b.nodes;
    renderNow(this.#region.element);
  }

  // ---- Browse ---------------------------------------------------------------------------------------------------

  /**
   * The beta caption above the store's tabs: a comic narration box (caution yellow, ink border, a hard offset shadow,
   * square corners and no tail, so it never reads as a speech bubble). Returns the y below it, shadow included.
   */
  #drawBetaCaption(at: { x: number; y: number; width: number }, phone: boolean): number {
    const b = this.#b;
    const pad = phone ? 8 : 12;
    const shadow = 4;
    const boxWidth = at.width - shadow;
    const headingSpec = bangers(phone ? 16 : 20);
    const headingText = MOD_STORE_BETA_CAPTION.heading.toUpperCase();
    const heading = b.measure(headingText, headingSpec, { letterSpacing: 1 });
    const bodyX = at.x + pad + heading.width + (phone ? 12 : 20);
    const bodyText = phone ? MOD_STORE_BETA_CAPTION.phoneBody : MOD_STORE_BETA_CAPTION.body;
    const bodyWidth = at.x + boxWidth - pad - bodyX;
    const body = b.measure(bodyText, typeRole.body, { ...(phone ? { size: 12 } : {}), wrapWidth: bodyWidth });
    const boxHeight = Math.max(heading.height, body.height) + pad * 2;
    b.box({ x: at.x + shadow, y: at.y + shadow, width: boxWidth, height: boxHeight }, { fill: INK });
    b.box({ x: at.x, y: at.y, width: boxWidth, height: boxHeight }, { fill: signal.caution.hex });
    b.box({ x: at.x, y: at.y, width: boxWidth, height: boxHeight }, { stroke: INK, strokeWidth: 2 });
    b.text(at.x + pad, at.y + pad, headingText, headingSpec, { color: INK, letterSpacing: 1 });
    // A thin ink rule sets the heading apart from the text, like a caption's lead-in.
    b.box({ x: bodyX - (phone ? 6 : 10), y: at.y + pad, width: 2, height: boxHeight - pad * 2 }, { fill: INK });
    b.text(bodyX, at.y + pad, bodyText, typeRole.body, {
      ...(phone ? { size: 12 } : {}),
      color: INK,
      wrapWidth: bodyWidth,
    });
    return at.y + boxHeight + shadow;
  }

  #drawBrowse(frame: { width: number; height: number; phone: boolean; gutter: number; top: number }): void {
    const { width, phone, gutter, top } = frame;
    const b = this.#b;
    const captionBottom = this.#drawBetaCaption({ x: gutter, y: top + 12, width: width - gutter * 2 }, phone);
    // A phone's search box, sort and chips stay folded away behind a magnifier until it is pressed (Quin, 2026-11-15:
    // phones are short on height), unless a search, tag or creator is narrowing the list.
    const finding = phone && this.#tab !== "credits" && this.#status !== "loading";
    const open = finding && (this.#findersOpen || isFiltering(this.#filter));
    const toggleSize = TAB_HEIGHT;
    const railWidth = width - gutter * 2 - (finding ? toggleSize + CHIP_GAP : 0);
    // Six tabs on a narrow window would cut their labels short: there they take two rows.
    const tabRows = modStoreTabRowsOf(railWidth);
    const tabRect: Rect = {
      x: gutter,
      y: captionBottom + (phone ? 10 : 12),
      width: railWidth,
      height: TAB_HEIGHT * tabRows.length,
    };
    tabRows.forEach((row, rowIndex) => {
      const rowRect: Rect = { ...tabRect, y: tabRect.y + rowIndex * TAB_HEIGHT, height: TAB_HEIGHT };
      b.tabRail(
        rowRect,
        row.map((tab) => ({ id: tab.id, label: modStoreTabLabel(tab), selected: tab.id === this.#tab })),
        { prefix: "tab:" },
      );
      const tabWidth = rowRect.width / row.length;
      row.forEach((tab, index) => {
        const key = `tab:${tab.id}`;
        const select = (): void => this.#select(tab.id);
        this.#press(key, select);
        this.#stops.set(key, {
          rect: { ...rowRect, x: rowRect.x + index * tabWidth, width: tabWidth },
          activate: select,
        });
        this.#order.push(key);
      });
    });
    if (finding) {
      const toggleRect: Rect = { x: width - gutter - toggleSize, y: tabRect.y, width: toggleSize, height: toggleSize };
      const toggle = (): void => this.#toggleFinders();
      this.#button({
        key: "finders-toggle",
        rect: toggleRect,
        label: "",
        look: "secondary",
        selected: open,
        run: toggle,
      });
      // The magnifier, in whichever ink the button's own state uses (paper on the ink-filled selected state).
      const color = open ? "var(--mc-line-paper, #f4efe3)" : "var(--mc-line-ink, #14110e)";
      const cx = 22 - 2;
      b.svg(
        toggleRect,
        [toggleSize, toggleSize],
        [
          { k: "circle", cx, cy: cx, r: 7, stroke: color, sw: 2.5 },
          { k: "line", x1: cx + 5, y1: cx + 5, x2: cx + 11, y2: cx + 11, stroke: color, sw: 3 },
        ],
        "finders-icon",
      );
    }
    this.#drawBrowseBody(frame, tabRect.y + tabRect.height + (phone ? 12 : 14), !phone || open);
  }

  #toggleFinders(): void {
    const open = this.#findersOpen || isFiltering(this.#filter);
    this.#findersOpen = !open;
    if (open) this.#filter = { ...EMPTY_FILTER, sort: this.#filter.sort };
    this.#draw();
    if (!open) this.#searchField()?.focusInput();
  }

  /** Everything under the tabs: the offline notice, then the finders (when shown) and the grid, or Credits. */
  #drawBrowseBody(
    frame: { width: number; height: number; phone: boolean; gutter: number; top: number },
    top: number,
    finders: boolean,
  ): void {
    const { width, height, phone, gutter } = frame;
    const b = this.#b;
    let listTop = top;
    if (this.#offline && this.#status === "ready") {
      const box: Rect = { x: gutter, y: listTop, width: width - gutter * 2, height: 34 };
      b.box(box, { fill: INK });
      b.text(box.x + 12, box.y + box.height / 2, t("modStore.offline"), typeRole.rowTitle, {
        size: 12,
        color: PAPER,
        origin: [0, 0.5],
        fitWidth: box.width - 24,
      });
      listTop += box.height + 10;
    }
    if (this.#status === "ready" && this.#tab !== "credits") {
      listTop = this.#drawUpdateBar({ x: gutter, y: listTop, width: width - gutter * 2 }, phone);
    }
    const restRect = (from: number): Rect => ({
      x: gutter,
      y: from,
      width: width - gutter * 2,
      height: Math.max(60, height - from - gutter),
    });
    const message = (text: string, at: Rect): number =>
      this.#b.text(at.x, at.y, text, typeRole.body, { size: 14, color: INK, alpha: ink.secondary, wrapWidth: at.width })
        .height;

    if (this.#status === "loading") {
      message(t("modStore.loading"), restRect(listTop));
      return;
    }
    const tabTiles = tilesOf(this.#index, this.#context(), this.#tab);
    if (this.#status === "failed" && tabTiles.length === 0) {
      const at = restRect(listTop);
      message(t("modStore.loadFailed"), at);
      this.#button({
        key: "retry",
        rect: { x: at.x, y: at.y + 56, width: 160, height: hit.target },
        label: t("modStore.tryAgain"),
        look: "primary",
        run: () => this.#retry(),
      });
      return;
    }
    if (this.#tab === "credits") {
      this.#drawCredits(creditsOf(tabTiles), restRect(listTop), phone);
      return;
    }
    if (tabTiles.length === 0) {
      message(emptyTextOf(this.#tab), restRect(listTop));
      return;
    }
    if (finders) {
      listTop = this.#drawFinders(tabTiles, { x: gutter, y: listTop, width: width - gutter * 2 }, phone);
    }
    const tiles = filterTiles(tabTiles, this.#filter);
    const listRect = restRect(listTop);
    if (tiles.length === 0) {
      message(t("modStore.noMatch"), listRect);
      return;
    }
    const grid = modStoreGridOf(listRect.width - SCROLLBAR, phone);
    const rows = extrasRowCount(tiles.length, grid);
    this.#list("grid", `grid:${this.#tab}`, listRect, (x) => {
      tiles.forEach((tile, index) => {
        const rowIndex = Math.floor(index / grid.columns);
        const rect = extrasTileRect(index, grid, { x, y: rowIndex * grid.rowHeight });
        this.#drawTile(tile, rect);
        const open = (): void => this.#openPack(tile);
        this.#press(`tile:${tile.id}`, open);
        this.#stop(`tile:${tile.id}`, rect, open);
      });
      return rows * grid.rowHeight;
    });
  }

  /**
   * The finders over a tab's grid (issue #734): the search box and the sort, then a row of chips (the creator picked on
   * Credits, then the tab's tags, the most used first, then Clear) and the count of what shows. Returns the y below.
   */
  #drawFinders(tabTiles: readonly ModStoreTile[], at: { x: number; y: number; width: number }, phone: boolean): number {
    const b = this.#b;
    const filter = this.#filter;
    const sortWidth = phone ? 112 : 150;
    const searchRect: Rect = { x: at.x, y: at.y, width: at.width - sortWidth - CHIP_GAP, height: CONTROL_HEIGHT };
    b.search(searchRect, {
      key: "search",
      value: filter.text,
      placeholder: t("modStore.search"),
      clearLabel: t("modStore.clearSearch"),
    });
    // The pad's A on the box puts the caret in; the route stands aside until it leaves.
    this.#stops.set("search", { rect: searchRect, activate: () => this.#searchField()?.focusInput() });
    this.#order.push("search");
    const sortRect: Rect = { x: at.x + at.width - sortWidth, y: at.y, width: sortWidth, height: CONTROL_HEIGHT };
    this.#button({
      key: "sort",
      rect: sortRect,
      label: `⇅ ${t(filter.sort === "name" ? "modStore.sort.name" : "modStore.sort.newest")}`,
      look: "secondary",
      run: () => this.#setFilter({ ...this.#filter, sort: this.#filter.sort === "name" ? "newest" : "name" }),
    });

    // The chips: the creator first (picked on Credits; its ✕ undoes that), the tags, then Clear while anything narrows.
    type Chip = { id: string; label: string; count?: number; selected: boolean; mark: boolean; press: () => void };
    const chips: Chip[] = [];
    if (filter.creator !== null) {
      chips.push({
        id: "creator",
        label: `${t("modStore.byCreator", { name: filter.creator })}  ✕`,
        selected: true,
        mark: false,
        press: () => this.#setFilter({ ...this.#filter, creator: null }),
      });
    }
    for (const chip of tagChipsOf(tabTiles, filter.tags)) {
      chips.push({
        id: `tag:${chip.tag}`,
        label: chip.tag,
        count: chip.count,
        selected: chip.on,
        mark: true,
        press: () => this.#setFilter({ ...this.#filter, tags: toggleTag(this.#filter.tags, chip.tag) }),
      });
    }
    const filtering = isFiltering(filter);
    const clear: Chip | null = filtering
      ? {
          id: "clear",
          label: t("modStore.clear"),
          selected: false,
          mark: false,
          press: () => this.#setFilter({ ...EMPTY_FILTER, sort: this.#filter.sort }),
        }
      : null;
    const chipType = { ...typeRole.label, size: 11 };
    const wordsOf = (chip: Chip): string =>
      chip.selected
        ? chip.mark
          ? `✓ ${chip.label}`
          : chip.label
        : chip.count === undefined
          ? chip.label
          : `${chip.label} ${chip.count}`;
    const measure = (chip: Chip): number =>
      Math.ceil(b.measure(wordsOf(chip).toUpperCase(), chipType, { letterSpacing: 1.2 }).width) + 24;
    // Clear keeps the first row's end: the tags pack into what is left.
    const clearWidth = clear ? measure(clear) : 0;
    const packed = packChips(chips, measure, at.width - (clear ? clearWidth + CHIP_GAP : 0), phone ? 1 : 2, CHIP_GAP);
    const chipTop = at.y + CONTROL_HEIGHT + 10;
    const shown = packed.slots.map((slot) => ({ chip: slot.item, x: slot.x, row: slot.row, width: slot.width }));
    const chipRows = Math.max(packed.rows, clear ? 1 : 0);
    // One bar for the tags (wrapped to the rows packed) and a button for Clear at the first row's end.
    if (shown.length > 0) {
      const barWidth = at.width - (clear ? clearWidth + CHIP_GAP : 0);
      b.filterBar(
        "chips",
        { x: at.x, y: chipTop, width: barWidth, height: packed.rows * (CONTROL_HEIGHT + CHIP_GAP) - CHIP_GAP },
        shown.map(({ chip, width }) => ({
          id: chip.id,
          label: chip.label,
          ...(chip.count !== undefined ? { count: chip.count } : {}),
          selected: chip.selected,
          width,
          mark: chip.mark,
        })),
        { prefix: "chip:", rows: packed.rows, rowHeight: CONTROL_HEIGHT },
      );
      for (const { chip, x, row, width } of shown) {
        const rect: Rect = {
          x: at.x + x,
          y: chipTop + row * (CONTROL_HEIGHT + CHIP_GAP),
          width,
          height: CONTROL_HEIGHT,
        };
        const key = `chip:${chip.id}`;
        this.#press(key, chip.press);
        this.#stops.set(key, { rect: () => this.#elementRect(key, rect), activate: chip.press });
        this.#order.push(key);
      }
    }
    if (clear) {
      this.#button({
        key: "chip:clear",
        rect: { x: at.x + at.width - clearWidth, y: chipTop, width: clearWidth, height: CONTROL_HEIGHT },
        label: clear.label,
        look: "secondary",
        type: chipType,
        run: clear.press,
      });
    }
    const y = chipRows > 0 ? chipTop + chipRows * (CONTROL_HEIGHT + CHIP_GAP) - CHIP_GAP : at.y + CONTROL_HEIGHT;

    // The count: how many show, and of how many while something narrows the list.
    const count = this.#label(
      at.x,
      y + 8,
      resultCountText(filterTiles(tabTiles, filter).length, tabTiles.length, filtering).toUpperCase(),
      11,
      at.width,
      ink.secondary,
    );
    return y + 8 + count.height + 8;
  }

  /** The Credits tab: one row per creator, their name, how many packs and which; a press shows their packs on All. */
  #drawCredits(credits: readonly CreatorCredit[], rect: Rect, phone: boolean): void {
    const intro = this.#b.text(rect.x, rect.y, t("modStore.credits.intro"), typeRole.body, {
      size: phone ? 12 : 14,
      color: INK,
      alpha: ink.secondary,
      wrapWidth: rect.width,
      maxLines: 2,
    });
    const introHeight = Math.min(intro.height, (phone ? 12 : 14) * 1.2 * 2 + 4);
    if (credits.length === 0) {
      this.#b.text(rect.x, rect.y + introHeight + 12, emptyTextOf("credits"), typeRole.body, { size: 14, color: INK });
      return;
    }
    const top = rect.y + introHeight + 12;
    const listRect: Rect = { x: rect.x, y: top, width: rect.width, height: Math.max(60, rect.y + rect.height - top) };
    const rowHeight = phone ? 72 : 56;
    const gap = 8;
    this.#list("credits", "credits", listRect, (x, width) => {
      credits.forEach((credit, index) => {
        const row: Rect = { x, y: index * (rowHeight + gap), width, height: rowHeight };
        this.#drawCredit(credit, row, phone);
        const key = `creator:${credit.name}`;
        const open = (): void => this.#showCreator(credit);
        this.#b.tap(key, row);
        this.#press(key, open);
        this.#stop(key, row, open);
      });
      return credits.length * (rowHeight + gap);
    });
  }

  /** One creator's row: a red bar down the left edge, as a comic's credits box, their name, pack count and packs. */
  #drawCredit(credit: CreatorCredit, rect: Rect, phone: boolean): void {
    const b = this.#b;
    b.box(rect, { fill: PARCHMENT });
    b.box(
      { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 },
      { stroke: INK, strokeWidth: 2 },
    );
    b.box({ x: rect.x + 2, y: rect.y + 2, width: 6, height: rect.height - 4 }, { fill: accent.heroRed.hex });
    const x = rect.x + 20;
    const textWidth = rect.x + rect.width - x - 12;
    const countText = `${packCountText(credit.packs.length).toUpperCase()} ▸`;
    const count = b.text(rect.x + rect.width - 12, rect.y + 10, countText, typeRole.label, {
      size: 11,
      color: INK,
      alpha: ink.secondary,
      origin: [1, 0],
    });
    const name = b.text(x, rect.y + 6, credit.name, bangers(phone ? 20 : 24), {
      color: INK,
      fitWidth: textWidth - count.width - 12,
    });
    b.text(x, rect.y + 6 + name.height + 2, creditLineOf(credit), typeRole.body, {
      size: phone ? 11 : 12,
      color: INK,
      alpha: 0.9,
      wrapWidth: textWidth,
      maxLines: phone ? 2 : 1,
    });
  }

  /** A pack's art for `source`, as the panel takes it (its URL, and the key to read it again by). */
  #src(source: ArtSource | null): { src: string | null; retry?: string } {
    return this.#leases.image(source);
  }

  /** The art for pack `packId`'s card `record`, or null while it loads or when there is none. */
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

  /** The featured card's preview for a tile, requesting it the first time a visible tile asks. */
  #previewOf(tile: ModStoreTile): ParsedPackPreview | null {
    if (!tile.previewUrl) return null;
    const known = previewInMemory(tile.previewUrl);
    if (known === undefined) void requestPreview(tile.previewUrl, tile.id);
    return known ?? null;
  }

  /** A pack's cover, whole: the installed copy's own file first, so it shows offline, else the catalog's thumbnail. */
  #coverSource(packId: string, cover: PackCover): ArtSource | null {
    return (
      (cover.path !== undefined ? packFileArt(packId, cover.path) : null) ??
      (cover.url !== undefined ? previewPictureFor(cover.url) : null)
    );
  }

  /**
   * A tile's left side, a portrait card: the pack's cover, else the catalog's thumbnail, else the featured card's
   * picture, else the pack's initial, big and faint, on ink while nothing has loaded.
   */
  #thumbOf(tile: ModStoreTile): { src: string | null; retry?: string; fit: "cover" | "contain" } {
    const preview = this.#previewOf(tile);
    const art = tileArtOf(tile, preview, artLanguageNow(), ruleCardsOf(tile));
    if (art.kind === "cover") {
      const source = this.#coverSource(tile.id, art);
      if (source) return { ...this.#src(source), fit: "contain" };
    }
    if (art.kind === "thumbnail") return { src: art.url, fit: "cover" };
    // A pack with a cover shows the initial while the cover loads, not the featured face it would then swap away from.
    const first =
      art.kind === "cover" ? undefined : featuredFacesOf(preview, tile.baseUrl, artLanguageNow(), ruleCardsOf(tile))[0];
    if (first?.pictureUrl) {
      const source = previewPictureFor(first.pictureUrl);
      if (source) return { ...this.#src(source), fit: "contain" };
    }
    return { src: null, fit: "contain" };
  }

  /** One pack's tile (`mc-media-row`): its picture, name, byline, summary, size and the state chip. */
  #drawTile(tile: ModStoreTile, rect: Rect): void {
    // A symbol and the words: the state never rests on color alone. A pack Update all could not update says so on its
    // own tile (issue #957), so every failure can be found.
    const failed = tile.state === "update" && this.#failedIds().has(tile.id);
    const mark = failed
      ? "!"
      : { install: "+", installed: "✓", update: "↑", "needs-app-update": "!", withdrawn: "✕" }[tile.state];
    const thumb = this.#thumbOf(tile);
    this.#b.mediaRow(`tile:${tile.id}`, rect, {
      heading: tile.name,
      meta: `${tile.kindLabel} · by ${tile.creator}`,
      summary: tile.summary,
      foot: tile.size,
      badge: `${mark} ${failed ? t("modStore.updateAll.retry") : tile.stateLabel}`,
      solid: tile.state === "install" || tile.state === "update",
      src: thumb.src,
      ...(thumb.retry !== undefined ? { retry: thumb.retry } : {}),
      letter: tile.name.charAt(0).toUpperCase(),
      fit: thumb.fit,
      focusY: 0.3,
    });
  }

  // ---- Pack page ------------------------------------------------------------------------------------------------

  /** A state chip (a mark and the words), its left edge at `x`, at `y`; returns its width. */
  #drawChip(tile: ModStoreTile, x: number, y: number, maxWidth: number): void {
    const failed = tile.state === "update" && this.#failedIds().has(tile.id);
    const mark = failed
      ? "!"
      : { install: "+", installed: "✓", update: "↑", "needs-app-update": "!", withdrawn: "✕" }[tile.state];
    const solid = tile.state === "install" || tile.state === "update";
    const b = this.#b;
    const text = `${mark} ${failed ? t("modStore.updateAll.retry") : tile.stateLabel}`;
    const size = b.measure(text, typeRole.label, { size: 9, fitWidth: maxWidth - 14, letterSpacing: 1.2 });
    const w = size.width + 14;
    const h = size.height + 8;
    if (solid) b.box({ x, y, width: w, height: h }, { fill: accent.heroRed.hex });
    else b.box({ x: x + 1, y: y + 1, width: w - 2, height: h - 2 }, { stroke: INK, strokeWidth: 2 });
    b.text(x + 7, y + 4, text, typeRole.label, {
      size: 9,
      color: solid ? PAPER : INK,
      fitWidth: maxWidth - 14,
    });
  }

  #drawPage(
    tile: ModStoreTile,
    frame: { width: number; height: number; phone: boolean; gutter: number; top: number },
  ): void {
    const { width, height, phone, gutter, top } = frame;
    const b = this.#b;
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
      const source2 = this.#coverSource(tile.id, cover);
      b.pictureTile(rect, { key: "page-cover", ...this.#src(source2), fit: "contain", frame: 0 });
    }
    if (layout.squareThumb) {
      const thumb = this.#thumbOf(tile);
      b.pictureTile(layout.faces[0]!, {
        key: "page-thumb",
        src: thumb.src,
        ...(thumb.retry !== undefined ? { retry: thumb.retry } : {}),
        fit: thumb.fit,
        frame: 0,
        missing: tile.name.charAt(0).toUpperCase(),
      });
    } else {
      layout.faces.forEach((rect, index) => {
        const face = faces[index]!;
        const art = packCards
          ? ((face.path ? packFileArt(tile.id, face.path) : null) ?? (rule ? null : artFor(face.card, face.face)))
          : face.pictureUrl
            ? previewPictureFor(face.pictureUrl)
            : null;
        b.pictureTile(rect, {
          key: `page-face:${index}`,
          ...this.#src(art),
          fit: "contain",
          frame: 2,
          missing: face.card.name as string,
        });
        this.#faceHovers.push({
          rect: { ...rect, y: rect.y + top },
          card: face.card,
          face: face.face,
          art: art ?? undefined,
        });
      });
    }
    const textX = layout.title.x;
    const textWidth = layout.title.width;
    const headY = layout.title.y;
    const name = b.text(textX, headY, page.title, bangers(phone ? 24 : 32), { color: INK, fitWidth: textWidth });
    const by = b.text(textX, headY + name.height + 2, page.byline, typeRole.rowTitle, {
      size: 13,
      color: INK,
      fitWidth: textWidth,
    });
    const meta = b.text(textX, headY + name.height + 2 + by.height + 4, page.meta, typeRole.body, {
      size: 11,
      color: INK,
      alpha: ink.secondary,
      wrapWidth: textWidth,
      maxLines: 2,
    });
    const metaHeight = Math.min(meta.height, 11 * 1.2 * 2 + 4);
    this.#drawChip(tile, textX, headY + name.height + 2 + by.height + 4 + metaHeight + 8, textWidth);

    // The scrolling text: the load status leads (an installed pack says whether it is working, or why it is not).
    const loadStatus = loadStatusOf(
      installed !== undefined,
      activePackStatuses().find((one) => one.id === tile.id),
      tile.kind,
    );
    const body = loadStatus ? `${loadStatusText(loadStatus)}\n\n${page.body}` : page.body;
    const textRect = layout.text;
    b.box(textRect, { fill: PARCHMENT });
    b.box(
      { x: textRect.x + 1, y: textRect.y + 1, width: textRect.width - 2, height: textRect.height - 2 },
      { stroke: INK, strokeWidth: 2 },
    );
    const textInner: Rect = {
      x: textRect.x + 8,
      y: textRect.y + 6,
      width: textRect.width - 16,
      height: textRect.height - 12,
    };
    this.#list("text", `text:${tile.id}`, textInner, (x, w) => {
      const text = this.#b.text(x, 0, body, typeRole.body, { color: INK, wrapWidth: w });
      return text.height + 4;
    });

    // Footer: status line, then buttons (below the gallery, never over it).
    this.#requirement = page.requirement;
    this.#drawStatus(running, this.#error, this.#requirement, layout.status);
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
      this.#button({
        key: `action:${action.id}`,
        rect,
        label: action.label,
        look: action.kind,
        enabled: action.enabled,
        ...(action.reason ? { reason: action.reason } : {}),
        run: () => this.#act(tile, action),
      });
    });

    if (layout.gallery) {
      const { count, list } = layout.gallery;
      const heading = t(packCards ? "modStore.cards" : "modStore.cardsPreview");
      this.#label(
        count.x + 2,
        count.y + 3,
        `${heading}  ·  ${galleryCountText(cardCount)}`,
        11,
        count.width,
        ink.secondary,
      );
      this.#drawGallery(list, sections, phone, tile.id);
    }
  }

  // ---- The pack's cards -----------------------------------------------------------------------------------------

  /**
   * A scrolling gallery of the pack's cards in groups (hero, villain, nemesis and obligation, deck), each a picture over a
   * name and type caption with its quantity. Pictures load lazily as the tiles scroll into view; a card without one says
   * its name where the picture would be. A tap (or a hold) reads one in Inspect.
   */
  #drawGallery(rect: Rect, sections: readonly GallerySection[], phone: boolean, packId: string): void {
    const grid = galleryGridOf(rect.width - SCROLLBAR, phone);
    const rows = galleryRowsOf(sections, grid.columns);
    this.#list("gallery", `gallery:${packId}`, rect, (x) => {
      let y = 0;
      rows.forEach((row, rowIndex) => {
        const rowHeight = row.kind === "heading" ? GALLERY_HEADING_HEIGHT : grid.rowHeight;
        const rowRect: Rect = {
          x,
          y,
          width: grid.tileWidth * grid.columns + grid.gap * (grid.columns - 1),
          height: rowHeight,
        };
        if (row.kind === "heading") this.#drawGalleryHeading(row, rowRect, rowIndex);
        else {
          row.cards.forEach((card, column) => {
            this.#drawGalleryTile(card, extrasTileRect(column, grid, rowRect), grid);
          });
        }
        y += rowHeight;
      });
      return y;
    });
  }

  #drawGalleryHeading(row: Extract<GalleryRow, { kind: "heading" }>, rect: Rect, index: number): void {
    const b = this.#b;
    b.text(rect.x, rect.y + rect.height / 2, `${row.title}  ·  ${row.count}`, typeRole.label, {
      size: 11,
      color: INK,
      origin: [0, 0.5],
      fitWidth: rect.width,
    });
    b.box(
      { x: rect.x, y: rect.y + rect.height - 2, width: rect.width, height: 2 },
      { fill: INK, key: `gallery-rule:${index}` },
    );
  }

  #drawGalleryTile(card: GalleryCard, rect: Rect, grid: ReturnType<typeof galleryGridOf>): void {
    const b = this.#b;
    const context = this.#pageContext;
    const record = context?.records.get(card.cardId);
    const picture: Rect = { x: rect.x, y: rect.y, width: rect.width, height: galleryPictureHeight(grid) };
    // The pack's picture where it has one for this card and it has arrived; otherwise the card's name stands in (a
    // missing picture is a supported outcome, never a blank tile).
    const art = record ? this.#artOfTile(record, card) : null;
    const key = galleryFocusKey(card);
    b.pictureTile(picture, {
      key: `pic:${key}`,
      ...this.#src(art),
      fit: "contain",
      frame: 0,
      missing: record ? (record.name as string) : card.name,
    });
    if (card.quantity > 1) {
      const text = `×${card.quantity}`;
      const size = b.measure(text, typeRole.label, { size: 11 });
      const w = size.width + 10;
      b.box({ x: picture.x + picture.width - w, y: picture.y, width: w, height: size.height + 4 }, { fill: INK });
      b.text(picture.x + picture.width - w + 5, picture.y + 2, text, typeRole.label, { size: 11, color: PAPER });
    }
    const name = b.text(rect.x, picture.y + picture.height + 3, card.name, typeRole.rowTitle, {
      size: 11,
      color: INK,
      fitWidth: rect.width,
    });
    b.text(rect.x, picture.y + picture.height + 3 + name.height, card.typeLine, typeRole.label, {
      size: 9,
      color: INK,
      alpha: ink.secondary,
      fitWidth: rect.width,
    });
    // A tap reads the card in Inspect; so does a hold or a right-click.
    b.tap(key, rect, { inspect: true });
    const inspect = (): void => this.#inspectCard(card);
    this.#press(key, inspect);
    this.#stop(key, rect, inspect, { inspect });
    if (record) {
      // A house rule's rebuilt face shows the rule's picture, not the printed one the pool has.
      const inPool = currentCardsById().has(card.cardId) && !card.rebuilt;
      const own = record && !inPool;
      const screen = this.#inScreen({ ...picture });
      this.#galleryHovers.push({
        slot: hoverSlotOf(card.cardId, key),
        rect: screen,
        data: {
          cardId: own ? (record.id as string) : card.cardId,
          ...(own ? { card: record } : {}),
          ...(card.face ? { face: card.face } : {}),
          ...(own && art ? { art } : {}),
        },
      });
    }
  }

  /**
   * The art for one gallery card of the page's pack (see `#artOf`). A house rule's rebuilt face is drawn in the rule's
   * own picture of it: the installed pack's file, else the store's copy; null until one arrives. Its other tiles (its own
   * cards, the official cards of its precon) take the usual picture, like any pack's.
   */
  #artOfTile(record: AnyCard, card?: GalleryCard): ArtSource | null {
    const context = this.#pageContext;
    if (!context) return null;
    if (context.rule && card?.rebuilt) {
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
    // A house rule's rebuilt face is keyed by the face code it rebuilds; the record is the official card it belongs to.
    if (record && currentCardsById().has(record.id as string) && !card.rebuilt) {
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

  /**
   * The Update all bar over the grid (issue #957), when an installed pack has an update or a run has news: its words
   * and progress on the left, Update all or Stop on the right. Returns the y below it.
   */
  #drawUpdateBar(at: { x: number; y: number; width: number }, phone: boolean): number {
    const bar = this.#updateAllBar();
    if (!bar) return at.y;
    const b = this.#b;
    const pad = 10;
    const actions = [bar.show, bar.action].filter((action) => action !== null);
    const widthOf = (action: UpdateAllAction): number =>
      action.id === "show-failed" ? (phone ? 112 : 150) : phone ? 128 : 200;
    // A phone with two buttons puts them in a row under the words; otherwise they sit at the bar's right.
    const below = phone && actions.length > 1;
    const sideWidth = below ? 0 : actions.reduce((sum, action) => sum + widthOf(action) + pad, 0);
    const lineRect: Rect = { x: at.x + pad, y: at.y + pad, width: at.width - pad * 2 - sideWidth, height: hit.target };
    // The words first, to size the bar: a phone's narrow bar may need a third line.
    const words = b.measure(bar.text, typeRole.rowTitle, {
      size: bar.fraction !== null ? 11 : 13,
      wrapWidth: lineRect.width,
    });
    const wordsHeight = bar.fraction !== null ? 15 : Math.min(words.height, 3 * 13 * 1.2);
    const textHeight = Math.max(hit.target, wordsHeight);
    const rowHeight = below ? hit.target + pad : 0;
    const box: Rect = { x: at.x, y: at.y, width: at.width, height: textHeight + pad * 2 + rowHeight };
    b.box(box, { fill: surface.card.hex });
    b.box(
      { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 },
      { stroke: INK, strokeWidth: 2 },
    );
    if (bar.fraction !== null) {
      b.text(lineRect.x, lineRect.y, bar.text, typeRole.rowTitle, { size: 13, color: INK, fitWidth: lineRect.width });
      const barH = 10;
      const y = lineRect.y + lineRect.height - barH - 1;
      b.box({ x: lineRect.x + 1, y, width: lineRect.width - 2, height: barH }, { stroke: INK, strokeWidth: 2 });
      b.box(
        { x: lineRect.x + 3, y: y + 2, width: (lineRect.width - 6) * bar.fraction, height: barH - 4 },
        { fill: signal.heal.hex },
      );
    } else {
      b.text(lineRect.x, lineRect.y + (textHeight - wordsHeight) / 2, bar.text, typeRole.rowTitle, {
        size: 13,
        color: INK,
        wrapWidth: lineRect.width,
        maxLines: 3,
      });
    }
    const rowY = below ? lineRect.y + textHeight + pad : box.y + (box.height - hit.target) / 2;
    const rowWidth = (box.width - pad * (actions.length + 1)) / actions.length;
    // Side by side: from the bar's right edge less the buttons' widths, a pad between each.
    let cursor = box.x + box.width - sideWidth;
    actions.forEach((action, index) => {
      const w = below ? rowWidth : widthOf(action);
      const rect: Rect = {
        x: below ? box.x + pad + index * (rowWidth + pad) : cursor,
        y: rowY,
        width: w,
        height: hit.target,
      };
      cursor += w + pad;
      this.#button({
        key: action.id === "show-failed" ? "update-all-show" : "update-all",
        rect,
        label: action.id === "update-all" ? `↑ ${action.label}` : action.label,
        look: action.id === "update-all" ? "primary" : "secondary",
        enabled: action.enabled,
        run: () => {
          if (action.id === "stop") this.#stopUpdateAll();
          else if (action.id === "show-failed") this.#showFailed();
          else void this.#updateAll();
        },
      });
    });
    return box.y + box.height + 10;
  }

  /** The progress bar (with its words) while installing, the last failure in words, or a remove failure. */
  #drawStatus(
    running: InstallState | null,
    removeError: string | null,
    requirement: string | undefined,
    rect: Rect,
  ): void {
    const b = this.#b;
    const failure = running?.error ?? removeError;
    if (failure) {
      const text = `! ${failure}`;
      const size = b.measure(text, typeRole.rowTitle, { size: 12, wrapWidth: rect.width });
      const h = Math.min(size.height, 12 * 1.2 * 2 + 2);
      b.text(rect.x, rect.y + (rect.height - h) / 2, text, typeRole.rowTitle, {
        size: 12,
        color: accent.heroRed.hex,
        wrapWidth: rect.width,
        maxLines: 2,
      });
      return;
    }
    if (!running) {
      if (requirement) {
        b.text(rect.x, rect.y, `! ${requirement}`, typeRole.rowTitle, {
          size: 12,
          color: INK,
          wrapWidth: rect.width,
          maxLines: 2,
        });
      }
      return;
    }
    const { fraction, text } = running.progress
      ? progressOf(running.progress)
      : { fraction: 0, text: t("modStore.starting") };
    const barH = 10;
    b.box(
      { x: rect.x + 1, y: rect.y + rect.height - barH - 1, width: rect.width - 2, height: barH },
      { stroke: INK, strokeWidth: 2 },
    );
    b.box(
      { x: rect.x + 3, y: rect.y + rect.height - barH + 1, width: (rect.width - 6) * fraction, height: barH - 4 },
      { fill: INK },
    );
    b.text(rect.x, rect.y, `${text}  ${Math.round(fraction * 100)}%`, typeRole.rowTitle, {
      size: 12,
      color: INK,
      fitWidth: rect.width,
    });
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
