/**
 * Extras: the comics, rulebooks, artwork, promo cards, hero and villain files and the soundtrack, reached from Title.
 * Eight tabs (Stories, Side Stories, Rulebooks, Heroes, Villains, Artwork, Promo Cards, Music), each a shelf of tiles; a locked tile shows its picture pixelated and says what
 * opens it, an open one reads, views or plays.
 *
 * What is open is `progression/extras.ts`'s (read through `extras()`, refreshed from storage when the screen opens);
 * the tabs, tiles and grid are `view/extras-model.ts`'s. This scene draws them and routes a tap:
 *
 * - **Stories** start the campaign opener with no run behind it (`CampaignOpenerData`'s Extras read), which comes
 *   back here to the same tab.
 * - **Rulebooks** open the reader (`scenes/extras-reader.ts`): the book as plain text, with links to its PDFs.
 * - **Side Stories** open the side-story reader (`scenes/side-story-reader.ts`): the comic beat by beat.
 * - **Heroes, Villains, Artwork, Promo Cards** open the viewer overlay (`scenes/extras-viewer.ts`) over this screen.
 *   A promo card's viewer is where it is picked for use, and it tells this scene to redraw (`PROMO_CHANGED`).
 * - **Music** plays the song through the music controller's jukebox, until Title (or any other screen) asks for its
 *   own music again. With shuffle on (#191) the shuffle carries on from it instead.
 */
import Phaser from "phaser";
import { accent, hit, ink, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawPicture, drawTopBar, drawnPictureKey } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTabs, fitText } from "../ui/widgets.js";
import { GlyphHints, specsForShortcuts } from "../ui/glyph-hints.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { drawNowPlayingPanel, type NowPlayingPanel } from "../ui/now-playing-panel.js";
import { earnedSongsOf } from "../view/music-player.js";
import { fadeScreenIn, goToScreen, holdScreenFor, isScreenHeld, revealWhenPainted } from "../ui/transitions.js";
import { paintScrolledIn } from "../ui/lazy-text.js";
import { ListScroll } from "../view/list-scroll.js";
import type { Rect } from "../view/layout.js";
import {
  extrasGridOf,
  extrasRowCount,
  extrasSummaryOf,
  extrasTabsOf,
  extrasTileAt,
  extrasTileRect,
  extrasTilesOf,
  type ExtrasGrid,
  type ExtrasTileView,
} from "../view/extras-model.js";
import { EXTRAS_TABS, type ExtrasTab } from "../progression/extras.js";
import { extras, refreshUnlocks } from "../progression/progression.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { PROMO_SETS, promoFaceArt } from "../art/promo-art.js";
import type { CampaignOpenerData } from "./campaign/routes.js";
import type { ExtrasViewerData } from "./extras-viewer.js";
import type { ExtrasReaderData } from "./extras-reader.js";
import type { SideStoryReaderData } from "./side-story-reader.js";
import { t } from "../i18n/translate.js";
import { isPictureSettled, onPictureLoadFailed } from "../art/pictures.js";
import { PictureWait } from "../ui/picture-wait.js";
import { markRenderDirty } from "../ui/idle-render.js";

export interface ExtrasSceneData {
  /** The tab to open on: a story read comes back to Stories. Defaults to the tab open last time. */
  readonly tab?: ExtrasTab;
}

const TAB_HEIGHT = 44;

/**
 * The shelf's first build, while the screen is held on the void, draws rows for this long in a frame and the rest on
 * the frames after (issue #722): the whole window at once was a 30 ms frame on its own.
 */
const FIRST_BUILD_BUDGET_MS = 4;

/** Emitted on this scene by the viewer when a promo card is picked or dropped. */
export const PROMO_CHANGED = "promo-changed";

