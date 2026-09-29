/**
 * The round debrief (guided mode G8 part 1, `docs/guided-mode.md` §4, tiles P07/D03): read `view/round-debrief-
 * model.ts`'s own header for the content/layout split this scene draws.
 *
 * **Launched as an overlay**, the same shape `hold-on.ts`'s `showHoldOn` uses: it runs over whatever scene asked
 * (the Board, once the tutorial's own end-of-round wiring lands — a separate follow-up, not this box), and closes
 * itself before either of its two callbacks runs, so nothing is ever left half-drawn under it.
 *
 * **Never a trap** (§3.10): Escape and "Round N+1 ▸" do exactly the same thing — close and resume. There is no
 * dead end here; "Replay a lesson" is the only other way out, and it never blocks "Round N+1" either.
 *
 * "Replay a lesson" opens How to win today (`SCENES.howToWin`, no `backTo` — its own Back/×/Escape go to Title,
 * same as reaching it from Settings) unless the caller supplies its own `onReplayLesson`; G6c's hub is what will
 * override this once it exists ("Replay a lesson" is supposed to open the hub at that lesson, not lesson 1's own
 * screen — `docs/guided-mode.md` §4 G8's own note).
 */
import Phaser from "phaser";
import { dotGrid, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, paintDotGrid } from "../ui/widgets.js";
import { drawPicture, heroPicture } from "../ui/campaign-chrome.js";
import { howToWinContent } from "../view/how-to-win-model.js";
import {
  roundDebriefContentOf,
  roundDebriefLayout,
  type RoundDebriefContent,
  type RoundDebriefInput,
  type RoundDebriefLayout,
  type RoundDebriefLessonRow,
} from "../view/round-debrief-model.js";
import { GUIDE_LEVEL_OPTIONS } from "../view/settings-rows.js";
import { withLevel, type GuideLevel } from "../guide/guide-prefs.js";
import { guidePrefs, setGuidePrefs } from "../guide/guide-store.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { HowToWinSceneData } from "./how-to-win.js";

export interface RoundDebriefData extends RoundDebriefInput {
  /** "Round N+1 ▸" and Escape both call this, after this overlay has already stopped itself. */
  readonly onNextRound: () => void;
  /** "Replay a lesson". Defaults to opening How to win (see this file's own header) when omitted. */
  readonly onReplayLesson?: () => void;
}

const EYEBROW_TYPE: TypeSpec = typeRole.label;
const HEADLINE_TYPE: TypeSpec = { ...typeRole.pageTitle, size: 26 };
const CAPTION_TYPE: TypeSpec = typeRole.label;
const ROW_TITLE_TYPE: TypeSpec = typeRole.rowTitle;
const SUBLINE_TYPE: TypeSpec = { ...typeRole.body, size: 10 };
const BODY_TYPE: TypeSpec = typeRole.body;
const BUTTON_TYPE: TypeSpec = typeRole.menuButton;

const GROUND_DEPTH = -4;
const ART_GROUND_DEPTH = -3;
const ART_SCRIM_DEPTH = -1;
const ART_DEPTH = -2;
const BANNER_DEPTH = 1;

export class RoundDebriefScene extends Phaser.Scene {
  #data!: RoundDebriefData;
  /**
   * The live guide level, seeded from `data.level` and updated in place by `#setGuideLevel` — `RoundDebriefInput`
   * itself stays a snapshot (the pure model's contract), so a click on the segmented row has to be reflected here
   * rather than by mutating `#data`.
   */
  #level!: GuideLevel;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #artGeneration = 0;

  constructor() {
    super(SCENES.roundDebrief);
  }

