/**
 * The Extras viewer: one hero's or villain's file, or one piece of artwork, over the Extras screen. The picture is shown
 * whole (fitted, never cropped), with arrows between a file's pictures, and the file's lines beside it (below it on a
 * narrow screen): both faces' names, traits and flavor for a hero, a villain's traits and scenario.
 *
 * Only the slides the player has opened are shown; the rest are counted, with what opens them ("1 more scene: Beat
 * Rhino"), so a villain's file says there is more to earn. The close button or Escape closes it; the left and right arrow
 * keys step through pictures.
 *
 * A promo card's file has one more control: use this art in place of the normal card, or stop using it. The choice is
 * saved in `Settings.promoArt`.
 *
 * **The viewer is one page element**, `mc-extras-viewer-page` (`views/extras-viewer/`): the header, the picture and the
 * words, composed from `components/viewer/`. This scene keeps the press shield, the scrim, the entrance and exit motion
 * (the page rises and fades with it, `DomRegion.follow`), the focus route and the arrow keys; it builds the page's model from
 * the entry and handles its `mc-viewer` events.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/extras-viewer/mc-extras-viewer-page/mc-extras-viewer-page.js";
import { surface } from "../tokens.js";
import { addPressShield } from "../ui/press-shield.js";
import { OverlayMotion } from "../ui/transitions.js";
import { EXTRAS_ENTRIES, unlockHint, type ExtrasEntry } from "../progression/extras.js";
import { applyEarnedItems, extras } from "../progression/progression.js";
import { withPromoToggled } from "../art/promo-art.js";
import { appSession } from "../session.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { settleElements } from "../dom/element-settle.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import type { ViewerEventDetail } from "../components/viewer/shared/viewer-events.types.js";
import type { ViewerPageModel } from "../views/extras-viewer/mc-extras-viewer-page/mc-extras-viewer-page.types.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { PROMO_CHANGED } from "./extras.js";
import { bindExtraInput } from "./extra-input.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface ExtrasViewerData {
  readonly entryId: string;
}

/** Below this width the words go under the picture instead of beside it. */
const SIDE_BY_SIDE_MIN = 820;
const PHONE_WIDTH = 600;

type Page = MountedElement<HTMLElementTagNameMap["mc-extras-viewer-page"]>;

export class ExtrasViewerScene extends Phaser.Scene {
  #entry: ExtrasEntry | null = null;
  #slide = 0;
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  /** Between `create` and shutdown. Not `sys.isActive()`, which is still false while `create` itself draws. */
  #alive = false;
  #page: Page | null = null;
  #unbind: (() => void) | null = null;
  #drawn = 0;

  constructor() {
    super(SCENES.extrasViewer);
  }