export class ExtrasScene extends Phaser.Scene {
  #tab: ExtrasTab = "stories";
  /** One scroll position per tab, kept across visits (Phaser reuses this scene instance). */
  readonly #scrolls = new Map<ExtrasTab, ListScroll>();
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #obstacles: Rect[] = [];
  #redrawQueued = false;
  /**
   * The next draw shows a different tab's shelf: its tiles' labels are painted off the main thread and the shelf
   * fades in once they are, so the tap that changes tab isn't held while some forty labels are painted.
   */
  #freshShelf = false;
  /** Between `create` and shutdown. Not `sys.isActive()`, which is still false while `create` itself draws. */
  #alive = false;
  /** The Music tab's expanded player (#191), whose progress bar moves every frame. */
  #player: NowPlayingPanel | null = null;
  #unsubscribe: (() => void) | null = null;
  #hover: HoverPreview | null = null;
  /** The Promo Cards tab's tiles as drawn, for the hover popover: a locked one shows what there is to earn. */
  #promoTiles: (() => ReadonlyMap<string, HoverCardIdRect>) | null = null;
  /** Tiles drawn before their pictures loaded: the screen's entrance waits for them (issue #716). */
  #pictures = new PictureWait(() => false);
  /** True until the first draw of this visit: the one built while the screen is held on the void. */
  #firstBuild = false;

  constructor() {
    super(SCENES.extras);
  }

  override update(): void {
    this.#player?.tick();
  }

