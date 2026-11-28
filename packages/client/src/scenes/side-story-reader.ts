/**
 * The side-story reader: an earned side story (`content/side-stories.ts`) read beat by beat in the guided comic
 * reader (`ui/comic-reader.ts`), the way a one-off scenario's intro reads its page (`scenes/scenario-intro.ts`).
 * Every page is Marvel's own lettered page, so the camera frames one panel at a time, panning from one to the next
 * across a page, and each page ends on the whole page before the next one cuts in.
 *
 * Reached from Extras ▸ Side Stories; leaving (the last beat's "DONE ▸", CLOSE, or Escape) goes back to that tab.
 *
 * **A Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`) for the chrome: the header (SIDE STORY, the title
 * and credit, CLOSE with its Start glyph), the "PAGE 2 · PANEL 3" line and the action bar (◂ BACK, NEXT ▸ / DONE ▸ with
 * its glyph). The comic picture itself stays Phaser (its animated camera pan, panel spotlight and masks) and shows through
 * a hole in the panel, redrawn on its own while the pan tweens so the panel is not rebuilt every frame.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { SIDE_STORY_ART, sideStoryPageArt } from "../art/side-stories-art.js";
import type { ComicBeat } from "../campaign/story.js";
import { sideStoryFor, type SideStory } from "../content/side-stories.js";
import { appSession } from "../session.js";
import { ink, surface, typeRole } from "../tokens.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { drawComicReaderPicture, type ComicReaderTween } from "../ui/comic-reader.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { onTap } from "../ui/tap.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import {
  comicReaderViewOf,
  nextComicBeat,
  prevComicBeat,
  resolveComicBeats,
  type ComicReaderStepView,
  type ResolvedComicBeat,
} from "../view/comic-reader-model.js";
import type { Rect } from "../view/layout.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import type { ExtrasSceneData } from "./extras.js";
import { bindExtraInput } from "./extra-input.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface SideStoryReaderData {
  readonly storyId: string;
}

/** As a one-off intro's camera: each move reads as one. */
const PAN_MS = 600;

export class SideStoryReaderScene extends Phaser.Scene {
  #story: SideStory | null = null;
  #steps: readonly ResolvedComicBeat[] = [];
  #current = 0;
  #panFrom: ComicBeat["panel"] | null = null;
  #panProgress = 1;
  #panTween: Phaser.Tweens.Tween | null = null;
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  /** The chrome, one Lit panel over the canvas; made on the first draw and kept. */
  #region: DomRegion<McSheet> | null = null;
  #actions = new Map<string, () => void>();
  /** The comic picture's Phaser objects, drawn again on their own while the camera pans. */
  #pictureObjects: Phaser.GameObjects.GameObject[] = [];
  #readingRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #view: { readonly step: ComicReaderStepView } | null = null;

  constructor() {
    super(SCENES.sideStoryReader);
  }

