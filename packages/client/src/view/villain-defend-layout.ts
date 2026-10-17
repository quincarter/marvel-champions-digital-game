/**
 * The docked defend decision's geometry (B1 desktop, TB1 tablet landscape, TB3 tablet portrait in
 * `artifacts/design-screenshots/villain-phase/`).
 *
 * The villain phase's dock grows for a defend (`view/villain-dock.ts`: the wide rail on desktop, the tall band on a
 * tablet in landscape, the tab panel on a phone or a tablet in portrait), and the choice is drawn inside it instead of
 * on the full-screen sheet. Top to bottom:
 *  - the header: the eyebrow ("VILLAIN PHASE · STEP 2 · …"), the title ("RHINO ATTACKS YOU") and EXPAND, which opens
 *    the full-screen sheet instead;
 *  - the matchup: the attacker's scan, BASE ATK and the arrow, the defender's scan, the facedown boost, a note;
 *  - "DECLARE A DEFENDER" and the options, as cards side by side where the width allows (the picture over the text) or
 *    as rows (the picture beside the text), wrapping to more rows rather than squeezing;
 *  - the stack, bottom left, and CONFIRM, bottom right. On a tabbed layout CONFIRM is in the footer (the action bar's
 *    place, at the thumb), the stack takes the panel's foot.
 *
 * The dock is proportional to the viewport (about 600 to 1100 wide on desktop), so nothing here assumes a width: the
 * options reflow between one and three across, the matchup's cards scale with the height they are given, and when the
 * height is short the matchup and the option cards give back, then the stack goes, before anything overlaps.
 *
 * Pure geometry, no text measurement.
 */
import { hit } from "../tokens.js";
import { defendMatchupLayout, type DefendMatchupLayout } from "./defend-choice-layout.js";
import type { Rect } from "./layout.js";

export type DefendDockKind = "rail" | "band" | "tab";

export interface VillainDefendInput {
  /** Where the Board left room for the phase (`VillainDockRects.panel`). */
  readonly panel: Rect;
  readonly kind: DefendDockKind;
  readonly optionCount: number;
  /** The action bar's rectangle on a tabbed layout: CONFIRM sits there. */
  readonly footer?: Rect | null;
}

export interface VillainDefendLayout {
  readonly kind: DefendDockKind;
  readonly panel: Rect;
  /** True when the panel is short or narrow enough that text steps down a size. */
  readonly compact: boolean;
  readonly eyebrow: Rect;
  readonly title: Rect;
  readonly expand: Rect;
  /**
   * HIDE ▸ (rail, band) or PEEK AT TABLE ▾ (a phone's tab) to see the whole table (#231): left of EXPAND in the header,
   * or beside CONFIRM in a phone's thumb strip, clear of the Now playing toast that slides in under the chrome.
   */
  readonly tuck: Rect;
  readonly matchup: Rect;
  readonly matchupParts: DefendMatchupLayout;
  readonly optionsLabel: Rect;
  readonly options: readonly Rect[];
  /** "top": the picture over the text; "left": the picture beside it. */
  readonly orientation: "top" | "left";
  /** Zero height when there is no room for it. */
  readonly stack: Rect;
  readonly confirm: Rect;
  /** True when CONFIRM is drawn in the footer, outside the panel. */
  readonly confirmInFooter: boolean;
  /**
   * False when even the most compact arrangement does not hold every option (four defenders on a phone): the scene
   * then leaves the choice to the full-screen sheet, which scrolls.
   */
  readonly fits: boolean;
  /**
   * The most compact shape: one short row per option, the matchup left out (the title already says who attacks whom).
   * Used when the options would not otherwise fit, so a phone holds a defend with three or four defenders docked.
   */
  readonly dense: boolean;
}

const CARD_RATIO = 63 / 88;
const GAP = 10;
const LABEL_HEIGHT = 20;
const STACK_HEIGHT = 60;
/** The matchup chrome around its scans: the padding and the two caption lines (`defendMatchupLayout`). */
const MATCHUP_CHROME = 12 * 2 + 16 * 2;
const MATCHUP_CARD_PREF = { rail: 150, band: 96, tab: 130 } as const;
const MATCHUP_CARD_MIN = 56;
/** Narrowest a "picture over text" card gets before the options wrap to another row. */
const TOP_CELL_MIN = 170;
const LEFT_CELL_MIN = 300;
const TOP_OPTION = { pref: 262, min: 196 } as const;
const LEFT_OPTION = { pref: 116, min: 84 } as const;
const DENSE_OPTION = { pref: 84, min: 64 } as const;

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

