/**
 * Title > Mod Store (docs/custom-content-packs.md §11.6): browse the catalog of community packs, open one, install,
 * update or remove it.
 *
 * Two views in one page. **Browse** is six tabs (All, Heroes, Scenarios, Extras, Installed, Credits) over a grid of pack
 * tiles, with a search box, a sort and tag chips over it (issue #734) and an offline strip when the catalog is the saved
 * copy; each tile leads with the pack's featured card (thumbnail, picture, or the pack's initial). Credits lists the
 * creators instead, and picking one shows their packs. **Pack** is one pack's page: the cover and featured card(s), the
 * title, scrolling text, a gallery of the pack's cards (from the preview before an install, from the installed pack
 * after), a status line (progress bar or error) and the buttons its state offers. The first time the store opens, a
 * heads-up about mods shows over it (and from About mods).
 *
 * The whole screen is one page element, `mc-mod-store-page` (`views/mod-store/`), made of section elements
 * (`components/mod-store/`). This scene only mounts it, sets its model from the store's state, and handles its events: it
 * keeps the focus route (the page's `data-stop` parts, read by `dom/element-stops.ts`) and the card hover popover
 * (`dom/card-events.ts`). The state and what it does is `scenes/mod-store/store-controller.ts`; the words are
 * `view/mod-store-page-model.ts`'s and `view/mod-store-detail-model.ts`'s; whether a pack can be installed is
 * `packs/pack-state.ts`'s. Every press is a tap, so a swipe that ends over a control fires nothing.
 *
 * Pad and keyboard: Back, About, the tabs (LB / RB step them), the search box, sort and chips, then every tile; on a pack
 * page, Back, About, its buttons and then the gallery's cards.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/mod-store/mc-mod-store-page/mc-mod-store-page.js";
import { currentCardsById } from "../content/pool.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { renderNow } from "../dom/dom-region.js";
import { settleElements } from "../dom/element-settle.js";
import { defaultFaceFor } from "../art/art-source.js";
import { isPhoneWidth } from "../ui/campaign-chrome.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { onPreviewArtArrived } from "../art/preview-art.js";
import { onArtChange } from "../language-change.js";
import { onActivePackStatuses } from "../packs/active-packs.js";
import { onPreviewArrived } from "../packs/preview-client.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { faceModelOf, statLineOf } from "../ui/generated-card-face.js";
import { motion, surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen, holdScreenFor } from "../ui/transitions.js";
import { settleWithin } from "../ui/picture-wait.js";
import { modNoticeSeen, rememberModNoticeSeen } from "../platform/mod-notice-seen.js";
import { MOD_STORE_TABS, actionsOf, type ModStoreTab } from "../view/mod-store-model.js";
import { formFactorFor } from "../view/layout.js";
import { MOD_NOTICE_LINES, modNoticeOutcomeOf, showNoticeOnOpen, type ModNoticeAnswer } from "../view/mod-notice.js";
import { browseModelOf, headerModelOf, modStoreFocusOrder, noticeModelOf } from "../view/mod-store-page-model.js";
import type { GalleryCard } from "../view/pack-gallery-model.js";
import type { ModStorePageModel } from "../views/mod-store/mc-mod-store-page/mc-mod-store-page.types.js";
import { MOD_STORE_RENDERED, type ModStoreEventDetail } from "../components/mod-store/shared/mod-store-events.types.js";
import { bindTextFieldEscape } from "./text-field-escape.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { openReportIssue } from "./report-button.js";
import { SCENES } from "./keys.js";
import type { InspectData } from "./inspect.js";
import { buildDetail, hoverKeyOf, type DetailBuild } from "./mod-store/detail.js";
import { StorePictures } from "./mod-store/pictures.js";
import { ModStoreController } from "./mod-store/store-controller.js";
import { noticePortraitsOf, preloadPortraits } from "./mod-store/notice-portraits.js";

export interface ModStoreSceneData {
  /** Dev only (`?screen=mod-store&catalog=`): a catalog address other than the store's own. */
  readonly catalogUrl?: string;
  /** Opens straight onto this pack's page (dev jumps). */
  readonly packId?: string;
  /** The scene Back returns to from the list (a screen that sent the player here, such as the room lobby); the Title otherwise. */
  readonly returnTo?: string;
}

type Page = MountedElement<HTMLElementTagNameMap["mc-mod-store-page"]>;

