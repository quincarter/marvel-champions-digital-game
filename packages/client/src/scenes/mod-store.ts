/**
 * Extras > Mod Store (docs/custom-content-packs.md §11.6): browse the catalog of community packs, open one, install,
 * update or remove it.
 *
 * Two views in one scene. **Browse** is four tabs (All, Heroes, Scenarios, Installed) over a grid of pack tiles, with an
 * offline notice when the catalog is the saved copy; each tile leads with the pack's featured card (thumbnail, picture or
 * generated face from its `preview.json`). **Pack** is one pack's page: the featured card(s), header, scrolling text
 * (description, credits, permission, requirement), a gallery of the pack's cards (from the preview before an install,
 * from the installed pack after), a status line (progress bar or error) and the buttons its state offers.
 *
 * This scene only draws. Which packs a tab shows, what the buttons are, progress words and error words are
 * `view/mod-store-model.ts`'s; whether a pack can be installed is `packs/pack-state.ts`'s; the install itself, in a
 * worker, is `packs/install-pack.ts`'s. Every press is an `McButton`, a tab, or the list's own row tap, so a swipe that
 * ends over a control fires nothing (CLAUDE.md, no tap on finger lift), and no control sits on a scrolling region: the
 * pack page's buttons are below its text panel, not over it.
 *
 * Pad and keyboard: Back, the tabs (LB / RB step them), then every tile; on a pack page, Back then its buttons.
 */
