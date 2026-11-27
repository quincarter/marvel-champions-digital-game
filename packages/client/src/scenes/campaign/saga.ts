/**
 * C00b — The Saga: the campaign shelf. One featured volume (art, status, its own CTA) plus a 3×3 "ALL VOLUMES"
 * grid — desktop and a sideways tablet — or, stacked under it, tiles or a list — phone and an upright tablet — of all the boxes in release order (`SAGA_VOLUMES`).
 *
 * Matches the current design canvas (`Marvel Champions game screens/Campaign - *.dc.html`'s `saga()`): the grid
 * includes the featured volume itself (its own tile, ringed red), not just what's "next"; status drives every
 * chip's color (done green, live red, fresh yellow, sealed an outline); a sealed tile dims under a dark scrim.
 *
 * The whole screen is one Lit panel over the canvas (`dom/dom-region.ts`, `mc-sheet`) at the same rects: the top bar,
 * the featured card, the volumes (tiles or rows, one native scroller whose pictures load as they near the view) and the
 * action bar. The scene keeps the focus route (its ring drawn in the panel layer), the glyph hints and navigation.
 *
 * All data — status, unlock, pips, roster names — comes from `view/campaign-saga-model.ts` and its words from
 * `view/campaign-saga-copy.ts`; this scene only lays it out and wires taps. Tapping any volume (grid tile, phone row)
 * re-features it; nothing here computes legality or unlock itself.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { CAMPAIGN_RECORDS } from "../../campaign/campaign-service.js";
import { customSagaVolumes, packCampaignEntryOf } from "../../campaign/pack-campaigns.js";
import { packFileArt } from "../../art/pack-art.js";
import type { ArtSource } from "../../art/art-source.js";
import type { Picture } from "../../art/pictures.js";
import { loadedPacks } from "../../packs/pack-registry.js";
import { customBadge } from "../../view/custom-content.js";
import { rebuildOnPackChange } from "../../ui/pack-redraw.js";
import { campaignCardsById } from "../../content/campaign-pool.js";
import { cardDisplayName } from "../../view/hero-names.js";
import { accent, hit, ink, signal, surface, typeRole } from "../../tokens.js";
import {
  bangers,
  campaignCoverPicture,
  campaignFrame,
  villainPicture,
  type PipState,
} from "../../ui/campaign-chrome.js";
import { cssOf, caseOf } from "../../ui/theme.js";
import { isDesktopType } from "../../ui/desktop-type.js";
import { inputDevice } from "../../platform/input-device.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { campaignService } from "../../session.js";
import {
  campaignSagaRows,
  defaultFeaturedVolume,
  doneVolumeCount,
  openVolumeCount,
  type SagaVolumeRow,
} from "../../view/campaign-saga-model.js";
import {
  altsOf,
  ctaOf,
  featuredCopyOf,
  gridChipOf,
  type SagaAlt,
  type SagaCta,
} from "../../view/campaign-saga-copy.js";
import type { SagaVolume } from "../../campaign/story.js";
import { volumeNameIn } from "../../campaign/campaign-text.js";
import { rememberSagaVolumesView, sagaVolumesView, type SagaVolumesView } from "../../platform/saga-view.js";
import type { Rect } from "../../view/layout.js";
import { clipToView, revealDelta } from "../../view/focus-list.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { goToCampaignStart } from "./start-route.js";
import { SCENES } from "../keys.js";
import { refreshUnlocks, unlocks } from "../../progression/progression.js";
import { unlockCostOf, unlockOrAsk } from "../unlock-confirm.js";
import { t } from "../../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../../language-change.js";
import { DomRegion, renderNow } from "../../dom/dom-region.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { gatePanels } from "../../dom/busy-gate.js";
import { PictureLeases } from "../../dom/picture-leases.js";
import { SheetBuilder } from "../../dom/sheet-builder.js";
import { SheetGlyphs } from "../../dom/sheet-glyphs.js";
import { sheetTopBar } from "../../dom/sheet-top-bar.js";
import { commandMeaning, staleKeys } from "../../dom/stale-presses.js";
import { cancelPressesWithin } from "@mc/ui";
import type { CampaignSagaData } from "./routes.js";

/** Where a page-scrolled list's rows are (the phone's one scroller): see `#drawVolumes`. */
interface VolumeInline {
  /** The builder to draw the rows into, and the content y of the first row. */
  readonly into: SheetBuilder;
  readonly top: number;
  /** A content-space rect as it is on the screen now. */
  readonly onScreen: (content: Rect) => Rect;
  /** The part of the screen a row can be seen in. */
  readonly view: () => Rect;
  /** Scrolls the page the least that brings a row into view. */
  readonly reveal: (content: Rect) => void;
}

/** How the volumes draw as tiles: how many across, and how tall. */
interface VolumeTiles {
  readonly columns: number;
  readonly height: number;
}

const WIDE_TILE_COLUMNS = 4;
const TILE_COLUMNS = 4;
const PHONE_TILE_COLUMNS = 2;
const TILE_GAP = 12;
const MIN_TILE_HEIGHT = 100;
const VOLUME_ROW_HEIGHT = 58;
const VIEW_STOP = "volumes-view";
/** The scrollbar's room beside a scroller (`SCROLL_GUTTER` in `@mc/ui`). */
const SCROLL_GUTTER = 8;
/** The volumes scroller's key in the panel. */
const LIST = "saga-volumes";
/** The room the "scroll for more" cue takes under the list. */
const MORE_HEIGHT = 20;
/** The tile's own ground: a shade warmer than ink, as the design canvas has it. */
const TILE_GROUND = 0x0b0906;

/** A hero's name from the pool, else its id. A run's custom hero is named from its own summary (`campaign-saga-model`). */
const identityNameOf = (id: string): string => {
  const card = campaignCardsById().get(id);
  return card ? cardDisplayName(card) : id;
};

/**
 * A volume's art: the box's own cover (`art/campaigns/<id>/cover.*`) when it has one, as the Cover screen uses, else its
 * final villain. A pack campaign's is the cover file its pack lists (null when it lists none, or once the pack is gone:
 * the tile then draws its generated ink cover).
 */
const volumeArtOf = (volume: SagaVolume): Picture | ArtSource | null => {
  if (volume.custom) {
    const cover = packCampaignEntryOf(loadedPacks(), volume.campaignId)?.campaign.art?.cover;
    return cover === undefined ? null : packFileArt(volume.custom.packId, cover);
  }
  return campaignCoverPicture(volume.campaignId) ?? villainPicture(finalScenarioIdOf(volume.campaignId));
};

/** "VOL. 3" for a base box; a pack campaign says CUSTOM in words (never a number past the base game's). */
const volumeTagOf = (volume: SagaVolume): string =>
  volume.custom ? customBadge() : t("saga.volume", { number: volume.number }).toLocaleUpperCase();

const CUSTOM_HEADER_HEIGHT = 34;

/** One row of the volumes list: a section header, or a run of volumes (a tile row, or a single phone row). */
type ShelfItem = { readonly kind: "header" } | { readonly kind: "volumes"; readonly rows: readonly SagaVolumeRow[] };

/** A box's own final scenario (its `Campaign.scenarioIds`' last entry) — the villain art `villainPicture` keys on. */
const finalScenarioIdOf = (campaignId: string): string =>
  (CAMPAIGN_RECORDS[campaignId]?.scenarioIds.at(-1) as string | undefined) ?? campaignId;

