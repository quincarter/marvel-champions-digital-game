/**
 * The Board's chrome: the ink bar across the top, and the phone board's tab rail.
 */

import type Phaser from "phaser";
import { accent, hit, ink, signal, surface, typeRole, type TypeSpec } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { onTap } from "../../ui/tap.js";
import { McButton, McTabs, clipLine } from "../../ui/widgets.js";
import type { BoardModel } from "../../view/board-model.js";
import { lerp } from "../../view/motion-math.js";
import {
  CHROME_HEIGHT,
  CHROME_TICKER_ROW,
  PHONE_RAIL_TABS,
  promptRowHeight,
  TURN_ROW_HEIGHT,
  type PhoneTab,
  type Rect,
} from "../../view/layout.js";
import type { TurnTone } from "../../view/whose-turn.js";
import type { LogTicker } from "../../view/log-dock.js";
import type { GlyphHints } from "../../ui/glyph-hints.js";
import type { BoardMotion, StatusStampState } from "./motion.js";
import type { WatchBadge } from "../../view/live-watch-ui.js";
import type { LivePill } from "../../view/live-pill.js";
import { appSession } from "../../session.js";
import { setReportSlot } from "../../ui/report-slot.js";
import { setMusicSlot } from "../../ui/music-slot.js";
import { languageSlotBeside } from "../../view/language-button.js";
import { themeSlotBeside } from "../../view/theme-button.js";
import { musicSlotBeside } from "../../view/music-player.js";

/** The title bar's log line: a word to name it and the newest line, in type that reads at a glance. */
const TICKER_WORD: TypeSpec = { ...typeRole.label, size: 11 };
const TICKER_LINE: TypeSpec = { ...typeRole.emphasis, size: 14 };
/** Beside the step label, on the bar's one row: narrower than this and the phase toggle gives up its room. */
const TICKER_MIN_WIDTH = 220;
/** The glyph's room at the line's right end. */
const TICKER_GLYPH_ROOM = 76;

/** The phone board's "≡" menu icon (see `drawChrome`'s own comment for why this isn't `typeRole.label`). */
const MENU_ICON_TYPE: TypeSpec = { ...typeRole.label, size: 20, letterSpacing: 0, uppercase: false };

/** The whose-turn line (#881): drawn as the title bar's last row, with the same words on every device. */
export interface ChromeTurn {
  readonly text: string;
  readonly tone: TurnTone;
}

/** A small prompt under the whose-turn line (#881): a request to answer, a seat to take over, my own request's answer. */
export interface ChromePrompt {
  readonly text: string;
  /** A second line (the asker's note, "2 more waiting"); null for none. */
  readonly detail: string | null;
  readonly actions: readonly { readonly label: string; readonly primary: boolean; readonly onPress: () => void }[];
  /** Hears where each button was drawn, for the keyboard and pad focus route. */
  readonly onRect: (index: number, rect: Rect) => void;
}

const TURN_TYPE: TypeSpec = { ...typeRole.rowTitle, size: 14 };
const PROMPT_TYPE: TypeSpec = { ...typeRole.emphasis, size: 12 };

/** The Epic pod strip (#882): lines of words under the bar, with a Tables button on its first line. */
export interface ChromePodStrip {
  readonly lines: readonly { readonly text: string; readonly alert: boolean; readonly continued?: boolean }[];
  readonly lineHeight: number;
  readonly button: { readonly label: string; readonly onPress: () => void; readonly onRect: (rect: Rect) => void };
}

