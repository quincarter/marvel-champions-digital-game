/**
 * C00b — The Saga: the campaign shelf. One featured volume (art, status, its own CTA) plus a 3×3 "ALL VOLUMES"
 * grid — desktop and a sideways tablet — or, stacked under it, tiles or a list — phone and an upright tablet — of all the boxes in release order (`SAGA_VOLUMES`).
 *
 * Matches the current design canvas (`Marvel Champions game screens/Campaign - *.dc.html`'s `saga()`): the grid
 * includes the featured volume itself (its own tile, ringed red), not just what's "next"; status drives every
 * chip's color (done green, live red, fresh yellow, sealed an outline); a sealed tile dims under a dark scrim.
 *
 * The whole screen is one Lit panel over the canvas (`dom/dom-region.ts`, `mc-sheet`). This scene is the thin owner: the
 * panel, the focus route (its ring drawn in the panel layer), the glyph hints, loading and navigation. Every visual part
 * is its own module in `saga/` (the wide layout, the phone's one scrolling page, the featured card, a tile, a row, the
 * buttons), each a function over the `SagaCtx` this scene hands it.
 *
 * All data — status, unlock, pips, roster names — comes from `view/campaign-saga-model.ts` and its words from
 * `view/campaign-saga-copy.ts`; nothing here computes legality or unlock itself.
 */
import Phaser from "phaser";
import "@mc/ui";
import { cancelPressesWithin, type McSheet } from "@mc/ui";
import { customSagaVolumes } from "../../campaign/pack-campaigns.js";
import { loadedPacks } from "../../packs/pack-registry.js";
import { rebuildOnPackChange } from "../../ui/pack-redraw.js";
import { campaignCardsById } from "../../content/campaign-pool.js";
import { cardDisplayName } from "../../view/hero-names.js";
import { surface } from "../../tokens.js";
import { campaignFrame } from "../../ui/campaign-chrome.js";
import { cssOf } from "../../ui/theme.js";
import { isDesktopType } from "../../ui/desktop-type.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { campaignService } from "../../session.js";
import {
  campaignSagaRows,
  defaultFeaturedVolume,
  doneVolumeCount,
  openVolumeCount,
  type SagaVolumeRow,
} from "../../view/campaign-saga-model.js";
import { sagaVolumesView } from "../../platform/saga-view.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { goToCampaignStart } from "./start-route.js";
import { SCENES } from "../keys.js";
import { refreshUnlocks, unlocks } from "../../progression/progression.js";
import { t } from "../../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../../language-change.js";
import { DomRegion, renderNow } from "../../dom/dom-region.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { gatePanels } from "../../dom/busy-gate.js";
import { PictureLeases } from "../../dom/picture-leases.js";
import { SheetBuilder } from "../../dom/sheet-builder.js";
import { SheetGlyphs } from "../../dom/sheet-glyphs.js";
import { sheetTopBar } from "../../dom/sheet-top-bar.js";
import { staleKeys } from "../../dom/stale-presses.js";
import { LIST, VIEW_STOP, type SagaCtx, type SagaState } from "./saga/context.js";
import { drawPhone } from "./saga/phone.js";
import { drawWide } from "./saga/wide.js";
import type { CampaignSagaData } from "./routes.js";

/** A hero's name from the pool, else its id. A run's custom hero is named from its own summary (`campaign-saga-model`). */
const identityNameOf = (id: string): string => {
  const card = campaignCardsById().get(id);
  return card ? cardDisplayName(card) : id;
};