/** A rectangle's corners turned by `angle` radians about its own center (Phaser rotates a container about its origin). */
function turnedCorners(cx: number, cy: number, width: number, height: number, angle: number): [number, number][] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (
    [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ] as const
  ).map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
}

/** The "pips" of a run's issues: paper done, red current (paper ring), outlined empty. */
function drawPips(b: SheetBuilder, rect: Rect, pips: readonly PipState[]): void {
  const gap = 5;
  const count = Math.max(1, pips.length);
  const width = (rect.width - gap * (count - 1)) / count;
  pips.forEach((state, index) => {
    const x = rect.x + index * (width + gap);
    if (state === "done") b.box({ x, y: rect.y, width, height: rect.height }, { fill: surface.paper.hex });
    else if (state === "current") {
      b.box({ x: x - 2, y: rect.y - 2, width: width + 4, height: rect.height + 4 }, { fill: surface.paper.hex });
      b.box({ x, y: rect.y, width, height: rect.height }, { fill: accent.heroRed.hex });
    } else
      b.box(
        { x: x + 1, y: rect.y + 1, width: width - 2, height: rect.height - 2 },
        { stroke: surface.paper.hex, strokeWidth: 2, alpha: 0.35 },
      );
  });
}

const CHIP_COLORS = {
  done: { fill: signal.heal.hex, text: surface.paper.hex },
  live: { fill: accent.heroRed.hex, text: surface.paper.hex },
  fresh: { fill: signal.caution.hex, text: surface.inkOnHue.hex },
  sealed: { fill: null, text: surface.paper.hex },
} as const;