export interface ChromeOptions {
  /** Epic games (#882): Loki, Worlds Collide, the tables and the clock, as the bar's last rows. */
  readonly podStrip?: ChromePodStrip | null;
  /** Room games with chat on (#881): the turn row's Chat control, with a count of lines not yet read. */
  readonly chat?: { readonly label: string; readonly unread: number; readonly onPress: () => void } | null;
  /** Room games (#881): whose turn it is, as the bar's last row. */
  readonly turn?: ChromeTurn | null;
  readonly prompt?: ChromePrompt | null;
  readonly notSaving?: boolean;
  /** The watcher badge (#876): an eye and the count, while anyone is watching this game live. */
  readonly watchers?: WatchBadge | null;
  /**
   * A watcher's live marker (#876), in the log line's label in place of "LOG": a pulsing red "● LIVE", a muted "○ HOST
   * AWAY", or "FEED LOST". Null (an ordinary replay, a game that ended) leaves "LOG".
   */
  readonly live?: LivePill | null;
  /** Pressing the watch control copies or shares the link (#876). */
  readonly onWatch?: () => void;
  /** Hears where the control was drawn, for the keyboard and pad focus route. */
  readonly onWatchRect?: (rect: Rect) => void;
  /** The line shown under the control right after a press ("Watch link copied"). */
  readonly watchToast?: string | null;
  /** Opens the Pause overlay (docs/phase4-screen-gaps.md §3 "W4"). Every board layout gets this button. */
  readonly onMenu: () => void;
  /** The menu button is a real `McButton` (it needs a click/hover/focus state), so it's handed back for the caller's own frame bookkeeping — same reason `drawActionBar` pushes onto `ctx.frame.buttons` instead of owning its own list. */
  readonly buttons: McButton[];
  /** Baron Zemo's EVIDENCE button (`scenes/evidence.ts`), left of MENU; absent in every other game. */
  readonly onEvidence?: () => void;
  /** Drives the round chip's pop and the phase toggle's fade-in when either just changed. */
  readonly motion: BoardMotion;
  /** The glyph hints, on layouts that show them: Esc / Menu hangs just below the MENU button. */
  readonly hints?: GlyphHints;
  /** Whether the Menu glyph may show for the input in use: Esc only opens Pause when nothing else would take it. */
  readonly menuHintWhen?: (set: "keyboard" | "pad") => boolean;
  /** The game log's latest line (`view/log-dock.ts`) and what pressing it does (issue #550). */
  readonly log: LogTicker & { readonly open: boolean; readonly onPress: () => void };
  /** Hears where the line was drawn, for the e2e specs. */
  readonly onLogRect?: (rect: Rect) => void;
}

/**
 * Round chip, phase toggle, the current step, and the MENU/≡ button, on the ink chrome bar.
 *
 * The phase toggle is the first thing to go when the bar is narrow: it says
 * the same thing the step label already says, and two overlapping labels say
 * less than one. The 1st-player mark goes next.
 *
 * `notSaving` puts a standing "NOT SAVING" chip at the right edge, ahead of
 * the 1st-player mark, which it displaces: once a save has failed the game
 * may not survive a refresh, and that stays true for the rest of the session.
 *
 * The Report button (#176) has its slot just left of MENU (and EVIDENCE); `scenes/report-button.ts` draws it there.
 * The music button (#191, `scenes/music-button.ts`) has its slot just left of that, and the card language button
 * (#337, `scenes/language-button.ts`) just left of the music button.
 *
 * The menu button sits at the very right edge, ahead of even the "NOT SAVING"
 * chip and the 1st-player mark — pausing has to stay reachable regardless of
 * how much else the bar is showing. It reads "MENU" on the long table
 * (`rect.width >= 640`, the same breakpoint the phase toggle uses) and "≡" on
 * the phone board, matching `Board - Long Table.dc.html` / `Board - Phone.dc.html`.
 *
 * The game log's latest line runs in the room left of those, or on a row of its own under them on a phone, which has
 * no room beside them.
 */