  init(data: SideStoryReaderData): void {
    this.#story = sideStoryFor(data.storyId);
    const pages = this.#story?.pages ?? [];
    this.#steps = resolveComicBeats(
      pages,
      pages.flatMap((page) => page.beats.map((_, beatIndex) => ({ page: page.file, beatIndex }))),
    );
    this.#current = 0;
    this.#panFrom = null;
    this.#panProgress = 1;
    this.#panTween = null;
    this.#route = null;
    this.#region = null;
  }

  create(): void {
    // A new route each visit: the scene instance is reused, and its key and pad bindings die with every shutdown.
    this.#route = null;
    if (!this.#story || this.#steps.length === 0) {
      this.#leave();
      return;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    this.scale.on("resize", this.#draw, this);
    const offLanguage = onLanguageChange(() => this.#draw());
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    const onArrow = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.#advance();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.#back();
      }
    };
    this.input.keyboard?.on("keydown", onArrow);
    // The D-pad pages as the arrows do.
    bindExtraInput(this, {
      intents: {
        right: () => {
          this.#advance();
        },
        left: () => {
          this.#back();
        },
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#draw, this);
      offLanguage();
      this.input.keyboard?.off("keydown", onArrow);
      this.#panTween?.stop();
      this.#glyphs.dispose();
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
    });
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.#draw());
    fadeScreenIn(this);
  }

  #leave(): void {
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.extras, { tab: "side" } satisfies ExtrasSceneData);
  }

  #advance(): void {
    if (this.#current >= this.#steps.length - 1) {
      this.#leave();
      return;
    }
    this.#step(nextComicBeat(this.#current, this.#steps.length));
  }

  #back(): void {
    if (this.#current === 0) return;
    this.#step(prevComicBeat(this.#current));
  }

  /** Moves to beat `next`: a pan within a page, a cut when the page turns (a panel of one page means nothing on another). */
  #step(next: number): void {
    const from = this.#steps[this.#current]!;
    this.#current = next;
    this.#panTween?.stop();
    this.#panTween = null;
    if (appSession().settings.reducedMotion || from.page.file !== this.#steps[next]!.page.file) {
      this.#panFrom = null;
      this.#panProgress = 1;
      this.#draw();
      return;
    }
    this.#panFrom = from.beat.panel;
    this.#panProgress = 0;
    const state = { t: 0 };
    this.#panTween = this.tweens.add({
      targets: state,
      t: 1,
      duration: PAN_MS,
      ease: "Sine.easeInOut",
      // Only the picture moves: the panel around it is not rebuilt every frame.
      onUpdate: () => {
        this.#panProgress = state.t;
        this.#drawPicture();
      },
      onComplete: () => {
        this.#panFrom = null;
        this.#panTween = null;
        this.#drawPicture();
      },
    });
    this.#draw();
  }

  /** The comic picture in the reading area (Phaser, shown through the panel's hole), over the ink ground. */
  #drawPicture(): void {
    const story = this.#story;
    const view = this.#view;
    if (!story || !view || !this.sys.isActive()) return;
    for (const object of this.#pictureObjects) object.destroy();
    const before = new Set(this.children.list);
    const panning = this.#panFrom !== null && this.#panProgress < 1;
    const tween: ComicReaderTween | undefined = panning
      ? { fromPanel: this.#panFrom!, progress: this.#panProgress }
      : undefined;
    drawComicReaderPicture(
      this,
      this.#readingRect,
      sideStoryPageArt(SIDE_STORY_ART, story.id, view.step.page.file),
      view.step,
      () => this.#drawPicture(),
      tween,
    );
    this.#pictureObjects = this.children.list.filter((object) => !before.has(object));
  }

  #draw(): void {
    if (!this.sys.isActive()) return;
    const story = this.#story;
    if (!story) return;
    destroyChildren(this);
    this.#pictureObjects = [];
    this.#actions = new Map();
    this.#glyphs.reset();

    const { width, height, phone } = campaignFrame(this);
    const view = comicReaderViewOf(this.#steps, this.#current, []);
    this.#view = view;
    const stops = new Map<string, FocusStop>();
    // Dev e2e hook (never referenced by product code): which beat of how many, and on which page.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcSideStoryDebug?: unknown }).__mcSideStoryDebug = {
        beat: () => this.#current,
        beats: () => this.#steps.length,
        page: () => view.step.page.file,
      };
    }
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);

    // The ink ground under the panel too: the chrome buttons' holes and the picture's hole show the canvas.
    this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0);
    b.box({ x: 0, y: 0, width, height }, { fill: surface.ink.hex });

    // Header: the story's title and its credit, with CLOSE.
    const headerPad = phone ? 16 : 24;
    const closeRect: Rect = { x: width - headerPad - (phone ? 78 : 96), y: 14, width: phone ? 78 : 96, height: 30 };
    this.#glyphs.button(b, {
      key: "close",
      rect: closeRect,
      label: t("sideStory.close"),
      look: "onInk",
      type: typeRole.label,
      ids: ["pause"],
      ground: "ink",
    });
    this.#actions.set("close", () => this.#leave());
    stops.set("close", { rect: closeRect, activate: () => this.#leave() });
    b.text(headerPad, 14, t("sideStory.label"), typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.label,
    });
    const titleSize = phone ? 22 : 30;
    const title = b.text(headerPad, 26, story.title.toUpperCase(), typeRole.barTitle, {
      size: titleSize,
      color: surface.paper.hex,
      fitWidth: closeRect.x - headerPad - 12,
    });
    const creditSize = phone ? 10 : 12;
    b.text(headerPad, 26 + title.height + 4, story.credit, typeRole.body, {
      size: creditSize,
      color: surface.paper.hex,
      alpha: ink.label,
      fitWidth: width - headerPad * 2,
    });
    const headerBottom =
      26 + title.height + 4 + b.measure(story.credit, typeRole.body, { size: creditSize }).height + 10;

    const actionBarHeight = phone ? 68 : 88;
    const dotsHeight = 22;
    this.#readingRect = {
      x: 0,
      y: headerBottom,
      width,
      height: Math.max(0, height - actionBarHeight - dotsHeight - headerBottom),
    };

    // "PAGE 2 · PANEL 3", or "PAGE 2 · FULL PAGE" on the beat that pulls back to the whole page.
    const { page, panel } = view.step;
    const wholePage = panel.x === 0 && panel.y === 0 && panel.w === page.width && panel.h === page.height;
    const label = /PAGE (\d+) · PANEL (\d+)/.exec(view.step.pageLabel);
    const where = label
      ? t(wholePage ? "sideStory.fullPage" : "sideStory.panel", { page: label[1]!, panel: label[2]! })
      : view.step.pageLabel;
    b.text(width / 2, height - actionBarHeight - dotsHeight / 2, where, typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.label,
      origin: [0.5, 0.5],
    });

    const barY = height - actionBarHeight;
    b.box({ x: 0, y: barY, width, height: actionBarHeight }, { fill: surface.ink.hex });
    const ctaPad = phone ? 12 : 16;
    const ctaHeight = phone ? 52 : 62;
    const ctaY = barY + (actionBarHeight - ctaHeight) / 2;
    const hasBack = !view.isFirst;
    const backWidth = hasBack ? (phone ? 64 : 110) : 0;
    const backGap = hasBack ? 10 : 0;
    const ctaWidth = phone
      ? width - ctaPad * 2 - backWidth - backGap
      : Math.min(425, width - ctaPad * 2 - backWidth - backGap);
    const ctaRect: Rect = { x: width - ctaPad - ctaWidth, y: ctaY, width: ctaWidth, height: ctaHeight };
    this.#glyphs.button(b, {
      key: "next",
      rect: ctaRect,
      label: view.isLast ? t("sideStory.done") : t("sideStory.next"),
      look: "primary",
      type: typeRole.barTitle,
      ids: ["activate"],
      ground: "ink",
    });
    this.#actions.set("next", () => this.#advance());
    stops.set("next", { rect: ctaRect, activate: () => this.#advance() });
    if (hasBack) {
      const backRect: Rect = { x: ctaPad, y: ctaY, width: backWidth, height: ctaHeight };
      b.button({ key: "back", rect: backRect, label: t("sideStory.back"), look: "onInk", type: typeRole.label });
      this.#actions.set("back", () => this.#back());
      stops.set("back", { rect: backRect, activate: () => this.#back() });
    }

    this.#mount(width, height, b);

    // The picture, then a tap on it advances too (the panel leaves a hole there, so the press reaches this zone).
    this.#drawPicture();
    const tapZone = this.add
      .zone(0, this.#readingRect.y, width, this.#readingRect.height)
      .setOrigin(0, 0)
      .setInteractive();
    onTap(tapZone, () => this.#advance(), "side-story:picture");

    // B, Start and View close the story (as CLOSE does); A with nothing focused turns the page.
    this.#route =
      this.#route ??
      new FocusRoute(this, {
        ring: domFocusRing,
        onCancel: () => this.#leave(),
        onPause: () => this.#leave(),
        onView: () => this.#leave(),
        primary: () => "next",
      });
    this.#route.set(hasBack ? ["back", "next", "close"] : ["next", "close"], stops);
  }

  /** Hands the built parts to the panel (made once) and renders them now. */
  #mount(width: number, height: number, builder: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    // The comic picture is drawn in the canvas: left out of the panel to be seen through it.
    region.setHoles(() => [this.#readingRect]);
    region.element.nodes = builder.nodes;
    renderNow(region.element);
  }
}