export class CampaignSagaScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  /** What a hanging glyph must not cover: the action buttons. */
  #obstacles: Rect[] = [];
  /** The screen, one Lit panel over the canvas; made on the first draw and kept (so the list's scroll survives). */
  #region: DomRegion<McSheet> | null = null;
  readonly #leases = new PictureLeases();
  #actions = new Map<string, () => void>();
  #meanings = new Map<string, string>();
  #lastMeanings = new Map<string, string>();
  /** Whether the big button can be pressed right now (Start and A must not press a disabled one). */
  #ctaEnabled = false;
  #stops = new Map<string, FocusStop>();
  #rows: readonly SagaVolumeRow[] = [];
  #featured = 1;
  #confirmAbandon = false;
  /** The volumes list's box on the screen, and what it holds: the focus ring and the scroll cue read them. */
  #listRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #listContent = 0;
  #listTop = 0;
  #moreShown = false;
  /** Box art tiles or plain rows under the featured volume, on a phone or an upright tablet. */
  #volumesView: SagaVolumesView = "grid";
  /** What the player chose on this visit; until then the kept choice, or the screen's own default. */
  #volumesChosen: SagaVolumesView | null = null;
  #alive = false;
  #abandoning = false;
  /** The scrollers whose scroll place has been restored and listened to. */
  readonly #placed = new WeakSet<HTMLElement>();

  constructor() {
    super(SCENES.campaignSaga);
  }

  create(_data: CampaignSagaData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#alive = true;
    this.#region = null;
    this.#abandoning = false;
    this.#listTop = 0;
    this.scale.on("resize", this.#rebuild, this);
    this.#glyphs = new SheetGlyphs(
      this,
      () => this.#rebuild(),
      () => this.#obstacles,
    );
    // A cover that resolves later (its pack has loaded), or a language switch (#390), draws the screen again.
    const offArt = onArtChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    const offLanguage = onLanguageChange(() => {
      if (this.sys.isActive()) void this.#load(true);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#rebuild, this);
      offArt();
      offLanguage();
      this.#glyphs.dispose();
      this.#leases.dispose();
      // The panel goes with the scene (`DomRegion`); the next visit makes a new one.
      this.#region = null;
    });
    this.#volumesChosen = null;
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // Start and A with nothing focused: the featured volume's one big button.
      primary: () => (this.#stops.has("cta") && this.#ctaEnabled ? "cta" : null),
      blocked: () => this.scene.isActive(SCENES.unlockConfirm) || this.#abandoning,
      onCancel: () => goToScreen(this, SCENES.title),
      // LB / RB: the list or the grid, where the screen offers both.
      onTab: () => this.#stops.get(VIEW_STOP)?.activate(),
      onPage: (direction) => this.#scroller()?.scrollBy({ top: direction * this.#listRect.height * 0.9 }),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onHomeEnd: (edge) => {
        const scroller = this.#scroller();
        if (scroller) scroller.scrollTop = edge === "home" ? 0 : scroller.scrollHeight;
      },
    });
    this.#rows = [];
    this.#confirmAbandon = false;
    void this.#load(false);
    // Installed packs load a moment after boot, and again after an install or removal in the Mod Store.
    rebuildOnPackChange(this, () => void this.#load(false));
    fadeScreenIn(this);
  }

  #scroller(): HTMLElement | null {
    return this.#region?.element.elementOf(LIST) ?? null;
  }

  async #load(force: boolean): Promise<void> {
    const [summaries] = await Promise.all([campaignService().storage.list(), refreshUnlocks().catch(() => false)]);
    if (!this.sys.isActive()) return;
    const unlocked = unlocks();
    const rows = campaignSagaRows(summaries, {
      customVolumes: customSagaVolumes(loadedPacks(), summaries),
      identityNameOf,
      waveLockOf: (campaignId) => unlocked.campaignLock(campaignId),
      openedByHandOf: (campaignId) => unlocked.campaignManual(campaignId),
    });
    // A second load (installed packs arriving a moment after boot, or a pack change) that finds the shelf as it is
    // draws nothing: rebuilding the whole screen under a player's finger dropped the tap it was in the middle of. When
    // something did change, the volume the player picked stays picked.
    const built = this.#rows.length > 0;
    if (!force && built && JSON.stringify(rows) === JSON.stringify(this.#rows)) return;
    const keepFeatured = built && rows.some((row) => row.volume.number === this.#featured);
    this.#rows = rows;
    if (!keepFeatured) this.#featured = defaultFeaturedVolume(this.#rows);
    this.#rebuild();
  }

  #rebuild(): void {
    if (!this.#alive || this.#rows.length === 0) return;
    this.#glyphs.reset();
    this.#leases.begin();
    this.#actions = new Map();
    this.#lastMeanings = this.#meanings;
    this.#meanings = new Map();
    this.#stops = new Map();
    this.#ctaEnabled = false;
    this.#obstacles = [];

    const frame = campaignFrame(this);
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    b.box({ x: 0, y: 0, width: frame.width, height: frame.height }, { fill: surface.paper.hex });
    const baseRows = this.#rows.filter((r) => !r.volume.custom);
    // A phone starts on its rows and an upright tablet on the tiles, until the player chooses.
    this.#volumesView = this.#volumesChosen ?? sagaVolumesView(frame.phone ? "list" : "grid");
    const top = sheetTopBar(b, this.#glyphs, {
      scene: this,
      frame,
      ...(frame.phone ? { backLabel: "◂" } : { backLabel: t("saga.backTitle") }),
      title: t("saga.title"),
      right: t("saga.progress", {
        done: doneVolumeCount(baseRows),
        total: baseRows.length,
        open: openVolumeCount(baseRows),
      }),
    });
    if (top.backRect) {
      this.#actions.set("back", () => goToScreen(this, SCENES.title));
      this.#stops.set("back", { rect: top.backRect, activate: () => goToScreen(this, SCENES.title) });
    }

    const row = this.#rows.find((r) => r.volume.number === this.#featured) ?? this.#rows[0]!;

    // An upright tablet stacks as a phone does: the wide layout's featured card is a tall sliver beside the grid.
    if (frame.phone || frame.formFactor === "tabletPortrait") this.#drawPhone(b, frame, top.height, row);
    else this.#drawWide(b, frame, top.height, row);

    const order = ["back", ...[...this.#stops.keys()].filter((k) => k !== "back")];
    this.#route?.set(order, this.#stops);
    this.#mount(frame, b);
  }

  /** Hands the built parts to the panel (made once, so the list's scroll survives a redraw) and renders them now. */
  #mount(frame: { readonly width: number; readonly height: number }, b: SheetBuilder): void {
    const rect: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#leases.watch(element);
      this.#region = new DomRegion(this, element, rect);
    }
    const region = this.#region;
    region.setRect(rect);
    region.element.nodes = b.nodes;
    renderNow(region.element);
    this.#leases.end();
    for (const key of staleKeys(this.#lastMeanings, this.#meanings)) {
      const element = region.element.elementOf(key);
      if (element) cancelPressesWithin(element);
    }
    const scroller = this.#scroller();
    if (scroller && !this.#placed.has(scroller)) {
      // The list comes back to where it was left (a redraw that made a new scroller).
      scroller.scrollTop = this.#listTop;
      this.#placed.add(scroller);
      scroller.addEventListener(
        "scroll",
        () => {
          this.#listTop = scroller.scrollTop;
          const more = this.#moreNow();
          if (more !== this.#moreShown) this.#rebuild();
        },
        { passive: true },
      );
    }
  }

  /** Whether there is more list below the view: what the "scroll for more" cue says. */
  #moreNow(): boolean {
    return (
      this.#listContent > this.#listRect.height + 1 && this.#listTop + this.#listRect.height < this.#listContent - 4
    );
  }

  #feature(number: number): void {
    if (this.#featured === number) return;
    this.#featured = number;
    this.#confirmAbandon = false;
    this.#rebuild();
  }

  // ---- Wide (desktop/tablet): featured card left, 3×3 "ALL VOLUMES" grid right ----------------------------------

  #drawWide(b: SheetBuilder, frame: ReturnType<typeof campaignFrame>, topHeight: number, row: SagaVolumeRow): void {
    const gutter = frame.gutter;
    const cardWidth = Math.round(((frame.width - gutter * 3) * 1) / 2.6);
    const cardRect: Rect = {
      x: gutter,
      y: topHeight + gutter,
      width: cardWidth,
      height: frame.height - topHeight - gutter * 2,
    };
    this.#drawFeaturedCard(b, cardRect, row, false);

    const gridX = cardRect.x + cardRect.width + gutter;
    const gridWidth = frame.width - gridX - gutter;
    let y = topHeight + gutter;
    const heading = t("saga.allVolumes").toLocaleUpperCase();
    const headingType = { ...typeRole.barTitle };
    b.text(gridX, y, heading, headingType, { size: 18, color: surface.ink.hex, letterSpacing: 0.6 });
    const headingWidth = b.measure(heading, headingType, { size: 18, letterSpacing: 0.6 }).width;
    const ruleX = gridX + headingWidth + 12;
    b.box(
      { x: ruleX, y: y + 11 - 1.5, width: Math.max(0, gridX + gridWidth - ruleX), height: 3 },
      { fill: surface.ink.hex },
    );
    y += 32;

    // Three rows of tiles fill the column; a box past those scrolls, so a new one needs no layout of its own.
    const footnoteHeight = 34;
    const height = frame.height - y - gutter - footnoteHeight - MORE_HEIGHT;
    const tileHeight = Math.floor((height - TILE_GAP * 2) / 3);
    const listRect: Rect = { x: gridX, y, width: gridWidth, height: (tileHeight + TILE_GAP) * 3 };
    this.#drawVolumes(b, listRect, { columns: WIDE_TILE_COLUMNS, height: tileHeight });

    b.text(gridX, listRect.y + listRect.height + MORE_HEIGHT, caseOf(typeRole.label, t("saga.note")), typeRole.label, {
      color: surface.ink.hex,
      alpha: ink.meta,
      wrapWidth: gridWidth,
    });
  }

  /**
   * The volumes as a scrolling list, in tiles or (`tiles` null) the phone's rows, each a focus stop that scrolls into
   * view. A tap is the list's own (a tap area in its content): the end of a swipe is not one.
   */
  #drawVolumes(b: SheetBuilder, listRect: Rect, tiles: VolumeTiles | null, inline?: VolumeInline): number {
    const tileWidth = tiles ? (listRect.width - TILE_GAP * (tiles.columns - 1)) / tiles.columns : 0;
    const columns = tiles?.columns ?? 1;
    const cellAt = (rowRect: Rect, column: number): Rect => ({
      x: rowRect.x + column * (tileWidth + TILE_GAP),
      y: rowRect.y,
      width: tileWidth,
      height: tiles?.height ?? 0,
    });
    // The base volumes, then (when a pack ships a campaign) a Custom campaigns header and those: rows of the list.
    const chunk = (rows: readonly SagaVolumeRow[]): ShelfItem[] =>
      Array.from({ length: Math.ceil(rows.length / columns) }, (_, i) => ({
        kind: "volumes" as const,
        rows: rows.slice(i * columns, (i + 1) * columns),
      }));
    const customRows = this.#rows.filter((r) => r.volume.custom);
    const items: ShelfItem[] = [
      ...chunk(this.#rows.filter((r) => !r.volume.custom)),
      ...(customRows.length > 0 ? [{ kind: "header" as const }, ...chunk(customRows)] : []),
    ];
    const rowHeight = tiles ? tiles.height + TILE_GAP : VOLUME_ROW_HEIGHT;
    const heightOf = (index: number): number => (items[index]?.kind === "header" ? CUSTOM_HEADER_HEIGHT : rowHeight);
    const tops: number[] = [];
    let total = 0;
    for (let index = 0; index < items.length; index++) {
      tops.push(total);
      total += heightOf(index);
    }
    // Where a content-space rect is on the screen now, the part of the screen the rows are seen in, and how a focused row
    // is brought into it: the list's own scroller, or (`inline`) the page's.
    const top0 = inline?.top ?? 0;
    const onScreen =
      inline?.onScreen ??
      ((content: Rect): Rect => {
        const scrolled = this.#scroller()?.scrollTop ?? this.#listTop;
        return { ...content, y: listRect.y + content.y - scrolled };
      });
    const view = inline?.view ?? ((): Rect => listRect);
    const reveal =
      inline?.reveal ??
      ((content: Rect): void => {
        const scroller = this.#scroller();
        if (!scroller) return;
        const seen: Rect = { x: 0, y: scroller.scrollTop, width: listRect.width, height: listRect.height };
        const delta = revealDelta(content, seen);
        if (delta !== 0) scroller.scrollTop += delta;
      });
    if (!inline) {
      this.#listRect = listRect;
      this.#listContent = total;
      this.#moreShown = this.#moreNow();
    }

    const paint = (inner: SheetBuilder): void => {
      items.forEach((item, index) => {
        const rowRect: Rect = { x: listRect.x, y: top0 + tops[index]!, width: listRect.width, height: heightOf(index) };
        if (item.kind === "header") {
          this.#drawCustomHeader(inner, rowRect);
          return;
        }
        item.rows.forEach((volumeRow, column) => {
          const rect = tiles ? cellAt(rowRect, column) : rowRect;
          if (tiles) this.#drawTile(inner, volumeRow, rect);
          else this.#drawPhoneVolumeRow(inner, volumeRow, rect);
          const key = `vol-${volumeRow.volume.number}`;
          inner.tap(key, rect);
          this.#actions.set(key, () => this.#feature(volumeRow.volume.number));
        });
      });
    };
    if (inline) paint(inline.into);
    else b.scroll(LIST, listRect, total, paint);
    if (!inline && this.#moreShown) {
      b.text(
        listRect.x + listRect.width / 2,
        listRect.y + listRect.height + MORE_HEIGHT / 2,
        caseOf(typeRole.label, t("saga.moreVolumes")),
        typeRole.label,
        { color: surface.ink.hex, alpha: ink.meta, origin: [0.5, 0.5] },
      );
    }

    items.forEach((item, row) => {
      if (item.kind !== "volumes") return;
      item.rows.forEach((volumeRow, column) => {
        const contentRect = (): Rect => {
          const rowRect: Rect = { x: listRect.x, y: top0 + tops[row]!, width: listRect.width, height: heightOf(row) };
          return tiles ? cellAt(rowRect, column) : rowRect;
        };
        this.#stops.set(`vol-${volumeRow.volume.number}`, {
          rect: () => clipToView(onScreen(contentRect()), view()),
          view,
          activate: () => this.#feature(volumeRow.volume.number),
          ensureVisible: () => reveal(contentRect()),
        });
      });
    });
    return total;
  }

  /** The Custom campaigns section's header: the section named in words, ruled like ALL VOLUMES. */
  #drawCustomHeader(b: SheetBuilder, rect: Rect): void {
    const label = t("saga.customCampaigns").toLocaleUpperCase();
    const width = b.measure(label, typeRole.barTitle, { size: 14, letterSpacing: 0.6 }).width;
    b.text(rect.x, rect.y + rect.height / 2, label, typeRole.barTitle, {
      size: 14,
      color: surface.ink.hex,
      letterSpacing: 0.6,
      origin: [0, 0.5],
    });
    const ruleX = rect.x + width + 12;
    b.box(
      { x: ruleX, y: rect.y + rect.height / 2 - 1.5, width: Math.max(0, rect.x + rect.width - ruleX), height: 3 },
      { fill: surface.ink.hex },
    );
  }

  /** The picture a volume's tile or card shows: a small copy for a tile, the whole picture for the featured card. */
  #pictureOf(volume: SagaVolume, tile: boolean): { src: string | null; retry?: string } {
    const picture = volumeArtOf(volume);
    if (!picture) return { src: null };
    const tileUrl = (picture as Picture).tileUrl;
    return this.#leases.image(tile && tileUrl !== undefined ? { key: picture.key, url: tileUrl } : picture);
  }

  /** A text's width and height, wrapped at `width` (the width of its longest line, as Phaser's wrapped `Text` reports). */
  #wrapped(
    b: SheetBuilder,
    text: string,
    spec: typeof typeRole.label,
    width: number,
    options: { readonly size?: number; readonly letterSpacing?: number },
  ): { width: number; height: number } {
    const single = b.measure(text, spec, options);
    if (single.width <= width) return single;
    return { width, height: b.measure(text, spec, { ...options, wrapWidth: width }).height };
  }

  /**
   * A dark grid tile on the shelf ("ALL VOLUMES ───"): box code, a huge "VOL. N", the box's name, a status chip
   * (color by status; an outline for sealed) and — when the box has art — a dimmed thumbnail behind it all. `selected`
   * draws the red ring around whichever tile is currently featured.
   */
  #drawTile(b: SheetBuilder, tileRow: SagaVolumeRow, rect: Rect): void {
    const volume = tileRow.volume;
    b.box(rect, { fill: TILE_GROUND });
    const art = this.#pictureOf(volume, true);
    if (art.src !== null) {
      b.image(rect, {
        src: art.src,
        cover: { x: 0.5, y: 0.15 },
        key: `tile-art-${volume.number}`,
        ...(art.retry !== undefined ? { retry: art.retry } : {}),
      });
      b.box(rect, { fill: TILE_GROUND, fillAlpha: 0.5 });
    }
    b.dots(rect, "ink", 6, 1, 0.1);

    b.text(
      rect.x + 11,
      rect.y + 9,
      caseOf(typeRole.label, volume.custom ? volume.custom.packName : volume.boxCode),
      typeRole.label,
      {
        color: surface.paper.hex,
        alpha: ink.meta,
        letterSpacing: 1,
      },
    );

    const colors = CHIP_COLORS[tileRow.status];
    const adjustedFlag = tileRow.status === "done" && tileRow.wonAdjustedOnly;
    const flagWord = caseOf(typeRole.label, t("saga.adjusted"));
    const flagWidth = adjustedFlag ? b.measure(flagWord, typeRole.label, { letterSpacing: 0.9 }).width : 0;
    const full = gridChipOf(tileRow).toLocaleUpperCase();
    const chipRoom = Math.max(40, rect.width - 22 - 14 - 8);
    const fullWidth = this.#wrapped(b, full, typeRole.label, chipRoom, { letterSpacing: 0.9 }).width;
    const fitsBeside = !adjustedFlag || 11 + fullWidth + 14 + 6 + flagWidth + 14 <= rect.width - 11;
    // In a narrow tile (a phone's two-column Grid View, a landscape tablet) the chip gives way to its short form.
    const chipText = adjustedFlag && !fitsBeside ? "✓" : full;
    const chipSize = this.#wrapped(b, chipText, typeRole.label, chipRoom, { letterSpacing: 0.9 });
    const chipHeight = Math.max(19, chipSize.height + 7);
    const chipY = rect.y + rect.height - 10 - chipHeight;
    const titleSize = Math.min(46, rect.width * 0.24, rect.height * 0.24);

    // Laid out bottom-up (chip, then subtitle, then title) so a two-line box name never collides with the chip below it.
    const name = volumeNameIn(volume).toLocaleUpperCase();
    const subtitleSize = Math.min(20, rect.width * 0.1);
    const subtitle = b.measure(name, bangers(subtitleSize, 1), { wrapWidth: rect.width - 22 });
    const subtitleY = chipY - 14 - subtitle.height;
    b.text(rect.x + 11, subtitleY, name, bangers(subtitleSize, 1), {
      color: surface.paper.hex,
      wrapWidth: rect.width - 22,
    });
    const titleText = (volume.custom ? customBadge() : t("saga.volume", { number: volume.number })).toLocaleUpperCase();
    const titleHeight = b.measure(titleText, bangers(titleSize, 1)).height;
    b.text(rect.x + 11, subtitleY - 2 - titleHeight, titleText, bangers(titleSize, 1), { color: surface.paper.hex });

    const chipRect: Rect = { x: rect.x + 11, y: chipY, width: chipSize.width + 14, height: chipHeight };
    if (colors.fill !== null) b.box(chipRect, { fill: colors.fill });
    else
      b.box(
        { x: chipRect.x + 0.75, y: chipRect.y + 0.75, width: chipRect.width - 1.5, height: chipRect.height - 1.5 },
        { stroke: surface.paper.hex, strokeWidth: 1.5, alpha: 0.45 },
      );
    b.text(chipRect.x + 7, chipRect.y + chipRect.height / 2, chipText, typeRole.label, {
      color: colors.text,
      letterSpacing: 0.9,
      origin: [0, 0.5],
      wrapWidth: chipRoom,
    });
    if (adjustedFlag) {
      const flagRect: Rect = {
        x: chipRect.x + chipRect.width + 6,
        y: chipRect.y,
        width: flagWidth + 14,
        height: chipRect.height,
      };
      b.box(flagRect, { fill: signal.caution.hex });
      b.text(flagRect.x + 7, flagRect.y + flagRect.height / 2, flagWord, typeRole.label, {
        color: surface.inkOnHue.hex,
        letterSpacing: 0.9,
        origin: [0, 0.5],
      });
    }

    if (tileRow.status === "sealed") b.box(rect, { fill: surface.ink.hex, fillAlpha: 0.4 });
    if (tileRow.volume.number === this.#featured) {
      b.box(
        { x: rect.x + 2, y: rect.y + 2, width: rect.width - 4, height: rect.height - 4 },
        { stroke: accent.heroRed.hex, strokeWidth: 4 },
      );
      b.box(
        { x: rect.x + 5, y: rect.y + 5, width: rect.width - 10, height: rect.height - 10 },
        { stroke: surface.paper.hex, strokeWidth: 2 },
      );
    }
  }

  // ---- Phone and upright tablet: featured card, then the scrolling "ALL VOLUMES", then a bottom CTA --------------

  /**
   * One page that scrolls as a whole (a single scroller from under the top bar to the action bar): the featured volume's
   * art on top, which scrolls away and fades as the page does, then a compact card that pins under the top bar (the
   * volume's status line, name, issue bar and its two buttons), then the rest of the card (the roster line, the note),
   * then ALL VOLUMES with its view toggle and every volume. The one big button stays pinned in the action bar.
   */
  #drawPhone(b: SheetBuilder, frame: ReturnType<typeof campaignFrame>, topHeight: number, row: SagaVolumeRow): void {
    const gutter = frame.gutter;
    // A phone held sideways has no height for tiles, or for the toggle.
    const choosesView = frame.formFactor === "tabletPortrait" || frame.formFactor === "phone";
    const showsTiles = choosesView && this.#volumesView === "grid";
    const view: Rect = {
      x: 0,
      y: topHeight,
      width: frame.width - SCROLL_GUTTER,
      height: frame.height - topHeight - frame.actionBar,
    };
    const cardWidth = frame.width - gutter * 2;
    const artHeight = Math.round(Math.min(300, view.height * 0.4));
    const stickyTop = gutter + artHeight;
    const copy = featuredCopyOf(row);
    const alts = altsOf(row, this.#confirmAbandon);
    const pad = 12;
    const innerWidth = cardWidth - pad * 2;

    // The pinned card's height: its status line, the name (which may take two lines), the issue bar and the buttons.
    const nameType = bangers(28, 0.92);
    const name = volumeNameIn(row.volume).toLocaleUpperCase();
    const nameHeight = b.measure(name, nameType, { wrapWidth: innerWidth }).height;
    const altHeight = 40;
    const stickyHeight = 10 + 18 + nameHeight + 9 + (copy.hasPips ? 15 : 0) + (alts.length > 0 ? altHeight + 10 : 4);

    this.#listRect = view;
    this.#listContent = 0;
    this.#moreShown = false;
    const scrolledNow = (): number => this.#scroller()?.scrollTop ?? this.#listTop;
    // Where the pinned card is in the view now: in its place in the page, then held at the view's top edge.
    const pinnedTop = (): number => view.y + Math.max(0, stickyTop - scrolledNow());
    const onPage = (content: Rect): Rect => ({ ...content, y: view.y + content.y - scrolledNow() });
    const onPinned = (content: Rect): Rect => ({ ...content, y: pinnedTop() + (content.y - stickyTop) });
    // What a row can be seen in: the view below the pinned card.
    const below = (): Rect => {
      const y = pinnedTop() + stickyHeight;
      return { x: 0, y, width: frame.width, height: Math.max(0, view.y + view.height - y) };
    };
    // Scrolls the page the least that brings a row into the part of the view the pinned card leaves free.
    const reveal = (content: Rect): void => {
      const scroller = this.#scroller();
      if (!scroller) return;
      const top = scroller.scrollTop;
      const edge = Math.max(top, stickyTop) + stickyHeight;
      const bottom = top + view.height;
      if (content.y < edge) scroller.scrollTop = top + (content.y - edge);
      else if (content.y + content.height > bottom) scroller.scrollTop = top + (content.y + content.height - bottom);
    };

    b.scrollFit(LIST, view, (inner) => {
      const artRect: Rect = { x: gutter, y: gutter, width: cardWidth, height: artHeight };
      inner.group("saga-art", artRect, { fade: artHeight }, (art) => {
        this.#drawFeaturedArt(art, artRect, row);
        art.box(artRect, { stroke: accent.heroRed.hex, strokeWidth: 6 });
        art.box(
          { x: artRect.x + 3, y: artRect.y + 3, width: artRect.width - 6, height: artRect.height - 6 },
          { stroke: surface.ink.hex, strokeWidth: 3 },
        );
        this.#drawArtBadges(art, { ...artRect, x: artRect.x + 3, y: artRect.y + 3 }, row, true);
      });

      const pinnedRect: Rect = { x: gutter, y: stickyTop, width: cardWidth, height: stickyHeight };
      inner.group("saga-pinned", pinnedRect, { sticky: true }, (card) => {
        card.box(pinnedRect, { fill: surface.ink.hex });
        card.box(pinnedRect, { stroke: accent.heroRed.hex, strokeWidth: 6 });
        card.box(
          { x: pinnedRect.x + 3, y: pinnedRect.y + 3, width: pinnedRect.width - 6, height: pinnedRect.height - 6 },
          { stroke: surface.ink.hex, strokeWidth: 3 },
        );
        let y = pinnedRect.y + 10;
        const statusLine = `${copy.status} · ${row.volume.custom ? `${customBadge()} · ${row.volume.custom.packName}` : row.volume.boxCode}`;
        card.text(pinnedRect.x + pad, y, caseOf(typeRole.label, statusLine.toLocaleUpperCase()), typeRole.label, {
          color: signal.caution.hex,
          letterSpacing: 1,
        });
        if (copy.right) {
          card.text(pinnedRect.x + pinnedRect.width - pad, y, copy.right.toLocaleUpperCase(), typeRole.label, {
            color: surface.paper.hex,
            alpha: ink.meta,
            origin: [1, 0],
            letterSpacing: 1,
          });
        }
        y += 18;
        card.text(pinnedRect.x + pad, y, name, nameType, { color: surface.paper.hex, wrapWidth: innerWidth });
        y += nameHeight + 9;
        if (copy.hasPips) {
          drawPips(card, { x: pinnedRect.x + pad, y, width: innerWidth, height: 7 }, row.pips);
          y += 15;
        }
        if (alts.length > 0) {
          const altWidth = (innerWidth - 8) / 2;
          alts.forEach((alt, index) => {
            const altRect: Rect = {
              x: pinnedRect.x + pad + index * (altWidth + 8),
              y,
              width: altWidth,
              height: altHeight,
            };
            this.#drawAlt(card, altRect, alt, index, row, 15, () => clipToView(onPinned(altRect), view));
          });
        }
      });

      // The rest of the card, under the pinned part: the roster line and the note, which scroll away with the art.
      const tailTop = stickyTop + stickyHeight;
      const sub = copy.sub ? inner.measure(copy.sub, typeRole.emphasis, { size: 11, wrapWidth: innerWidth }).height : 0;
      const footText = alts.length > 0 && copy.foot ? caseOf(typeRole.label, copy.foot) : "";
      const foot = footText ? inner.measure(footText, typeRole.label, { size: 9.5, wrapWidth: innerWidth }).height : 0;
      const tailHeight = sub + foot > 0 ? 10 + sub + (foot > 0 ? 8 + foot : 0) + 12 : 0;
      if (tailHeight > 0) {
        const tailRect: Rect = { x: gutter, y: tailTop, width: cardWidth, height: tailHeight };
        inner.box(tailRect, { fill: surface.ink.hex });
        inner.box(tailRect, { stroke: accent.heroRed.hex, strokeWidth: 6 });
        inner.box(
          { x: tailRect.x + 3, y: tailRect.y + 3, width: tailRect.width - 6, height: tailRect.height - 6 },
          { stroke: surface.ink.hex, strokeWidth: 3 },
        );
        let y = tailTop + 10;
        if (sub > 0) {
          inner.text(gutter + pad, y, copy.sub, typeRole.emphasis, {
            size: 11,
            color: surface.paper.hex,
            alpha: ink.secondary,
            wrapWidth: innerWidth,
          });
          y += sub + 8;
        }
        if (foot > 0) {
          inner.text(gutter + pad, y, footText, typeRole.label, {
            size: 9.5,
            color: surface.paper.hex,
            alpha: ink.meta,
            wrapWidth: innerWidth,
          });
        }
      }

      // ALL VOLUMES, with the list / grid toggle.
      let y = tailTop + tailHeight + 18;
      const headerHeight = choosesView ? hit.target + 8 : 24;
      const toggleWidth = choosesView ? 130 : 0;
      const headerMiddle = y + (choosesView ? hit.target / 2 : 9);
      const heading = t("saga.allVolumes").toLocaleUpperCase();
      const headingWidth = inner.measure(heading, typeRole.barTitle, { size: 14, letterSpacing: 0.6 }).width;
      inner.text(gutter, headerMiddle, heading, typeRole.barTitle, {
        size: 14,
        color: surface.ink.hex,
        letterSpacing: 0.6,
        origin: [0, 0.5],
      });
      const ruleX = gutter + headingWidth + 12;
      inner.box(
        {
          x: ruleX,
          y: headerMiddle - 1.5,
          width: Math.max(0, frame.width - gutter - (toggleWidth ? toggleWidth + 12 : 0) - ruleX),
          height: 3,
        },
        { fill: surface.ink.hex },
      );
      if (choosesView) {
        const rect: Rect = { x: frame.width - gutter - toggleWidth, y, width: toggleWidth, height: hit.target };
        const toggle = (): void => {
          this.#volumesChosen = this.#volumesView === "grid" ? "list" : "grid";
          rememberSagaVolumesView(this.#volumesChosen);
          this.#listTop = 0;
          this.#rebuild();
          if (inputDevice().mode === "keyboard" || inputDevice().mode === "pad") this.#route?.focusKey(VIEW_STOP);
        };
        this.#glyphs.button(inner, {
          key: VIEW_STOP,
          rect,
          label: showsTiles ? t("saga.viewList") : t("saga.viewGrid"),
          look: "secondary",
          type: typeRole.label,
          ids: ["zoneNext"],
          ground: "paper",
        });
        this.#actions.set(VIEW_STOP, toggle);
        this.#stops.set(VIEW_STOP, {
          rect: () => clipToView(onPage(rect), below()),
          view: below,
          activate: toggle,
          ensureVisible: () => reveal(rect),
        });
      }
      y += headerHeight;

      const listWidth = frame.width - gutter * 2;
      const columns = frame.formFactor === "phone" ? PHONE_TILE_COLUMNS : TILE_COLUMNS;
      const tileWidth = (listWidth - TILE_GAP * (columns - 1)) / columns;
      const tileHeight = Math.max(MIN_TILE_HEIGHT, Math.round(tileWidth * 1.25));
      const tiles: VolumeTiles | null = showsTiles ? { columns, height: tileHeight } : null;
      const listRect: Rect = { x: gutter, y, width: listWidth, height: 0 };
      const total = this.#drawVolumes(inner, listRect, tiles, {
        into: inner,
        top: y,
        onScreen: onPage,
        view: below,
        reveal,
      });
      // Long enough that the art can scroll away completely, however few volumes there are.
      return Math.max(y + total + gutter, view.height + stickyTop);
    });

    // The ink action bar across the bottom, with the one CTA.
    const actionBar: Rect = { x: 0, y: frame.height - frame.actionBar, width: frame.width, height: frame.actionBar };
    b.box(actionBar, { fill: surface.ink.hex });
    const ctaRect: Rect = {
      x: actionBar.x + 12,
      y: actionBar.y + 9,
      width: actionBar.width - 24,
      height: actionBar.height - 18,
    };
    this.#drawCta(b, ctaRect, row, 18);
  }

  /** One row of the phone's list: the volume number block, the name, the box code and the status chip. */
  #drawPhoneVolumeRow(b: SheetBuilder, row: SagaVolumeRow, rect: Rect): void {
    const rowRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - 6 };
    b.box(rowRect, { fill: surface.parchment.hex });
    b.box(
      { x: rowRect.x + 1.5, y: rowRect.y + 1.5, width: rowRect.width - 3, height: rowRect.height - 3 },
      { stroke: surface.ink.hex, strokeWidth: 3 },
    );
    const blockW = 58;
    b.box({ x: rowRect.x, y: rowRect.y, width: blockW, height: rowRect.height }, { fill: surface.ink.hex });
    const tag = row.volume.custom
      ? `${customBadge()}\n▸`
      : `${t("saga.volumeShort").toLocaleUpperCase()}\n${row.volume.number}`;
    b.text(rowRect.x + blockW / 2, rowRect.y + rowRect.height / 2, tag, bangers(15, 1), {
      color: surface.paper.hex,
      origin: [0.5, 0.5],
      align: "center",
    });
    b.text(rowRect.x + blockW + 10, rowRect.y + 6, volumeNameIn(row.volume).toLocaleUpperCase(), bangers(16, 1), {
      color: surface.ink.hex,
      wrapWidth: rowRect.width - blockW - 24,
    });
    b.text(
      rowRect.x + blockW + 10,
      rowRect.y + rowRect.height - 18,
      caseOf(typeRole.label, row.volume.custom ? row.volume.custom.packName : row.volume.boxCode),
      typeRole.label,
      { size: 9, color: surface.ink.hex, alpha: ink.meta },
    );

    const colors = row.status === "sealed" ? { fill: null, text: surface.ink.hex } : CHIP_COLORS[row.status];
    const chipText = gridChipOf(row).toLocaleUpperCase();
    const chipWidth = b.measure(chipText, typeRole.label, { size: 9, letterSpacing: 0.6 }).width;
    const chipRect: Rect = {
      x: rowRect.x + rowRect.width - 10 - chipWidth - 12,
      // On the row's own bottom line, beside the box code: a long name ("AGENTS OF S.H.I.E.L.D.") has the whole top line.
      y: rowRect.y + rowRect.height - 8 - 20,
      width: chipWidth + 12,
      height: 20,
    };
    if (colors.fill !== null) b.box(chipRect, { fill: colors.fill });
    else
      b.box(
        { x: chipRect.x + 0.75, y: chipRect.y + 0.75, width: chipRect.width - 1.5, height: chipRect.height - 1.5 },
        { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: 0.45 },
      );
    b.text(chipRect.x + 6, chipRect.y + chipRect.height / 2, chipText, typeRole.label, {
      size: 9,
      color: colors.text,
      letterSpacing: 0.6,
      origin: [0, 0.5],
    });
    // A volume won only by adjusted runs (issue #869): an amber "ADJUSTED" chip just before the "✓ COMPLETE" one.
    if (row.status === "done" && row.wonAdjustedOnly) {
      const flag = caseOf(typeRole.label, t("saga.adjusted"));
      const flagWidth = b.measure(flag, typeRole.label, { size: 9, letterSpacing: 0.6 }).width;
      const flagRect: Rect = {
        x: chipRect.x - 6 - flagWidth - 12,
        y: chipRect.y,
        width: flagWidth + 12,
        height: chipRect.height,
      };
      b.box(flagRect, { fill: signal.caution.hex });
      b.text(flagRect.x + 6, flagRect.y + flagRect.height / 2, flag, typeRole.label, {
        size: 9,
        color: surface.inkOnHue.hex,
        letterSpacing: 0.6,
        origin: [0, 0.5],
      });
    }

    if (row.status === "sealed") b.box(rowRect, { fill: surface.paper.hex, fillAlpha: 0.45 });
    if (row.volume.number === this.#featured) b.box(rowRect, { stroke: accent.heroRed.hex, strokeWidth: 3 });
  }

  // ---- The featured card: art (or a glyph), status line, name, pips, sub, CTA, alt row --------------------------

  #drawFeaturedCard(b: SheetBuilder, rect: Rect, row: SagaVolumeRow, phone: boolean): void {
    b.box(rect, { stroke: accent.heroRed.hex, strokeWidth: 6 });
    b.box(
      { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6, height: rect.height - 6 },
      { stroke: surface.ink.hex, strokeWidth: 3 },
    );
    const copy = featuredCopyOf(row);
    // The adjusted-run note (issue #869) adds a line under the roster: the art gives up that much, not the buttons.
    const noteHeight = row.status === "done" && row.adjustedWinKeepsNextSealed ? (phone ? 15 : 17) : 0;
    const footerHeight = Math.min(rect.height * 0.5, phone ? 210 : 270) + noteHeight;
    const artRect: Rect = {
      x: rect.x + 3,
      y: rect.y + 3,
      width: rect.width - 6,
      height: rect.height - 6 - footerHeight,
    };
    const footerRect: Rect = {
      x: rect.x + 3,
      y: artRect.y + artRect.height,
      width: rect.width - 6,
      height: footerHeight,
    };

    this.#drawFeaturedArt(b, artRect, row);

    this.#drawArtBadges(b, artRect, row, phone);

    b.box(footerRect, { fill: surface.ink.hex });

    const pad = phone ? 12 : 18;
    let y = footerRect.y + (phone ? 10 : 16);
    const statusLine = `${copy.status} · ${row.volume.custom ? `${customBadge()} · ${row.volume.custom.packName}` : row.volume.boxCode}`;
    b.text(footerRect.x + pad, y, caseOf(typeRole.label, statusLine.toLocaleUpperCase()), typeRole.label, {
      color: signal.caution.hex,
      letterSpacing: 1,
    });
    if (copy.right) {
      b.text(footerRect.x + footerRect.width - pad, y, copy.right.toLocaleUpperCase(), typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.meta,
        origin: [1, 0],
        letterSpacing: 1,
      });
    }
    y += 18;

    const nameType = bangers(phone ? 28 : 44, 0.92);
    const name = volumeNameIn(row.volume).toLocaleUpperCase();
    const nameBox = b.text(footerRect.x + pad, y, name, nameType, {
      color: surface.paper.hex,
      wrapWidth: footerRect.width - pad * 2,
    });
    y += nameBox.height + 9;

    if (copy.hasPips) {
      drawPips(b, { x: footerRect.x + pad, y, width: footerRect.width - pad * 2, height: phone ? 7 : 8 }, row.pips);
      y += phone ? 15 : 18;
    }

    const subBox = b.text(footerRect.x + pad, y, copy.sub, typeRole.emphasis, {
      size: phone ? 11 : 12,
      color: surface.paper.hex,
      alpha: ink.secondary,
      wrapWidth: footerRect.width - pad * 2,
    });
    y += subBox.height + (phone ? 8 : 10);

    // Phone draws this screen's one CTA in the bottom action bar instead (`#drawPhone`) — the card itself keeps
    // going below the sub line (DOSSIER/START OVER + footnote, or nothing at all), matching the phone composition.
    if (!phone) {
      const ctaHeight = 58;
      this.#drawCta(b, { x: footerRect.x + pad, y, width: footerRect.width - pad * 2, height: ctaHeight }, row, 21);
      y += ctaHeight + 8;
    }

    const alts = altsOf(row, this.#confirmAbandon);
    if (alts.length > 0) {
      const altHeight = phone ? 40 : 48;
      const altWidth = (footerRect.width - pad * 2 - 8) / 2;
      alts.forEach((alt, index) => {
        const altRect: Rect = { x: footerRect.x + pad + index * (altWidth + 8), y, width: altWidth, height: altHeight };
        this.#drawAlt(b, altRect, alt, index, row, phone ? 15 : 19);
      });
      y += altHeight + 6;
      if (copy.foot) {
        const footSize = phone ? 9.5 : 10.5;
        const footText = caseOf(typeRole.label, copy.foot);
        const foot = b.measure(footText, typeRole.label, { size: footSize, wrapWidth: footerRect.width - pad * 2 });
        // The footnote is the one optional line: where the card is too short for it (an iPhone SE, a two-line box name),
        // it goes rather than running through the card's border.
        if (y + foot.height <= footerRect.y + footerRect.height - 4) {
          b.text(footerRect.x + pad, y, footText, typeRole.label, {
            size: footSize,
            color: surface.paper.hex,
            alpha: ink.meta,
            wrapWidth: footerRect.width - pad * 2,
          });
        }
      }
    }
  }

  /** The art's "VOL. N" tab and, for a finished volume, its tilted COMPLETE (and ADJUSTED) stamps. */
  #drawArtBadges(b: SheetBuilder, artRect: Rect, row: SagaVolumeRow, phone: boolean): void {
    // "VOL. N" tab
    const tagText = volumeTagOf(row.volume);
    const tagSize = b.measure(tagText, bangers(18, 1));
    b.box(
      { x: artRect.x, y: artRect.y, width: tagSize.width + 20, height: tagSize.height + 12 },
      { fill: signal.caution.hex },
    );
    b.text(artRect.x + 10, artRect.y + 6, tagText, bangers(18, 1), { color: surface.inkOnHue.hex });
    if (row.status === "done") {
      // Solid green with paper-white text, the grid tile's own "✓ Complete" chip colors. Tilted about its own center.
      const word = t("saga.status.complete").toLocaleUpperCase();
      const stampType = bangers(phone ? 18 : 26, 1);
      const stamp = b.measure(word, stampType);
      const cx = artRect.x + artRect.width - stamp.width / 2 - 24;
      const cy = artRect.y + stamp.height / 2 + 20;
      const tilt = 0.14;
      b.poly(turnedCorners(cx, cy, stamp.width + 20, stamp.height + 8, tilt), { fill: signal.heal.hex });
      b.text(cx, cy, word, stampType, {
        color: surface.paper.hex,
        origin: [0.5, 0.5],
        angle: (tilt * 180) / Math.PI,
      });
      // A volume complete only by adjusted runs (issue #869) gets a second stamp under the first, in caution amber.
      if (row.wonAdjustedOnly) {
        const adjustedWord = t("saga.adjusted").toLocaleUpperCase();
        const adjustedType = bangers(phone ? 15 : 21, 1);
        const adjusted = b.measure(adjustedWord, adjustedType);
        const ax = cx + 6;
        const ay = cy + stamp.height / 2 + adjusted.height / 2 + 16;
        b.poly(turnedCorners(ax, ay, adjusted.width + 16, adjusted.height + 6, tilt), { fill: signal.caution.hex });
        b.text(ax, ay, adjustedWord, adjustedType, {
          color: surface.inkOnHue.hex,
          origin: [0.5, 0.5],
          angle: (tilt * 180) / Math.PI,
        });
      }
    }
  }

  #drawFeaturedArt(b: SheetBuilder, rect: Rect, row: SagaVolumeRow): void {
    const art = this.#pictureOf(row.volume, false);
    if (art.src !== null) {
      b.image(rect, {
        src: art.src,
        cover: { x: 0.5, y: 0.15 },
        fill: surface.ink.hex,
        key: "featured-art",
        ...(art.retry !== undefined ? { retry: art.retry } : {}),
      });
      return;
    }
    b.box(rect, { fill: surface.ink.hex });
    // A pack campaign with no cover gets its first letter, big, on the ink: a generated cover.
    const glyph = row.volume.custom
      ? row.volume.name.slice(0, 1).toUpperCase()
      : row.status === "sealed" && !row.hasDefinition
        ? "?"
        : `${row.volume.number}`;
    b.text(rect.x + rect.width / 2, rect.y + rect.height / 2, glyph, bangers(Math.min(rect.width, rect.height) * 0.5), {
      color: surface.paper.hex,
      alpha: 0.18,
      origin: [0.5, 0.5],
    });
  }

  // ---- CTA/alt-action buttons — the decisions are `view/campaign-saga-copy.ts`; navigation is wired here --------

  /** The featured volume's one big button. */
  #drawCta(b: SheetBuilder, rect: Rect, row: SagaVolumeRow, titleSize: number): void {
    const target = { kind: "campaign", campaignId: row.volume.campaignId } as const;
    const cta: SagaCta = ctaOf(row, row.status === "sealed" && row.hasDefinition ? unlockCostOf(target) : 0);
    const press = (): void => this.#pressCta(row, cta);
    this.#meanings.set(
      "cta",
      commandMeaning(`${row.volume.campaignId}:${cta.action}`, "primary", cta.label, cta.enabled),
    );
    b.button({
      key: "cta",
      rect,
      label: cta.label.toLocaleUpperCase(),
      look: "primary",
      type: bangers(titleSize),
      row: true,
      chevron: false,
      ...(cta.enabled ? {} : { disabled: cta.reason ?? true }),
    });
    this.#actions.set("cta", () => {
      if (cta.enabled) press();
    });
    this.#stops.set("cta", { rect, activate: press });
    this.#ctaEnabled = cta.enabled;
    this.#obstacles.push(rect);
    // Start on a pad, Enter on a keyboard: the glyph sits inside the button's right end when the row is wide enough.
    if (cta.enabled && rect.width >= 240) {
      const glyphHeight = Math.min(26, Math.max(16, rect.height - 24));
      this.#glyphs.hint(b, {
        key: "cta-forward",
        x: rect.x + rect.width - 40,
        y: rect.y + rect.height / 2,
        ids: ["pause"],
        idsNow: (set) => (set === "pad" ? ["pause"] : ["activate"]),
        height: glyphHeight,
        ground: "ink",
        alignRight: true,
      });
    }
  }

  #pressCta(row: SagaVolumeRow, cta: SagaCta): void {
    switch (cta.action) {
      case "continue":
        goToScreen(this, SCENES.campaignCover, { campaignId: row.volume.campaignId, runId: row.runId });
        return;
      case "reread":
        goToScreen(this, SCENES.campaignRun, { runId: row.runId });
        return;
      case "start":
        goToScreen(this, SCENES.campaignCover, { campaignId: row.volume.campaignId });
        return;
      case "unlock":
        unlockOrAsk(this, { kind: "campaign", campaignId: row.volume.campaignId }, () => void this.#load(true));
        return;
      case "none":
        return;
    }
  }

  #drawAlt(
    b: SheetBuilder,
    rect: Rect,
    alt: SagaAlt,
    index: number,
    row: SagaVolumeRow,
    titleSize: number,
    stopRect: Rect | (() => Rect) = rect,
  ): void {
    const key = `alt-${index}`;
    const press = (): void => this.#pressAlt(row, alt);
    this.#meanings.set(key, commandMeaning(`${row.volume.campaignId}:${alt.action}`, "onInk", alt.label, alt.enabled));
    b.button({
      key,
      rect,
      label: alt.label.toLocaleUpperCase(),
      look: "onInk",
      type: bangers(titleSize),
      row: true,
      ...(alt.enabled ? {} : { disabled: true }),
    });
    this.#actions.set(key, () => {
      if (alt.enabled) press();
    });
    this.#stops.set(key, { rect: stopRect, activate: press });
    this.#obstacles.push(rect);
  }

  #pressAlt(row: SagaVolumeRow, alt: SagaAlt): void {
    const runId = row.runId ?? row.lost?.runId ?? null;
    switch (alt.action) {
      case "dossier":
        goToScreen(this, SCENES.campaignDossier, { runId: row.status === "fresh" ? row.lost?.runId : row.runId });
        return;
      case "reread":
        goToScreen(this, SCENES.campaignRun, { runId: row.lost?.runId ?? runId });
        return;
      case "startOver":
        this.#startOver(row);
        return;
      case "newRun":
        goToCampaignStart(this, row.volume.campaignId);
        return;
      case "expertRun":
        goToCampaignStart(this, row.volume.campaignId, true);
        return;
    }
  }

  #startOver(row: SagaVolumeRow): void {
    if (!this.#confirmAbandon) {
      this.#confirmAbandon = true;
      this.#rebuild();
      return;
    }
    this.#confirmAbandon = false;
    const runId = row.runId;
    if (!runId) return;
    // Nothing on the panel takes a press while the run is archived: a second tap on Start over must not run it twice.
    this.#abandoning = true;
    gatePanels([this.#region?.element], true);
    void campaignService()
      .abandon(runId)
      .then(() => {
        if (this.sys.isActive()) goToCampaignStart(this, row.volume.campaignId);
      })
      .finally(() => {
        this.#abandoning = false;
        if (this.sys.isActive()) gatePanels([this.#region?.element], false);
      });
  }
}