  create(data: ExtrasSceneData = {}): void {
    this.#tab = data.tab ?? this.#tab;
    this.#redrawQueued = false;
    this.#alive = true;
    this.#pictures = new PictureWait((key) => isPictureSettled(this, key));
    this.#firstBuild = true;
    // A picture that fails to load is settled too: the wait checks again, rather than holding to the cap.
    const offFailures = onPictureLoadFailed(() => this.#pictures.arrived());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offFailures);
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    // A glyph that would hang over another control is not drawn (the phone's Back hint, over the Trophy Room button).
    this.#hints = new GlyphHints(this, () => this.#obstacles);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.extrasViewer),
      onCancel: () => this.#back(),
      // LB / RB (and the zone keys) step the tabs along the top; Page Up / Down still page the shelf.
      onTab: (direction) => this.#stepTab(direction),
      onPage: (direction) => this.#list?.scrollByPage(direction),
      onScroll: (_dx, dy) => this.#list?.scrollByPx(dy),
    });
    // A new song (the shuffle moving on, or Next) redraws the Music tab's player and its playing row.
    this.#unsubscribe = appSession().music?.onTrackStart(() => this.#requestRedraw()) ?? null;
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#promoTiles?.() ?? new Map(),
      area: (pointer) => (this.scene.isActive(SCENES.extrasViewer) ? null : screenHoverArea(this, pointer)),
    });
    this.events.on(PROMO_CHANGED, this.#requestRedraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#hover?.destroy();
      this.#hover = null;
      this.events.off(PROMO_CHANGED, this.#requestRedraw, this);
      this.scale.off("resize", this.#draw, this);
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#hints.dispose();
      this.#destroyWidgets();
    });
    this.#draw();
    fadeScreenIn(this);
    // The shelf as the saves have it now: drawn before the screen fades in, rather than redrawn as it does. Its tiles'
    // pictures are waited for too, so the screen arrives with them in place and their first upload and render happen
    // while it is still on the void, not across the fade (issue #716). The hold is capped, so a slow picture can't
    // keep the screen dark.
    // The shelf's rows (built over a few frames, `FIRST_BUILD_BUDGET_MS`), then the pictures those rows asked for.
    holdScreenFor(
      this,
      (this.#list?.ready ?? Promise.resolve()).then(() => this.#pictures.settled()),
    );
    // Drawn again only when the read changed something the shelf shows (an unlock, or Extras progress, which makes a
    // new `extras()`): a redraw of the whole screen was a second long frame on every visit (issue #722).
    const shown = extras();
    holdScreenFor(
      this,
      refreshUnlocks()
        .catch(() => false)
        .then((changed) => {
          if (!changed && extras() === shown) return;
          this.#draw();
          holdScreenFor(
            this,
            (this.#list?.ready ?? Promise.resolve()).then(() => this.#pictures.settled()),
          );
        }),
    );
  }

  /**
   * Pictures arrived (once per batch, `ensurePictureLoaded`): the drawn tiles waiting for them fill themselves in
   * (`McVirtualList#refreshRows`) rather than the whole screen being drawn again, which made the first fade into
   * Extras step through 100–190 ms frames (issue #716). One stable function, so the loader tells it once per batch.
   */
  readonly #pictureArrived = (): void => {
    if (!this.#alive) return;
    this.#list?.refreshRows();
    markRenderDirty();
    this.#pictures.arrived();
  };

  #scroll(tab: ExtrasTab): ListScroll {
    let scroll = this.#scrolls.get(tab);
    if (!scroll) {
      scroll = new ListScroll();
      this.#scrolls.set(tab, scroll);
    }
    return scroll;
  }

  #back(): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.title);
  }

  #select(tab: ExtrasTab): void {
    if (tab === this.#tab) return;
    this.#tab = tab;
    this.#freshShelf = true;
    this.#draw();
  }

  /** LB / RB: the previous or next tab, stopping at the ends like the tab strip itself. */
  #stepTab(direction: 1 | -1): void {
    const at = EXTRAS_TABS.findIndex((tab) => tab.id === this.#tab);
    const next = EXTRAS_TABS[at + direction];
    if (next) this.#select(next.id);
  }

  /** A picture arriving redraws once, however many arrive in the same frame. */
  #requestRedraw(): void {
    if (this.#redrawQueued) return;
    this.#redrawQueued = true;
    this.time.delayedCall(0, () => {
      this.#redrawQueued = false;
      this.#draw();
    });
  }

  #activate(tile: ExtrasTileView): void {
    if (!tile.open || this.scene.isActive(SCENES.extrasViewer)) return;
    const content = tile.entry.content;
    if (content.kind === "issue") {
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.campaignOpener, {
        campaignId: content.campaignId,
        nodeId: content.nodeId,
        returnTo: { key: SCENES.extras, data: { tab: "stories" } satisfies ExtrasSceneData },
      } satisfies CampaignOpenerData);
      return;
    }
    if (content.kind === "comic") {
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.sideStoryReader, { storyId: content.storyId } satisfies SideStoryReaderData);
      return;
    }
    if (content.kind === "book") {
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.extrasReader, { bookId: content.bookId } satisfies ExtrasReaderData);
      return;
    }
    if (content.kind === "track") {
      const music = appSession().music;
      // The song playing again: stop it (back to Title's music), or with shuffle on, skip to the next song.
      if (music?.jukeboxKey() === content.track.key) {
        if (appSession().settings.musicShuffle) music.next();
        else music.playTitle();
      } else music?.playTrack(content.track);
      this.#draw();
      return;
    }
    this.scene.launch(SCENES.extrasViewer, { entryId: tile.id } satisfies ExtrasViewerData);
  }

  #destroyWidgets(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#tabs?.destroy();
    this.#tabs = null;
    this.#list?.destroy();
    this.#list = null;
    this.#player = null;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);
    this.#hints.reset();
    this.#obstacles = [];

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const current = extras();
    const stops = new Map<string, FocusStop>();

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : "◂ TITLE",
      onBack: () => this.#back(),
      title: "Extras",
      right: extrasSummaryOf(current),
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) stops.set("back", { rect: bar.backRect, activate: () => this.#back() });

    // The Trophy Room and Art & Credits doors: beside the tabs on a wide screen, on a row of their own above them on a
    // phone. (The Mod Store moved to the main menu: issue #734; opening a replay file to Past games: #858.)
    const doorWidth = 150;
    const trophyWidth = doorWidth * 2 + 8;
    const rowGap = 8;
    // The doors beside the tab strip leave it too narrow to print every tab's label whole at some widths (measured, not
    // guessed): then the doors take rows of their own above it, three across, or two to a row on a phone.
    const tabs = extrasTabsOf(current);
    const widestTab = Math.max(
      ...tabs.map((tab) => {
        const probe = this.add.text(
          0,
          0,
          (phone ? tab.name : tab.label).toUpperCase(),
          textStyle(typeRole.label, surface.ink.hex),
        );
        const w = probe.width;
        probe.destroy();
        return w;
      }),
    );
    const besideTabsWidth = width - gutter * 2 - trophyWidth - 12;
    const stackDoors = phone || besideTabsWidth / tabs.length < widestTab + 24;
    const perRow = 2;
    const doorW = stackDoors ? (width - gutter * 2 - rowGap * (perRow - 1)) / perRow : doorWidth;
    const stacked = (index: number): Rect => ({
      x: gutter + (index % perRow) * (doorW + rowGap),
      y: bar.height + 10 + Math.floor(index / perRow) * (hit.target + rowGap),
      width: doorW,
      height: hit.target,
    });
    const trophyRect: Rect = stackDoors
      ? stacked(0)
      : { x: width - gutter - doorWidth, y: bar.height + 12, width: doorWidth, height: TAB_HEIGHT };
    const creditsRect: Rect = stackDoors ? stacked(1) : { ...trophyRect, x: trophyRect.x - doorWidth - rowGap };
    const doorsBottom = trophyRect.y + trophyRect.height;
    const openTrophies = (): void => {
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.trophyRoom);
    };
    const openCredits = (): void => {
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.credits);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: phone ? t("extras.trophies") : `${t("title.trophyRoom")} ▸`,
        type: typeRole.label,
        rect: trophyRect,
        onClick: openTrophies,
      }),
      new McButton(this, {
        kind: "secondary",
        label: "Credits ▸",
        type: typeRole.label,
        rect: creditsRect,
        onClick: openCredits,
      }),
    );
    stops.set("trophies", { rect: trophyRect, activate: openTrophies });
    stops.set("credits", { rect: creditsRect, activate: openCredits });

    const tabRect: Rect = stackDoors
      ? { x: gutter, y: doorsBottom + 8, width: width - gutter * 2, height: TAB_HEIGHT }
      : { x: gutter, y: bar.height + 12, width: width - gutter * 2 - trophyWidth - 12, height: TAB_HEIGHT };
    this.#tabs = new McTabs(this, {
      rect: tabRect,
      tabs: tabs.map((tab) => ({ id: tab.id, label: phone ? tab.name : tab.label })),
      activeId: this.#tab,
      onSelect: (id) => this.#select(id as ExtrasTab),
    });
    // LB / RB, pad only, in the gap under the strip's right end.
    this.#hints.custom(
      (set, snapshot) => (set === "pad" ? specsForShortcuts(["zonePrevious", "zoneNext"], snapshot) : null),
      16,
      ({ width }) => ({ x: tabRect.x + tabRect.width - width, y: tabRect.y + tabRect.height + 11 }),
      { avoidObstacles: true },
    );
    this.#obstacles.push(trophyRect, creditsRect, tabRect);
    if (bar.back) this.#hints.button(bar.back, ["cancel"], "paper");
    const tabWidth = tabRect.width / tabs.length;
    tabs.forEach((tab, index) => {
      stops.set(`tab:${tab.id}`, {
        rect: { x: tabRect.x + index * tabWidth, y: tabRect.y, width: tabWidth, height: tabRect.height },
        activate: () => this.#select(tab.id),
      });
    });

    // 22px under the strip: room for the LB / RB hint (14px tall) in the gap.
    let listTop = tabRect.y + tabRect.height + 22;
    // The Music tab opens on the expanded player: what is playing, how far in, Shuffle and Next.
    const playerStops: string[] = [];
    if (this.#tab === "music") {
      const player = drawNowPlayingPanel(this, {
        x: gutter,
        y: listTop,
        width: width - gutter * 2,
        expanded: true,
        songs: earnedSongsOf(current),
        onChange: () => this.#draw(),
      });
      this.#player = player;
      this.#buttons.push(...player.buttons);
      for (const stop of player.stops) {
        stops.set(`player:${stop.id}`, { rect: stop.rect, activate: stop.activate });
        playerStops.push(`player:${stop.id}`);
      }
      listTop += player.height + 14;
    }
    const listRect: Rect = {
      x: gutter,
      y: listTop,
      width: width - gutter * 2,
      height: Math.max(60, height - listTop - gutter),
    };
    // The scrollbar sits in the list's own right edge; keep tiles clear of it.
    const gridWidth = listRect.width - 12;
    const grid = extrasGridOf(gridWidth, this.#tab, phone);
    const tiles = extrasTilesOf(current, this.#tab, appSession().settings.promoArt);
    const rows = extrasRowCount(tiles.length, grid);
    const playing = appSession().music?.nowPlaying()?.key ?? null;

    const fresh = this.#freshShelf;
    this.#freshShelf = false;
    // The first build, and any other while the screen is still held (a resize, the redraw after the progress read).
    const firstBuild = this.#firstBuild || isScreenHeld(this);
    this.#firstBuild = false;
    const appearing: Phaser.GameObjects.GameObject[] = [];
    let collecting = fresh;
    const makeList = (): McVirtualList =>
      new McVirtualList(this, {
        rect: listRect,
        rowHeight: grid.rowHeight,
        count: rows,
        scroll: this.#scroll(this.#tab),
        background: false,
        ...(firstBuild ? { buildBudgetMs: FIRST_BUILD_BUDGET_MS } : {}),
        renderRow: (rowIndex, rect) => {
          const row = this.#renderRow(tiles, rowIndex, rect, grid, playing);
          if (collecting) appearing.push(...row.objects);
          return row;
        },
        onRowActivate: (rowIndex, pointer) => {
          const index = extrasTileAt(pointer.x, rowIndex, grid, listRect.x, tiles.length);
          if (index !== null) this.#activate(tiles[index]!);
        },
        rowPressableAt: (rowIndex, pointer) =>
          extrasTileAt(pointer.x, rowIndex, grid, listRect.x, tiles.length) !== null,
      });
    const list = fresh ? paintScrolledIn(makeList) : makeList();
    collecting = false;
    if (fresh) revealWhenPainted(this, appearing);
    this.#list = list;
    this.#promoTiles =
      this.#tab === "promos"
        ? () => {
            const found = new Map<string, HoverCardIdRect>();
            tiles.forEach((tile, index) => {
              const set = PROMO_SETS.find((one) => `promo:${one.id}` === tile.id);
              if (!set) return;
              const rowRect = list.rectFor(Math.floor(index / grid.columns));
              const shown = clipHoverRect(extrasTileRect(index, grid, rowRect), listRect);
              if (!shown) return;
              found.set(hoverSlotOf(set.cardId, `promo${index}`), {
                ...shown,
                cardId: set.cardId,
                art: promoFaceArt(set, set.faces[0]!),
                through: true,
              });
            });
            return found;
          }
        : null;

    const order = [
      ...(bar.backRect ? ["back"] : []),
      "trophies",
      "credits",
      ...EXTRAS_TABS.map((tab) => `tab:${tab.id}`),
      ...playerStops,
    ];
    tiles.forEach((tile, index) => {
      const rowIndex = Math.floor(index / grid.columns);
      order.push(`tile:${tile.id}`);
      stops.set(`tile:${tile.id}`, {
        rect: () => extrasTileRect(index, grid, list.rectFor(rowIndex)),
        activate: () => this.#activate(tile),
        ensureVisible: () => list.scrollIntoView(rowIndex),
      });
    });

    if (tiles.length === 0) {
      this.add
        .text(listRect.x, listRect.y, "Nothing here yet.", textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setFontSize(14);
    }

    this.#route?.set(order, stops);
  }

  #renderRow(
    tiles: readonly ExtrasTileView[],
    rowIndex: number,
    rect: Rect,
    grid: ExtrasGrid,
    playing: string | null,
  ): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const waiting: (() => void)[] = [];
    for (let column = 0; column < grid.columns; column += 1) {
      const index = rowIndex * grid.columns + column;
      const tile = tiles[index];
      if (!tile) break;
      const tileRect = extrasTileRect(index, grid, rect);
      if (this.#tab === "music") objects.push(...this.#drawTrackRow(tile, tileRect, playing));
      else objects.push(...this.#drawTile(tile, tileRect, waiting));
    }
    return waiting.length > 0 ? { objects, refresh: () => waiting.forEach((fill) => fill()) } : { objects };
  }

  #drawTile(tile: ExtrasTileView, rect: Rect, waiting: (() => void)[]): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const captionHeight = 52;
    const art: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - captionHeight };

    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(art.x, art.y, art.width, art.height);
    ground.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, art.y + art.height, rect.width, captionHeight);
    objects.push(ground);

    const portrait = this.#tab === "heroes" || this.#tab === "villains" || this.#tab === "promos";
    const pictureOptions = {
      focusY: portrait ? 0.2 : 0.4,
      // Locked: a gray ghost of the picture on the ink ground, so the shelf shows what there is to earn.
      ...(tile.open ? {} : { grayscale: true, alpha: 0.3 }),
      // A shelf of tiles, each a large picture drawn small (issue #722).
      scaleToSlot: true,
    };
    const image = drawPicture(this, tile.thumb, art, this.#pictureArrived, pictureOptions);
    if (image) {
      objects.push(image);
    } else {
      // No picture yet: the entry's initial, big and faint, so the shelf still reads as a shelf, in a slot the picture
      // takes over in place when it arrives.
      const initial = this.add
        .text(art.x + art.width / 2, art.y + art.height / 2, tile.title.charAt(0).toUpperCase(), {
          ...textStyle(bangers(Math.round(art.height * 0.5)), surface.paper.hex, 0.18),
        })
        .setOrigin(0.5);
      const slot = this.add.container(0, 0, [initial]);
      objects.push(slot);
      // Only a picture whose load was started is waited for (an empty slot starts none).
      if (tile.thumb && art.width > 0 && art.height > 0) {
        const key = drawnPictureKey(tile.thumb, art, !tile.open, true);
        if (key) this.#pictures.expect(key);
        waiting.push(() => {
          if (!slot.active || slot.list[0] !== initial) return;
          const arrived = drawPicture(this, tile.thumb, art, this.#pictureArrived, pictureOptions);
          if (arrived) slot.removeAll(true).add(arrived);
        });
      }
    }

    // The status chip, top-left: what a tap does, or that it's locked.
    const chipText = this.add
      .text(0, 0, tile.open ? `${tile.action} ▸` : "LOCKED", textStyle(typeRole.label, surface.paper.hex, 1))
      .setOrigin(0, 0);
    const chipBox = this.add.graphics();
    chipBox
      .fillStyle(tile.open ? accent.heroRed.hex : surface.ink.hex, 1)
      .fillRect(art.x + 8, art.y + 8, chipText.width + 12, chipText.height + 8);
    if (!tile.open)
      chipBox
        .lineStyle(1, surface.paper.hex, 0.7)
        .strokeRect(art.x + 8, art.y + 8, chipText.width + 12, chipText.height + 8);
    chipText.setPosition(art.x + 14, art.y + 12);
    objects.push(chipBox, chipText);

    const frame = this.add.graphics();
    frame.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    objects.push(frame);

    const textWidth = rect.width - 16;
    const title = this.add
      .text(rect.x + 8, art.y + art.height + 7, tile.title, textStyle(typeRole.rowTitle, surface.ink.hex))
      .setFontSize(13);
    fitText(title, textWidth, 13);
    const detail = this.add
      .text(
        rect.x + 8,
        art.y + art.height + 27,
        tile.open ? tile.subtitle : (tile.hint ?? ""),
        textStyle(typeRole.body, tile.open ? surface.ink.hex : accent.heroRed.hex, tile.open ? ink.secondary : 1),
      )
      .setFontSize(10);
    fitText(detail, textWidth, 10);
    objects.push(title, detail);
    return objects;
  }

  #drawTrackRow(tile: ExtrasTileView, rect: Rect, playing: string | null): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const content = tile.entry.content;
    const isPlaying = content.kind === "track" && playing === content.track.key;
    const row: Rect = { x: rect.x, y: rect.y + 3, width: rect.width, height: rect.height - 6 };

    const g = this.add.graphics();
    g.fillStyle(isPlaying ? surface.ink.hex : surface.parchment.hex, 1).fillRect(row.x, row.y, row.width, row.height);
    g.lineStyle(2, surface.ink.hex, tile.open ? 1 : 0.35).strokeRect(
      row.x + 1,
      row.y + 1,
      row.width - 2,
      row.height - 2,
    );
    objects.push(g);

    const fg = isPlaying ? surface.paper.hex : surface.ink.hex;
    const buttonSize = row.height - 16;
    const cx = row.x + 8 + buttonSize / 2;
    const cy = row.y + row.height / 2;
    const disc = this.add.graphics();
    disc
      .fillStyle(tile.open ? accent.heroRed.hex : surface.ink.hex, tile.open ? 1 : 0.25)
      .fillCircle(cx, cy, buttonSize / 2);
    objects.push(disc);
    objects.push(
      this.add
        .text(cx + (isPlaying ? 0 : 1), cy, isPlaying ? "■" : "▶", textStyle(typeRole.rowTitle, surface.paper.hex))
        .setFontSize(14)
        .setOrigin(0.5),
    );

    const textX = row.x + 16 + buttonSize;
    const textWidth = row.width - (textX - row.x) - 12;
    const title = this.add
      .text(textX, row.y + 8, tile.title, textStyle(typeRole.rowTitle, fg, tile.open ? 1 : 0.45))
      .setFontSize(14);
    fitText(title, textWidth, 14);
    const detail = this.add
      .text(
        textX,
        row.y + row.height - 20,
        tile.open ? (isPlaying ? `Now playing · ${tile.subtitle}` : tile.subtitle) : (tile.hint ?? ""),
        textStyle(typeRole.body, tile.open ? fg : accent.heroRed.hex, tile.open ? ink.secondary : 1),
      )
      .setFontSize(10);
    fitText(detail, textWidth, 10);
    objects.push(title, detail);
    return objects;
  }
}
