/**
 * Draws the "In-progress games" list (device sync, #276) onto an ink ground: the Title's panel in its art panel and the
 * phone's full-screen overlay both call this, so a game reads and behaves the same in either.
 *
 * Each row is one whole-row tap target (resume) with, along its bottom, a red primary Resume button (the main action)
 * and a smaller outlined Remove after it. The rows scroll inside a masked
 * region; every control in it follows the "no tap on finger lift" rule (issue #227): a press and its release both on
 * the control, within the tap slop (`McButton`, `addRowTapZone`), honoring the region's clip and its drag, so the end
 * of a swipe that lifts over a row or over Remove presses nothing. Remove asks "Remove this game?" in place of the
 * list before it does anything.
 *
 * The scene owns the state (which game is being asked about, the scroll offset); this draws what it is given.
 */
import type Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import { drawPlayPlatformIcon } from "./play-platform-icon.js";
import { McScrollRegion } from "./scroll-region.js";
import { textStyle } from "./theme.js";
import { McButton, addRowTapZone, fitText } from "./widgets.js";
import type { FocusStop } from "../scenes/focus-route.js";
import {
  GAME_NEEDS_UPDATE_TEXT,
  REMOVE_CONFIRM_TEXT,
  gameRowParts,
  gameRowRects,
  removeConfirmParts,
  type GameRow,
} from "../view/games-list-model.js";
import type { Rect } from "../view/layout.js";
import { playPlatformMarkOf, playPlatformSlotIn } from "../view/play-platform-mark.js";
import type { VariableListScroll } from "../view/variable-list-scroll.js";

export interface GamesListOptions {
  /** Where the list (or the question that replaces it) is drawn. */
  readonly area: Rect;
  readonly rows: readonly GameRow[];
  /** Caller-owned, so the scroll offset survives a redraw. */
  readonly scroll: VariableListScroll;
  /** The game being asked about ("Remove this game?"), or null while the list shows. */
  readonly confirming: GameRow | null;
  /** False while something is already starting (a resume in flight): the rows and buttons are drawn unavailable. */
  readonly enabled: boolean;
  readonly onResume: (row: GameRow) => void;
  readonly onAskRemove: (row: GameRow) => void;
  readonly onKeep: () => void;
  readonly onRemove: (row: GameRow) => void;
  /** Why the last Remove failed, shown under the question; null when there is nothing to say. */
  readonly error?: string | null;
}

export interface DrawnGamesList {
  readonly buttons: readonly McButton[];
  /** Focus stops by key (`gamesListFocusOrder`): `game:<id>`, `game-remove:<id>`, `remove-keep`, `remove-confirm`. */
  readonly stops: ReadonlyMap<string, FocusStop>;
  readonly region: McScrollRegion | null;
}

const PAPER = surface.paper.hex;

export function drawGamesList(scene: Phaser.Scene, options: GamesListOptions): DrawnGamesList {
  return options.confirming ? drawConfirm(scene, options, options.confirming) : drawRows(scene, options);
}

