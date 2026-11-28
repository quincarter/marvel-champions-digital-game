/**
 * "How to play" (guided mode G6c part 1, `docs/guided-mode.md` §4): the learning hub Title's menu, Settings' "Play
 * the tutorial", the round debrief's "Replay a lesson", and the aspect chips' own "Aspects ▸" all open.
 * `view/how-to-play-model.ts`'s own header has the content split this scene shows.
 *
 * **THE BASICS**: the tutorial's real five lessons, each showing ✓ done or a yellow "NEXT" stamp on the first one
 * not done. Lesson 1 ("How to win") opens `scenes/how-to-win.ts` with `backTo: "howToPlay"` — that screen already
 * starts the tutorial game. Lessons 2–5 start the tutorial game directly, the same shared `guide/start-
 * tutorial.ts#startTutorialGame` call, passing that lesson's own id as `startAtLesson` (G6c part 2,
 * `guide/tutorial-checkpoints.ts`) so it replays straight to that lesson's start point instead of the top, and go
 * straight to the Board.
 *
 * **ASPECTS**: the four playable aspect rows (`guide/aspects.ts`, Basic and 'Pool skipped per §5.4), each live and
 * tappable to `scenes/aspect-lesson.ts` (G10c) with `backTo: "howToPlay"`, showing a ✓ once
 * `prefs.aspectLessonsDone` includes it.
 *
 * **REFERENCE**: one row, "Rules & glossary", opens `SCENES.rules`.
 *
 * **NEW IN EACH BOX** (guided mode §3.14): a band of rows, one per box page the player has unlocked
 * (`scenes/new-in-box.ts#openBoxPages`), each opening `scenes/new-in-box.ts`. No band at all while no box has a page.
 *
 * A red "Continue learning ▸" primary starts the first lesson not yet done (`continueLearningLesson`), the hub's
 * own forward action — everything else here is optional, in whatever order the player wants to click it.
 *
 * **Modules always run at Full for that run only** (§3 G6c): every path this screen has into a live tutorial game
 * goes through `startTutorialGame`, which sets `guide/guide-store.ts`'s run-only level override before starting —
 * the saved level in `mc-guide` is never touched.
 *
 * Back/×/Escape (§3.10 "every tutorial screen has Back") always return to Title — this hub itself never carries a
 * `backTo`, since it is always where a "How to play"-style flow starts from.
 *
 * The whole screen is one page element, `mc-how-to-play-page` (`views/how-to-play/`), made of section elements
 * (`components/learn/`). This scene only mounts it, sets its properties from the modules above, and handles its one
 * `mc-learn` event. It keeps the focus route (the page's `data-stop` parts, read by `dom/element-stops.ts`, its ring
 * drawn in the DOM, `dom/dom-ring.ts`), navigation and the guide-prefs subscription.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/how-to-play/mc-how-to-play-page/mc-how-to-play-page.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import {
  continueLearningLesson,
  howToPlayFocusOrder,
  howToPlayModules,
  type AspectRowInfo,
  type BoxRowInfo,
  type HowToPlayModules,
  type LessonRowInfo,
} from "../view/how-to-play-model.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { guidePrefs, onGuidePrefsChange } from "../guide/guide-store.js";
import { startTutorialGame } from "../guide/start-tutorial.js";
import type { TutorialLessonId } from "../guide/tutorial-checkpoints.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { settleElements } from "../dom/element-settle.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import type { LearnEventDetail } from "../components/learn/shared/learn-events.types.js";
import type { HowToPlayPageModel } from "../views/how-to-play/mc-how-to-play-page/mc-how-to-play-page.types.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { HowToWinSceneData } from "./how-to-win.js";
import type { AspectLessonSceneData } from "./aspect-lesson.js";
import type { RulesSceneData } from "./rules.js";
import { openBoxPages, type NewInBoxSceneData } from "./new-in-box.js";

type Page = MountedElement<HTMLElementTagNameMap["mc-how-to-play-page"]>;

/** The ink band behind the bar, for the fade (the bar itself is as tall as its rows). */
const BAR_HEIGHT = 64;
/** The height the close's Cancel glyph is drawn for. */
const CLOSE_HINT_HEIGHT = 30;

