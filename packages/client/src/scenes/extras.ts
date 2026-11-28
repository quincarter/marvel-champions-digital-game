/**
 * Extras: the comics, rulebooks, artwork, promo cards, hero and villain files and the soundtrack, reached from Title.
 * Eight tabs (Stories, Side Stories, Rulebooks, Heroes, Villains, Artwork, Promo Cards, Music), each a shelf of tiles; a
 * locked tile shows its picture as a gray ghost and says what opens it, an open one reads, views or plays.
 *
 * What is open is `progression/extras.ts`'s (read through `extras()`, refreshed from storage when the screen opens);
 * the tabs and tiles are `view/extras-model.ts`'s. This scene mounts the screen and routes a tap:
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
 * **The whole screen is one page element**, `mc-extras-page` (`views/extras/`): the top bar, the two doors, the tab rail
 * and the tab's body (a shelf of picture tiles, or the player over the song rows), composed from `components/extras/`.
 * This scene only sets its model (`scenes/extras/page-model.ts`) and handles its `mc-extras` events. It keeps the focus
 * route (the page's `data-stop` parts, read by `dom/element-stops.ts`), the card hover popover over the promo tiles
 * (`dom/card-events.ts`), the shelf's scroll per tab, navigation and the music controller's wiring.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/extras/mc-extras-page/mc-extras-page.js";
import { surface } from "../tokens.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { cssOf } from "../ui/theme.js";
import { hasDesktopWindow } from "../platform/desktop-window.js";
import { fadeScreenIn, goToScreen, holdScreenFor } from "../ui/transitions.js";
import { EXTRAS_TABS, type ExtrasTab } from "../progression/extras.js";
import { extras, refreshUnlocks } from "../progression/progression.js";
import { formFactorFor } from "../view/layout.js";
import type { ExtrasTileView } from "../view/extras-model.js";
import { appSession } from "../session.js";
import { barClearance } from "../dom/bar-clearance.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { settleElements } from "../dom/element-settle.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import type { HoverCardIdRect } from "../view/card-hover.js";
import { PROMO_SETS, promoFaceArt } from "../art/promo-art.js";
import type { CampaignOpenerData } from "./campaign/routes.js";
import type { ExtrasViewerData } from "./extras-viewer.js";
import type { ExtrasReaderData } from "./extras-reader.js";
import type { SideStoryReaderData } from "./side-story-reader.js";
import type { ExtrasEventDetail } from "../components/extras/shared/extras-events.types.js";
import { MusicVolume } from "./extras/music-volume.js";
import { extrasPageModelOf } from "./extras/page-model.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";

export interface ExtrasSceneData {
  /** The tab to open on: a story read comes back to Stories. Defaults to the tab open last time. */
  readonly tab?: ExtrasTab;
}

/** Emitted on this scene by the viewer when a promo card is picked or dropped. */
export const PROMO_CHANGED = "promo-changed";

/** How far a page (Page Up / Down, a shoulder button) scrolls, as a share of the list's height. */
const PAGE = 0.9;
/** The heights the glyphs hung on Back and under the rail are drawn for. */
const BACK_HEIGHT = 44;
const TAB_HINT_HEIGHT = 16;

type Page = MountedElement<HTMLElementTagNameMap["mc-extras-page"]>;

export class ExtrasScene extends Phaser.Scene {
  #tab: ExtrasTab = "stories";
  /** One scroll position per tab, kept across visits (Phaser reuses this scene instance). */
  readonly #scrolls = new Map<ExtrasTab, number>();
  /** The tab the page is showing now, to tell a new tab (read from its own scroll) from a redraw (kept). */
  #shownTab: ExtrasTab | null = null;
  #route: FocusRoute | null = null;
  #redrawQueued = false;
  /** Between `create` and shutdown. Not `sys.isActive()`, which is still false while `create` itself draws. */
  #alive = false;
  #leaving = false;
  #unsubscribe: (() => void) | null = null;
  #hover: HoverPreview | null = null;
  #cards: CardEvents | null = null;
  /** The promo set whose tile the mouse is over: the hover popover shows that set's own picture. */
  #promoUnder: string | null = null;
  #page: Page | null = null;
  #glyphs!: ControlGlyphs;
  #volume = new MusicVolume(() => this.#requestRedraw());
  /** The tiles drawn now, for a tap by id. */
  #views = new Map<string, ExtrasTileView>();
  #unbind: (() => void) | null = null;
  #drawn = 0;

