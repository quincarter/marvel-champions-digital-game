/**
 * The Board's chrome: the ink bar across the top, and the phone board's tab rail.
 */

import type Phaser from "phaser";
import { accent, ink, signal, surface, typeRole, type TypeSpec } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { McButton, McTabs } from "../../ui/widgets.js";
import type { BoardModel } from "../../view/board-model.js";
import { PHONE_TABS, type PhoneTab, type Rect } from "../../view/layout.js";

/** The phone board's "≡" menu icon (see `drawChrome`'s own comment for why this isn't `typeRole.label`). */
const MENU_ICON_TYPE: TypeSpec = { ...typeRole.label, size: 20, letterSpacing: 0, uppercase: false };

export interface ChromeOptions {
  readonly notSaving?: boolean;
  /** Opens the Pause overlay (docs/phase4-screen-gaps.md §3 "W4"). Every board layout gets this button. */
  readonly onMenu: () => void;
  /** The menu button is a real `McButton` (it needs a click/hover/focus state), so it's handed back for the caller's own frame bookkeeping — same reason `drawActionBar` pushes onto `ctx.frame.buttons` instead of owning its own list. */
  readonly buttons: McButton[];
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
 * The menu button sits at the very right edge, ahead of even the "NOT SAVING"
 * chip and the 1st-player mark — pausing has to stay reachable regardless of
 * how much else the bar is showing. It reads "MENU" on the long table
 * (`rect.width >= 640`, the same breakpoint the phase toggle uses) and "≡" on
 * the phone board, matching `Board - Long Table.dc.html` / `Board - Phone.dc.html`.
 */
export function drawChrome(scene: Phaser.Scene, rect: Rect, model: BoardModel, options: ChromeOptions): void {
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);

  const wide = rect.width >= 640;
  const menuWidth = wide ? 76 : 40;
  const menuRect: Rect = { x: rect.x + rect.width - 8 - menuWidth, y: rect.y + 5, width: menuWidth, height: rect.height - 10 };
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

  // The live round chip is the one red besides the forward action.
  const chip: Rect = { x: rect.x + 8, y: rect.y + 5, width: 54, height: rect.height - 10 };
  const chipG = scene.add.graphics();
  chipG.fillStyle(accent.heroRed.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
  scene.add
    .text(chip.x + chip.width / 2, chip.y + chip.height / 2, `RD ${model.round}`, textStyle(typeRole.statSmall, surface.paper.hex))
    .setOrigin(0.5);

  let left = chip.x + chip.width + 10;
  const showToggle = wide;
  if (showToggle) {
    // Two-state phase toggle: whichever side's clock is running is filled.
    (["player", "villain"] as const).forEach((phase, index) => {
      const box: Rect = { x: left + index * 86, y: chip.y, width: 82, height: chip.height };
      const active = model.phase === phase;
      const bg = scene.add.graphics();
      bg.fillStyle(active ? surface.paper.hex : surface.ink.hex, 1).fillRect(box.x, box.y, box.width, box.height);
      bg.lineStyle(2, surface.paper.hex, active ? 1 : ink.meta).strokeRect(box.x, box.y, box.width, box.height);
      scene.add
        .text(box.x + box.width / 2, box.y + box.height / 2, phase.toUpperCase(), textStyle(typeRole.label, active ? surface.ink.hex : surface.paper.hex, active ? 1 : ink.meta))
        .setOrigin(0.5)
        .setLetterSpacing(typeRole.label.letterSpacing);
    });
    left += 86 * 2 + 18;
  }

  const notSaving = options.notSaving ?? false;
  const firstPlayer = !notSaving && model.firstPlayerId === model.perspectiveId && rect.width >= 520;
  let rightEdge = menuRect.x - 10 - (firstPlayer ? 86 : 0);
  if (notSaving) {
    // A glyph as well as the hue, so the warning never rests on colour alone.
    const warning = scene.add
      .text(menuRect.x - 8, rect.y + rect.height / 2, "⚠ NOT SAVING", textStyle(typeRole.label, surface.ink.hex))
      .setOrigin(1, 0.5)
      .setLetterSpacing(typeRole.label.letterSpacing)
      .setPadding(6, 3, 6, 3)
      .setBackgroundColor(cssOf(signal.caution.hex));
    rightEdge = warning.x - warning.width - 8;
  }
  scene.add
    .text(left, rect.y + rect.height / 2, model.stepLabel, textStyle(typeRole.emphasis, surface.paper.hex, ink.secondary))
    .setOrigin(0, 0.5)
    .setWordWrapWidth(Math.max(40, rightEdge - left))
    .setMaxLines(1);

  if (firstPlayer) {
    scene.add
      .text(menuRect.x - 10, rect.y + rect.height / 2, "1ST PLAYER", textStyle(typeRole.label, signal.caution.hex))
      .setOrigin(1, 0.5)
      .setLetterSpacing(typeRole.label.letterSpacing);
  }
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
  const tabs = PHONE_TABS.filter((tab) => tab !== "team" || model.team.length > 0);

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
