/**
 * "How to play" (guided mode G6c part 1, `docs/guided-mode.md` §4): the learning hub Title's menu, Settings' "Play
 * the tutorial", the round debrief's "Replay a lesson", and the aspect chips' own "Aspects ▸" all open.
 * `view/how-to-play-model.ts`'s own header has the content/layout split this scene draws.
 *
 * **THE BASICS**: the tutorial's real five lessons, each showing ✓ done or a yellow "NEXT" stamp on the first one
 * not done. Lesson 1 ("How to win") opens `scenes/how-to-win.ts` with `backTo: "howToPlay"` — that screen already
 * starts the tutorial game. Lessons 2–5 start the tutorial game directly, the same shared `guide/start-
 * tutorial.ts#startTutorialGame` call, and go straight to the Board. **Part 2 is open**: replaying straight to a
 * later lesson's own start point (`docs/guided-mode.md` §4 G6c's own note) — for now every lesson starts the
 * tutorial from the top, same as lesson 1.
 *
 * **ASPECTS**: the four playable aspect rows (`guide/aspects.ts`, Basic and 'Pool skipped per §5.4), each live and
 * tappable to `scenes/aspect-lesson.ts` (G10c) with `backTo: "howToPlay"`, showing a ✓ once
 * `prefs.aspectLessonsDone` includes it.
 *
 * **REFERENCE**: one row, "Rules & glossary", opens `SCENES.rules`.
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
 */
import Phaser from "phaser";
import { dotGrid, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, label, paintDotGrid } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { Rect } from "../view/layout.js";
import {
  continueLearningLabel,
  continueLearningLesson,
  howToPlayContentLayout,
  howToPlayHeaderLayout,
  howToPlayModules,
  type AspectRowInfo,
  type HowToPlayModules,
  type LessonRowInfo,
} from "../view/how-to-play-model.js";
import { guidePrefs, onGuidePrefsChange } from "../guide/guide-store.js";
import { startTutorialGame } from "../guide/start-tutorial.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { HowToWinSceneData } from "./how-to-win.js";
import type { AspectLessonSceneData } from "./aspect-lesson.js";
import type { RulesSceneData } from "./rules.js";

const TITLE_TYPE: TypeSpec = typeRole.barTitle;
const SECTION_LABEL_TYPE: TypeSpec = typeRole.label;
const ROW_TITLE_TYPE: TypeSpec = typeRole.rowTitle;
const ROW_DETAIL_TYPE: TypeSpec = typeRole.body;
const STAMP_TYPE: TypeSpec = { ...typeRole.label, size: 10 };
const INDEX_TYPE: TypeSpec = { ...typeRole.barTitle, size: 18 };