export function villainDefendLayout(input: VillainDefendInput): VillainDefendLayout {
  const { panel, kind } = input;
  const count = Math.max(1, input.optionCount);
  const pad = kind === "tab" ? 12 : 20;
  const x = panel.x + pad;
  const width = Math.max(0, panel.width - pad * 2);
  const bottom = panel.y + panel.height - pad;
  const compact = panel.height < 560 || panel.width < 480;

  // Header.
  const expandWidth = compact ? 104 : 116;
  const expand: Rect = { x: x + width - expandWidth, y: panel.y + pad, width: expandWidth, height: hit.target };
  const footerTuck = kind === "tab" && (input.footer ?? null) !== null;
  const tuckWidth = compact ? 96 : 112;
  const headerTuck: Rect = { x: expand.x - 8 - tuckWidth, y: expand.y, width: tuckWidth, height: hit.target };
  const headerRight = footerTuck ? expand.x : headerTuck.x;
  const eyebrow: Rect = { x, y: panel.y + pad, width: Math.max(0, headerRight - 12 - x), height: 16 };
  const titleHeight = compact ? 28 : 36;
  const title: Rect = { x, y: eyebrow.y + 20, width: eyebrow.width, height: titleHeight };
  const headerBottom = Math.max(title.y + title.height, expand.y + expand.height);

  // The bottom row: CONFIRM (and the stack beside it) on the panel, or the stack alone over a footer CONFIRM.
  const footer = input.footer ?? null;
  const confirmInFooter = kind === "tab" && footer !== null;
  const confirmHeight = hit.primary + 4;
  const confirmWidth = clamp(Math.round(width * 0.46), Math.min(width, 240), 430);
  const bottomRowFor = (withStack: boolean): number =>
    confirmInFooter ? (withStack ? STACK_HEIGHT : 0) : Math.max(confirmHeight, withStack ? STACK_HEIGHT : 0);
  const optionsTop0 = headerBottom + 10;

  // How many options go across, and which way each card reads, depends on what fits: the picture over the text where
  // the width allows several across and the height allows their taller card, else rows with the picture beside the text.
  const plan = (orientation: "top" | "left", withStack: boolean, dense = false, noMatchup = false) => {
    const across =
      orientation === "top"
        ? clamp(Math.floor((width + GAP) / (TOP_CELL_MIN + GAP)), 1, count)
        : clamp(Math.floor((width + GAP) / (LEFT_CELL_MIN + GAP)), 1, count);
    const rows = Math.ceil(count / across);
    const spec = dense ? DENSE_OPTION : orientation === "top" ? TOP_OPTION : LEFT_OPTION;
    const rowsHeight = (rowHeight: number): number => rows * rowHeight + (rows - 1) * GAP;
    const lower = bottom - bottomRowFor(withStack) - (bottomRowFor(withStack) > 0 ? 12 : 0);
    const room = lower - optionsTop0;
    const fixed = 12 + LABEL_HEIGHT + 6; // gaps either side of the label, and the label
    const matchupPref = noMatchup ? 0 : MATCHUP_CARD_PREF[kind] + MATCHUP_CHROME;
    const matchupMin = noMatchup ? 0 : MATCHUP_CARD_MIN + MATCHUP_CHROME;
    const matchupHeight = clamp(room - fixed - rowsHeight(spec.pref), matchupMin, matchupPref);
    const optionHeight = clamp((room - fixed - matchupHeight - (rows - 1) * GAP) / rows, spec.min, spec.pref);
    const used = matchupHeight + fixed + rowsHeight(optionHeight);
    return { orientation, across, matchupHeight, optionHeight, fits: used <= room + 0.5, withStack, dense };
  };
  const candidates = [
    plan("top", true),
    plan("left", true),
    plan("top", false),
    plan("left", false),
    plan("left", false, true),
    plan("left", false, true, true),
  ];
  // The first that fits; short of that, the densest rows, which give back the most.
  const chosen = candidates.find((candidate) => candidate.fits) ?? candidates[candidates.length - 1]!;
  const { orientation, across, withStack } = chosen;
  const fit = chosen;

  const matchup: Rect = { x, y: optionsTop0, width, height: Math.round(fit.matchupHeight) };
  // The sheet's own matchup geometry, always in its wide shape: notes beside the scans, or none when there is no room.
  const matchupParts = defendMatchupLayout(matchup, "desktop");
  const optionsLabel: Rect = { x, y: matchup.y + matchup.height + 12, width, height: LABEL_HEIGHT };
  const optionsTop = optionsLabel.y + LABEL_HEIGHT + 6;
  const optionHeight = Math.round(fit.optionHeight);
  const cellWidth = (width - GAP * (across - 1)) / across;
  const options: Rect[] = Array.from({ length: count }, (_unused, i) => ({
    x: x + (i % across) * (cellWidth + GAP),
    y: optionsTop + Math.floor(i / across) * (optionHeight + GAP),
    width: cellWidth,
    height: optionHeight,
  }));

  const confirm: Rect =
    confirmInFooter && footer
      ? {
          x: footer.x + 8,
          y: footer.y + 6,
          width: Math.round((footer.width - 24) * 0.62),
          height: Math.max(hit.target, footer.height - 12),
        }
      : { x: x + width - confirmWidth, y: bottom - confirmHeight, width: confirmWidth, height: confirmHeight };
  const tuck: Rect =
    confirmInFooter && footer
      ? {
          x: confirm.x + confirm.width + 8,
          y: confirm.y,
          width: footer.x + footer.width - 8 - (confirm.x + confirm.width + 8),
          height: confirm.height,
        }
      : headerTuck;
  const stackHeight = withStack ? STACK_HEIGHT : 0;
  const stack: Rect = confirmInFooter
    ? { x, y: bottom - stackHeight, width, height: stackHeight }
    : {
        x,
        y: bottom - Math.max(stackHeight, 0),
        width: Math.max(0, confirm.x - 16 - x),
        height: stackHeight,
      };

  return {
    kind,
    panel,
    compact,
    eyebrow,
    title,
    expand,
    tuck,
    matchup,
    matchupParts,
    optionsLabel,
    options,
    orientation,
    stack,
    confirm,
    confirmInFooter,
    fits: chosen.fits,
    dense: chosen.dense,
  };
}

