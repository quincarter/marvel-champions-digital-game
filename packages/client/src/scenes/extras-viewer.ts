/**
 * The Extras viewer: one hero's or villain's file, or one piece of artwork, over the Extras screen. The picture is
 * shown whole (fitted, never cropped), with ◂ ▸ between a file's pictures, and the file's lines beside it (below it
 * on a narrow screen): both faces' names, traits and flavor for a hero, a villain's traits and scenario.
 *
 * Only the slides the player has opened are shown; the rest are counted, with what opens them ("1 more scene: Beat
 * Rhino"), so a villain's file says there is more to earn. ✕ or Escape closes it; ← and → step through pictures.
 *
 * A promo card's file has one more control: use this art in place of the normal card, or stop using it. The choice is
 * saved in `Settings.promoArt`.
 *
 * **One Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`, as `scenes/rules.ts` is) at the rects the
 * Phaser screen drew: the ink header with its title and ✕, the picture (a lazy `<img>`, fitted whole), ◂ ▸, the caption
 * and the text column. The scene keeps the press shield, the entrance and exit motion, the focus route (its ring drawn
 * in the DOM) and the arrow keys.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { accent, ink, surface, typeRole } from "../tokens.js";
import { bangers } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { addPressShield } from "../ui/press-shield.js";
import { OverlayMotion } from "../ui/transitions.js";
import type { Rect } from "../view/layout.js";
import { EXTRAS_ENTRIES, unlockHint, type ExtrasEntry } from "../progression/extras.js";
import { applyEarnedItems, extras } from "../progression/progression.js";
import { withPromoToggled } from "../art/promo-art.js";
import { appSession } from "../session.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { PROMO_CHANGED } from "./extras.js";
import { bindExtraInput } from "./extra-input.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface ExtrasViewerData {
  readonly entryId: string;
}

const HEADER = 60;
/** Below this width the text goes under the picture instead of beside it. */
const SIDE_BY_SIDE_MIN = 820;

export class ExtrasViewerScene extends Phaser.Scene {
  #entry: ExtrasEntry | null = null;
  #slide = 0;
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  /** Between `create` and shutdown. Not `sys.isActive()`, which is still false while `create` itself draws. */
  #alive = false;
  /** The screen, one Lit panel over the canvas; made on the first draw and kept. */
  #region: DomRegion<McSheet> | null = null;
  /** What each key in the panel does when tapped, this draw. */
  #actions = new Map<string, () => void>();

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
    this.#region = null;
    this.#motion = new OverlayMotion();
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    const offLanguage = onLanguageChange(() => this.#draw());
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
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #step(direction: 1 | -1): void {
    const count = this.#slides().length;
    if (count <= 1) return;
    this.#slide = (this.#slide + direction + count) % count;
    this.#draw();
  }

