/**
 * The side-story reader: an earned side story (`content/side-stories.ts`) read beat by beat in the guided comic reader
 * (`ui/comic-reader.ts`), the way a one-off scenario's intro reads its page (`scenes/scenario-intro.ts`). Every page is
 * Marvel's own lettered page, so the camera frames one panel at a time, panning from one to the next across a page, and
 * each page ends on the whole page before the next one cuts in.
 *
 * Reached from Extras > Side Stories; leaving (the last beat's "DONE", CLOSE, or Escape) goes back to that tab.
 *
 * **The chrome is one page element**, `mc-side-story-page` (`views/side-story/`): the header (SIDE STORY, the title and
 * credit, CLOSE with its Start glyph), the "PAGE 2 · PANEL 3" line and the action bar (BACK, NEXT / DONE with its glyph).
 * The comic picture itself stays Phaser (its animated camera pan, panel spotlight and masks) and shows through a hole at
 * the page's reading area, redrawn on its own while the pan tweens so the page is not rebuilt every frame.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/side-story/mc-side-story-page/mc-side-story-page.js";
import { SIDE_STORY_ART, sideStoryPageArt } from "../art/side-stories-art.js";
import type { ComicBeat } from "../campaign/story.js";
import { sideStoryFor, type SideStory } from "../content/side-stories.js";
import { appSession } from "../session.js";
import { surface } from "../tokens.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { drawComicReaderPicture, type ComicReaderTween } from "../ui/comic-reader.js";
import { onTap } from "../ui/tap.js";
import { cssOf } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import {
  comicReaderViewOf,
  nextComicBeat,
  prevComicBeat,
  resolveComicBeats,
  type ResolvedComicBeat,
} from "../view/comic-reader-model.js";
import type { Rect } from "../view/layout.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { settleElements } from "../dom/element-settle.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import type { SideStoryEventDetail } from "../components/side-story/shared/side-story-events.types.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import type { ExtrasSceneData } from "./extras.js";
import { bindExtraInput } from "./extra-input.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface SideStoryReaderData {
  readonly storyId: string;
}

/** As a one-off intro's camera: each move reads as one. */
const PAN_MS = 600;
/** The heights the glyphs hung on CLOSE and NEXT are drawn for. */
const CLOSE_HEIGHT = 30;

type Page = MountedElement<HTMLElementTagNameMap["mc-side-story-page"]>;