export class HowToPlayScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #buttons: McButton[] = [];
  #region: McScrollRegion | null = null;
  #scroll = new VariableListScroll();
  #starting = false;
  #unsubscribePrefs: (() => void) | null = null;

  constructor() {
    super(SCENES.howToPlay);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#starting = false;
    this.scale.on("resize", this.#rebuild, this);
    this.#unsubscribePrefs = onGuidePrefsChange(() => this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.#unsubscribePrefs?.();
      this.#unsubscribePrefs = null;
    });
    this.#route = new FocusRoute(this, { onCancel: () => this.#leave() });
    this.#rebuild();
    fadeScreenIn(this);
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#region?.destroy();
    this.#region = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const modules = howToPlayModules(guidePrefs());
    const header = howToPlayHeaderLayout(width, height);
    const content = howToPlayContentLayout(width, height, modules);

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(
      this,
      { x: 0, y: header.header.height, width, height: height - header.header.height },
      "paper",
      dotGrid.onPaper,
    );

    this.#drawHeader(header);

    const viewport: Rect = {
      x: 0,
      y: header.header.height,
      width,
      height: height - header.header.height,
    };
    this.#region = new McScrollRegion(this, { rect: viewport, heights: content.heights, scroll: this.#scroll });
    const container = this.#region.content;
    const toScreen = (rect: Rect): Rect => ({ ...rect, y: viewport.y + rect.y });

    const stops = new Map<string, FocusStop>();
    stops.set("close", { rect: header.close, activate: () => this.#leave() });

    this.#captureInto(container, () => {
      label(
        this,
        content.basicsLabel.x,
        viewport.y + content.basicsLabel.y,
        "THE BASICS",
        SECTION_LABEL_TYPE,
        surface.ink.hex,
        ink.secondary,
      );
    });
    modules.lessons.forEach((lesson, i) => {
      const rowRect = content.lessonRows[i]!;
      const screenRect = toScreen(rowRect);
      this.#captureInto(container, () => this.#drawLessonRow(screenRect, lesson));
      const activate = (): void => void this.#openLesson(lesson);
      const zone = this.add
        .zone(screenRect.x, screenRect.y, screenRect.width, screenRect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", activate);
      container.add(zone);
      stops.set(`lesson:${lesson.id}`, this.#bodyStop(rowRect, content.lessonScrollIndex[i]!, activate));
    });

    this.#captureInto(container, () => {
      label(
        this,
        content.aspectsLabel.x,
        viewport.y + content.aspectsLabel.y,
        "ASPECTS",
        SECTION_LABEL_TYPE,
        surface.ink.hex,
        ink.secondary,
      );
    });
    modules.aspects.forEach((aspectRow, i) => {
      const rowRect = content.aspectRows[i]!;
      const screenRect = toScreen(rowRect);
      this.#captureInto(container, () => this.#drawAspectRow(screenRect, aspectRow));
      const activate = (): void => this.#openAspectLesson(aspectRow);
      const zone = this.add
        .zone(screenRect.x, screenRect.y, screenRect.width, screenRect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", activate);
      container.add(zone);
      stops.set(`aspect:${aspectRow.aspect}`, this.#bodyStop(rowRect, content.aspectScrollIndex[i]!, activate));
    });

    this.#captureInto(container, () => {
      label(
        this,
        content.referenceLabel.x,
        viewport.y + content.referenceLabel.y,
        "REFERENCE",
        SECTION_LABEL_TYPE,
        surface.ink.hex,
        ink.secondary,
      );
    });
    {
      const screenRect = toScreen(content.referenceRow);
      this.#captureInto(container, () => this.#drawReferenceRow(screenRect));
      const activate = (): void => this.#openReference();
      const zone = this.add
        .zone(screenRect.x, screenRect.y, screenRect.width, screenRect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", activate);
      container.add(zone);
      stops.set("reference", this.#bodyStop(content.referenceRow, content.referenceScrollIndex, activate));
    }

    this.#captureInto(container, () => this.#drawContinueLearning(toScreen(content.continueLearning), modules));
    stops.set(
      "continue-learning",
      this.#bodyStop(content.continueLearning, content.continueScrollIndex, () => void this.#continueLearning(modules)),
    );

    this.#route?.set(
      [
        "close",
        ...modules.lessons.map((l) => `lesson:${l.id}`),
        ...modules.aspects.map((a) => `aspect:${a.aspect}`),
        "reference",
        "continue-learning",
      ],
      stops,
    );
  }

  /** Runs `draw`, then reparents everything it just added into `container` — the "eagerly draw, then move into the scrolled/masked layer" trick `McScrollRegion` relies on (its own doc comment), same as `scenes/settings.ts#captureInto`. */
  #captureInto(container: Phaser.GameObjects.Container, draw: () => void): void {
    const before = this.children.list.length;
    draw();
    const added = this.children.list.slice(before);
    if (added.length > 0) container.add(added);
  }

  /** A stop inside the scroll region: its rect tracks the current scroll offset, and taking focus scrolls it into view (`scenes/settings.ts#bodyStop`'s own shape). */
  #bodyStop(rect: Rect, index: number, activate: () => void): FocusStop {
    const header = howToPlayHeaderLayout(this.scale.gameSize.width, this.scale.gameSize.height);
    return {
      rect: () => ({ ...rect, y: header.header.height + rect.y - this.#scroll.offsetPx }),
      activate,
      ensureVisible: () => this.#region?.scrollIntoView(index),
    };
  }

  #drawHeader(header: ReturnType<typeof howToPlayHeaderLayout>): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(0, 0, this.scale.gameSize.width, header.header.height);

    this.add
      .text(header.close.x + header.close.width / 2, header.close.y + header.close.height / 2, "×", {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "26px",
      })
      .setOrigin(0.5);
    const zone = this.add
      .zone(header.close.x, header.close.y, header.close.width, header.close.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => this.#leave());

    this.add
      .text(header.title.x, header.header.height / 2, "HOW TO PLAY", {
        ...textStyle(TITLE_TYPE, surface.paper.hex),
        fontSize: "22px",
      })
      .setOrigin(0, 0.5);
  }

  /** A lesson row: index badge, title, and a done ✓ / yellow "NEXT" stamp / quiet "▸" — every lesson is always tappable, whatever its own done state (`docs/guided-mode.md` §4 G6c: "a recommended order the player can ignore"). */
  #drawLessonRow(rect: Rect, lesson: LessonRowInfo): void {
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(
      lesson.recommended ? 2.5 : 1.5,
      lesson.recommended ? signal.caution.hex : surface.ink.hex,
      1,
    ).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);

    const badgeSize = 32;
    const badgeX = rect.x + 16;
    const badgeY = rect.y + rect.height / 2;
    g.fillStyle(lesson.done ? surface.ink.hex : surface.parchment.hex, 1).fillCircle(
      badgeX + badgeSize / 2,
      badgeY,
      badgeSize / 2,
    );
    g.lineStyle(1.5, surface.ink.hex, 1).strokeCircle(badgeX + badgeSize / 2, badgeY, badgeSize / 2);
    this.add
      .text(badgeX + badgeSize / 2, badgeY, lesson.done ? "✓" : String(lesson.index), {
        ...textStyle(INDEX_TYPE, lesson.done ? surface.paper.hex : surface.ink.hex),
        fontSize: "16px",
      })
      .setOrigin(0.5);

    const textLeft = badgeX + badgeSize + 14;
    const statusWidth = 90;
    this.add
      .text(textLeft, rect.y + rect.height / 2, lesson.title, textStyle(ROW_TITLE_TYPE, surface.ink.hex))
      .setOrigin(0, 0.5)
      .setWordWrapWidth(rect.width - (textLeft - rect.x) - statusWidth - 16);

    const statusX = rect.x + rect.width - statusWidth - 12;
    if (lesson.done) {
      this.add
        .text(
          statusX + statusWidth,
          rect.y + rect.height / 2,
          "✓ Done",
          textStyle(ROW_DETAIL_TYPE, surface.ink.hex, ink.secondary),
        )
        .setOrigin(1, 0.5);
    } else if (lesson.recommended) {
      const stampLabel = this.add.text(0, 0, "NEXT", textStyle(STAMP_TYPE, surface.ink.hex)).setVisible(false);
      const stampWidth = stampLabel.width + 16;
      const stampHeight = 20;
      const sx = rect.x + rect.width - stampWidth - 12;
      const sy = rect.y + rect.height / 2 - stampHeight / 2;
      g.fillStyle(signal.caution.hex, 1).fillRect(sx, sy, stampWidth, stampHeight);
      stampLabel
        .setPosition(sx + stampWidth / 2, sy + stampHeight / 2)
        .setOrigin(0.5)
        .setVisible(true);
    } else {
      this.add
        .text(rect.x + rect.width - 12, rect.y + rect.height / 2, "▸", {
          ...textStyle(typeRole.barTitle, surface.ink.hex),
          fontSize: "18px",
        })
        .setOrigin(1, 0.5);
    }
  }

  /** An aspect row: name, tagline, and a done ✓ / quiet "▸" — every aspect's lesson page is live (G10c), the same
   * always-tappable shape `#drawLessonRow` uses. */
  #drawAspectRow(rect: Rect, aspect: AspectRowInfo): void {
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(1.5, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);

    const pad = 16;
    this.add.text(rect.x + pad, rect.y + 12, aspect.name, textStyle(ROW_TITLE_TYPE, surface.ink.hex));
    this.add
      .text(rect.x + pad, rect.y + 38, aspect.tagline, textStyle(ROW_DETAIL_TYPE, surface.ink.hex, ink.secondary))
      .setWordWrapWidth(rect.width - pad * 2 - 90);

    if (aspect.done) {
      this.add
        .text(
          rect.x + rect.width - 12,
          rect.y + rect.height / 2,
          "✓ Done",
          textStyle(ROW_DETAIL_TYPE, surface.ink.hex, ink.secondary),
        )
        .setOrigin(1, 0.5);
    } else {
      this.add
        .text(rect.x + rect.width - 12, rect.y + rect.height / 2, "▸", {
          ...textStyle(typeRole.barTitle, surface.ink.hex),
          fontSize: "18px",
        })
        .setOrigin(1, 0.5);
    }
  }

  #drawReferenceRow(rect: Rect): void {
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(1.5, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const pad = 16;
    this.add.text(rect.x + pad, rect.y + 12, "Rules & glossary", textStyle(ROW_TITLE_TYPE, surface.ink.hex));
    this.add
      .text(
        rect.x + pad,
        rect.y + 38,
        "Every keyword and the full rules reference, searchable.",
        textStyle(ROW_DETAIL_TYPE, surface.ink.hex, ink.secondary),
      )
      .setWordWrapWidth(rect.width - pad * 2 - 40);
    this.add
      .text(rect.x + rect.width - 12, rect.y + rect.height / 2, "▸", {
        ...textStyle(typeRole.barTitle, surface.ink.hex),
        fontSize: "18px",
      })
      .setOrigin(1, 0.5);
  }

  #drawContinueLearning(rect: Rect, modules: HowToPlayModules): void {
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#starting ? "Suiting up…" : continueLearningLabel(modules),
        type: typeRole.barTitle,
        rect,
        enabled: !this.#starting,
        onClick: () => void this.#continueLearning(modules),
        clip: () => this.#region?.rect ?? null,
        suppressClick: () => this.#region?.isDragSuppressingClick ?? false,
      }),
    );
  }

  async #continueLearning(modules: HowToPlayModules): Promise<void> {
    if (this.#starting) return;
    await this.#openLesson(continueLearningLesson(modules));
  }

  /** Lesson 1 ("how-to-win") opens the pre-game screen; every other lesson starts the tutorial game directly and
   * jumps to the Board (part 2, replaying to that lesson's own start point, is open — see this file's header). */
  async #openLesson(lesson: LessonRowInfo): Promise<void> {
    if (this.#starting) return;
    if (lesson.id === "how-to-win") {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.howToWin, { backTo: "howToPlay" } satisfies HowToWinSceneData);
      return;
    }
    this.#starting = true;
    this.#rebuild();
    await startTutorialGame();
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
