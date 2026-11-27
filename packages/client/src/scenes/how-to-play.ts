/**
 * "How to play" (guided mode G6c part 1, `docs/guided-mode.md` §4): the learning hub Title's menu, Settings' "Play
 * the tutorial", the round debrief's "Replay a lesson", and the aspect chips' own "Aspects ▸" all open.
 * `view/how-to-play-model.ts`'s own header has the content/layout split this scene draws.
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
 * **One Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`, as `scenes/pause.ts` and `scenes/rules.ts`
 * are): the ink header (× and title, with its Cancel glyph, `dom/sheet-glyphs.ts`) and the scrolling body, laid out at
 * the rects `view/how-to-play-model.ts` gives, scrolled natively. The scene keeps the focus route (its ring drawn in
 * the DOM, `dom/dom-ring.ts`), navigation and the guide-prefs subscription.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { dotGrid, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { isDesktopType } from "../ui/desktop-type.js";
import type { Rect } from "../view/layout.js";
import {
  continueLearningLesson,
  howToPlayContentLayout,
  howToPlayHeaderLayout,
  howToPlayModules,
  type AspectRowInfo,
  type BoxRowInfo,
  type HowToPlayModules,
  type LessonRowInfo,
} from "../view/how-to-play-model.js";
import { guidePrefs, onGuidePrefsChange } from "../guide/guide-store.js";
import { startTutorialGame } from "../guide/start-tutorial.js";
import type { TutorialLessonId } from "../guide/tutorial-checkpoints.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { HowToWinSceneData } from "./how-to-win.js";
import type { AspectLessonSceneData } from "./aspect-lesson.js";
import type { RulesSceneData } from "./rules.js";
import { openBoxPages, type NewInBoxSceneData } from "./new-in-box.js";

const TITLE_TYPE: TypeSpec = typeRole.barTitle;
const SECTION_LABEL_TYPE: TypeSpec = typeRole.label;
const ROW_TITLE_TYPE: TypeSpec = typeRole.rowTitle;
const ROW_DETAIL_TYPE: TypeSpec = typeRole.body;
const STAMP_TYPE: TypeSpec = { ...typeRole.label, size: 10 };
const INDEX_TYPE: TypeSpec = { ...typeRole.barTitle, size: 18 };
/** The scrolling body's key in the panel. */
const LIST = "list";