  constructor() {
    super(SCENES.extras);
  }

  create(data: ExtrasSceneData = {}): void {
    this.#tab = data.tab ?? this.#tab;
    this.#redrawQueued = false;
    this.#alive = true;
    this.#leaving = false;
    this.#page = null;
    this.#shownTab = null;
    this.#promoUnder = null;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#compose, this);
    const offLanguage = onLanguageChange(() => {
      if (this.#alive) this.#compose();
    });
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    this.#volume = new MusicVolume(() => this.#requestRedraw());
    this.#volume.start();
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.extrasViewer),
      onCancel: () => this.#back(),
      // LB / RB (and the zone keys) step the tabs along the top; Page Up / Down still page the shelf.
      onTab: (direction) => this.#stepTab(direction),
      onPage: (direction) => {
        const scroller = this.#page?.element.scroller;
        scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE });
      },
      onScroll: (_dx, dy) => this.#page?.element.scroller?.scrollBy({ top: dy }),
    });
    // A new song (the shuffle moving on, or Next) redraws the Music tab's player and its playing row.
    this.#unsubscribe = appSession().music?.onTrackStart(() => this.#requestRedraw()) ?? null;
    resetHoverCards(this);
    this.events.on(PROMO_CHANGED, this.#requestRedraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#scrolls.set(this.#tab, this.#page?.element.scroller?.scrollTop ?? this.#scrolls.get(this.#tab) ?? 0);
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#unbind?.();
      this.#unbind = null;
      this.events.off(PROMO_CHANGED, this.#requestRedraw, this);
      this.scale.off("resize", this.#compose, this);
      offLanguage();
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#volume.stop();
      this.#glyphs.dispose();
      this.#page = null;
    });
    this.#mount();
    this.#compose();
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
          this.#compose();
        }),
    );
  }

  /** Mounts the page once, so the shelf's scroll survives a redraw, and wires what it says and what hovers over it. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-extras-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    element.addEventListener("mc-extras", (event) => this.#heard(event.detail));
    this.#unbind = bindStopFocus(element, (key) => this.#route?.focusKey(key));
    element.progress = () => appSession().music?.progress() ?? null;
    // The promo tiles are card pictures: the mouse over one opens the card hover popover, with that set's own picture.
    this.#cards = new CardEvents(region);
    element.addEventListener("mc-card-hover", (event) => {
      const target = event.composedPath()[0];
      this.#promoUnder = target instanceof HTMLElement ? target.dataset.promoSet || null : null;
    });
    element.addEventListener("mc-card-hover-end", () => (this.#promoUnder = null));
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => (this.scene.isActive(SCENES.extrasViewer) ? null : screenHoverArea(this, pointer)),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
  }

  /** The hovered promo tile, with that promo set's own picture. */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const set = this.#promoUnder ? PROMO_SETS.find((one) => one.id === this.#promoUnder) : undefined;
    for (const [slot, rect] of this.#cards?.hovered() ?? []) {
      found.set(slot, set ? { ...rect, art: promoFaceArt(set, set.faces[0]!) } : rect);
    }
    return found;
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  #heard(detail: ExtrasEventDetail): void {
    if (this.#leaving) return;
    switch (detail.type) {
      case "back":
        return this.#back();
      case "door":
        return this.#go(detail.id === "trophies" ? SCENES.trophyRoom : SCENES.credits);
      case "tab":
        return this.#select(detail.id as ExtrasTab);
      case "tile": {
        const view = this.#views.get(detail.id);
        if (view) this.#activate(view);
        return;
      }
      case "player":
        return this.#player(detail.action);
      case "volume":
        return this.#volume.slide(detail.share, detail.commit);
      case "volume-step":
        return this.#volume.step(detail.direction);
    }
  }

  /** Leaves for another screen, once. */
  #go(key: string, data?: object): void {
    this.#leaving = true;
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, key, data);
  }

  #back(): void {
    this.#go(SCENES.title);
  }

  /** Shuffle, Next and Pause on the Music tab's player. */
  #player(action: "shuffle" | "next" | "pause"): void {
    const session = appSession();
    const music = session.music;
    if (action === "pause") {
      if (!music) return;
      if (music.paused()) music.resume();
      else music.pause();
    } else if (action === "next") {
      music?.next();
    } else {
      const next = { ...session.settings, musicShuffle: !session.settings.musicShuffle };
      music?.syncSettings(next);
      session.settings = next;
    }
    this.#compose();
  }

  #select(tab: ExtrasTab): void {
    if (tab === this.#tab) return;
    this.#scrolls.set(this.#tab, this.#page?.element.scroller?.scrollTop ?? 0);
    this.#tab = tab;
    this.#compose();
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

  /** A picture or a song arriving redraws once, however many arrive in the same frame. */
  #requestRedraw(): void {
    if (this.#redrawQueued || !this.#alive) return;
    this.#redrawQueued = true;
    this.time.delayedCall(0, () => {
      this.#redrawQueued = false;
      this.#compose();
    });
  }

  #activate(tile: ExtrasTileView): void {
    if (!tile.open || this.scene.isActive(SCENES.extrasViewer)) return;
    const content = tile.entry.content;
    if (content.kind === "issue") {
      this.#go(SCENES.campaignOpener, {
        campaignId: content.campaignId,
        nodeId: content.nodeId,
        returnTo: { key: SCENES.extras, data: { tab: "stories" } satisfies ExtrasSceneData },
      } satisfies CampaignOpenerData);
      return;
    }
    if (content.kind === "comic") {
      this.#go(SCENES.sideStoryReader, { storyId: content.storyId } satisfies SideStoryReaderData);
      return;
    }
    if (content.kind === "book") {
      this.#go(SCENES.extrasReader, { bookId: content.bookId } satisfies ExtrasReaderData);
      return;
    }
    if (content.kind === "track") {
      const music = appSession().music;
      // The song playing again: stop it (back to Title's music), or with shuffle on, skip to the next song.
      if (music?.jukeboxKey() === content.track.key) {
        if (appSession().settings.musicShuffle) music.next();
        else music.playTitle();
      } else music?.playTrack(content.track);
      this.#compose();
      return;
    }
    this.scene.launch(SCENES.extrasViewer, { entryId: tile.id } satisfies ExtrasViewerData);
  }

  /** Sets the page from what is open, then, once it has rendered, hands the route its stops. */
  #compose(): void {
    const mounted = this.#page;
    if (!this.#alive || this.#leaving || !mounted) return;
    const frame = campaignFrame(this);
    const { width, height, phone } = frame;
    const back = phone ? "◂" : t("extras.back");
    this.#glyphs.reset();
    const backGlyph = hintGlyphOf(this.#glyphs.glyph("back", ["cancel"], "ink", BACK_HEIGHT));
    // LB / RB, pad only, under the strip's right end.
    const tabsHint = this.#glyphs.glyph("tab-step", ["zonePrevious", "zoneNext"], "paper", TAB_HINT_HEIGHT);
    this.#glyphs.settled();
    resetHoverCards(this);
    mounted.region.setRect({ x: 0, y: 0, width, height });
    mounted.element.model = extrasPageModelOf({
      extras: extras(),
      tab: this.#tab,
      width,
      phone,
      withSlider: hasDesktopWindow() || formFactorFor(width, height) === "desktop",
      volume: this.#volume.value,
      backGlyph,
      tabsHint,
      clearance: barClearance(this, { width, phone, back, title: t("title.extras").toUpperCase(), right: "" }),
      onViews: (views) => (this.#views = new Map(views.map((view) => [view.id, view]))),
    });
    const draw = ++this.#drawn;
    void settleElements(mounted.element).then(() => draw === this.#drawn && this.#alive && this.#wire(mounted));
  }

  /** After a render: the tab's scroll, the route's stops and the hover's cards. */
  #wire({ element, region }: Page): void {
    // A tab opens where it was left; a redraw of the same tab keeps the scroll the page already has.
    if (this.#shownTab !== this.#tab) {
      const scroller = element.scroller;
      if (scroller) scroller.scrollTop = this.#scrolls.get(this.#tab) ?? 0;
      this.#shownTab = this.#tab;
    }
    const collected = focusStopsOf(element, (target) => region.rectOf(target));
    // The volume slider's steps are the player's: `player:volume-down`, `player:volume-up`.
    const stops = new Map<string, FocusStop>();
    for (const [key, stop] of collected) stops.set(key.startsWith("volume-") ? `player:${key}` : key, stop);
    const keys = [...stops.keys()];
    this.#route?.set(
      [
        "back",
        "trophies",
        "credits",
        ...EXTRAS_TABS.map((tab) => `tab:${tab.id}`),
        ...keys.filter((key) => key.startsWith("player:")),
        ...keys.filter((key) => key.startsWith("tile:")),
      ].filter((key) => stops.has(key)),
      stops,
    );
    this.#hover?.onDraw();
  }
}