  create(data: RoundDebriefData): void {
    this.#data = data;
    this.#level = data.level;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#nextRound() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#rebuild();
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const content = roundDebriefContentOf({ ...this.#data, level: this.#level });
    const layout = roundDebriefLayout(width, height, content.lessons);

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0).setDepth(GROUND_DEPTH);
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper).setDepth(GROUND_DEPTH);

    if (layout.wide) this.#drawArt(layout);
    this.#drawHeader(layout, content);
    this.#drawLessons(layout, content);
    this.#drawWorthRemembering(layout, content);
    this.#drawNewOnBoard(layout, content);
    const guideStops = this.#drawGuideLevel(layout, content);
    this.#drawActions(layout, guideStops);

    // Headless click-through hook only (never referenced by product code) — mirrors `how-to-win.ts`'s own
    // `__mcHowToWinDebug`.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcRoundDebriefDebug?: unknown }).__mcRoundDebriefDebug = {
        content: () => content,
        layout: () => layout,
      };
    }
  }

  #drawArt(layout: RoundDebriefLayout): void {
    this.add
      .rectangle(layout.art.x, layout.art.y, layout.art.width, layout.art.height, surface.ink.hex)
      .setOrigin(0, 0)
      .setDepth(ART_GROUND_DEPTH);
    paintDotGrid(this, layout.art, "ink", dotGrid.onInk).setDepth(ART_GROUND_DEPTH);
    this.add
      .rectangle(layout.art.x, layout.art.y, layout.art.width, layout.art.height, surface.ink.hex, 0.28)
      .setOrigin(0, 0)
      .setDepth(ART_SCRIM_DEPTH);

    const generation = ++this.#artGeneration;
    const picture = heroPicture(howToWinContent().heroCardId);
    drawPicture(
      this,
      picture,
      layout.art,
      () => {
        if (generation === this.#artGeneration && this.sys.isActive()) this.#rebuild();
      },
      { focusY: 0.12 },
    )?.setDepth(ART_DEPTH);
  }

  /** Wide (D03): the yellow banner over the art panel's own foot. Narrow (P07): a full-bleed dark header band. */
  #drawHeader(layout: RoundDebriefLayout, content: RoundDebriefContent): void {
    if (layout.wide) {
      const { banner } = layout;
      const g = this.add.graphics().setDepth(BANNER_DEPTH);
      g.fillStyle(surface.ink.hex, 1).fillRect(banner.x + 3, banner.y + 3, banner.width, banner.height);
      g.fillStyle(signal.caution.hex, 1).fillRect(banner.x, banner.y, banner.width, banner.height);
      g.lineStyle(3, surface.ink.hex, 1).strokeRect(banner.x, banner.y, banner.width, banner.height);
      this.add
        .text(banner.x + 14, banner.y + 12, content.title.toUpperCase(), textStyle(EYEBROW_TYPE, surface.ink.hex, 0.75))
        .setDepth(BANNER_DEPTH);
      this.add
        .text(banner.x + 14, banner.y + 30, content.headline.toUpperCase(), {
          ...textStyle(HEADLINE_TYPE, surface.ink.hex),
          fontSize: "20px",
        })
        .setWordWrapWidth(banner.width - 28)
        .setDepth(BANNER_DEPTH);
      return;
    }

    const { header } = layout;
    this.add.rectangle(header.x, header.y, header.width, header.height, surface.ink.hex).setOrigin(0, 0);
    this.add.text(16, 12, content.title.toUpperCase(), textStyle(EYEBROW_TYPE, surface.paper.hex, 0.7));
    this.add
      .text(16, 30, content.headline.toUpperCase(), { ...textStyle(HEADLINE_TYPE, surface.paper.hex) })
      .setWordWrapWidth(header.width - 32);
  }

  #drawLessons(layout: RoundDebriefLayout, content: RoundDebriefContent): void {
    content.lessons.forEach((row, index) => {
      const rect = layout.lessonRows[index]!;
      this.#drawLessonRow(rect, row);
    });
  }

  #drawLessonRow(rect: { x: number; y: number; width: number; height: number }, row: RoundDebriefLessonRow): void {
    const g = this.add.graphics();
    const fill = row.status === "upNext" ? signal.caution.hex : surface.card.hex;
    g.fillStyle(fill, 1).fillRect(rect.x, rect.y, rect.width, rect.height - 2);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 4);

    const iconX = rect.x + 12;
    const iconCy = rect.y + (row.subline ? 18 : rect.height / 2 - 1);
    if (row.status === "done") {
      const box = this.add.graphics();
      box.fillStyle(surface.ink.hex, 1).fillRect(iconX, iconCy - 8, 16, 16);
      this.add
        .text(iconX + 8, iconCy, "✓", { ...textStyle(CAPTION_TYPE, surface.paper.hex), fontSize: "11px" })
        .setOrigin(0.5);
    } else {
      const box = this.add.graphics();
      box.lineStyle(2, surface.ink.hex, 0.6).strokeRect(iconX, iconCy - 8, 16, 16);
    }

    const textX = iconX + 26;
    this.add
      .text(textX, iconCy, row.title, textStyle(ROW_TITLE_TYPE, surface.ink.hex, row.status === "done" ? 0.6 : 1))
      .setOrigin(0, 0.5)
      .setFontSize(12);

    if (row.subline) {
      this.add
        .text(textX, iconCy + 15, row.subline, textStyle(SUBLINE_TYPE, surface.ink.hex, 0.7))
        .setWordWrapWidth(rect.width - (textX - rect.x) - 16, true);
      // The tag sits at the row's top-right corner, not vertically centred, so a two-line subline (a narrow
      // column wraps "Next round · …" more often than the wide desktop split) never runs under it.
      this.add
        .text(rect.x + rect.width - 12, rect.y + 10, "UP NEXT", {
          ...textStyle(CAPTION_TYPE, surface.ink.hex),
          fontSize: "9px",
        })
        .setOrigin(1, 0);
    }
  }

  #drawWorthRemembering(layout: RoundDebriefLayout, content: RoundDebriefContent): void {
    const rect = layout.worthRemembering;
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    this.add.text(rect.x + 12, rect.y + 10, "WORTH REMEMBERING", textStyle(CAPTION_TYPE, surface.ink.hex, 0.7));
    this.add
      .text(rect.x + 12, rect.y + 28, content.worthRemembering, textStyle(BODY_TYPE, surface.ink.hex))
      .setWordWrapWidth(rect.width - 24);
  }

  #drawNewOnBoard(layout: RoundDebriefLayout, content: RoundDebriefContent): void {
    if (content.newOnBoard.length === 0) return;
    const rect = layout.newOnBoard;
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    this.add.text(rect.x + 12, rect.y + 10, "NEW ON YOUR BOARD", textStyle(CAPTION_TYPE, surface.ink.hex, 0.7));
    this.add
      .text(rect.x + 12, rect.y + 28, content.newOnBoard.join(" "), textStyle(BODY_TYPE, surface.ink.hex))
      .setWordWrapWidth(rect.width - 24);
  }

  /** The three-cell "Guide level" segmented row, styled like `scenes/settings.ts`'s own but on paper, not ink. */
  #drawGuideLevel(layout: RoundDebriefLayout, content: RoundDebriefContent): readonly string[] {
    this.add.text(
      layout.guideLevelLabel.x,
      layout.guideLevelLabel.y,
      "GUIDE LEVEL",
      textStyle(CAPTION_TYPE, surface.ink.hex, 0.6),
    );

    const rect = layout.guideLevel;
    const gap = 4;
    const cellWidth = (rect.width - gap * (GUIDE_LEVEL_OPTIONS.length - 1)) / GUIDE_LEVEL_OPTIONS.length;
    const stopIds: string[] = [];
    GUIDE_LEVEL_OPTIONS.forEach((option, i) => {
      const cellRect = { x: rect.x + i * (cellWidth + gap), y: rect.y, width: cellWidth, height: rect.height };
      const selected = content.level === option.value;
      const activate = (): void => this.#setGuideLevel(option.value);
      this.#buttons.push(
        new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect: cellRect, onClick: activate }),
      );
      const g = this.add.graphics();
      g.fillStyle(selected ? signal.caution.hex : surface.card.hex, 1).fillRect(
        cellRect.x,
        cellRect.y,
        cellRect.width,
        cellRect.height,
      );
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(
        cellRect.x + 1,
        cellRect.y + 1,
        cellRect.width - 2,
        cellRect.height - 2,
      );
      this.add
        .text(cellRect.x + cellRect.width / 2, cellRect.y + 14, option.label.toUpperCase(), {
          ...textStyle(ROW_TITLE_TYPE, surface.ink.hex),
          fontSize: "12px",
        })
        .setOrigin(0.5);
      this.add
        .text(cellRect.x + cellRect.width / 2, cellRect.y + 32, option.detail, {
          ...textStyle(SUBLINE_TYPE, surface.ink.hex, 0.7),
        })
        .setOrigin(0.5)
        .setWordWrapWidth(cellWidth - 10);
      stopIds.push(`guide-level:${option.value}`);
    });
    return stopIds;
  }

  #drawActions(layout: RoundDebriefLayout, guideStops: readonly string[]): void {
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Replay a lesson",
        type: BUTTON_TYPE,
        rect: layout.replayLesson,
        onClick: () => this.#replayLesson(),
      }),
      new McButton(this, {
        kind: "primary",
        label: `Round ${this.#data.round + 1} ▸`,
        type: BUTTON_TYPE,
        rect: layout.nextRound,
        onClick: () => this.#nextRound(),
      }),
    );

    const stops = new Map<string, FocusStop>();
    for (const id of guideStops) {
      const option = GUIDE_LEVEL_OPTIONS.find((o) => `guide-level:${o.value}` === id)!;
      stops.set(id, { rect: layout.guideLevel, activate: () => this.#setGuideLevel(option.value) });
    }
    stops.set("replay-lesson", { rect: layout.replayLesson, activate: () => this.#replayLesson() });
    stops.set("next-round", { rect: layout.nextRound, activate: () => this.#nextRound() });
    this.#route?.set([...guideStops, "replay-lesson", "next-round"], stops);
  }

  #setGuideLevel(level: GuideLevel): void {
    setGuidePrefs(withLevel(guidePrefs(), level));
    this.#level = level;
    this.#rebuild();
  }

  #replayLesson(): void {
    if (this.#data.onReplayLesson) {
      this.#data.onReplayLesson();
      return;
    }
    // Registered as a "screen" (`main.ts`), ahead of this overlay in the render stack — `scene.launch` alone
    // would start it *underneath* this still-running overlay, invisibly. Stopping first is the same shape
    // `#nextRound` already uses, and is fine here too: nothing about this default needs the debrief to still be
    // running once How to win takes over.
    this.scene.stop();
    this.scene.launch(SCENES.howToWin, {} satisfies HowToWinSceneData);
  }

  #nextRound(): void {
    const { onNextRound } = this.#data;
    this.scene.stop();
    onNextRound();
  }
}

/** Shows the round debrief over `scene` (the same launch/stop shape `hold-on.ts`'s `showHoldOn` uses). */
export function showRoundDebrief(scene: Phaser.Scene, data: RoundDebriefData): void {
  if (scene.scene.isActive(SCENES.roundDebrief)) return;
  scene.scene.launch(SCENES.roundDebrief, data satisfies RoundDebriefData);
}