export class CampaignSagaScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  /** The screen, one Lit panel over the canvas; made on the first draw and kept (so the list's scroll survives). */
  #region: DomRegion<McSheet> | null = null;
  readonly #leases = new PictureLeases();
  readonly #actions = new Map<string, () => void>();
  readonly #meanings = new Map<string, string>();
  #lastMeanings = new Map<string, string>();
  readonly #stops = new Map<string, FocusStop>();
  /** What a hanging glyph must not cover: the action buttons. */
  readonly #obstacles: Rect[] = [];
  readonly #state: SagaState = {
    rows: [],
    featured: 1,
    confirmAbandon: false,
    volumesView: "grid",
    listRect: { x: 0, y: 0, width: 0, height: 0 },
    listContent: 0,
    listTop: 0,
    moreShown: false,
    volumesChosen: null,
    ctaEnabled: false,
  };
  #alive = false;
  #abandoning = false;
  /** The scrollers whose scroll place has been restored and listened to. */
  readonly #placed = new WeakSet<HTMLElement>();
  #ctx!: SagaCtx;

  constructor() {
    super(SCENES.campaignSaga);
  }

  create(_data: CampaignSagaData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#alive = true;
    this.#region = null;
    this.#abandoning = false;
    this.#state.listTop = 0;
    this.#state.volumesChosen = null;
    this.scale.on("resize", this.#rebuild, this);
    this.#glyphs = new SheetGlyphs(
      this,
      () => this.#rebuild(),
      () => this.#obstacles,
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // Start and A with nothing focused: the featured volume's one big button.
      primary: () => (this.#stops.has("cta") && this.#state.ctaEnabled ? "cta" : null),
      blocked: () => this.scene.isActive(SCENES.unlockConfirm) || this.#abandoning,
      onCancel: () => goToScreen(this, SCENES.title),
      // LB / RB: the list or the grid, where the screen offers both.
      onTab: () => this.#stops.get(VIEW_STOP)?.activate(),
      onPage: (direction) => this.#scroller()?.scrollBy({ top: direction * this.#state.listRect.height * 0.9 }),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onHomeEnd: (edge) => {
        const scroller = this.#scroller();
        if (scroller) scroller.scrollTop = edge === "home" ? 0 : scroller.scrollHeight;
      },
    });
    this.#ctx = {
      scene: this,
      glyphs: this.#glyphs,
      leases: this.#leases,
      actions: this.#actions,
      stops: this.#stops,
      meanings: this.#meanings,
      obstacles: this.#obstacles,
      route: this.#route,
      state: this.#state,
      scroller: () => this.#scroller(),
      moreNow: () => this.#moreNow(),
      feature: (number) => this.#feature(number),
      rebuild: () => this.#rebuild(),
      reload: () => void this.#load(true),
      startOver: (row) => this.#startOver(row),
    };
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
    this.#state.rows = [];
    this.#state.confirmAbandon = false;
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
    const built = this.#state.rows.length > 0;
    if (!force && built && JSON.stringify(rows) === JSON.stringify(this.#state.rows)) return;
    const keepFeatured = built && rows.some((row) => row.volume.number === this.#state.featured);
    this.#state.rows = rows;
    if (!keepFeatured) this.#state.featured = defaultFeaturedVolume(this.#state.rows);
    this.#rebuild();
  }

  #rebuild(): void {
    if (!this.#alive || this.#state.rows.length === 0) return;
    this.#glyphs.reset();
    this.#leases.begin();
    this.#actions.clear();
    this.#lastMeanings = new Map(this.#meanings);
    this.#meanings.clear();
    this.#stops.clear();
    this.#state.ctaEnabled = false;
    this.#obstacles.length = 0;

    const frame = campaignFrame(this);
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    b.box({ x: 0, y: 0, width: frame.width, height: frame.height }, { fill: surface.paper.hex });
    const baseRows = this.#state.rows.filter((r) => !r.volume.custom);
    // A phone starts on its rows and an upright tablet on the tiles, until the player chooses.
    this.#state.volumesView = this.#state.volumesChosen ?? sagaVolumesView(frame.phone ? "list" : "grid");
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

    const row = this.#state.rows.find((r) => r.volume.number === this.#state.featured) ?? this.#state.rows[0]!;

    // An upright tablet stacks as a phone does: the wide layout's featured card is a tall sliver beside the grid.
    if (frame.phone || frame.formFactor === "tabletPortrait") drawPhone(this.#ctx, b, frame, top.height, row);
    else drawWide(this.#ctx, b, frame, top.height, row);

    const order = ["back", ...[...this.#stops.keys()].filter((k) => k !== "back")];
    this.#route?.set(order, new Map(this.#stops));
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
      scroller.scrollTop = this.#state.listTop;
      this.#placed.add(scroller);
      scroller.addEventListener(
        "scroll",
        () => {
          this.#state.listTop = scroller.scrollTop;
          if (this.#moreNow() !== this.#state.moreShown) this.#rebuild();
        },
        { passive: true },
      );
    }
  }

  /** Whether there is more list below the view: what the "scroll for more" cue says. */
  #moreNow(): boolean {
    const { listContent, listRect, listTop } = this.#state;
    return listContent > listRect.height + 1 && listTop + listRect.height < listContent - 4;
  }

  #feature(number: number): void {
    if (this.#state.featured === number) return;
    this.#state.featured = number;
    this.#state.confirmAbandon = false;
    this.#rebuild();
  }

  /** Start over asks twice; the second archives the run and opens a new roster. */
  #startOver(row: SagaVolumeRow): void {
    if (!this.#state.confirmAbandon) {
      this.#state.confirmAbandon = true;
      this.#rebuild();
      return;
    }
    this.#state.confirmAbandon = false;
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
