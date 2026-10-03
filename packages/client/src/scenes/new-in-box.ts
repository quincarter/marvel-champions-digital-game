/**
 * "New in this box" (guided mode §3.14, owner request 2026-10-03): one page per box that introduced mechanics,
 * opened from a row in the How to play hub. `view/new-in-box-model.ts` has the content and layout; this scene only
 * draws them.
 *
 * A page lists its box's new glossary entries, grouped as KEYWORDS, HERO MECHANICS and SCENARIO MECHANICS, then its
 * TRY IT lessons. Tapping an entry opens the Rules reference glossary on that entry (the same view the dotted
 * `[[term]]` tooltips open); tapping a lesson starts that Try-it game and hands off to the Board, the way the
 * hub's tutorial lessons do. Back, x and Escape return to the hub.
 *
 * A box that is locked has no page: if the player's unlocks no longer include the box this scene was opened for
 * (a switch turned off in another tab), it returns to the hub rather than draw a page they should not see.
 */
import Phaser from "phaser";
import { dotGrid, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { label, paintDotGrid } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { Rect } from "../view/layout.js";
import {
  boxPageContentLayout,
  boxPageFocusOrder,
  boxPageHeaderLayout,
  boxPages,
  type BoxEntryRow,
  type BoxLessonRow,
  type BoxPage,
} from "../view/new-in-box-model.js";
import { guidePrefs, onGuidePrefsChange } from "../guide/guide-store.js";
import { mechanicLessonDoneKey } from "../guide/mechanic-tryits.js";
import { startMechanicTryItGame } from "../guide/start-mechanic-tryit.js";
import { unlocks } from "../progression/progression.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";

export interface NewInBoxSceneData {
  readonly boxId: BoxPage["id"];
}

const TITLE_TYPE: TypeSpec = typeRole.barTitle;
const SECTION_LABEL_TYPE: TypeSpec = typeRole.label;
const ROW_TITLE_TYPE: TypeSpec = typeRole.rowTitle;
const ROW_DETAIL_TYPE: TypeSpec = typeRole.body;
const ARROW_WIDTH = 64;

/** The pages the player has unlocked right now (`?unlock=all` opens every one). */
export function openBoxPages(): readonly BoxPage[] {
  return boxPages((unlockKey) => unlocks().waveLock(unlockKey) === null);
}

export class NewInBoxScene extends Phaser.Scene {
  #boxId: BoxPage["id"] = "cycle6";
  #route: FocusRoute | null = null;
  #region: McScrollRegion | null = null;
  #scroll = new VariableListScroll();
  #starting = false;
  #unsubscribePrefs: (() => void) | null = null;

  constructor() {
    super(SCENES.newInBox);
  }

  create(data: NewInBoxSceneData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#boxId = data.boxId;
    this.#starting = false;
    this.#scroll.reset();
    this.scale.on("resize", this.#rebuild, this);
    this.#unsubscribePrefs = onGuidePrefsChange(() => this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.#unsubscribePrefs?.();
      this.#unsubscribePrefs = null;
      this.#region?.destroy();
      this.#region = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.rules),
      onCancel: () => this.#leave(),
    });
    if (!this.#page()) {
      this.#leave();
      return;
    }
    this.#rebuild();
    fadeScreenIn(this);
  }

  #page(): BoxPage | undefined {
    return openBoxPages().find((p) => p.id === this.#boxId);
  }

  #rebuild(): void {
    this.#region?.destroy();
    this.#region = null;
    destroyChildren(this);
    const page = this.#page();
    if (!page) return;

    const { width, height } = this.scale.gameSize;
    const header = boxPageHeaderLayout(width, height);
    const content = boxPageContentLayout(width, page);

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(
      this,
      { x: 0, y: header.header.height, width, height: height - header.header.height },
      "paper",
      dotGrid.onPaper,
    );
    this.#drawHeader(header, page);

    const viewport: Rect = { x: 0, y: header.header.height, width, height: height - header.header.height };
    this.#region = new McScrollRegion(this, { rect: viewport, heights: content.heights, scroll: this.#scroll });
    const container = this.#region.content;
    const toScreen = (rect: Rect): Rect => ({ ...rect, y: viewport.y + rect.y });
    const done = guidePrefs().aspectLessonsDone;

    const stops = new Map<string, FocusStop>();
    stops.set("close", { rect: header.close, activate: () => this.#leave() });

    for (const section of content.sections) {
      this.#captureInto(container, () => {
        label(
          this,
          section.label.x,
          viewport.y + section.label.y,
          section.section.label,
          SECTION_LABEL_TYPE,
          surface.ink.hex,
          ink.secondary,
        );
      });
      section.section.rows.forEach((row, i) => {
        const rowRect = section.rows[i]!;
        const screenRect = toScreen(rowRect);
        const isLesson = section.section.kind === "tryit";
        const stopId = `${isLesson ? "lesson" : "entry"}:${row.id}`;
        const activate = isLesson
          ? (): void => void this.#startLesson(row as BoxLessonRow)
          : (): void => this.#openEntry(row as BoxEntryRow);
        this.#captureInto(container, () => {
          if (isLesson) {
            const lesson = row as BoxLessonRow;
            this.#drawLessonRow(screenRect, lesson, done.includes(mechanicLessonDoneKey(lesson.id)));
          } else {
            this.#drawEntryRow(screenRect, row as BoxEntryRow);
          }
        });
        const zone = this.add
          .zone(screenRect.x, screenRect.y, screenRect.width, screenRect.height)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        zone.on("pointerup", activate);
        container.add(zone);
        stops.set(stopId, {
          rect: () => ({ ...rowRect, y: viewport.y + rowRect.y - this.#scroll.offsetPx }),
          activate,
          ensureVisible: () => this.#region?.scrollIntoView(content.scrollIndexByStop.get(stopId)!),
        });
      });
    }

    this.#route?.set(boxPageFocusOrder(page), stops);
  }

  /** Runs `draw`, then reparents everything it just added into `container` (`scenes/how-to-play.ts#captureInto`'s own trick). */
  #captureInto(container: Phaser.GameObjects.Container, draw: () => void): void {
    const before = this.children.list.length;
    draw();
    const added = this.children.list.slice(before);
    if (added.length > 0) container.add(added);
  }

  #drawHeader(header: ReturnType<typeof boxPageHeaderLayout>, page: BoxPage): void {
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
      .text(header.title.x, header.header.height / 2, page.title.toUpperCase(), {
        ...textStyle(TITLE_TYPE, surface.paper.hex),
        fontSize: "20px",
        wordWrap: { width: header.title.width },
      })
      .setOrigin(0, 0.5);
  }

  #drawRowFrame(rect: Rect): void {
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(1.5, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  }

  #drawArrow(rect: Rect): void {
    this.add
      .text(rect.x + rect.width - 12, rect.y + rect.height / 2, "▸", {
        ...textStyle(typeRole.barTitle, surface.ink.hex),
        fontSize: "18px",
      })
      .setOrigin(1, 0.5);
  }

  /** An entry row: the term's name, wrapped if it is long, and a quiet "▸". */
  #drawEntryRow(rect: Rect, entry: BoxEntryRow): void {
    this.#drawRowFrame(rect);
    this.add
      .text(rect.x + 16, rect.y + rect.height / 2, entry.displayName, {
        ...textStyle(ROW_TITLE_TYPE, surface.ink.hex),
        wordWrap: { width: rect.width - 16 - ARROW_WIDTH },
      })
      .setOrigin(0, 0.5);
    this.#drawArrow(rect);
  }

  /** A Try-it row: the lesson's name and one line under it, with a done mark or a quiet "▸". */
  #drawLessonRow(rect: Rect, lesson: BoxLessonRow, done: boolean): void {
    this.#drawRowFrame(rect);
    const textWidth = rect.width - 16 - (done ? 90 : ARROW_WIDTH);
    this.add.text(rect.x + 16, rect.y + 12, lesson.title, {
      ...textStyle(ROW_TITLE_TYPE, surface.ink.hex),
      wordWrap: { width: textWidth },
    });
    this.add.text(rect.x + 16, rect.y + 38, lesson.tagline, {
      ...textStyle(ROW_DETAIL_TYPE, surface.ink.hex, ink.secondary),
      wordWrap: { width: textWidth },
    });
    if (done) {
      this.add
        .text(
          rect.x + rect.width - 12,
          rect.y + rect.height / 2,
          "✓ Done",
          textStyle(ROW_DETAIL_TYPE, surface.ink.hex, ink.secondary),
        )
        .setOrigin(1, 0.5);
    } else {
      this.#drawArrow(rect);
    }
  }

  /** The Rules reference on this entry: the same glossary entry card a dotted term's tooltip opens. */
  #openEntry(entry: BoxEntryRow): void {
    this.scene.launch(SCENES.rules, {
      initialTab: "glossary",
      initialQuery: entry.displayName,
    } satisfies RulesSceneData);
  }

  async #startLesson(lesson: BoxLessonRow): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    try {
      await startMechanicTryItGame(lesson.id);
    } catch (error) {
      this.#starting = false;
      throw error;
    }
    if (!this.sys.isActive()) return;
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.board);
  }

  #leave(): void {
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.howToPlay);
  }
}