  #slides() {
    return this.#entry ? extras().openSlides(this.#entry.content) : [];
  }

  #draw(): void {
    if (this.#motion.leaving || !this.#alive) return;
    destroyChildren(this);
    this.#actions = new Map();

    const entry = this.#entry;
    const { width, height } = this.scale.gameSize;
    // Swallows every tap on no control of this overlay's own, so nothing reaches the Extras shelf underneath.
    addPressShield(this, { x: 0, y: 0, width, height });
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.92).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    const anchor = this.add.graphics();
    if (!entry) {
      this.#close();
      return;
    }
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    b.box({ x: 0, y: 0, width, height }, { fill: surface.ink.hex });

    const stops = new Map<string, FocusStop>();
    const pad = width < 600 ? 12 : 24;
    const closeRect: Rect = { x: width - pad - 40, y: (HEADER - 40) / 2, width: 40, height: 40 };
    b.button({ key: "close", rect: closeRect, label: "✕", look: "onInk", type: typeRole.rowTitle });
    this.#actions.set("close", () => this.#close());
    stops.set("close", { rect: closeRect, activate: () => this.#close() });
    b.text(pad, HEADER / 2, entry.title.toUpperCase(), bangers(width < 600 ? 24 : 32), {
      color: surface.paper.hex,
      origin: [0, 0.5],
      letterSpacing: 1,
      fitWidth: closeRect.x - pad * 2,
    });
    b.box({ x: 0, y: HEADER - 2, width, height: 2 }, { fill: accent.heroRed.hex });

    const content = entry.content;
    const lines = content.kind === "gallery" ? content.lines : [];
    const note = this.#lockedNote(entry);
    const promoSetId = content.kind === "gallery" ? content.promoSetId : undefined;
    const hasText = lines.length > 0 || note !== null;
    const sideBySide = width >= SIDE_BY_SIDE_MIN && hasText;
    const body: Rect = { x: pad, y: HEADER + pad, width: width - pad * 2, height: height - HEADER - pad * 2 };
    const textWidth = sideBySide ? Math.min(360, body.width * 0.34) : body.width;
    const textHeight = !hasText ? 0 : sideBySide ? body.height : Math.min(body.height * 0.34, 200);
    const pictureArea: Rect = sideBySide
      ? { x: body.x, y: body.y, width: body.width - textWidth - pad, height: body.height }
      : { x: body.x, y: body.y, width: body.width, height: body.height - textHeight - (textHeight > 0 ? pad : 0) };

    const slides = this.#slides();
    this.#slide = Math.min(this.#slide, Math.max(0, slides.length - 1));
    const slide = slides[this.#slide];
    const captionHeight = 28;
    const frame: Rect = { ...pictureArea, height: Math.max(40, pictureArea.height - captionHeight) };

    if (slide) {
      // The picture fitted whole into the frame, loaded as it comes near.
      b.image(frame, { src: slide.picture.url, key: "slide" });
      const caption = slides.length > 1 ? `${slide.caption} · ${this.#slide + 1} / ${slides.length}` : slide.caption;
      b.text(frame.x + frame.width / 2, frame.y + frame.height + 8, caption, typeRole.label, {
        color: surface.paper.hex,
        alpha: ink.secondary,
        origin: [0.5, 0],
      });
    } else {
      b.text(frame.x + frame.width / 2, frame.y + frame.height / 2, t("extras.viewer.noArt"), typeRole.body, {
        size: 13,
        color: surface.paper.hex,
        alpha: ink.secondary,
        origin: [0.5, 0.5],
        align: "center",
        wrapWidth: Math.max(80, frame.width - 24),
      });
    }

    if (slides.length > 1) {
      const arrow = 44;
      const prevRect: Rect = { x: frame.x, y: frame.y + frame.height / 2 - arrow / 2, width: arrow, height: arrow };
      const nextRect: Rect = { ...prevRect, x: frame.x + frame.width - arrow };
      b.button({ key: "prev", rect: prevRect, label: "◂", look: "onInk", type: typeRole.rowTitle });
      b.button({ key: "next", rect: nextRect, label: "▸", look: "onInk", type: typeRole.rowTitle });
      this.#actions.set("prev", () => this.#step(-1));
      this.#actions.set("next", () => this.#step(1));
      stops.set("prev", { rect: prevRect, activate: () => this.#step(-1) });
      stops.set("next", { rect: nextRect, activate: () => this.#step(1) });
    }

    if (textHeight > 0) {
      const textRect: Rect = sideBySide
        ? { x: body.x + body.width - textWidth, y: body.y, width: textWidth, height: body.height }
        : { x: body.x, y: body.y + body.height - textHeight, width: body.width, height: textHeight };
      let y = textRect.y;
      if (entry.subtitle) {
        const subtitle = b.text(textRect.x, y, entry.subtitle, typeRole.label, {
          color: surface.paper.hex,
          alpha: ink.secondary,
          wrapWidth: textRect.width,
        });
        y += subtitle.height + 10;
      }
      for (const line of lines) {
        if (y > textRect.y + textRect.height - 16) break;
        const quote = line.startsWith('"') || line.startsWith("“");
        const text = b.text(textRect.x, y, line, typeRole.body, {
          size: sideBySide ? 14 : 12,
          color: surface.paper.hex,
          alpha: quote ? 0.75 : 0.95,
          italic: quote,
          wrapWidth: textRect.width,
          lineSpacing: 3,
        });
        y += text.height + 10;
      }
      if (promoSetId) y = this.#drawPromoControl(b, promoSetId, textRect, y, stops);
      if (note && y < textRect.y + textRect.height - 16) {
        b.text(textRect.x, y, note, typeRole.body, {
          size: 12,
          color: accent.heroRed.hex,
          wrapWidth: textRect.width,
        });
      }
    }

    this.#route?.set(
      [...(slides.length > 1 ? ["prev", "next"] : []), ...(promoSetId ? ["promo"] : []), "close"],
      stops,
    );
    this.#mount(width, height, b);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
    this.#region?.follow(anchor);
  }

  /** Hands the built parts to the panel (made once) and renders them now. */
  #mount(width: number, height: number, builder: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        // Closing already (its exit is playing): a second tap must not act.
        if (this.#motion.leaving) return;
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
    }
    this.#region.setRect({ x: 0, y: 0, width, height });
    this.#region.element.nodes = builder.nodes;
    renderNow(this.#region.element);
  }

  /** The use-this-art button, at `y` in the text column. Returns the y below it. */
  #drawPromoControl(b: SheetBuilder, setId: string, column: Rect, y: number, stops: Map<string, FocusStop>): number {
    const { promoArt, promoArtOn } = appSession().settings;
    const toggle = (): void => {
      appSession().settings = { ...appSession().settings, promoArt: withPromoToggled(promoArt, setId) };
      applyEarnedItems();
      this.scene.get(SCENES.extras).events.emit(PROMO_CHANGED);
      this.#draw();
    };
    const rect: Rect = { x: column.x, y, width: Math.min(column.width, 260), height: 44 };
    b.button({
      key: "promo",
      rect,
      label: promoArt.includes(setId) ? t("extras.viewer.promoStop") : t("extras.viewer.promoUse"),
      look: "onInk",
      type: typeRole.rowTitle,
    });
    this.#actions.set("promo", toggle);
    stops.set("promo", { rect, activate: toggle });
    if (promoArtOn) return y + rect.height + 10;
    const off = b.text(column.x, y + rect.height + 8, t("extras.viewer.promoOff"), typeRole.body, {
      size: 12,
      color: accent.heroRed.hex,
      wrapWidth: column.width,
    });
    return y + rect.height + 8 + off.height + 10;
  }

  /** "1 more picture to earn: Beat Rhino", or null when the whole file is open. */
  #lockedNote(entry: ExtrasEntry): string | null {
    if (entry.content.kind !== "gallery") return null;
    const locked = entry.content.slides.filter((slide) => !extras().isOpen(slide.unlock));
    if (locked.length === 0) return null;
    const hints = [...new Set(locked.map((slide) => unlockHint(slide.unlock)))].join(" · ");
    return t(locked.length === 1 ? "extras.viewer.moreOne" : "extras.viewer.moreMany", {
      count: locked.length,
      hints,
    });
  }
}
