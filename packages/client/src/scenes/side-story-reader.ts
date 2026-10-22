/**
 * The side-story reader: an earned side story (`content/side-stories.ts`) read beat by beat in the guided comic
 * reader (`ui/comic-reader.ts`), the way a one-off scenario's intro reads its page (`scenes/scenario-intro.ts`).
 * Every page is Marvel's own lettered page, so the camera frames one panel at a time, panning from one to the next
 * across a page, and each page ends on the whole page before the next one cuts in.
 *
 * Reached from Extras ▸ Side Stories; leaving (the last beat's "DONE ▸", CLOSE, or Escape) goes back to that tab.
 */
import Phaser from "phaser";
import { SIDE_STORY_ART, sideStoryPageArt } from "../art/side-stories-art.js";
import type { ComicBeat } from "../campaign/story.js";
import { sideStoryFor, type SideStory } from "../content/side-stories.js";
import { appSession } from "../session.js";
import { ink, surface, typeRole } from "../tokens.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { drawComicReaderPicture, type ComicReaderTween } from "../ui/comic-reader.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { onTap } from "../ui/tap.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McButton, fitText, label } from "../ui/widgets.js";
import {
  comicReaderViewOf,
  nextComicBeat,
  prevComicBeat,
  resolveComicBeats,
  type ResolvedComicBeat,
} from "../view/comic-reader-model.js";
import type { Rect } from "../view/layout.js";
import type { ExtrasSceneData } from "./extras.js";
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
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

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
  }

  create(): void {
    if (!this.#story || this.#steps.length === 0) {
      this.#leave();
      return;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    this.scale.on("resize", this.#draw, this);
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#draw, this);
      this.input.keyboard?.off("keydown", onArrow);
      this.#panTween?.stop();
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
      onUpdate: () => {
        this.#panProgress = state.t;
        this.#draw();
      },
      onComplete: () => {
        this.#panFrom = null;
        this.#panTween = null;
        this.#draw();
      },
    });
    this.#draw();
  }

  #draw(): void {
    if (!this.sys.isActive()) return;
    const story = this.#story;
    if (!story) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height, phone } = campaignFrame(this);
    const view = comicReaderViewOf(this.#steps, this.#current, []);
    const stops = new Map<string, FocusStop>();
    // Dev e2e hook (never referenced by product code): which beat of how many, and on which page.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcSideStoryDebug?: unknown }).__mcSideStoryDebug = {
        beat: () => this.#current,
        beats: () => this.#steps.length,
        page: () => view.step.page.file,
      };
    }

    this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0);

    // Header: the story's title and its credit, with CLOSE.
    const headerPad = phone ? 16 : 24;
    const closeRect: Rect = { x: width - headerPad - (phone ? 78 : 96), y: 14, width: phone ? 78 : 96, height: 30 };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "CLOSE ✕",
        type: typeRole.label,
        rect: closeRect,
        onClick: () => this.#leave(),
      }),
    );
    stops.set("close", { rect: closeRect, activate: () => this.#leave() });
    label(this, headerPad, 14, "SIDE STORY", typeRole.label, surface.paper.hex, ink.label);
    const title = this.add
      .text(
        headerPad,
        26,
        story.title.toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: phone ? 22 : 30 }, surface.paper.hex),
      )
      .setOrigin(0, 0);
    fitText(title, closeRect.x - headerPad - 12, phone ? 22 : 30);
    const credit = this.add
      .text(headerPad, title.y + title.height + 4, story.credit, textStyle(typeRole.body, surface.paper.hex, ink.label))
      .setFontSize(phone ? 10 : 12)
      .setOrigin(0, 0);
    fitText(credit, width - headerPad * 2, phone ? 10 : 12);
    const headerBottom = credit.y + credit.height + 10;

    const actionBarHeight = phone ? 68 : 88;
    const dotsHeight = 22;
    const readingRect: Rect = {
      x: 0,
      y: headerBottom,
      width,
      height: Math.max(0, height - actionBarHeight - dotsHeight - headerBottom),
    };
    const panning = this.#panFrom !== null && this.#panProgress < 1;
    const tween: ComicReaderTween | undefined = panning
      ? { fromPanel: this.#panFrom!, progress: this.#panProgress }
      : undefined;
    drawComicReaderPicture(
      this,
      readingRect,
      sideStoryPageArt(SIDE_STORY_ART, story.id, view.step.page.file),
      view.step,
      () => this.#draw(),
      tween,
    );

    // "PAGE 2 · PANEL 3", or "PAGE 2 · FULL PAGE" on the beat that pulls back to the whole page.
    const { page, panel } = view.step;
    const wholePage = panel.x === 0 && panel.y === 0 && panel.w === page.width && panel.h === page.height;
    const where = wholePage ? view.step.pageLabel.replace(/PANEL \d+/, "FULL PAGE") : view.step.pageLabel;
    this.add
      .text(width / 2, height - actionBarHeight - dotsHeight / 2, where, {
        ...textStyle(typeRole.label, surface.paper.hex, ink.label),
      })
      .setOrigin(0.5);

    const barY = height - actionBarHeight;
    this.add.rectangle(0, barY, width, actionBarHeight, surface.ink.hex).setOrigin(0, 0);
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
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: view.isLast ? "DONE ▸" : "NEXT ▸",
        type: typeRole.barTitle,
        rect: ctaRect,
        onClick: () => this.#advance(),
      }),
    );
    stops.set("next", { rect: ctaRect, activate: () => this.#advance() });
    if (hasBack) {
      const backRect: Rect = { x: ctaPad, y: ctaY, width: backWidth, height: ctaHeight };
      this.#buttons.push(
        new McButton(this, {
          kind: "onInk",
          label: "◂ BACK",
          type: typeRole.label,
          rect: backRect,
          onClick: () => this.#back(),
        }),
      );
      stops.set("back", { rect: backRect, activate: () => this.#back() });
    }

    // Tapping the picture advances too, under the buttons so it never steals their clicks.
    const tapZone = this.add.zone(0, readingRect.y, width, readingRect.height).setOrigin(0, 0).setInteractive();
    onTap(tapZone, () => this.#advance(), "side-story:picture");
    this.children.sendToBack(tapZone);

    this.#route = this.#route ?? new FocusRoute(this, { onCancel: () => this.#leave() });
    this.#route.set(hasBack ? ["back", "next", "close"] : ["next", "close"], stops);
  }
}