/** The heights the glyphs hung on Back, About and Got it are drawn for. */
const BAR_BUTTON = 44;
const NOTICE_BUTTON = 56;

export class ModStoreScene extends Phaser.Scene {
  readonly #ctl = new ModStoreController({
    draw: () => this.#compose(),
    drawSoon: () => this.#composeSoon(),
    showNotice: (onClose) => this.#showNotice(onClose),
    focusKey: (key) => this.#route?.focusKey(key),
    hasFocus: () => this.#route?.focused != null,
    leave: () => this.#leave(),
    later: (ms, run) => void this.time.delayedCall(ms, run),
  });
  readonly #pictures = new StorePictures();
  #page: Page | null = null;
  #route: FocusRoute | null = null;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  #glyphs!: ControlGlyphs;
  #unbind: (() => void) | null = null;
  #detail: DetailBuild | null = null;
  /** The heads-up about mods is open, and what carries on when it closes. */
  #notice: { readonly onClose?: (() => void) | undefined } | null = null;
  /** The caret is in the search box (the route and the pad stand aside while it is). */
  #searchFocused = false;
  #alive = false;
  #leaving = false;
  #composeQueued = false;
  #syncQueued = false;
  #returnTo: string = SCENES.title;
  /** Each opening of the store: the first-visit notice, opened once its portraits are in, belongs to one of them. */
  #visit = 0;

  constructor() {
    super(SCENES.modStore);
  }

  create(data: ModStoreSceneData = {}): void {
    this.#alive = true;
    this.#leaving = false;
    this.#composeQueued = false;
    this.#searchFocused = false;
    this.#notice = null;
    this.#detail = null;
    this.#returnTo = data.returnTo ?? SCENES.title;
    this.#ctl.begin({ catalogUrl: data.catalogUrl, packId: data.packId });
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#compose, this);
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    // A pad that put the caret in the search box can take it out again (B, A or Start). Bound before the route, so the
    // A that focuses the field is not also read as the press that leaves it (`text-field-escape.ts`).
    bindTextFieldEscape(
      this,
      () => ({ focused: this.#searchFocused, blur: () => this.#page?.element.searchField?.blurInput() }),
      () => this.#overlayUp(),
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => (this.#notice ? this.#answer("close") : this.#ctl.back()),
      // X (G / H on the keyboard) reopens the heads-up about mods.
      onToggle: () => this.#showNotice(),
      onTab: (direction) => (this.#notice ? undefined : this.#ctl.stepTab(direction)),
      onPage: (direction) => this.#scrollList(direction * Math.max(80, this.scale.gameSize.height * 0.5)),
      onScroll: (_dx, dy) => this.#scrollList(dy),
      blocked: () => this.scene.isActive(SCENES.inspect) || this.#searchFocused,
    });
    resetHoverCards(this);
    // A pack finishing its load (after an install, or at boot) and a picture arriving both redraw the page.
    const offs = [
      onActivePackStatuses(() => this.#composeSoon()),
      onArtChange(() => this.#composeSoon()),
      // A preview or a pack picture arriving from the pack host redraws what shows it.
      onPreviewArrived(() => this.#composeSoon()),
      onPreviewArtArrived(() => this.#composeSoon()),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      for (const off of offs) off();
      this.#pictures.leases.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#unbind?.();
      this.#unbind = null;
      this.scale.off("resize", this.#compose, this);
      this.#glyphs.dispose();
      this.#page = null;
    });
    this.#mount();
    this.#compose();
    fadeScreenIn(this);
    // The catalog (usually the saved copy, at once) before the store fades in, not a "Loading" page swapped for it.
    holdScreenFor(this, this.#ctl.load());
    // The first time the store opens, the heads-up about mods shows over it (remembered once answered), once its two
    // portraits are in: they load while the store is held, so the notice opens with them rather than with letters that
    // turn into faces a moment later (issue #716). A portrait that never loads holds it no longer than the hold. Asked
    // again when they are in: the player may have opened the notice (About mods) and answered it meanwhile.
    if (showNoticeOnOpen(modNoticeSeen())) {
      const visit = ++this.#visit;
      const portraits = settleWithin(
        preloadPortraits(MOD_NOTICE_LINES.map((line) => line.identityId)),
        motion.screenHoldMaxMs,
      );
      holdScreenFor(this, portraits);
      void portraits.then(() => {
        if (visit === this.#visit && this.sys.isActive() && showNoticeOnOpen(modNoticeSeen())) this.#showNotice();
      });
    }
  }

  /** Mounts the page and wires what it says and what hovers over it. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-mod-store-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    element.addEventListener("mc-mod-store", (event) => this.#heard(event.detail));
    element.addEventListener(MOD_STORE_RENDERED, () => this.#queueStops());
    element.addEventListener("mc-search", (event) => {
      const { value } = (event as CustomEvent<{ value: string }>).detail;
      if (value !== this.#ctl.filter.text) this.#ctl.setFilter({ ...this.#ctl.filter, text: value });
    });
    element.addEventListener("mc-search-focus", (event) => {
      this.#searchFocused = (event as CustomEvent<{ focused: boolean }>).detail.focused;
    });
    // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
      if (key) refreshPackArt(key, src ?? undefined);
    });
    this.#unbind = bindStopFocus(element, (key) => this.#route?.focusKey(key));
    // The hover popover is drawn in the canvas, so its box is left out of the panel; the pictures raise the events.
    this.#cards = new CardEvents(region);
    this.#cards.enrich = (rect) => {
      const info = this.#detail?.hovers.get(hoverKeyOf(rect.cardId, rect.face));
      return info ? { ...rect, ...info } : rect;
    };
    this.#cards.onInspect = (cardId, face) => this.#inspectHeld(cardId, face);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
  }

  /** Inspect or the mods notice is over the store: the list's hand cursor stands down. */
  #overlayUp(): boolean {
    return this.scene.isActive(SCENES.inspect) || this.#notice !== null;
  }

  #leave(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, this.#returnTo);
  }

  // ---- The heads-up about mods --------------------------------------------------------------------------------

  /** Deadpool and Spider-Man's heads-up, over the store; `onClose` carries on with what it held back. */
  #showNotice(onClose?: () => void): void {
    if (this.#notice) return;
    this.#notice = { onClose };
    this.#compose();
    void this.#focusNotice();
  }

  async #focusNotice(): Promise<void> {
    if (this.#page) await settleElements(this.#page.element);
    if (this.#notice) {
      this.#syncStops();
      this.#route?.focusKey("close");
    }
  }

  /** Answering it (either button, or Back) remembers it was seen; "Report a problem" then opens the report tool. */
  #answer(answer: ModNoticeAnswer): void {
    const outcome = modNoticeOutcomeOf(answer);
    if (outcome.remember) rememberModNoticeSeen();
    const onClose = this.#notice?.onClose;
    this.#notice = null;
    this.#compose();
    onClose?.();
    if (outcome.openReport) openReportIssue(this);
  }

  // ---- What the page says ----------------------------------------------------------------------------------------

  #heard(detail: ModStoreEventDetail): void {
    if (this.#leaving) return;
    const ctl = this.#ctl;
    switch (detail.type) {
      case "back":
        return ctl.back();
      case "about":
        return this.#showNotice();
      case "tab": {
        const tab = MOD_STORE_TABS.find((one) => one.id === detail.tab);
        if (tab) ctl.select(tab.id as ModStoreTab);
        return;
      }
      case "toggle-finders": {
        const open = ctl.toggleFinders();
        // The caret goes in once the finders have drawn.
        if (open && this.#page)
          void settleElements(this.#page.element).then(() => this.#page?.element.searchField?.focusInput());
        return;
      }
      case "sort":
        return ctl.toggleSort();
      case "chip":
        return ctl.pressChip(detail.id);
      case "clear":
        return ctl.clearFilter();
      case "update-all":
        if (detail.action === "stop") ctl.stopUpdateAll();
        else if (detail.action === "show-failed") ctl.showFailed();
        else void ctl.updateAll();
        return;
      case "retry":
        return ctl.retry();
      case "open-pack":
        return ctl.openPack(detail.id);
      case "creator":
        return ctl.showCreator({ name: detail.name });
      case "pack-action": {
        const tile = ctl.openTile();
        const action = tile
          ? actionsOf({ tile, busy: ctl.pageBusy(tile.id), confirmingRemove: ctl.confirmingRemove }).find(
              (one) => one.id === detail.action,
            )
          : undefined;
        if (tile && action) ctl.act(tile, action);
        return;
      }
      case "card": {
        const card = this.#detail?.byKey.get(detail.key);
        if (card) this.#inspectCard(card);
        return;
      }
      case "notice":
        return this.#answer(detail.answer);
    }
  }

  // ---- Inspect -------------------------------------------------------------------------------------------------------

  /**
   * Reads one card in Inspect. A card the game's pool has (installed packs, the base game) opens the full sheet; a card of
   * a pack that is not installed yet has no place in the pool, so it opens as a reference sheet from its preview record:
   * name, type line and rules text over its picture.
   */
  #inspectCard(card: GalleryCard): void {
    const detail = this.#detail;
    const record = detail?.records.get(card.cardId);
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
          art: detail?.artOf(record, card) ?? null,
        },
      } satisfies InspectData);
    } else return;
    this.scene.bringToTop(SCENES.inspect);
  }

  /** A hold or right-click on a card picture: its gallery card, else (a featured face) the card itself. */
  #inspectHeld(cardId: string, face: unknown): void {
    if (this.scene.isActive(SCENES.inspect)) return;
    const card = this.#detail?.cards.get(hoverKeyOf(cardId, face));
    if (card) return this.#inspectCard(card);
    if (!currentCardsById().has(cardId)) return;
    this.scene.launch(SCENES.inspect, { card: { cardId, face: face ?? { kind: "front" } } });
    this.scene.bringToTop(SCENES.inspect);
  }

  // ---- Drawing ----------------------------------------------------------------------------------------------------------

  #scrollList(pixels: number): void {
    this.#page?.element.scrollers[0]?.scrollBy({ top: pixels });
  }

  /** A picture or a progress report arriving redraws once per frame, however many arrive. */
  #composeSoon(): void {
    if (this.#composeQueued || !this.#alive) return;
    this.#composeQueued = true;
    this.time.delayedCall(0, () => {
      this.#composeQueued = false;
      this.#compose();
    });
  }

  /** Sets the page from the store's state. */
  #compose(): void {
    if (!this.#alive || !this.#page) return;
    const ctl = this.#ctl;
    const { width, height } = this.scale.gameSize;
    const phone = isPhoneWidth(formFactorFor(width, height));
    const leases: PackLeases = this.#pictures.leases;
    leases.begin();
    this.#glyphs.reset();
    resetHoverCards(this);
    const tile = ctl.openTile();
    this.#detail = tile ? buildDetail(ctl, tile, this.#pictures) : null;
    const model: ModStorePageModel = {
      header: headerModelOf({
        phone,
        inPack: tile !== null,
        installedCount: ctl.installed.size,
        // A phone's bar carries no glyphs: its buttons are 44px squares.
        backGlyph: phone ? undefined : this.#glyphs.glyph("back", ["cancel"], "ink", BAR_BUTTON),
        aboutGlyph: phone ? undefined : this.#glyphs.glyph("about", ["guide"], "ink", BAR_BUTTON),
      }),
      browse: tile
        ? null
        : browseModelOf({
            tab: ctl.tab,
            status: ctl.status,
            offline: ctl.offline,
            phone,
            findersOpen: ctl.findersOpen,
            filter: ctl.filter,
            tabTiles: ctl.tilesOf(ctl.tab),
            updateBar: ctl.updateAllBar(),
            failedIds: ctl.failedIds(),
            scrollFrom: ctl.scrollFrom,
            thumbOf: (one) => this.#pictures.thumbOf(one),
          }),
      detail: this.#detail?.model ?? null,
      notice: this.#notice
        ? noticeModelOf(noticePortraitsOf, this.#glyphs.glyph("notice-close", ["activate"], "paper", NOTICE_BUTTON))
        : null,
    };
    this.#glyphs.settled();
    const { region, element } = this.#page;
    region.setRect({ x: 0, y: 0, width, height });
    element.size = phone ? "phone" : "wide";
    element.model = model;
    renderNow(element);
    leases.end();
    this.#hover?.onDraw();
    this.#queueStops();
  }

  /** Reads the page's stops a frame after it drew, once its parts (a list waits for its width) have too. */
  #queueStops(): void {
    if (this.#syncQueued) return;
    this.#syncQueued = true;
    requestAnimationFrame(() => {
      this.#syncQueued = false;
      if (this.#alive) this.#syncStops();
    });
  }

  #syncStops(): void {
    if (!this.#page || !this.#route) return;
    const { element, region } = this.#page;
    const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    const view = this.#notice ? "notice" : this.#detail ? "pack" : "browse";
    this.#route.set(modStoreFocusOrder([...stops.keys()], view), stops);
  }
}
