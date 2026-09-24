/**
 * Extras: the comics, artwork, hero and villain files and the soundtrack, reached from Title. Five tabs (Stories,
 * Heroes, Villains, Artwork, Music), each a shelf of tiles; a locked tile shows its picture pixelated and says what
 * opens it, an open one reads, views or plays.
 *
 * What is open is `progression/extras.ts`'s (read through `extras()`, refreshed from storage when the screen opens);
 * the tabs, tiles and grid are `view/extras-model.ts`'s. This scene draws them and routes a tap:
 *
 * - **Stories** start the campaign opener with no run behind it (`CampaignOpenerData`'s Extras read), which comes
 *   back here to the same tab.
 * - **Heroes, Villains, Artwork** open the viewer overlay (`scenes/extras-viewer.ts`) over this screen.
 * - **Music** plays the song through the music controller's jukebox, until Title (or any other screen) asks for its
 *   own music again.
 */
import Phaser from "phaser";
import { accent, ink, surface, typeRole } from "../tokens.js";
import { bangers, campaignFrame, drawPicture, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McTabs, fitText } from "../ui/widgets.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
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
import type { CampaignOpenerData } from "./campaign/routes.js";
import type { ExtrasViewerData } from "./extras-viewer.js";

export interface ExtrasSceneData {
  /** The tab to open on: a story read comes back to Stories. Defaults to the tab open last time. */
  readonly tab?: ExtrasTab;
}

const TAB_HEIGHT = 44;

export class ExtrasScene extends Phaser.Scene {
  #tab: ExtrasTab = "stories";
  /** One scroll position per tab, kept across visits (Phaser reuses this scene instance). */
  readonly #scrolls = new Map<ExtrasTab, ListScroll>();
  #buttons: McButton[] = [];
  #tabs: McTabs | null = null;
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #redrawQueued = false;
  /** Between `create` and shutdown. Not `sys.isActive()`, which is still false while `create` itself draws. */
  #alive = false;

  constructor() {
    super(SCENES.extras);
  }

  create(data: ExtrasSceneData = {}): void {
    this.#tab = data.tab ?? this.#tab;
    this.#redrawQueued = false;
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.extrasViewer),
      onCancel: () => this.#back(),
      onPage: (direction) => this.#list?.scrollByPage(direction),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#draw, this);
      this.#destroyWidgets();
    });
    this.#draw();
    fadeScreenIn(this);
    void refreshUnlocks()
      .catch(() => false)
      .then(() => this.#draw());
  }

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
    this.#draw();
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
    if (content.kind === "track") {
      const music = appSession().music;
      if (music?.jukeboxKey() === content.track.key) music.playTitle();
      else music?.playTrack(content.track);
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
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);

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

    const tabs = extrasTabsOf(current);
    const tabRect: Rect = { x: gutter, y: bar.height + 12, width: width - gutter * 2, height: TAB_HEIGHT };
    this.#tabs = new McTabs(this, {
      rect: tabRect,
      tabs: tabs.map((tab) => ({ id: tab.id, label: phone ? tab.name : tab.label })),
      activeId: this.#tab,
      onSelect: (id) => this.#select(id as ExtrasTab),
    });
    const tabWidth = tabRect.width / tabs.length;
    tabs.forEach((tab, index) => {
      stops.set(`tab:${tab.id}`, {
        rect: { x: tabRect.x + index * tabWidth, y: tabRect.y, width: tabWidth, height: tabRect.height },
        activate: () => this.#select(tab.id),
      });
    });

    const listTop = tabRect.y + tabRect.height + 14;
    const listRect: Rect = {
      x: gutter,
      y: listTop,
      width: width - gutter * 2,
      height: Math.max(60, height - listTop - gutter),
    };
    // The scrollbar sits in the list's own right edge; keep tiles clear of it.
    const gridWidth = listRect.width - 12;
    const grid = extrasGridOf(gridWidth, this.#tab, phone);
    const tiles = extrasTilesOf(current, this.#tab);
    const rows = extrasRowCount(tiles.length, grid);
    const playing = appSession().music?.jukeboxKey() ?? null;

    let list: McVirtualList;
    list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: grid.rowHeight,
      count: rows,
      scroll: this.#scroll(this.#tab),
      background: false,
      renderRow: (rowIndex, rect) => this.#renderRow(tiles, rowIndex, rect, grid, playing),
      onRowActivate: (rowIndex, pointer) => {
        const index = extrasTileAt(pointer.x, rowIndex, grid, listRect.x, tiles.length);
        if (index !== null) this.#activate(tiles[index]!);
      },
    });
    this.#list = list;

    const order = [...(bar.backRect ? ["back"] : []), ...EXTRAS_TABS.map((tab) => `tab:${tab.id}`)];
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
    for (let column = 0; column < grid.columns; column += 1) {
      const index = rowIndex * grid.columns + column;
      const tile = tiles[index];
      if (!tile) break;
      const tileRect = extrasTileRect(index, grid, rect);
      if (this.#tab === "music") objects.push(...this.#drawTrackRow(tile, tileRect, playing));
      else objects.push(...this.#drawTile(tile, tileRect));
    }
    return { objects };
  }

  #drawTile(tile: ExtrasTileView, rect: Rect): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const captionHeight = 52;
    const art: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - captionHeight };

    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(art.x, art.y, art.width, art.height);
    ground.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, art.y + art.height, rect.width, captionHeight);
    objects.push(ground);

    const portrait = this.#tab === "heroes" || this.#tab === "villains";
    const image = drawPicture(this, tile.thumb, art, () => this.#requestRedraw(), {
      focusY: portrait ? 0.2 : 0.4,
      // Locked: a grey ghost of the picture on the ink ground, so the shelf shows what there is to earn.
      ...(tile.open ? {} : { grayscale: true, alpha: 0.3 }),
    });
    if (image) {
      objects.push(image);
    } else {
      // No picture yet: the entry's initial, big and faint, so the shelf still reads as a shelf.
      objects.push(
        this.add
          .text(art.x + art.width / 2, art.y + art.height / 2, tile.title.charAt(0).toUpperCase(), {
            ...textStyle(bangers(Math.round(art.height * 0.5)), surface.paper.hex, 0.18),
          })
          .setOrigin(0.5),
      );
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