/** Where an option card's picture and text go inside its cell. */
export interface DefendOptionParts {
  /** Null when the cell is too small to hold a scan beside readable text. */
  readonly picture: Rect | null;
  readonly text: Rect;
}

const OPTION_PAD = 10;
/** What a card's text stack (title, cost, damage, HP line) needs at its least. */
const TEXT_STACK_MIN = 112;

export function villainDefendOptionParts(slot: Rect, orientation: "top" | "left"): DefendOptionParts {
  if (orientation === "top") {
    const room = slot.height - OPTION_PAD - TEXT_STACK_MIN - 8;
    const height = Math.min(room, 170, Math.round((slot.width - OPTION_PAD * 2) / CARD_RATIO));
    if (height < 56) {
      return {
        picture: null,
        text: {
          x: slot.x + OPTION_PAD,
          y: slot.y + OPTION_PAD,
          width: slot.width - OPTION_PAD * 2,
          height: slot.height - OPTION_PAD * 2,
        },
      };
    }
    const picture: Rect = {
      x: slot.x + OPTION_PAD,
      y: slot.y + OPTION_PAD,
      width: Math.round(height * CARD_RATIO),
      height,
    };
    const top = picture.y + picture.height + 8;
    return {
      picture,
      text: {
        x: slot.x + OPTION_PAD,
        y: top,
        width: slot.width - OPTION_PAD * 2,
        height: slot.y + slot.height - OPTION_PAD - top,
      },
    };
  }
  const height = Math.min(slot.height - OPTION_PAD * 2, 150);
  const width = Math.round(height * CARD_RATIO);
  const room = slot.width - width - OPTION_PAD * 3;
  if (height < 56 || room < 110) {
    return {
      picture: null,
      text: {
        x: slot.x + OPTION_PAD,
        y: slot.y + OPTION_PAD,
        width: slot.width - OPTION_PAD * 2,
        height: slot.height - OPTION_PAD * 2,
      },
    };
  }
  const picture: Rect = { x: slot.x + OPTION_PAD, y: slot.y + OPTION_PAD, width, height };
  return {
    picture,
    text: {
      x: picture.x + width + OPTION_PAD,
      y: slot.y + OPTION_PAD,
      width: room,
      height: slot.height - OPTION_PAD * 2,
    },
  };
}
