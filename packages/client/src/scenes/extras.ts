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
 *
 * **One Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`, as `scenes/how-to-play.ts` is) at the rects
 * `view/extras-model.ts` gives: the ink top bar (`dom/sheet-top-bar.ts`), the two doors, the tab rail and one natively
 * scrolling shelf of tiles whose pictures are lazy `<img>`s (a locked tile's a gray, faded ghost). The Music tab's
 * player stays a Phaser widget (`ui/now-playing-panel.ts`: a progress bar that moves every frame, a volume slider
 * shared with the jukebox popover) shown through a hole in the panel, so it behaves as it always did. The scene keeps
 * the focus route (its ring drawn in the DOM, `dom/dom-ring.ts`), the card hover popover over the promo tiles (shown
 * through a hole too), navigation and the music controller's wiring.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { hit, minType, surface, typeRole } from "../tokens.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { cssOf } from "../ui/theme.js";
import type { McButton } from "../ui/widgets.js";
import { drawNowPlayingPanel, type NowPlayingPanel } from "../ui/now-playing-panel.js";
import { earnedSongsOf } from "../view/music-player.js";
import { fadeScreenIn, goToScreen, holdScreenFor } from "../ui/transitions.js";
import type { Rect } from "../view/layout.js";
import {
  extrasGridOf,
  extrasRowCount,
  extrasSummaryOf,
  extrasTabsOf,
  extrasTileRect,
  extrasTilesOf,
  type ExtrasTileView,
} from "../view/extras-model.js";
import { EXTRAS_TABS, type ExtrasTab } from "../progression/extras.js";
import { extras, refreshUnlocks } from "../progression/progression.js";
import { appSession } from "../session.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { sheetTopBar } from "../dom/sheet-top-bar.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { PROMO_SETS, promoFaceArt } from "../art/promo-art.js";
import type { ArtSource } from "../art/art-source.js";
import type { CampaignOpenerData } from "./campaign/routes.js";
import type { ExtrasViewerData } from "./extras-viewer.js";
import type { ExtrasReaderData } from "./extras-reader.js";
import type { SideStoryReaderData } from "./side-story-reader.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";

export interface ExtrasSceneData {
  /** The tab to open on: a story read comes back to Stories. Defaults to the tab open last time. */
  readonly tab?: ExtrasTab;
}

const TAB_HEIGHT = 44;
/** The scrolling shelf's key in the panel. */
const SHELF = "shelf";

/** Emitted on this scene by the viewer when a promo card is picked or dropped. */
export const PROMO_CHANGED = "promo-changed";

/** A promo tile's place on the shelf (content space) and what its hover popover shows. */
interface PromoTarget {
  readonly cardId: string;
  readonly art: ArtSource;
  readonly rect: Rect;
}

export class ExtrasScene extends Phaser.Scene {
  #tab: ExtrasTab = "stories";
  /** One scroll position per tab, kept across visits (Phaser reuses this scene instance). */
  readonly #scrolls = new Map<ExtrasTab, number>();
  /** The tab the panel's shelf is showing now, to tell a new tab (read from its own scroll) from a redraw (kept). */
  #shownTab: ExtrasTab | null = null;
  /** The Music tab's Phaser player, with its buttons. */
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  #obstacles: Rect[] = [];
  #redrawQueued = false;
  /** Between `create` and shutdown. Not `sys.isActive()`, which is still false while `create` itself draws. */
  #alive = false;
  /** The Music tab's expanded player (#191), whose progress bar moves every frame. */
  #player: NowPlayingPanel | null = null;
  /** Where the player is on screen, left out of the panel to be seen through it. */
  #playerRect: Rect | null = null;
  #unsubscribe: (() => void) | null = null;
  #hover: HoverPreview | null = null;
  /** The Promo Cards tab's tiles as drawn, for the hover popover: a locked one shows what there is to earn. */
  #promoTargets = new Map<string, PromoTarget>();
  /** The shelf's own box, which a hover rect is clipped to. */
  #listRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  /** The screen, one Lit panel over the canvas; made on the first draw and kept, so the shelf's scroll stays. */
  #region: DomRegion<McSheet> | null = null;
  /** What each key in the panel does when tapped, this draw. */
  #actions = new Map<string, () => void>();

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
    this.#region = null;
    this.#shownTab = null;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    const offLanguage = onLanguageChange(() => {
      if (this.#alive) this.#draw();
    });
    // A glyph that would hang over another control is not drawn (the phone's Back hint, over the Trophy Room button).
    this.#glyphs = new SheetGlyphs(
      this,
      () => this.#draw(),
      () => this.#obstacles,
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.extrasViewer),
      onCancel: () => this.#back(),
      // LB / RB (and the zone keys) step the tabs along the top; Page Up / Down still page the shelf.
      onTab: (direction) => this.#stepTab(direction),
      onPage: (direction) => this.#scroller()?.scrollBy({ top: direction * this.#listRect.height * 0.9 }),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
    });
    // A new song (the shuffle moving on, or Next) redraws the Music tab's player and its playing row.
    this.#unsubscribe = appSession().music?.onTrackStart(() => this.#requestRedraw()) ?? null;
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => (this.scene.isActive(SCENES.extrasViewer) ? null : screenHoverArea(this, pointer)),
    });
    this.events.on(PROMO_CHANGED, this.#requestRedraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#scrolls.set(this.#tab, this.#scroller()?.scrollTop ?? this.#scrolls.get(this.#tab) ?? 0);
      this.#hover?.destroy();
      this.#hover = null;
      this.events.off(PROMO_CHANGED, this.#requestRedraw, this);
      this.scale.off("resize", this.#draw, this);
      offLanguage();
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#glyphs.dispose();
      this.#destroyWidgets();
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
    });
    this.#draw();
    fadeScreenIn(this);
    // The shelf as the saves have it now: drawn before the screen fades in, rather than redrawn as it does. Drawn again
    // only when the read changed something the shelf shows (an unlock, or Extras progress, which makes a new
    // `extras()`): a redraw of the whole screen was a second long frame on every visit (issue #722).
    const shown = extras();
    holdScreenFor(
      this,
      refreshUnlocks()
        .catch(() => false)
        .then((changed) => {
          if (!changed && extras() === shown) return;
          this.#draw();
        }),
    );
  }

  #scroller(): HTMLElement | null {
    return this.#region?.element.elementOf(SHELF) ?? null;
  }

  /** The promo tiles in view, with their place on screen (the shelf's scroll applied), for the hover popover. */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const list = this.#listRect;
    const scrolled = this.#scroller()?.scrollTop ?? 0;
    for (const [slot, target] of this.#promoTargets) {
      const shown = clipHoverRect({ ...target.rect, y: list.y + target.rect.y - scrolled }, list);
      if (shown) found.set(slot, { ...shown, cardId: target.cardId, art: target.art, through: true });
    }
    return found;
  }

  #back(): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.title);
  }

  #select(tab: ExtrasTab): void {
    if (tab === this.#tab) return;
    this.#scrolls.set(this.#tab, this.#scroller()?.scrollTop ?? 0);
    this.#tab = tab;
    this.#draw();
  }

  /** LB / RB: the previous or next tab, stopping at the ends like the tab strip itself. */
  #stepTab(direction: 1 | -1): void {
    const at = EXTRAS_TABS.findIndex((tab) => tab.id === this.#tab);
    const next = EXTRAS_TABS[at + direction];
    if (next) {
      this.#select(next.id);
      this.#route?.focusKey(`tab:${next.id}`);
    }
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
    this.#player = null;
  }

  #draw(): void {
    if (!this.#alive) return;
    this.#destroyWidgets();
    destroyChildren(this);
    this.#glyphs.reset();
    this.#obstacles = [];
    this.#actions = new Map();
    this.#promoTargets = new Map();
    this.#playerRect = null;
    resetHoverCards(this);

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    const current = extras();
    const stops = new Map<string, FocusStop>();
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);

    // The ground under the panel too: the chrome buttons' holes in the panel (the dark mode toggle) and the player's
    // hole show the canvas.
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    this.add.rectangle(0, 0, width, frame.topBar, surface.ink.hex).setOrigin(0, 0);
    b.box({ x: 0, y: 0, width, height }, { fill: surface.paper.hex });
    const bar = sheetTopBar(b, this.#glyphs, {
      frame,
      backLabel: phone ? "◂" : t("extras.back"),
      title: t("title.extras"),
      right: extrasSummaryOf(current),
    });
    if (bar.backRect) {
      this.#actions.set("back", () => this.#back());
      stops.set("back", { rect: bar.backRect, activate: () => this.#back() });
    }

    // The Trophy Room and Art & Credits doors: beside the tabs on a wide screen, on a row of their own above them on a
    // phone. (The Mod Store moved to the main menu: issue #734; opening a replay file to Past games: #858.)
    const doorWidth = 150;
    const trophyWidth = doorWidth * 2 + 8;
    const rowGap = 8;
    // The doors beside the tab strip leave it too narrow to print every tab's label whole at some widths (measured, not
    // guessed): then the doors take rows of their own above it, three across, or two to a row on a phone.
    const tabs = extrasTabsOf(current);
    const tabType = { ...typeRole.label, size: Math.max(minType.phoneLabel, typeRole.label.size) };
    const widestTab = Math.max(
      ...tabs.map((tab) => b.measure((phone ? tab.name : tab.label).toUpperCase(), typeRole.label).width),
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
    b.button({
      key: "trophies",
      rect: trophyRect,
      label: phone ? t("extras.trophies") : `${t("title.trophyRoom")} ▸`,
      look: "secondary",
      type: typeRole.label,
    });
    b.button({
      key: "credits",
      rect: creditsRect,
      label: t("extras.credits"),
      look: "secondary",
      type: typeRole.label,
    });
    this.#actions.set("trophies", openTrophies);
    this.#actions.set("credits", openCredits);
    stops.set("trophies", { rect: trophyRect, activate: openTrophies });
    stops.set("credits", { rect: creditsRect, activate: openCredits });

    const tabRect: Rect = stackDoors
      ? { x: gutter, y: doorsBottom + 8, width: width - gutter * 2, height: TAB_HEIGHT }
      : { x: gutter, y: bar.height + 12, width: width - gutter * 2 - trophyWidth - 12, height: TAB_HEIGHT };
    // The tab rail (`mc-tab-rail`): a recessed strip of equal cells, the active one an ink fill.
    b.tabRail(tabRect, {
      tabs: tabs.map((tab) => ({ id: tab.id, label: phone ? tab.name : tab.label })),
      selected: this.#tab,
      size: tabType.size,
    });
    const tabWidth = tabRect.width / tabs.length;
    tabs.forEach((tab, index) => {
      const cell: Rect = { x: tabRect.x + index * tabWidth, y: tabRect.y, width: tabWidth, height: tabRect.height };
      this.#actions.set(`tab:${tab.id}`, () => this.#select(tab.id));
      stops.set(`tab:${tab.id}`, { rect: cell, activate: () => this.#select(tab.id) });
    });
    this.#obstacles.push(trophyRect, creditsRect, tabRect);
    // LB / RB, pad only, in the gap under the strip's right end.
    this.#glyphs.hint(b, {
      key: "tab-step",
      x: tabRect.x + tabRect.width,
      y: tabRect.y + tabRect.height + 11 + 8,
      ids: ["zonePrevious", "zoneNext"],
      idsNow: (set) => (set === "pad" ? ["zonePrevious", "zoneNext"] : null),
      height: 16,
      ground: "paper",
      alignRight: true,
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
      this.#playerRect = { x: gutter, y: listTop, width: width - gutter * 2, height: player.height };
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
    this.#listRect = listRect;
    // The scrollbar sits in the list's own right edge; keep tiles clear of it.
    const gridWidth = listRect.width - 12;
    const grid = extrasGridOf(gridWidth, this.#tab, phone);
    const tiles = extrasTilesOf(current, this.#tab, appSession().settings.promoArt);
    const rows = extrasRowCount(tiles.length, grid);
    const playing = appSession().music?.nowPlaying()?.key ?? null;

    b.scroll(SHELF, listRect, rows * grid.rowHeight, (inner) => {
      tiles.forEach((tile, index) => {
        const rowIndex = Math.floor(index / grid.columns);
        const rect = extrasTileRect(index, grid, { x: listRect.x, y: rowIndex * grid.rowHeight });
        if (this.#tab === "music") this.#drawTrackRow(inner, tile, rect, playing);
        else this.#drawTile(inner, tile, rect);
        const key = `tile:${tile.id}`;
        inner.tap(key, rect);
        this.#actions.set(key, () => this.#activate(tile));
        stops.set(
          key,
          this.#tileStop(key, () => this.#activate(tile)),
        );
        if (this.#tab !== "promos") return;
        const set = PROMO_SETS.find((one) => `promo:${one.id}` === tile.id);
        if (set) {
          this.#promoTargets.set(hoverSlotOf(set.cardId, `promo${index}`), {
            cardId: set.cardId,
            art: promoFaceArt(set, set.faces[0]!),
            rect,
          });
        }
      });
      if (tiles.length === 0) inner.emptyState(listRect.x, 0, t("extras.empty"));
    });

    this.#mount(width, height, b);
    this.#hover?.onDraw();

    this.#route?.set(
      [
        ...(bar.backRect ? ["back"] : []),
        "trophies",
        "credits",
        ...EXTRAS_TABS.map((tab) => `tab:${tab.id}`),
        ...playerStops,
        ...tiles.map((tile) => `tile:${tile.id}`),
      ],
      stops,
    );
  }

  /** A stop inside the scrolling shelf: its box is read off the panel, so it follows the scroll, and taking focus scrolls it into view. */
  #tileStop(key: string, activate: () => void): FocusStop {
    const region = (): DomRegion<McSheet> | null => this.#region;
    return {
      rect: () => {
        const found = region()?.element.elementOf(key);
        return found ? region()!.rectOf(found) : this.#listRect;
      },
      view: () => {
        const found = region()?.element.elementOf(SHELF);
        return found ? region()!.rectOf(found) : this.#listRect;
      },
      activate,
      ensureVisible: () => region()?.element.elementOf(key)?.scrollIntoView({ block: "nearest" }),
    };
  }

  /** Hands the built parts to the panel (made once, so the shelf's scroll survives a redraw) and renders them now. */
  #mount(width: number, height: number, builder: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas.
      this.#region.forwardMouseMoves();
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    // The Music tab's player and the hover popover are drawn in the canvas: left out of the panel to be seen through it.
    region.setHoles(() => {
      const holes: Rect[] = [];
      if (this.#playerRect) holes.push(this.#playerRect);
      const popover = this.#hover?.shownRect;
      if (popover) holes.push(popover);
      return holes;
    });
    region.element.nodes = builder.nodes;
    renderNow(region.element);
    // A tab opens where it was left; a redraw of the same tab keeps the scroll the panel already has.
    if (this.#shownTab !== this.#tab) {
      const scroller = this.#scroller();
      if (scroller) scroller.scrollTop = this.#scrolls.get(this.#tab) ?? 0;
      this.#shownTab = this.#tab;
    }
  }

  #drawTile(b: SheetBuilder, tile: ExtrasTileView, rect: Rect): void {
    const portrait = this.#tab === "heroes" || this.#tab === "villains" || this.#tab === "promos";
    b.pictureTile(
      rect,
      {
        src: tile.thumb?.url ?? null,
        focusY: portrait ? 0.2 : 0.4,
        // Locked: a gray ghost of the picture on the ink ground, so the shelf shows what there is to earn.
        dim: !tile.open,
        chip: tile.open ? `${tile.action} ▸` : t("extras.locked"),
        chipTone: tile.open ? "action" : "locked",
        title: tile.title,
        detail: tile.open ? tile.subtitle : (tile.hint ?? ""),
        detailTone: tile.open ? "meta" : "alert",
        initial: tile.title.charAt(0).toUpperCase(),
      },
      `thumb:${tile.id}`,
    );
  }

  #drawTrackRow(b: SheetBuilder, tile: ExtrasTileView, rect: Rect, playing: string | null): void {
    const content = tile.entry.content;
    const isPlaying = content.kind === "track" && playing === content.track.key;
    b.listRow(
      { x: rect.x, y: rect.y + 3, width: rect.width, height: rect.height - 6 },
      {
        leading: isPlaying ? "■" : "▶",
        title: tile.title,
        detail: tile.open
          ? isPlaying
            ? t("extras.nowPlaying", { detail: tile.subtitle })
            : tile.subtitle
          : (tile.hint ?? ""),
        open: tile.open,
        active: isPlaying,
      },
      `row:${tile.id}`,
    );
  }
}
