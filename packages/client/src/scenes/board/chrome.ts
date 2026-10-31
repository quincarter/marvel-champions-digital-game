/**
 * The Board's chrome: the ink bar across the top, and the phone board's tab rail.
 */

import type Phaser from "phaser";
import { accent, ink, signal, surface, typeRole, type TypeSpec } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { onTap } from "../../ui/tap.js";
import { McButton, McTabs, clipLine } from "../../ui/widgets.js";
import type { BoardModel } from "../../view/board-model.js";
import { lerp } from "../../view/motion-math.js";
import { CHROME_HEIGHT, CHROME_TICKER_ROW, PHONE_RAIL_TABS, type PhoneTab, type Rect } from "../../view/layout.js";
import type { LogTicker } from "../../view/log-dock.js";
import type { GlyphHints } from "../../ui/glyph-hints.js";
import type { BoardMotion, StatusStampState } from "./motion.js";
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

export interface ChromeOptions {
  readonly notSaving?: boolean;
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
export function drawChrome(scene: Phaser.Scene, whole: Rect, model: BoardModel, options: ChromeOptions): void {
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(whole.x, whole.y, whole.width, whole.height);
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

/** The log's line: LOG, the newest thing that happened cut with an ellipsis, and a press that opens the log. */
function drawLogTicker(scene: Phaser.Scene, rect: Rect, options: ChromeOptions): void {
  const { log, hints } = options;
  if (rect.width < 90) return;
  const g = scene.add.graphics();
  g.lineStyle(1.5, surface.paper.hex, log.open ? 1 : ink.disabled).strokeRect(rect.x, rect.y, rect.width, rect.height);
  if (log.open) g.fillStyle(surface.paper.hex, 0.14).fillRect(rect.x, rect.y, rect.width, rect.height);
  const middle = rect.y + rect.height / 2;
  const alpha = log.enabled ? ink.body : ink.meta;
  const word = scene.add
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