import Phaser from "phaser";
import { customCardPrefix, type AnyCard, type CardId, type PackIndex } from "@mc/content";
import { accent, hit, ink, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawPicture, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { GlyphHints, specsForShortcuts } from "../ui/glyph-hints.js";
import { McButton, McScrollPanel, McTabs, fitText, fitWrapped } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { ListScroll } from "../view/list-scroll.js";
import type { Rect } from "../view/layout.js";
import { extrasRowCount, extrasTileAt, extrasTileRect, type ExtrasGrid } from "../view/extras-model.js";
import {
  LOADING_TEXT,
  LOAD_FAILED_TEXT,
  MOD_STORE_TABS,
  OFFLINE_NOTICE,
  actionsOf,
  emptyTextOf,
  errorTextOf,
  modStoreGridOf,
  featuredFacesOf,
  packPageOf,
  progressOf,
  tileArtOf,
  tilesOf,
  type ModStoreContext,
  type ModStoreTab,
  type ModStoreTile,
  type PackAction,
} from "../view/mod-store-model.js";
import { loadCatalog } from "../packs/catalog.js";
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
import { currentCardsById } from "../content/pool.js";
import { onPreviewArrived, previewInMemory, requestPreview } from "../packs/preview-client.js";
import { previewPictureUrl, type ParsedPackPreview } from "../packs/pack-preview.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { packFileArt } from "../art/pack-art.js";
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

export interface ModStoreSceneData {
  /** Dev only (`?screen=mod-store&catalog=`): a catalog address other than the store's own. */
  readonly catalogUrl?: string;
  /** Opens straight onto this pack's page (dev jumps). */
  readonly packId?: string;
}

const TAB_HEIGHT = 44;
const SCROLLBAR = 12;

/** One install in flight, or the last one's failure, for the pack whose page is open. */
interface InstallState {
  readonly id: string;
  readonly progress: InstallProgress | null;
  readonly error: string | null;
}

export class ModStoreScene extends Phaser.Scene {
  #tab: ModStoreTab = "all";
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
  /** The progress bar's objects, so a report redraws only these (the text panel keeps its scroll position). */
  #statusObjects: Phaser.GameObjects.GameObject[] = [];
  #statusRect: Rect | null = null;
  #statusQueued = false;
  #requirement: string | undefined;
  readonly #scrolls = new Map<ModStoreTab, ListScroll>();
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
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
    this.#confirmingRemove = false;
    this.#removing = false;
    this.#statusQueued = false;
    this.#error = null;
    this.#status = "loading";
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#hints = new GlyphHints(this, () => this.#obstacles);
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#back(),
      onTab: (direction) => this.#stepTab(direction),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onScroll: (_dx, dy) => {
        this.#list?.scrollByPx(dy);
        this.#gallery?.scrollByPx(dy);
        this.#panel?.scrollByPx(dy);
      },
      blocked: () => this.scene.isActive(SCENES.inspect),
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
    });
    this.#draw();
    fadeScreenIn(this);
    void this.#load();
  }

  async #load(): Promise<void> {
    this.#status = "loading";
    try {
      const [catalog, installed] = await Promise.all([
        // A dev override must never overwrite the real catalog's saved copy.
        loadCatalog(this.#catalogUrl ? { url: this.#catalogUrl, storage: null } : {}),
        this.#store.list().catch(() => [] as InstalledPack[]),
      ]);
      this.#index = catalog.index;
      this.#offline = catalog.offline;
      this.#installed = new Map(installed.map((pack) => [pack.id, pack]));
      this.#status = "ready";
    } catch {
      // No network and no saved copy: still show what is installed.
      const installed = await this.#store.list().catch(() => [] as InstalledPack[]);
      this.#installed = new Map(installed.map((pack) => [pack.id, pack]));
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

  async #refreshInstalled(): Promise<void> {
    const installed = await this.#store.list().catch(() => [] as InstalledPack[]);
    this.#installed = new Map(installed.map((pack) => [pack.id, pack]));
    // Installed packs join the running game's pool (not awaited: the load is validated in a worker).
    void refreshActivePacks();
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
    goToScreen(this, SCENES.extras);
  }

  #select(tab: ModStoreTab): void {
    if (tab === this.#tab) return;
    this.#tab = tab;
    this.#draw();
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
    } else {
      void this.#installTile(tile);
    }
  }

  async #installTile(tile: ModStoreTile): Promise<void> {
    const entry = this.#index?.packs.find((one) => one.id === tile.id);
    // Only a RUNNING install blocks another; a failed one's error is stale the moment a new run starts.
    if (!entry || (this.#install && this.#install.error === null)) return;
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
      if (token !== this.#installToken) return;
      await this.#refreshInstalled();
      if (token !== this.#installToken) return;
      this.#install = null;
    } catch (error) {
      if (token !== this.#installToken) return;
      // A failed install leaves nothing installed (§7.2.3), and a failed update leaves the old version: say so.
      this.#install = { id: tile.id, progress: null, error: errorTextOf(error, installedVersion) };
    }
    this.#requestRedraw();
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
    });
  }

  #paintStatus(): void {
    const rect = this.#statusRect;
    if (!this.#alive || !rect || this.#packId === null) return;
    for (const object of this.#statusObjects) object.destroy();
    const before = this.children.list.length;
    const running = this.#install?.id === this.#packId ? this.#install : null;
    this.#drawStatus(running, this.#error, this.#requirement, rect);
    this.#statusObjects = this.children.list.slice(before);
  }

  #destroyWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#tabs?.destroy();
    this.#tabs = null;
    this.#list?.destroy();
    this.#list = null;
    this.#panel?.destroy();
    this.#panel = null;
    this.#gallery?.destroy();
    this.#gallery = null;
    this.#galleryRect = null;
    this.#statusObjects = [];
    this.#statusRect = null;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);
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

    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : tile ? "◂ STORE" : "◂ EXTRAS",
      onBack: () => this.#back(),
      hints: this.#hints,
      title: "Mod Store",
      ...(this.#installed.size > 0 ? { right: `${this.#installed.size} installed` } : {}),
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
    const order: string[] = bar.backRect ? ["back"] : [];

    if (tile) this.#drawPage(tile, { width, height, phone, gutter, top: bar.height }, stops, order);
    else this.#drawBrowse({ width, height, phone, gutter, top: bar.height }, stops, order);
    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }

  // ---- Browse ---------------------------------------------------------------------------------------------------

  #drawBrowse(
    frame: { width: number; height: number; phone: boolean; gutter: number; top: number },
    stops: Map<string, FocusStop>,
    order: string[],
  ): void {
    const { width, height, phone, gutter, top } = frame;
    const tabRect: Rect = { x: gutter, y: top + 12, width: width - gutter * 2, height: TAB_HEIGHT };
    this.#tabs = new McTabs(this, {
      rect: tabRect,
      tabs: MOD_STORE_TABS.map((tab) => ({ id: tab.id, label: tab.label })),
      activeId: this.#tab,
      onSelect: (id) => this.#select(id as ModStoreTab),
    });
    this.#hints.custom(
      (set, snapshot) => (set === "pad" ? specsForShortcuts(["zonePrevious", "zoneNext"], snapshot) : null),
      16,
      ({ width: glyphWidth }) => ({ x: tabRect.x + tabRect.width - glyphWidth, y: tabRect.y + tabRect.height + 11 }),
      { avoidObstacles: true },
    );
    this.#obstacles.push(tabRect);
    const tabWidth = tabRect.width / MOD_STORE_TABS.length;
    MOD_STORE_TABS.forEach((tab, index) => {
      stops.set(`tab:${tab.id}`, {
        rect: { x: tabRect.x + index * tabWidth, y: tabRect.y, width: tabWidth, height: tabRect.height },
        activate: () => this.#select(tab.id),
      });
      order.push(`tab:${tab.id}`);
    });

    let listTop = tabRect.y + tabRect.height + 22;
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
    const listRect: Rect = {
      x: gutter,
      y: listTop,
      width: width - gutter * 2,
      height: Math.max(60, height - listTop - gutter),
    };

    const message = (text: string): void => {
      this.add
        .text(listRect.x, listRect.y, text, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setFontSize(14)
        .setWordWrapWidth(listRect.width, true);
    };

    if (this.#status === "loading") {
      message(LOADING_TEXT);
      return;
    }
    const tiles = tilesOf(this.#index, this.#context(), this.#tab);
    if (this.#status === "failed" && tiles.length === 0) {
      message(LOAD_FAILED_TEXT);
      const retryRect: Rect = { x: listRect.x, y: listRect.y + 56, width: 160, height: hit.target };
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
    if (tiles.length === 0) {
      message(emptyTextOf(this.#tab));
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
   * A tile's left side, a portrait card: the catalog's thumbnail, else the featured card's picture, else its generated
   * face from the preview's record, else the pack's initial, big and faint, on ink while nothing has loaded.
   */
  #drawThumb(tile: ModStoreTile, rect: Rect): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    ground.lineStyle(1, surface.paper.hex, 0.4).strokeRect(rect.x + 5, rect.y + 5, rect.width - 10, rect.height - 10);
    objects.push(ground);
    const preview = this.#previewOf(tile);
    const art = tileArtOf(tile, preview);
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
    const first = featuredFacesOf(preview, tile.baseUrl)[0];
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
    const mark = { install: "+", installed: "✓", update: "↑", "needs-app-update": "!", withdrawn: "✕" }[tile.state];
    const solid = tile.state === "install" || tile.state === "update";
    const g = this.add.graphics();
    const text = this.add
      .text(
        0,
        0,
        `${mark} ${tile.stateLabel}`,
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
    const page = packPageOf(tile, entry, installed);
    const running = this.#install?.id === tile.id ? this.#install : null;
    const busy = (running !== null && running.error === null) || this.#removing;

    // What the page shows of the pack: an installed, loaded pack's own data; before that (or when it did not load) the
    // preview fetched from the store, which is all there is of an uninstalled pack.
    const preview = this.#previewOf(tile);
    const packCards = loadedPacks().find((pack) => pack.id === tile.id);
    const source = packCards ?? preview;
    const { sections, records } = source
      ? gallerySectionsOf({ cards: source.cards, decks: source.decks, baseCards: currentCardsById() })
      : { sections: [], records: new Map<string, AnyCard>() };
    const cardCount = galleryCardCount(sections);
    const faces = featuredFacesOf(preview, tile.baseUrl);
    const actions = actionsOf({ tile, busy, confirmingRemove: this.#confirmingRemove });
    const layout = packPageLayoutOf({
      width,
      height,
      phone,
      gutter,
      top,
      faceCount: faces.length,
      cardCount,
      buttonsHeight: actions.length > 0 ? hit.target : 0,
    });
    this.#pageContext = { packId: tile.id, preview, base: tile.baseUrl, records };

    // The featured card(s), then the name, byline, meta and the state chip.
    if (layout.squareThumb) this.#drawThumb(tile, layout.faces[0]!);
    else {
      layout.faces.forEach((rect, index) => {
        const face = faces[index]!;
        const art = packCards
          ? ((face.path ? packFileArt(tile.id, face.path) : null) ?? artFor(face.card, face.face))
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
      ? this.#drawCardFace(picture, record, defaultFaceFor(record), this.#artOfTile(record))
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

  /** The art for one gallery card of the page's pack (see `#artOf`). */
  #artOfTile(record: AnyCard): ArtSource | null {
    const context = this.#pageContext;
    return context ? this.#artOf(record, defaultFaceFor(record), context.packId, context.preview, context.base) : null;
  }

  /**
   * Reads one card in Inspect. A card the game's pool has (installed packs, the base game) opens the full sheet; a
   * card of a pack that is not installed yet has no place in the pool, so it opens as a reference sheet from its
   * preview record: name, type line and rules text over its picture.
   */
  #inspectCard(card: GalleryCard): void {
    const record = this.#pageContext?.records.get(card.cardId);
    if (record && currentCardsById().has(card.cardId)) {
      this.scene.launch(SCENES.inspect, {
        card: { cardId: card.cardId as CardId, face: defaultFaceFor(record) },
      } satisfies InspectData);
    } else if (record) {
      const model = faceModelOf(record, defaultFaceFor(record));
      const stats = statLineOf(model.stats);
      this.scene.launch(SCENES.inspect, {
        reference: {
          title: model.name,
          text: [model.typeLine, stats, model.rulesText].filter((part) => part !== "").join("\n\n"),
          art: this.#artOfTile(record),
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
        const inPool = currentCardsById().has(card.cardId);
        // A card the pool does not have (a pack not installed yet) carries its own record and picture to the popover.
        const art = record && !inPool ? this.#artOfTile(record) : null;
        found.set(hoverSlotOf(card.cardId, row.first + column), {
          ...picture,
          cardId: card.cardId,
          ...(record && !inPool ? { card: record } : {}),
          ...(art ? { art } : {}),
          through: true,
        });
      });
    });
    return found;
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
