/**
 * The Extras viewer: one hero's or villain's file, or one piece of artwork, over the Extras screen. The picture is
 * shown whole (fitted, never cropped), with ◂ ▸ between a file's pictures, and the file's lines beside it (below it
 * on a narrow screen): both faces' names, traits and flavor for a hero, a villain's traits and scenario.
 *
 * Only the slides the player has opened are shown; the rest are counted, with what opens them ("1 more scene: Beat
 * Rhino"), so a villain's file says there is more to earn. ✕ or Escape closes it; ← and → step through pictures.
 */
import Phaser from "phaser";
import { containScale, ensurePictureLoaded } from "../art/pictures.js";
import { accent, ink, surface, typeRole } from "../tokens.js";
import { artNote, bangers } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { OverlayMotion } from "../ui/transitions.js";
import type { Rect } from "../view/layout.js";
import { EXTRAS_ENTRIES, unlockHint, type ExtrasEntry } from "../progression/extras.js";
import { extras } from "../progression/progression.js";
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
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  /** Between `create` and shutdown. Not `sys.isActive()`, which is still false while `create` itself draws. */
  #alive = false;

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
    this.#motion = new OverlayMotion();
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#close() });
    const onArrow = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight") this.#step(1);
      else if (event.key === "ArrowLeft") this.#step(-1);
    };
    this.input.keyboard?.on("keydown", onArrow);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", onResize, this);
      this.input.keyboard?.off("keydown", onArrow);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
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
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const entry = this.#entry;
    const { width, height } = this.scale.gameSize;
    // Swallows every tap on no control of this overlay's own, so nothing reaches the Extras shelf underneath.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.92).fillRect(0, 0, width, height);
    const panelsFrom = this.children.list.length;
    this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0);
    if (!entry) {
      this.#close();
      return;
    }

    const stops = new Map<string, FocusStop>();
    const pad = width < 600 ? 12 : 24;
    const closeRect: Rect = { x: width - pad - 40, y: (HEADER - 40) / 2, width: 40, height: 40 };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        onClick: () => this.#close(),
      }),
    );
    stops.set("close", { rect: closeRect, activate: () => this.#close() });
    const title = this.add
      .text(pad, HEADER / 2, entry.title.toUpperCase(), textStyle(bangers(width < 600 ? 24 : 32), surface.paper.hex))
      .setOrigin(0, 0.5)
      .setLetterSpacing(1);
    fitText(title, closeRect.x - pad * 2, width < 600 ? 24 : 32);
    this.add.rectangle(0, HEADER - 2, width, 2, accent.heroRed.hex).setOrigin(0, 0);

    const content = entry.content;
    const lines = content.kind === "gallery" ? content.lines : [];
    const note = this.#lockedNote(entry);
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
      const key = ensurePictureLoaded(this, slide.picture, () => this.#draw());
      if (key) {
        const source = this.textures.get(key).getSourceImage() as { width: number; height: number };
        const scale = containScale(source, frame);
        this.add
          .image(frame.x + frame.width / 2, frame.y + frame.height / 2, key)
          .setScale(scale)
          .setOrigin(0.5);
      }
      const caption = slides.length > 1 ? `${slide.caption} · ${this.#slide + 1} / ${slides.length}` : slide.caption;
      this.add
        .text(
          frame.x + frame.width / 2,
          frame.y + frame.height + 8,
          caption,
          textStyle(typeRole.label, surface.paper.hex, ink.secondary),
        )
        .setOrigin(0.5, 0);
    } else {
      artNote(this, frame, "No artwork for this one yet.", true);
    }

    if (slides.length > 1) {
      const arrow = 44;
      const prevRect: Rect = { x: frame.x, y: frame.y + frame.height / 2 - arrow / 2, width: arrow, height: arrow };
      const nextRect: Rect = { ...prevRect, x: frame.x + frame.width - arrow };
      this.#buttons.push(
        new McButton(this, {
          kind: "onInk",
          label: "◂",
          type: typeRole.rowTitle,
          rect: prevRect,
          onClick: () => this.#step(-1),
        }),
        new McButton(this, {
          kind: "onInk",
          label: "▸",
          type: typeRole.rowTitle,
          rect: nextRect,
          onClick: () => this.#step(1),
        }),
      );
      stops.set("prev", { rect: prevRect, activate: () => this.#step(-1) });
      stops.set("next", { rect: nextRect, activate: () => this.#step(1) });
    }

    if (textHeight > 0) {
      const textRect: Rect = sideBySide
        ? { x: body.x + body.width - textWidth, y: body.y, width: textWidth, height: body.height }
        : { x: body.x, y: body.y + body.height - textHeight, width: body.width, height: textHeight };
      let y = textRect.y;
      if (entry.subtitle) {
        const subtitle = this.add
          .text(textRect.x, y, entry.subtitle, textStyle(typeRole.label, surface.paper.hex, ink.secondary))
          .setWordWrapWidth(textRect.width);
        y += subtitle.height + 10;
      }
      for (const line of lines) {
        if (y > textRect.y + textRect.height - 16) break;
        const quote = line.startsWith('"') || line.startsWith("“");
        const text = this.add
          .text(textRect.x, y, line, {
            ...textStyle(typeRole.body, surface.paper.hex, quote ? 0.75 : 0.95),
            fontStyle: quote ? "italic" : "normal",
          })
          .setFontSize(sideBySide ? 14 : 12)
          .setWordWrapWidth(textRect.width)
          .setLineSpacing(3);
        y += text.height + 10;
      }
      if (note && y < textRect.y + textRect.height - 16) {
        this.add
          .text(textRect.x, y, note, textStyle(typeRole.body, accent.heroRed.hex))
          .setFontSize(12)
          .setWordWrapWidth(textRect.width);
      }
    }

    this.#route?.set([...(slides.length > 1 ? ["prev", "next"] : []), "close"], stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  /** "1 more picture to earn: Beat Rhino", or null when the whole file is open. */
  #lockedNote(entry: ExtrasEntry): string | null {
    if (entry.content.kind !== "gallery") return null;
    const locked = entry.content.slides.filter((slide) => !extras().isOpen(slide.unlock));
    if (locked.length === 0) return null;
    const hints = [...new Set(locked.map((slide) => unlockHint(slide.unlock)))].join(" · ");
    return `${locked.length} more ${locked.length === 1 ? "picture" : "pictures"} to earn: ${hints}`;
  }
}