export class HowToPlayScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #starting = false;
  #glyphs!: SheetGlyphs;
  #unsubscribePrefs: (() => void) | null = null;
  /** The screen, one Lit panel over the canvas; made on the first draw and kept, so the body's scroll stays. */
  #region: DomRegion<McSheet> | null = null;
  #b!: SheetBuilder;
  /** What each key in the panel does when tapped, this draw. */
  #actions = new Map<string, () => void>();
  /** Where the body was scrolled to, kept across a restart of the screen (coming back from a lesson page). */
  #scrollTop = 0;
  /** The viewport the body scrolls in, for the dev hook and the stops' `view`. */
  #viewport: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor() {
    super(SCENES.howToPlay);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#starting = false;
    this.#region = null;
    this.scale.on("resize", this.#rebuild, this);
    this.#unsubscribePrefs = onGuidePrefsChange(() => this.#rebuild());
    const offLanguage = onLanguageChange(() => this.#rebuild());
    this.#glyphs = new SheetGlyphs(this, () => this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.#unsubscribePrefs?.();
      this.#unsubscribePrefs = null;
      offLanguage();
      this.#scrollTop = this.#scroller()?.scrollTop ?? this.#scrollTop;
      this.#glyphs.dispose();
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
    });
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
    this.#rebuild();
    fadeScreenIn(this);
  }

  #scroller(): HTMLElement | null {
    return this.#region?.element.elementOf(LIST) ?? null;
  }

  /** A press on a row or the button: what the key does. */
  #press(key: string, action: () => void): void {
    this.#actions.set(key, action);
  }

  #rebuild(): void {
    destroyChildren(this);
    this.#actions = new Map();
    this.#glyphs.reset();

    const { width, height } = this.scale.gameSize;
    const modules = howToPlayModules(guidePrefs(), openBoxPages());
    const header = howToPlayHeaderLayout(width, height);
    const content = howToPlayContentLayout(width, height, modules);
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    this.#b = b;

    const full: Rect = { x: 0, y: 0, width, height };
    b.box(full, { fill: surface.paper.hex });
    const bodyTop = header.header.height;
    b.dots(
      { x: 0, y: bodyTop, width, height: height - bodyTop },
      "paper",
      dotGrid.onPaper.spacing,
      dotGrid.onPaper.radius,
      dotGrid.onPaper.alpha,
    );

    // The header band under the panel too: the chrome buttons' holes in the panel (the dark mode toggle) show the canvas.
    this.add.rectangle(0, 0, width, bodyTop, surface.ink.hex).setOrigin(0, 0);
    const stops = new Map<string, FocusStop>();
    this.#drawHeader(header);
    stops.set("close", { rect: header.close, activate: () => this.#leave() });

    const viewport: Rect = { x: 0, y: bodyTop, width, height: height - bodyTop };
    this.#viewport = viewport;
    b.scroll(LIST, viewport, content.totalHeight, (inner) => {
      this.#b = inner;
      inner.text(content.basicsLabel.x, content.basicsLabel.y, t("howToPlay.basics"), SECTION_LABEL_TYPE, {
        color: surface.ink.hex,
        alpha: ink.secondary,
      });
      modules.lessons.forEach((lesson, i) => {
        const rowRect = content.lessonRows[i]!;
        this.#drawLessonRow(rowRect, lesson);
        this.#row(`lesson:${lesson.id}`, rowRect, () => void this.#openLesson(lesson), stops);
      });

      inner.text(content.aspectsLabel.x, content.aspectsLabel.y, t("howToPlay.aspects"), SECTION_LABEL_TYPE, {
        color: surface.ink.hex,
        alpha: ink.secondary,
      });
      modules.aspects.forEach((aspectRow, i) => {
        const rowRect = content.aspectRows[i]!;
        this.#drawAspectRow(rowRect, aspectRow);
        this.#row(`aspect:${aspectRow.aspect}`, rowRect, () => this.#openAspectLesson(aspectRow), stops);
      });

      inner.text(content.referenceLabel.x, content.referenceLabel.y, t("howToPlay.reference"), SECTION_LABEL_TYPE, {
        color: surface.ink.hex,
        alpha: ink.secondary,
      });
      this.#drawReferenceRow(content.referenceRow);
      this.#row("reference", content.referenceRow, () => this.#openReference(), stops);

      if (content.boxesLabel) {
        inner.text(content.boxesLabel.x, content.boxesLabel.y, t("howToPlay.newInBox"), SECTION_LABEL_TYPE, {
          color: surface.ink.hex,
          alpha: ink.secondary,
        });
      }
      modules.boxes.forEach((boxRow, i) => {
        const rowRect = content.boxRows[i]!;
        this.#drawBoxRow(rowRect, boxRow);
        this.#row(`box:${boxRow.id}`, rowRect, () => this.#openBoxPage(boxRow), stops);
      });

      inner.button({
        key: "continue-learning",
        rect: content.continueLearning,
        label: this.#starting ? t("howToPlay.suitingUp") : this.#continueLabel(modules),
        look: "primary",
        type: typeRole.barTitle,
        ...(this.#starting ? { disabled: true as const } : {}),
      });
      this.#press("continue-learning", () => void this.#continueLearning(modules));
      stops.set(
        "continue-learning",
        this.#bodyStop("continue-learning", () => void this.#continueLearning(modules)),
      );
    });
    this.#b = b;
    this.#mount(width, height, b);

    // Dev e2e hook: each row's rect on screen right now (scroll applied), so a script can check the columns line up
    // and click a row that is in view.
    if (import.meta.env.DEV) {
      const onScreen = (rect: Rect): Rect => ({
        ...rect,
        y: viewport.y + rect.y - (this.#scroller()?.scrollTop ?? 0),
      });
      (window as unknown as { __mcHowToPlayDebug?: unknown }).__mcHowToPlayDebug = {
        viewport: () => viewport,
        lessons: () => modules.lessons.map((l, i) => ({ id: l.id, ...onScreen(content.lessonRows[i]!) })),
        aspects: () => modules.aspects.map((a, i) => ({ id: a.aspect, ...onScreen(content.aspectRows[i]!) })),
        reference: () => onScreen(content.referenceRow),
        boxes: () => modules.boxes.map((bx, i) => ({ id: bx.id, title: bx.title, ...onScreen(content.boxRows[i]!) })),
      };
    }

    this.#route?.set(
      [
        "close",
        ...modules.lessons.map((l) => `lesson:${l.id}`),
        ...modules.aspects.map((a) => `aspect:${a.aspect}`),
        "reference",
        ...modules.boxes.map((bx) => `box:${bx.id}`),
        "continue-learning",
      ],
      stops,
    );
  }

  /** Hands the built parts to the panel (made once, so the body's scroll survives a redraw) and renders them now. */
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
    const fresh = !region.element.isConnected || region.element.nodes.length === 0;
    region.element.nodes = builder.nodes;
    renderNow(region.element);
    // A new panel (the screen opened again) reads from where it was left.
    if (fresh) {
      const scroller = this.#scroller();
      if (scroller) scroller.scrollTop = this.#scrollTop;
    }
  }

  /** A row: its tap area over `rect` (content space), its action, and its focus stop. */
  #row(key: string, rect: Rect, activate: () => void, stops: Map<string, FocusStop>): void {
    this.#b.tap(key, rect);
    this.#press(key, activate);
    stops.set(key, this.#bodyStop(key, activate));
  }

  /** A stop inside the scrolling body: its box is read off the panel, so it follows the scroll, and taking focus scrolls it into view. */
  #bodyStop(key: string, activate: () => void): FocusStop {
    const region = (): DomRegion<McSheet> | null => this.#region;
    const viewport = this.#viewport;
    return {
      rect: () => {
        const found = region()?.element.elementOf(key);
        return found ? region()!.rectOf(found) : viewport;
      },
      view: () => {
        const found = region()?.element.elementOf(LIST);
        return found ? region()!.rectOf(found) : viewport;
      },
      activate,
      ensureVisible: () => region()?.element.elementOf(key)?.scrollIntoView({ block: "nearest" }),
    };
  }

  #continueLabel(modules: HowToPlayModules): string {
    return modules.recommendedLessonIndex === null ? t("howToPlay.playAgain") : t("howToPlay.continue");
  }

  #drawHeader(header: ReturnType<typeof howToPlayHeaderLayout>): void {
    const b = this.#b;
    b.box(header.header, { fill: surface.ink.hex });
    b.text(header.close.x + header.close.width / 2, header.close.y + header.close.height / 2, "×", typeRole.barTitle, {
      size: 26,
      color: surface.paper.hex,
      origin: [0.5, 0.5],
    });
    b.tap("close", header.close);
    this.#press("close", () => this.#leave());

    const title = b.text(header.title.x, header.header.height / 2, t("title.howToPlay"), TITLE_TYPE, {
      size: 22,
      color: surface.paper.hex,
      origin: [0, 0.5],
    });
    // The close is a drawn ×, not a button: its Cancel glyph follows the title.
    this.#glyphs.hint(b, {
      key: "close",
      x: header.title.x + title.width + 14,
      y: header.header.y + header.header.height / 2,
      ids: ["cancel"],
      height: 18,
      ground: "ink",
    });
  }

  /** A card-fill row with a 1.5px (or `weight`) outline inside its edge, as the rows have always been drawn. */
  #rowCard(rect: Rect, weight: number, line: number): void {
    const b = this.#b;
    b.box(rect, { fill: surface.card.hex });
    b.box(
      { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 },
      { stroke: line, strokeWidth: weight },
    );
  }

  /** A lesson row: index badge, title, and a done ✓ / yellow "NEXT" stamp / quiet "▸" — every lesson is always tappable, whatever its own done state (`docs/guided-mode.md` §4 G6c: "a recommended order the player can ignore"). */
  #drawLessonRow(rect: Rect, lesson: LessonRowInfo): void {
    const b = this.#b;
    this.#rowCard(rect, lesson.recommended ? 2.5 : 1.5, lesson.recommended ? signal.caution.hex : surface.ink.hex);

    const badgeSize = 32;
    const badgeX = rect.x + 16;
    const badgeY = rect.y + rect.height / 2;
    b.box(
      { x: badgeX, y: badgeY - badgeSize / 2, width: badgeSize, height: badgeSize },
      {
        fill: lesson.done ? surface.ink.hex : surface.parchment.hex,
        stroke: surface.ink.hex,
        strokeWidth: 1.5,
        round: true,
      },
    );
    b.text(badgeX + badgeSize / 2, badgeY, lesson.done ? "✓" : String(lesson.index), INDEX_TYPE, {
      size: 16,
      color: lesson.done ? surface.paper.hex : surface.ink.hex,
      origin: [0.5, 0.5],
    });

    const textLeft = badgeX + badgeSize + 14;
    const statusWidth = 90;
    b.text(textLeft, rect.y + rect.height / 2, lesson.title, ROW_TITLE_TYPE, {
      color: surface.ink.hex,
      origin: [0, 0.5],
      wrapWidth: rect.width - (textLeft - rect.x) - statusWidth - 16,
    });

    if (lesson.done) {
      b.text(rect.x + rect.width - 12, rect.y + rect.height / 2, t("howToPlay.done"), ROW_DETAIL_TYPE, {
        color: surface.ink.hex,
        alpha: ink.secondary,
        origin: [1, 0.5],
      });
    } else if (lesson.recommended) {
      const stampLabel = t("howToPlay.next");
      const stampWidth = b.measure(stampLabel, STAMP_TYPE).width + 16;
      const stampHeight = 20;
      const sx = rect.x + rect.width - stampWidth - 12;
      const sy = rect.y + rect.height / 2 - stampHeight / 2;
      b.box({ x: sx, y: sy, width: stampWidth, height: stampHeight }, { fill: signal.caution.hex });
      b.text(sx + stampWidth / 2, sy + stampHeight / 2, stampLabel, STAMP_TYPE, {
        color: surface.inkOnHue.hex,
        origin: [0.5, 0.5],
      });
    } else {
      this.#chevron(rect);
    }
  }

  /** The quiet "▸" at a row's right edge. */
  #chevron(rect: Rect): void {
    this.#b.text(rect.x + rect.width - 12, rect.y + rect.height / 2, "▸", typeRole.barTitle, {
      size: 18,
      color: surface.ink.hex,
      origin: [1, 0.5],
    });
  }

  /** An aspect row: name, tagline, and a done ✓ / quiet "▸" — every aspect's lesson page is live (G10c), the same
   * always-tappable shape `#drawLessonRow` uses. */
  #drawAspectRow(rect: Rect, aspect: AspectRowInfo): void {
    const b = this.#b;
    this.#rowCard(rect, 1.5, surface.ink.hex);

    const pad = 16;
    // The aspect's own chip stands where the plain name was: its frame color with the name on it, as Seats and Decks show it.
    b.chip(rect.x + pad, rect.y + 12, aspect.aspect, aspect.name, { height: 22, size: 12 });
    b.text(rect.x + pad, rect.y + 38, aspect.tagline, ROW_DETAIL_TYPE, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: rect.width - pad * 2 - 90,
    });

    if (aspect.done) {
      b.text(rect.x + rect.width - 12, rect.y + rect.height / 2, t("howToPlay.done"), ROW_DETAIL_TYPE, {
        color: surface.ink.hex,
        alpha: ink.secondary,
        origin: [1, 0.5],
      });
    } else {
      this.#chevron(rect);
    }
  }

  #drawReferenceRow(rect: Rect): void {
    const b = this.#b;
    this.#rowCard(rect, 1.5, surface.ink.hex);
    const pad = 16;
    b.text(rect.x + pad, rect.y + 12, t("howToPlay.referenceTitle"), ROW_TITLE_TYPE, { color: surface.ink.hex });
    b.text(rect.x + pad, rect.y + 38, t("howToPlay.referenceDetail"), ROW_DETAIL_TYPE, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: rect.width - pad * 2 - 40,
    });
    this.#chevron(rect);
  }

  /** A "New in this box" row: the page's title, its entry/Try-it count, and a quiet "▸". */
  #drawBoxRow(rect: Rect, box: BoxRowInfo): void {
    const b = this.#b;
    this.#rowCard(rect, 1.5, surface.ink.hex);
    const pad = 16;
    b.text(rect.x + pad, rect.y + 12, box.title, ROW_TITLE_TYPE, {
      color: surface.ink.hex,
      wrapWidth: rect.width - pad * 2 - 40,
    });
    b.text(rect.x + pad, rect.y + 38, box.summary, ROW_DETAIL_TYPE, { color: surface.ink.hex, alpha: ink.secondary });
    this.#chevron(rect);
  }

  #openBoxPage(box: BoxRowInfo): void {
    this.scale.off("resize", this.#rebuild, this);
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
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.howToWin, { backTo: "howToPlay" } satisfies HowToWinSceneData);
      return;
    }
    this.#starting = true;
    this.#rebuild();
    await startTutorialGame({ startAtLesson: lesson.id as TutorialLessonId });
    if (!this.sys.isActive()) return;
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.board);
  }

  /** Opens `aspect.aspect`'s lesson page (G10c), returning here on Back/×/Escape. */
  #openAspectLesson(aspect: AspectRowInfo): void {
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.aspectLesson, {
      aspect: aspect.aspect,
      backTo: "howToPlay",
    } satisfies AspectLessonSceneData);
  }

  #openReference(): void {
    this.scene.launch(SCENES.rules, { initialTab: "glossary" } satisfies RulesSceneData);
  }

  #leave(): void {
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.title);
  }
}