export function drawChrome(scene: Phaser.Scene, fullWhole: Rect, model: BoardModel, options: ChromeOptions): void {
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(fullWhole.x, fullWhole.y, fullWhole.width, fullWhole.height);
  // The rows below the bar's own (the whose-turn line, a prompt) are taken off first: the rest draws as it always did.
  const promptHeight = options.prompt ? promptRowHeight(options.prompt.actions.length) : 0;
  const stripHeight = options.podStrip ? podStripBoxHeight(options.podStrip) : 0;
  const extra = (options.turn ? TURN_ROW_HEIGHT : 0) + promptHeight + stripHeight;
  const whole: Rect = extra > 0 ? { ...fullWhole, height: fullWhole.height - extra } : fullWhole;
  if (options.turn) {
    const turnRow: Rect = { x: whole.x, y: whole.y + whole.height, width: whole.width, height: TURN_ROW_HEIGHT };
    // The Esc / Menu glyph hangs under the MENU button on wide bars: the Chat control stays clear of it.
    drawTurnRow(scene, turnRow, options.turn, options.chat ?? null, fullWhole.width >= 640 ? 80 : 10, options.buttons);
  }
  if (options.prompt) {
    const top = whole.y + whole.height + (options.turn ? TURN_ROW_HEIGHT : 0);
    drawPromptRow(scene, { x: whole.x, y: top, width: whole.width, height: promptHeight }, options);
  }
  if (options.podStrip) {
    const top = whole.y + whole.height + (options.turn ? TURN_ROW_HEIGHT : 0) + promptHeight;
    drawPodStrip(
      scene,
      { x: whole.x, y: top, width: whole.width, height: stripHeight },
      options.podStrip,
      options.buttons,
    );
  }
  const ownRow = whole.height >= CHROME_HEIGHT.phone && whole.width < 768;
  const rect: Rect = ownRow ? { ...whole, height: whole.height - CHROME_TICKER_ROW } : whole;

  const wide = rect.width >= 640;
  const menuWidth = wide ? 76 : 40;
  const menuRect: Rect = {
    x: rect.x + rect.width - 8 - menuWidth,
    y: rect.y + 5,
    width: menuWidth,
    height: rect.height - 10,
  };
  if (options.hints && wide) {
    options.hints.hang(menuRect, ["pause"], 16, {
      ground: "paper",
      ...(options.menuHintWhen ? { when: options.menuHintWhen } : {}),
    });
  }
  options.buttons.push(
    new McButton(scene, {
      kind: "onInk",
      label: wide ? "MENU" : "≡",
      // The phone board's "≡" is a symbol standing in for a whole word, not a
      // short label — at `typeRole.label`'s own 9px it rendered as a barely
      // visible smudge (fidelity pass, 2026-09-17). Bigger and untracked, so
      // the three bars actually read as a hamburger icon on a touch screen.
      type: wide ? typeRole.label : MENU_ICON_TYPE,
      rect: menuRect,
      enabled: true,
      onClick: options.onMenu,
    }),
  );

  // The Evidence view's button sits just left of MENU, in a game that has evidence.
  let evidenceRect: Rect | null = null;
  if (options.onEvidence) {
    const evidenceWidth = wide ? 96 : 52;
    evidenceRect = { x: menuRect.x - 8 - evidenceWidth, y: menuRect.y, width: evidenceWidth, height: menuRect.height };
    options.buttons.push(
      new McButton(scene, {
        kind: "onInk",
        label: wide ? "EVIDENCE" : "EVID.",
        type: typeRole.label,
        rect: evidenceRect,
        enabled: true,
        onClick: options.onEvidence,
      }),
    );
  }
  // The Report button's slot (#176), just left of those: `scenes/report-button.ts` draws it, above every overlay.
  const reportWidth = wide ? 44 : 40;
  const reportRect: Rect = {
    x: (evidenceRect ?? menuRect).x - 8 - reportWidth,
    y: menuRect.y,
    width: reportWidth,
    height: menuRect.height,
  };
  setReportSlot(scene.scene.key, reportRect);
  const musicRect = musicSlotBeside(reportRect);
  setMusicSlot(scene.scene.key, musicRect);
  // Where the standing chips on the right edge stop: the dark mode toggle's slot (#459), left of the card language
  // button's (#337), left of the music button's.
  const anchorX = themeSlotBeside(languageSlotBeside(musicRect)).x - 2;

  // The live round chip is the one red besides the forward action.
  const chip: Rect = { x: rect.x + 8, y: rect.y + 5, width: 54, height: rect.height - 10 };
  const chipFirstDrawn = scene.children.list.length;
  const chipG = scene.add.graphics();
  chipG.fillStyle(accent.heroRed.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
  scene.add
    .text(
      chip.x + chip.width / 2,
      chip.y + chip.height / 2,
      `RD ${model.round}`,
      textStyle(typeRole.statSmall, surface.paper.hex),
    )
    .setOrigin(0.5);
  // A pop (1.25 -> 1) right when the round just turned — the chip is the design's one red besides the forward
  // action, so it's the thing that should visibly react when the number on it changes.
  const pop = options.motion.roundChipPop(model.round);
  if (pop) {
    const cx = chip.x + chip.width / 2;
    const cy = chip.y + chip.height / 2;
    animateStampScale(scene, cx, cy, scene.children.list.slice(chipFirstDrawn), pop);
  }

  const notSaving = options.notSaving ?? false;
  const firstPlayer = !notSaving && model.firstPlayerId === model.perspectiveId && rect.width >= 520;
  let rightEdge = anchorX - 10 - (firstPlayer ? 86 : 0);
  if (notSaving) {
    // A glyph as well as the hue, so the warning never rests on color alone.
    const warning = scene.add
      .text(anchorX - 8, rect.y + rect.height / 2, "⚠ NOT SAVING", textStyle(typeRole.label, surface.inkOnHue.hex))
      .setOrigin(1, 0.5)
      .setPadding(6, 3, 6, 3)
      .setBackgroundColor(cssOf(signal.caution.hex));
    rightEdge = warning.x - warning.width - 8;
  }

  // The watcher badge sits at the right end of the log's room: an eye drawn with lines and the count in digits, so it
  // reads without colour. A bar too narrow for it goes without (the pause menu still has the link).
  if (options.watchers && rightEdge - (chip.x + chip.width) > 260) {
    const width = drawWatchBadge(scene, options, options.watchers, rightEdge, rect, whole);
    rightEdge -= width + 10;
  }

  const stepLeft = chip.x + chip.width + 10;
  const step = scene.add
    .text(
      stepLeft,
      rect.y + rect.height / 2,
      model.stepLabel,
      textStyle(typeRole.emphasis, surface.paper.hex, ink.secondary),
    )
    .setOrigin(0, 0.5);
  const toggleWidth = 86 * 2 + 18;
  // The toggle says what the step label says, so on a narrow bar the log's line takes its room.
  const showToggle = wide && (ownRow || rightEdge - stepLeft - toggleWidth - step.width - 16 >= TICKER_MIN_WIDTH);
  const left = stepLeft + (showToggle ? toggleWidth : 0);
  step.setX(left);
  const room = Math.max(40, rightEdge - left);
  step.setWordWrapWidth(ownRow ? room : Math.round(room * 0.45)).setMaxLines(1);
  if (showToggle) {
    // Two-state phase toggle: whichever side's clock is running is filled.
    (["player", "villain"] as const).forEach((phase, index) => {
      const box: Rect = { x: stepLeft + index * 86, y: chip.y, width: 82, height: chip.height };
      const active = model.phase === phase;
      const sideFirstDrawn = scene.children.list.length;
      const bg = scene.add.graphics();
      bg.fillStyle(active ? surface.paper.hex : surface.ink.hex, 1).fillRect(box.x, box.y, box.width, box.height);
      bg.lineStyle(2, surface.paper.hex, active ? 1 : ink.meta).strokeRect(box.x, box.y, box.width, box.height);
      scene.add
        .text(
          box.x + box.width / 2,
          box.y + box.height / 2,
          phase.toUpperCase(),
          textStyle(typeRole.label, active ? surface.ink.hex : surface.paper.hex, active ? 1 : ink.meta),
        )
        .setOrigin(0.5);
      // The active side fades in right when the phase just turned to it.
      if (active) {
        const fade = options.motion.toggleFade(phase);
        if (fade) animateStampAlpha(scene, scene.children.list.slice(sideFirstDrawn), fade);
      }
    });
  }

  if (firstPlayer) {
    scene.add
      .text(anchorX - 10, rect.y + rect.height / 2, "1ST PLAYER", textStyle(typeRole.label, signal.caution.hex))
      .setOrigin(1, 0.5);
  }

  const tickerX = left + step.width + 16;
  drawLogTicker(
    scene,
    ownRow
      ? { x: whole.x + 6, y: rect.y + rect.height, width: whole.width - 12, height: CHROME_TICKER_ROW - 4 }
      : { x: tickerX, y: chip.y, width: rightEdge - tickerX, height: chip.height },
    options,
  );
}

const STRIP_BUTTON = 44;
const STRIP_TYPE: TypeSpec = { ...typeRole.rowTitle, size: 12 };

/** The strip's own height: its lines, the first as tall as its button, and a little air. */
const podStripBoxHeight = (strip: ChromePodStrip): number =>
  Math.max(strip.lineHeight, STRIP_BUTTON) + (strip.lines.length - 1) * strip.lineHeight + 10;

/** The pod strip: words on ink, an alert line inverted on paper with a warning mark, never colour alone. */
function drawPodStrip(scene: Phaser.Scene, row: Rect, strip: ChromePodStrip, buttons: McButton[]): void {
  const g = scene.add.graphics();
  g.lineStyle(1, surface.paper.hex, ink.disabled).lineBetween(row.x, row.y + 0.5, row.x + row.width, row.y + 0.5);
  const buttonWidth = Math.max(72, strip.button.label.length * 9 + 24);
  const buttonRect: Rect = {
    x: row.x + row.width - buttonWidth - 8,
    y: row.y + 3,
    width: buttonWidth,
    height: STRIP_BUTTON - 6,
  };
  buttons.push(
    new McButton(scene, {
      kind: "onInk",
      label: strip.button.label,
      type: { ...typeRole.label, size: 11 },
      rect: buttonRect,
      enabled: true,
      onClick: strip.button.onPress,
    }),
  );
  strip.button.onRect(buttonRect);
  let y = row.y + 5;
  strip.lines.forEach((line, index) => {
    const height = index === 0 ? Math.max(strip.lineHeight, STRIP_BUTTON) : strip.lineHeight;
    const right = index === 0 ? buttonRect.x - 6 : row.x + row.width - 8;
    if (line.alert) g.fillStyle(surface.paper.hex, 1).fillRect(row.x + 4, y, row.width - 8, height);
    // One marker for a wrapped paragraph: its first line carries it, the others hang-indent under the words.
    const colour = line.alert ? surface.ink.hex : surface.paper.hex;
    let textX = row.x + 10;
    if (line.alert) {
      const mark = scene.add.text(textX, y + height / 2, "⚠ ", textStyle(STRIP_TYPE, colour)).setOrigin(0, 0.5);
      if (line.continued) mark.setVisible(false);
      textX += mark.width;
    }
    const text = scene.add.text(textX, y + height / 2, line.text, textStyle(STRIP_TYPE, colour)).setOrigin(0, 0.5);
    clipLine(text, right - textX);
    scene.add.zone(row.x, y, row.width, height).setOrigin(0, 0).setName(line.text);
    y += height;
  });
}

/** The whose-turn row: words first (a glyph backs them up), my own turn on paper so it stands out without colour. */
function drawTurnRow(
  scene: Phaser.Scene,
  row: Rect,
  turn: ChromeTurn,
  chat: ChromeOptions["chat"],
  rightInset: number,
  buttons: McButton[],
): void {
  const g = scene.add.graphics();
  const mine = turn.tone === "mine";
  if (mine) g.fillStyle(surface.paper.hex, 1).fillRect(row.x, row.y, row.width, row.height);
  else g.lineStyle(1, surface.paper.hex, ink.disabled).lineBetween(row.x, row.y + 0.5, row.x + row.width, row.y + 0.5);
  const colour = mine ? surface.ink.hex : turn.tone === "away" ? signal.caution.hex : surface.paper.hex;
  const glyph = mine ? "▶ " : turn.tone === "away" ? "⚠ " : "";
  const text = scene.add
    .text(row.x + 10, row.y + row.height / 2, `${glyph}${turn.text}`, textStyle(TURN_TYPE, colour))
    .setOrigin(0, 0.5);
  let room = row.width - 20;
  if (chat) {
    // Words and a count, never a colour or a dot alone: "CHAT" or "CHAT · 2". A real button, at the touch size.
    const word = chat.unread > 0 ? `${chat.label} · ${chat.unread}` : chat.label;
    const buttonWidth = Math.max(84, word.length * 9 + 24);
    const rect: Rect = {
      x: row.x + row.width - rightInset + 4 - buttonWidth,
      y: row.y + 4,
      width: buttonWidth,
      height: row.height - 8,
    };
    buttons.push(
      new McButton(scene, {
        kind: mine ? "secondary" : "onInk",
        label: word,
        type: { ...typeRole.label, size: 12 },
        rect,
        enabled: true,
        onClick: chat.onPress,
      }),
    );
    room -= buttonWidth + 8;
  }
  clipLine(text, room);
  // A name to a screen reader or a hover, in the row's own zone.
  scene.add.zone(row.x, row.y, row.width, row.height).setOrigin(0, 0).setName(turn.text);
}

/** The prompt row: a paper strip with up to two lines of words and its buttons at the right. */
function drawPromptRow(scene: Phaser.Scene, row: Rect, options: ChromeOptions): void {
  const prompt = options.prompt!;
  const strip: Rect = { x: row.x + 6, y: row.y + 3, width: row.width - 12, height: row.height - 6 };
  const g = scene.add.graphics();
  g.fillStyle(surface.paper.hex, 1).fillRect(strip.x, strip.y, strip.width, strip.height);
  g.lineStyle(2, surface.paper.hex, 1).strokeRect(strip.x, strip.y, strip.width, strip.height);
  const stacked = prompt.actions.length > 2;
  const gap = 6;
  const buttonWidth = stacked
    ? Math.floor((strip.width - 12 - gap * (prompt.actions.length - 1)) / prompt.actions.length)
    : strip.width < 420
      ? 76
      : 100;
  const buttonHeight = stacked ? hit.target : strip.height - 10;
  const buttonTop = stacked ? strip.y + strip.height - 5 - buttonHeight : strip.y + 5;
  let right = stacked ? strip.x + strip.width - 6 : strip.x + strip.width - 6;
  const rects: Rect[] = [];
  for (let index = prompt.actions.length - 1; index >= 0; index -= 1) {
    const action = prompt.actions[index]!;
    const rect: Rect = { x: right - buttonWidth, y: buttonTop, width: buttonWidth, height: buttonHeight };
    rects[index] = rect;
    options.buttons.push(
      new McButton(scene, {
        kind: action.primary ? "primary" : "secondary",
        label: action.label,
        type: { ...typeRole.label, size: 10 },
        rect,
        enabled: true,
        onClick: action.onPress,
      }),
    );
    right = rect.x - gap;
  }
  rects.forEach((rect, index) => prompt.onRect(index, rect));
  const textWidth = stacked ? strip.width - 16 : right - (strip.x + 8);
  const title = scene.add
    .text(strip.x + 8, strip.y + 5, prompt.text, textStyle(PROMPT_TYPE, surface.ink.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(Math.max(40, textWidth), true)
    .setMaxLines(prompt.detail ? 1 : 2);
  if (prompt.detail) {
    clipLine(title, textWidth);
    const detail = scene.add
      .text(
        strip.x + 8,
        title.y + title.height + 1,
        prompt.detail,
        textStyle({ ...PROMPT_TYPE, weight: 400 }, surface.ink.hex, ink.secondary),
      )
      .setOrigin(0, 0);
    clipLine(detail, textWidth);
  }
}

/** Draws the eye and the count with its right edge at `right`; returns the width taken. */
function drawWatchBadge(
  scene: Phaser.Scene,
  options: ChromeOptions,
  badge: WatchBadge,
  right: number,
  bar: Rect,
  whole: Rect,
): number {
  const middle = bar.y + bar.height / 2;
  // The count appears once anyone watches; before that the eye stands alone.
  const count =
    badge.count > 0
      ? scene.add
          .text(right, middle, String(badge.count), textStyle(typeRole.statSmall, surface.paper.hex))
          .setOrigin(1, 0.5)
      : null;
  const eyeWidth = 20;
  const eyeRight = count ? count.x - count.width - 6 : right;
  const cx = eyeRight - eyeWidth / 2;
  const g = scene.add.graphics();
  g.lineStyle(2, surface.paper.hex, 1);
  // The lid: two arcs meeting at the corners; the iris: a filled disc.
  g.beginPath();
  g.moveTo(cx - eyeWidth / 2, middle);
  g.lineTo(cx - eyeWidth / 4, middle - 5);
  g.lineTo(cx + eyeWidth / 4, middle - 5);
  g.lineTo(cx + eyeWidth / 2, middle);
  g.lineTo(cx + eyeWidth / 4, middle + 5);
  g.lineTo(cx - eyeWidth / 4, middle + 5);
  g.closePath();
  g.strokePath();
  g.fillStyle(surface.paper.hex, 1).fillCircle(cx, middle, 3);
  // A hit zone so a hover or long press names it: "3 watching".
  const left = cx - eyeWidth / 2;
  options.onWatchRect?.({ x: left - 4, y: bar.y, width: right - left + 8, height: bar.height });
  const zone = scene.add.zone(left - 4, bar.y, right - left + 8, bar.height).setOrigin(0, 0);
  zone.setName(badge.label);
  if (options.onWatch) {
    zone.setInteractive({ useHandCursor: true });
    onTap(zone, options.onWatch, "chrome-watch");
  }
  if (options.watchToast) {
    // A chip just under the bar, right-aligned to the control; words, never colour alone.
    const toast = scene.add
      .text(right, whole.y + whole.height + 6, options.watchToast, textStyle(typeRole.label, surface.ink.hex))
      .setOrigin(1, 0)
      .setPadding(8, 5, 8, 5)
      .setBackgroundColor(cssOf(surface.paper.hex))
      .setDepth(50);
    toast.setWordWrapWidth(Math.max(120, right - whole.x - 16));
  }
  return right - left;
}

/**
 * A live game's label for the log line (#876), words and a glyph so colour never carries it alone: a red "● LIVE" whose
 * dot pulses (steady under reduced motion), a muted "○ HOST AWAY", a caution-coloured "FEED LOST". Returns the object
 * that ends the label, so the line starts after it.
 */
function drawLiveWord(scene: Phaser.Scene, live: LivePill, x: number, middle: number): Phaser.GameObjects.Text {
  const colour =
    live.tone === "live" ? accent.heroRed.hex : live.tone === "failed" ? signal.caution.hex : surface.paper.hex;
  const alpha = live.tone === "away" ? ink.meta : 1;
  let at = x;
  if (live.glyph) {
    const dot = scene.add.text(at, middle, live.glyph, textStyle(TICKER_WORD, colour, alpha)).setOrigin(0, 0.5);
    if (live.tone === "live" && !appSession().settings.reducedMotion) {
      scene.tweens.add({ targets: dot, alpha: 0.25, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    at += dot.width + 4;
  }
  return scene.add.text(at, middle, live.word, textStyle(TICKER_WORD, colour, alpha)).setOrigin(0, 0.5);
}

/** The log's line: LOG, the newest thing that happened cut with an ellipsis, and a press that opens the log. */
function drawLogTicker(scene: Phaser.Scene, rect: Rect, options: ChromeOptions): void {
  const { log, hints } = options;
  if (rect.width < 90) return;
  const g = scene.add.graphics();
  g.lineStyle(1.5, surface.paper.hex, log.open ? 1 : ink.disabled).strokeRect(rect.x, rect.y, rect.width, rect.height);
  if (log.open) g.fillStyle(surface.paper.hex, 0.14).fillRect(rect.x, rect.y, rect.width, rect.height);
  const middle = rect.y + rect.height / 2;
  const alpha = log.enabled ? ink.body : ink.meta;
  const word = options.live
    ? drawLiveWord(scene, options.live, rect.x + 8, middle)
    : scene.add
        .text(rect.x + 8, middle, `${log.open ? "▾" : "▸"} LOG`, textStyle(TICKER_WORD, signal.caution.hex, alpha))
        .setOrigin(0, 0.5);
  const textX = word.x + word.width + 8;
  const glyphRoom = hints && rect.width > 360 ? TICKER_GLYPH_ROOM : 0;
  const line = scene.add
    .text(textX, middle, log.text, textStyle(TICKER_LINE, surface.paper.hex, alpha))
    .setOrigin(0, 0.5);
  clipLine(line, rect.x + rect.width - 8 - glyphRoom - textX);
  options.onLogRect?.(rect);
  if (!log.enabled) return;
  if (glyphRoom > 0) hints?.rightInRow(rect, rect.y, rect.height, 6, ["log"], 16, "ink");
  const zone = scene.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0);
  zone.setInteractive({ useHandCursor: true });
  onTap(zone, log.onPress, "chrome-log");
}

/**
 * Re-parents freshly drawn objects into a container pinned at `(cx, cy)` and
 * tweens it from a 1.25 scale down to its resting 1, picking up wherever
 * `state.progress` says the pop already is — the same "redraw mid-flight
 * resumes, never restarts" trick `character-panel.ts#turnSideways` uses for
 * the exhaust turn.
 */
function animateStampScale(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  drawn: readonly Phaser.GameObjects.GameObject[],
  state: StatusStampState,
): void {
  if (drawn.length === 0) return;
  for (const object of drawn) {
    const placed = object as Phaser.GameObjects.GameObject & { x?: number; y?: number };
    if (typeof placed.x === "number") placed.x -= cx;
    if (typeof placed.y === "number") placed.y -= cy;
  }
  const container = scene.add.container(cx, cy, [...drawn]);
  container.setScale(lerp(1.25, 1, state.progress));
  scene.tweens.add({ targets: container, scale: 1, duration: state.remainingMs, ease: "Back.easeOut" });
}

/** The same re-parenting trick, for a plain alpha fade-in with no scale or pivot involved. */
function animateStampAlpha(
  scene: Phaser.Scene,
  drawn: readonly Phaser.GameObjects.GameObject[],
  state: StatusStampState,
): void {
  if (drawn.length === 0) return;
  const container = scene.add.container(0, 0, [...drawn]);
  container.setAlpha(lerp(0, 1, state.progress));
  scene.tweens.add({ targets: container, alpha: 1, duration: state.remainingMs, ease: "Quad.easeOut" });
}

export interface PhoneTabsState {
  readonly activeTab: PhoneTab;
  /** Changes that landed on a tab the player isn't looking at, per tab. */
  readonly badges: ReadonlyMap<PhoneTab, number>;
  onSelect(tab: PhoneTab): void;
}

const TAB_LABELS: Record<PhoneTab, string> = {
  threat: "Threat",
  enemies: "Enemies",
  me: "Me",
  team: "Team",
  log: "Log",
};

/**
 * The phone board's zone rail. Only one tabbed zone has a rectangle at a time
 * (`layout.ts`), so this is what makes the other four reachable at all.
 *
 * A tab the player isn't on carries a change badge, because a card that moves
 * to a hidden zone would otherwise happen silently.
 */
export function drawPhoneTabs(scene: Phaser.Scene, rect: Rect, model: BoardModel, state: PhoneTabsState): McTabs {
  // A solo game has no other seats, so it has no Team tab to offer.
  const tabs = PHONE_RAIL_TABS.filter((tab) => tab !== "team" || model.team.length > 0);

  return new McTabs(scene, {
    rect,
    tabs: tabs.map((tab) => ({
      id: tab,
      label: TAB_LABELS[tab],
      ...(state.badges.get(tab) ? { badge: state.badges.get(tab)! } : {}),
    })),
    activeId: state.activeTab,
    onSelect: (id) => state.onSelect(id as PhoneTab),
  });
}