function drawRows(scene: Phaser.Scene, options: GamesListOptions): DrawnGamesList {
  const { area, rows } = options;
  const buttons: McButton[] = [];
  const stops = new Map<string, FocusStop>();
  const layout = gameRowRects(area, rows.length);
  const heights = [Math.max(area.height, layout.height)];
  const region = new McScrollRegion(scene, { rect: area, heights, scroll: options.scroll });
  const inRegion = (): Rect => area;
  const suppress = (): boolean => region.isDragSuppressingClick;
  const before = scene.children.list.length;

  rows.forEach((row, index) => {
    const rect = layout.rows[index]!;
    const parts = gameRowParts(rect);
    // A game a newer build wrote cannot be resumed here: no Resume, and a tap on the row does nothing (the row says why).
    const go = (): void => {
      if (!row.needsUpdate) options.onResume(row);
    };
    const ask = (): void => options.onAskRemove(row);
    scene.add
      .rectangle(rect.x, rect.y, rect.width, rect.height, PAPER, 0.1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, PAPER, 0.55);
    // Created before the buttons, so each button, drawn above it, takes the presses on itself.
    addRowTapZone(scene, rect, {
      onClick: go,
      enabled: options.enabled && !row.needsUpdate,
      clip: inRegion,
      suppressClick: suppress,
    });
    const mark = playPlatformMarkOf(row.save.lastPlayedOn);
    if (mark) {
      const slot = playPlatformSlotIn({ ...rect, width: parts.iconInset + 14, height: parts.resume.y - rect.y });
      drawPlayPlatformIcon(scene.add.graphics(), mark, slot.box, PAPER, 0.9);
    }
    const title = scene.add.text(parts.text.x, parts.text.y, row.title, textStyle(typeRole.rowTitle, PAPER));
    // A long name (a built game's stages and sets) wraps onto a second line, shrinking a step before it would need a third.
    title.setWordWrapWidth(parts.text.width);
    for (const size of [15, 14, 13, 12]) {
      title.setFontSize(size);
      const lines = size >= 14 ? 1 : 2;
      if (title.height <= size * lines * typeRole.rowTitle.lineHeight + 2) break;
    }
    const second = [row.kicker, row.detail].filter((part): part is string => part !== null).join(" · ");
    const detail = scene.add.text(
      parts.text.x,
      title.y + title.height + 4,
      second,
      textStyle(typeRole.body, PAPER, 0.8),
    );
    fitText(detail, parts.text.width, 12);
    if (row.needsUpdate) {
      // In Resume's place, in words (never colour alone): the game waits for an update.
      const note = scene.add
        .text(parts.resume.x, parts.resume.y, GAME_NEEDS_UPDATE_TEXT, textStyle(typeRole.rowTitle, PAPER))
        .setWordWrapWidth(parts.resume.width)
        .setFontSize(13);
      note.setY(parts.resume.y + Math.max(0, (parts.resume.height - note.height) / 2));
    } else {
      buttons.push(
        new McButton(scene, {
          kind: "primary",
          label: "Resume",
          type: typeRole.menuButton,
          rect: parts.resume,
          enabled: options.enabled,
          onClick: go,
          clip: inRegion,
          suppressClick: suppress,
        }),
      );
    }
    buttons.push(
      new McButton(scene, {
        kind: "onInk",
        label: "Remove",
        type: { ...typeRole.rowTitle, size: 13 },
        rect: parts.remove,
        enabled: options.enabled,
        onClick: ask,
        clip: inRegion,
        suppressClick: suppress,
      }),
    );
    // The focus ring follows the list as it scrolls.
    const offsetBy =
      (r: Rect): (() => Rect) =>
      () => ({ ...r, y: r.y - options.scroll.offsetPx });
    const bringIntoView = (): void => {
      const top = rect.y - area.y - options.scroll.offsetPx;
      const over = top + rect.height - area.height;
      if (top < 0) region.scrollByPx(top);
      else if (over > 0) region.scrollByPx(over);
    };
    stops.set(`game:${row.id}`, { rect: offsetBy(parts.resume), activate: go, ensureVisible: bringIntoView });
    stops.set(`game-remove:${row.id}`, { rect: offsetBy(parts.remove), activate: ask, ensureVisible: bringIntoView });
  });

  const added = scene.children.list.slice(before);
  if (added.length > 0) region.content.add(added);
  region.refresh();
  return { buttons, stops, region };
}

function drawConfirm(scene: Phaser.Scene, options: GamesListOptions, row: GameRow): DrawnGamesList {
  const parts = removeConfirmParts(options.area);
  const stops = new Map<string, FocusStop>();
  scene.add
    .rectangle(options.area.x, options.area.y, options.area.width, options.area.height, PAPER, 0.1)
    .setOrigin(0, 0)
    .setStrokeStyle(2, PAPER, 0.55);
  const pad = 12;
  const wrap = parts.message.width - pad * 2;
  const name = scene.add
    .text(parts.message.x + pad, parts.message.y + pad, row.title, textStyle(typeRole.rowTitle, PAPER))
    .setWordWrapWidth(wrap)
    .setFontSize(15);
  scene.add
    .text(parts.message.x + pad, name.y + name.height + 8, REMOVE_CONFIRM_TEXT, textStyle(typeRole.body, PAPER, 0.9))
    .setWordWrapWidth(wrap)
    .setFontSize(14)
    .setLineSpacing(3);
  if (options.error) {
    scene.add
      .text(
        parts.message.x + pad,
        parts.message.y + parts.message.height - 20,
        options.error,
        textStyle(typeRole.body, PAPER),
      )
      .setWordWrapWidth(wrap)
      .setFontSize(13)
      .setColor("#ffb4a8");
  }
  const keep = (): void => options.onKeep();
  const remove = (): void => options.onRemove(row);
  const buttons = [
    new McButton(scene, {
      kind: "onInk",
      label: "Keep it",
      type: typeRole.menuButton,
      rect: parts.keep,
      enabled: options.enabled,
      onClick: keep,
    }),
    new McButton(scene, {
      kind: "primary",
      label: "Remove",
      type: typeRole.menuButton,
      rect: parts.remove,
      enabled: options.enabled,
      onClick: remove,
    }),
  ];
  stops.set("remove-keep", { rect: parts.keep, activate: keep });
  stops.set("remove-confirm", { rect: parts.remove, activate: remove });
  return { buttons, stops, region: null };
}