export class SideStoryReaderScene extends Phaser.Scene {
  #story: SideStory | null = null;
  #steps: readonly ResolvedComicBeat[] = [];
  #current = 0;
  #panFrom: ComicBeat["panel"] | null = null;
  #panProgress = 1;
  #panTween: Phaser.Tweens.Tween | null = null;
  #route: FocusRoute | null = null;
  #glyphs!: ControlGlyphs;
  #page: Page | null = null;
  #unbind: (() => void) | null = null;
  /** The comic picture's Phaser objects, drawn again on their own while the camera pans. */
  #pictureObjects: Phaser.GameObjects.GameObject[] = [];
  #tapZone: Phaser.GameObjects.Zone | null = null;
  #readingRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #view: ReturnType<typeof comicReaderViewOf> | null = null;
  #drawn = 0;
  #leaving = false;
  /** Between `create` and shutdown (not `sys.isActive()`, which is still false while `create` itself draws). */
  #alive = false;

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
    this.#page = null;
    this.#tapZone = null;
    this.#pictureObjects = [];
    this.#leaving = false;
  }

  create(): void {
    this.#route = null;
    this.#alive = true;
    if (!this.#story || this.#steps.length === 0) {
      this.#leave();
      return;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    this.scale.on("resize", this.#compose, this);
    const offLanguage = onLanguageChange(() => this.#compose());
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
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
      this.#alive = false;
      this.scale.off("resize", this.#compose, this);
      offLanguage();
      this.input.keyboard?.off("keydown", onArrow);
      this.#panTween?.stop();
      this.#unbind?.();
      this.#unbind = null;
      this.#glyphs.dispose();
      this.#page = null;
      this.#tapZone = null;
    });
    this.#mount();
    // B, Start and View close the story (as CLOSE does); A with nothing focused turns the page.
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#leave(),
      onPause: () => this.#leave(),
      onView: () => this.#leave(),
      primary: () => "next",
    });
    this.#compose();
    fadeScreenIn(this);
  }

  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-side-story-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    mounted.element.addEventListener("mc-side-story", (event) => this.#heard(event.detail));
    this.#unbind = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key));
    // The comic picture is drawn in the canvas: the reading area is left out of the page to be seen through it.
    mounted.region.setHoles(() => [this.#readingRect]);
  }

  #heard(detail: SideStoryEventDetail): void {
    if (this.#leaving) return;
    if (detail.type === "close") this.#leave();
    else if (detail.type === "next") this.#advance();
    else this.#back();
  }

  #leave(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.extras, { tab: "side" } satisfies ExtrasSceneData);
  }

  #advance(): void {
    if (this.#leaving) return;
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
      this.#compose();
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
      // Only the picture moves: the page around it is not rebuilt every frame.
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
    this.#compose();
  }

  /** The comic picture in the reading area (Phaser, shown through the page's hole), over the ink ground. */
  #drawPicture(): void {
    const story = this.#story;
    const view = this.#view;
    if (!story || !view || !this.#alive || this.#readingRect.width === 0) return;
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
    this.#pictureObjects = this.children.list.filter((object) => !before.has(object) && object !== this.#tapZone);
  }

  /** Sets the page from the beat, then, once it has rendered, places the picture and hands the route its stops. */
  #compose(): void {
    const mounted = this.#page;
    const story = this.#story;
    if (!this.#alive || this.#leaving || !mounted || !story) return;
    const { width, height, phone } = campaignFrame(this);
    const view = comicReaderViewOf(this.#steps, this.#current, []);
    this.#view = view;
    // Dev e2e hook (never referenced by product code): which beat of how many, and on which page.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcSideStoryDebug?: unknown }).__mcSideStoryDebug = {
        beat: () => this.#current,
        beats: () => this.#steps.length,
        page: () => view.step.page.file,
      };
    }
    // "PAGE 2 · PANEL 3", or "PAGE 2 · FULL PAGE" on the beat that pulls back to the whole page.
    const { page, panel } = view.step;
    const wholePage = panel.x === 0 && panel.y === 0 && panel.w === page.width && panel.h === page.height;
    const label = /PAGE (\d+) · PANEL (\d+)/.exec(view.step.pageLabel);
    const where = label
      ? t(wholePage ? "sideStory.fullPage" : "sideStory.panel", { page: label[1]!, panel: label[2]! })
      : view.step.pageLabel;
    this.#glyphs.reset();
    const closeGlyph = hintGlyphOf(this.#glyphs.glyph("close", ["pause"], "ink", CLOSE_HEIGHT));
    const nextGlyph = hintGlyphOf(this.#glyphs.glyph("next", ["activate"], "ink", phone ? 52 : 62));
    this.#glyphs.settled();
    mounted.region.setRect({ x: 0, y: 0, width, height });
    mounted.element.model = {
      compact: phone,
      header: {
        label: t("sideStory.label"),
        title: story.title.toUpperCase(),
        credit: story.credit,
        closeLabel: t("sideStory.close"),
        closeGlyph,
      },
      where,
      actions: {
        hasBack: !view.isFirst,
        backLabel: t("sideStory.back"),
        nextLabel: view.isLast ? t("sideStory.done") : t("sideStory.next"),
        nextGlyph,
      },
    };
    const draw = ++this.#drawn;
    void settleElements(mounted.element).then(() => draw === this.#drawn && this.#wire(mounted));
  }

  #wire({ element, region }: Page): void {
    if (!this.#alive || this.#leaving) return;
    const reading = element.readingArea;
    if (reading) {
      this.#readingRect = region.rectOf(reading);
      this.#placeTapZone();
    }
    this.#drawPicture();
    const stops = focusStopsOf(element, (target) => region.rectOf(target));
    this.#route?.set(this.#view?.isFirst ? ["next", "close"] : ["back", "next", "close"], stops);
  }

  /** A tap on the picture advances too (the page leaves a hole there, so the press reaches this zone). */
  #placeTapZone(): void {
    const { x, y, width, height } = this.#readingRect;
    if (!this.#tapZone) {
      this.#tapZone = this.add.zone(x, y, width, height).setOrigin(0, 0).setInteractive();
      onTap(this.#tapZone, () => this.#advance(), "side-story:picture");
      return;
    }
    this.#tapZone.setPosition(x, y).setSize(width, height);
  }
}