export class HowToPlayScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #starting = false;
  #alive = false;
  #unsubscribePrefs: (() => void) | null = null;
  #page: Page | null = null;
  #unbind: (() => void) | null = null;
  #glyphs!: ControlGlyphs;
  /** The ink under the bar: the dark mode tab's hole in the panel shows it. */
  #band: Phaser.GameObjects.Rectangle | null = null;
  /** The modules the page shows now, for what a press on a row opens. */
  #modules: HowToPlayModules | null = null;
  /** Where the body was scrolled to, kept across a restart of the screen (coming back from a lesson page). */
  #scrollTop = 0;
  /** The page's focus stops as last read (the dev hook's rects). */
  #stops = new Map<string, FocusStop>();
  #syncing = false;

  constructor() {
    super(SCENES.howToPlay);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#starting = false;
    this.#alive = true;
    this.#page = null;
    this.#band = this.add.rectangle(0, 0, this.scale.gameSize.width, BAR_HEIGHT, surface.ink.hex).setOrigin(0, 0);
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    this.scale.on("resize", this.#compose, this);
    this.#unsubscribePrefs = onGuidePrefsChange(() => this.#compose());
    const offLanguage = onLanguageChange(() => this.#compose());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#compose, this);
      this.#unsubscribePrefs?.();
      this.#unsubscribePrefs = null;
      offLanguage();
      this.#scrollTop = this.#scroller()?.scrollTop ?? this.#scrollTop;
      this.#unbind?.();
      this.#unbind = null;
      this.#glyphs.dispose();
      this.#page = null;
      this.#band = null;
    });
    this.#mount();
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // The Rules reference opens over this hub and owns Escape and the pad until it has closed (it leaves on a motion).
      blocked: () => this.scene.isActive(SCENES.rules),
      onCancel: () => this.#leave(),
      // Start is "forward": it presses Continue learning, the hub's one primary action.
      primary: () => "continue-learning",
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onPage: (direction) => this.#scroller()?.scrollBy({ top: direction * this.scale.gameSize.height * 0.7 }),
    });
    this.#compose();
    // A new panel (the screen opened again) reads from where it was left.
    void this.#settled().then(() => {
      const scroller = this.#scroller();
      if (scroller) scroller.scrollTop = this.#scrollTop;
    });
    fadeScreenIn(this);
  }

  #scroller(): HTMLElement | null {
    return this.#page?.element.scroller ?? null;
  }

  /** Mounts the page and wires what it says. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-how-to-play-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    mounted.element.addEventListener("mc-learn", (event) => this.#heard(event.detail));
    this.#unbind = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key));
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  #heard(detail: LearnEventDetail): void {
    const modules = this.#modules;
    switch (detail.type) {
      case "close":
        return this.#leave();
      case "lesson": {
        const lesson = modules?.lessons.find((l) => l.id === detail.id);
        if (lesson) void this.#openLesson(lesson);
        return;
      }
      case "aspect": {
        const aspect = modules?.aspects.find((a) => a.aspect === detail.aspect);
        if (aspect) this.#openAspectLesson(aspect);
        return;
      }
      case "reference":
        return this.#openReference();
      case "box": {
        const box = modules?.boxes.find((b) => b.id === detail.id);
        if (box) this.#openBoxPage(box);
        return;
      }
      case "continue":
        if (modules) void this.#continueLearning(modules);
        return;
      default:
        return;
    }
  }

  #model(modules: HowToPlayModules): HowToPlayPageModel {
    const title = t("title.howToPlay");
    const done = t("howToPlay.done");
    return {
      header: {
        heading: title,
        closeLabel: t("scenario.back"),
        // The close is a drawn ×, not a button: its Cancel glyph follows the title.
        glyph: this.#glyphs.glyph("close", ["cancel"], "ink", CLOSE_HINT_HEIGHT),
      },
      lessons: {
        heading: t("howToPlay.basics"),
        rows: modules.lessons.map((lesson) => ({
          id: lesson.id,
          index: lesson.index,
          title: lesson.title,
          done: lesson.done,
          recommended: lesson.recommended,
          doneLabel: done,
          nextLabel: t("howToPlay.next"),
        })),
      },
      aspects: {
        heading: t("howToPlay.aspects"),
        rows: modules.aspects.map((aspect) => ({
          aspect: aspect.aspect,
          name: aspect.name,
          tagline: aspect.tagline,
          done: aspect.done,
          doneLabel: done,
        })),
      },
      reference: {
        heading: t("howToPlay.reference"),
        rows: [
          {
            stop: "reference",
            heading: modules.reference.title,
            detail: modules.reference.detail,
            action: { type: "reference" },
          },
        ],
      },
      boxes: {
        heading: t("howToPlay.newInBox"),
        rows: modules.boxes.map((box) => ({
          stop: `box:${box.id}`,
          heading: box.title,
          detail: box.summary,
          action: { type: "box", id: box.id },
        })),
      },
      continue: {
        label: this.#starting
          ? t("howToPlay.suitingUp")
          : modules.recommendedLessonIndex === null
            ? t("howToPlay.playAgain")
            : t("howToPlay.continue"),
        starting: this.#starting,
      },
    };
  }

  /** Sets the page from the modules and the screen's shape. */
  #compose(): void {
    if (!this.#alive || !this.#page) return;
    this.#glyphs.reset();
    const { width, height } = this.scale.gameSize;
    const form = formFactorFor(width, height);
    const wide = form === "desktop" || form === "tabletLandscape";
    const modules = howToPlayModules(guidePrefs(), openBoxPages());
    this.#modules = modules;
    this.#band?.setSize(width, BAR_HEIGHT);
    const { region, element } = this.#page;
    region.setRect({ x: 0, y: 0, width, height });
    element.mode = wide ? "wide" : "narrow";
    element.model = this.#model(modules);
    this.#glyphs.settled();
    this.#queueStops();
    this.#publishDebug(modules);
  }

  /** Resolves once the page and its parts have drawn. */
  async #settled(): Promise<void> {
    if (this.#page) await settleElements(this.#page.element);
  }

  /** Reads the page's stops once it has drawn, its parts included (every row is a level down). */
  #queueStops(): void {
    if (this.#syncing) return;
    this.#syncing = true;
    void this.#settled().then(() => {
      this.#syncing = false;
      if (this.#alive) this.#syncStops();
    });
  }

  #syncStops(): void {
    if (!this.#page || !this.#route || !this.#modules) return;
    const { element, region } = this.#page;
    this.#stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    this.#route.set(howToPlayFocusOrder(this.#modules), this.#stops);
  }

  /** Dev e2e hook (never referenced by product code): each row's rect on screen right now (scroll applied), so a script can click a row that is in view. */
  #publishDebug(modules: HowToPlayModules): void {
    if (!import.meta.env.DEV) return;
    const rectOf = (key: string): Rect => {
      const rect = this.#stops.get(key)?.rect;
      return (typeof rect === "function" ? rect() : rect) ?? { x: 0, y: 0, width: 0, height: 0 };
    };
    const { width, height } = this.scale.gameSize;
    (window as unknown as { __mcHowToPlayDebug?: unknown }).__mcHowToPlayDebug = {
      viewport: () => {
        const scroller = this.#scroller();
        return scroller && this.#page ? this.#page.region.rectOf(scroller) : { x: 0, y: 0, width, height };
      },
      lessons: () => modules.lessons.map((l) => ({ id: l.id, ...rectOf(`lesson:${l.id}`) })),
      aspects: () => modules.aspects.map((a) => ({ id: a.aspect, ...rectOf(`aspect:${a.aspect}`) })),
      reference: () => rectOf("reference"),
      boxes: () => modules.boxes.map((bx) => ({ id: bx.id, title: bx.title, ...rectOf(`box:${bx.id}`) })),
    };
  }

  #openBoxPage(box: BoxRowInfo): void {
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.newInBox, { boxId: box.id } satisfies NewInBoxSceneData);
  }

  async #continueLearning(modules: HowToPlayModules): Promise<void> {
    if (this.#starting) return;
    await this.#openLesson(continueLearningLesson(modules));
  }

  /** Lesson 1 ("how-to-win") opens the pre-game screen; every other lesson starts the tutorial game directly,
   * replayed straight to that lesson's own checkpoint (G6c part 2, this file's header), and jumps to the Board. */
  async #openLesson(lesson: LessonRowInfo): Promise<void> {
    if (this.#starting) return;
    if (lesson.id === "how-to-win") {
      this.scale.off("resize", this.#compose, this);
      goToScreen(this, SCENES.howToWin, { backTo: "howToPlay" } satisfies HowToWinSceneData);
      return;
    }
    this.#starting = true;
    this.#compose();
    await startTutorialGame({ startAtLesson: lesson.id as TutorialLessonId });
    if (!this.sys.isActive()) return;
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.board);
  }

  /** Opens `aspect.aspect`'s lesson page (G10c), returning here on Back/×/Escape. */
  #openAspectLesson(aspect: AspectRowInfo): void {
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.aspectLesson, {
      aspect: aspect.aspect,
      backTo: "howToPlay",
    } satisfies AspectLessonSceneData);
  }

  #openReference(): void {
    this.scene.launch(SCENES.rules, { initialTab: "glossary" } satisfies RulesSceneData);
  }

  #leave(): void {
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.title);
  }
}