  create(data: ExtrasViewerData): void {
    this.#entry =
      Object.values(EXTRAS_ENTRIES)
        .flat()
        .find((entry) => entry.id === data.entryId) ?? null;
    this.#slide = 0;
    this.#alive = true;
    this.#page = null;
    this.#motion = new OverlayMotion();
    const onResize = (): void => {
      this.#frame();
      this.#compose();
    };
    this.scale.on("resize", onResize, this);
    const offLanguage = onLanguageChange(() => this.#compose());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#close(),
      onTab: (direction) => this.#step(direction),
    });
    const onArrow = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight") this.#step(1);
      else if (event.key === "ArrowLeft") this.#step(-1);
    };
    this.input.keyboard?.on("keydown", onArrow);
    // The D-pad pages as the arrows do.
    bindExtraInput(this, {
      intents: {
        right: () => {
          this.#step(1);
        },
        left: () => {
          this.#step(-1);
        },
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", onResize, this);
      offLanguage();
      this.input.keyboard?.off("keydown", onArrow);
      this.#unbind?.();
      this.#unbind = null;
      this.#page = null;
    });
    if (!this.#entry) {
      this.#close();
      return;
    }
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-extras-viewer-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    mounted.element.addEventListener("mc-viewer", (event) => this.#heard(event.detail));
    this.#unbind = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key));
    this.#frame();
    this.#compose();
  }

  #heard(detail: ViewerEventDetail): void {
    // Closing already (its exit is playing): a second tap must not act.
    if (this.#motion.leaving) return;
    if (detail.type === "close") this.#close();
    else if (detail.type === "step") this.#step(detail.direction);
    else this.#togglePromo();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #step(direction: 1 | -1): void {
    const count = this.#slides().length;
    if (count <= 1 || this.#motion.leaving) return;
    this.#slide = (this.#slide + direction + count) % count;
    this.#compose();
  }

  #slides() {
    return this.#entry ? extras().openSlides(this.#entry.content) : [];
  }

  #togglePromo(): void {
    const content = this.#entry?.content;
    const setId = content?.kind === "gallery" ? content.promoSetId : undefined;
    if (!setId) return;
    const { promoArt } = appSession().settings;
    appSession().settings = { ...appSession().settings, promoArt: withPromoToggled(promoArt, setId) };
    applyEarnedItems();
    this.scene.get(SCENES.extras).events.emit(PROMO_CHANGED);
    this.#compose();
  }

  /** The scrim, the press shield and the anchor the page rises with: drawn on open and again on a resize. */
  #frame(): void {
    if (this.#motion.leaving || !this.#alive) return;
    for (const child of [...this.children.list]) child.destroy();
    const { width, height } = this.scale.gameSize;
    // Swallows every tap on no control of this overlay's own, so nothing reaches the Extras shelf underneath.
    addPressShield(this, { x: 0, y: 0, width, height });
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.92).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    // Nothing drawn: the entrance and exit tween this, and the page rises and fades with it (`DomRegion.follow`).
    const anchor = this.add.graphics();
    this.#page?.region.setRect({ x: 0, y: 0, width, height });
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
    this.#page?.region.follow(anchor);
  }

  /** "1 more picture to earn: Beat Rhino", or "" when the whole file is open. */
  #lockedNote(entry: ExtrasEntry): string {
    if (entry.content.kind !== "gallery") return "";
    const locked = entry.content.slides.filter((slide) => !extras().isOpen(slide.unlock));
    if (locked.length === 0) return "";
    const hints = [...new Set(locked.map((slide) => unlockHint(slide.unlock)))].join(" · ");
    return t(locked.length === 1 ? "extras.viewer.moreOne" : "extras.viewer.moreMany", {
      count: locked.length,
      hints,
    });
  }

  #modelOf(entry: ExtrasEntry): ViewerPageModel {
    const { width } = this.scale.gameSize;
    const content = entry.content;
    const lines = content.kind === "gallery" ? content.lines : [];
    const note = this.#lockedNote(entry);
    const promoSetId = content.kind === "gallery" ? content.promoSetId : undefined;
    const hasText = lines.length > 0 || note !== "";
    const slides = this.#slides();
    this.#slide = Math.min(this.#slide, Math.max(0, slides.length - 1));
    const slide = slides[this.#slide];
    const { promoArt, promoArtOn } = appSession().settings;
    return {
      compact: width < PHONE_WIDTH,
      wide: width >= SIDE_BY_SIDE_MIN && hasText,
      header: { title: entry.title.toUpperCase(), closeLabel: t("common.close") },
      slide: {
        picture: slide ? { src: slide.picture.url } : null,
        caption: slide
          ? slides.length > 1
            ? `${slide.caption} · ${this.#slide + 1} / ${slides.length}`
            : slide.caption
          : "",
        arrows: slides.length > 1,
        empty: t("extras.viewer.noArt"),
      },
      text: hasText
        ? {
            subtitle: entry.subtitle,
            lines: lines.map((text) => ({ text, quote: text.startsWith('"') || text.startsWith("“") })),
            promo: promoSetId
              ? {
                  label: promoArt.includes(promoSetId) ? t("extras.viewer.promoStop") : t("extras.viewer.promoUse"),
                  off: promoArtOn ? null : t("extras.viewer.promoOff"),
                }
              : null,
            note,
          }
        : null,
    };
  }

  /** Sets the page from the entry and the slide, then, once it has rendered, hands the route its stops. */
  #compose(): void {
    const mounted = this.#page;
    const entry = this.#entry;
    if (this.#motion.leaving || !this.#alive || !mounted || !entry) return;
    mounted.element.model = this.#modelOf(entry);
    const draw = ++this.#drawn;
    void settleElements(mounted.element).then(() => draw === this.#drawn && this.#alive && this.#wire(mounted, entry));
  }

  #wire({ element, region }: Page, entry: ExtrasEntry): void {
    const stops = focusStopsOf(element, (target) => region.rectOf(target));
    const promo = entry.content.kind === "gallery" && entry.content.promoSetId !== undefined;
    this.#route?.set(
      [...(this.#slides().length > 1 ? ["prev", "next"] : []), ...(promo ? ["promo"] : []), "close"].filter((key) =>
        stops.has(key),
      ),
      stops,
    );
  }
}
