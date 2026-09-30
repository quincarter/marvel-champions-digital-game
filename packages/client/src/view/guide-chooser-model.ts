/**
 * The first-run chooser (guided mode G6a, `docs/guided-mode.md` §3.9, §4): "New to the fight?" — three guide-level
 * radio cards (Learn as you play / Hints only / No guide) and a single forward action, "Suit up". Pure data plus a
 * pure layout, same split as every other screen in this codebase — `scenes/guide-chooser.ts` draws it, this module
 * decides what to draw and where.
 *
 * Content is real, not the design tiles' placeholder Crossbones/Spider-Woman matchup (`docs/guided-mode.md` §1):
 * the tutorial is Core Set Rhino with Spider-Man (§3.1), and the lesson chips shown on wide layouts come straight
 * from `guide/tutorial-lessons.ts`'s own five lessons, in their real order — never a second, hand-copied list that
 * could drift from what the tutorial actually teaches.
 */
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export type GuideChooserValue = "full" | "hints" | "off";

export interface GuideChooserOptionInfo {
  readonly value: GuideChooserValue;
  readonly label: string;
  readonly body: string;
  readonly recommended: boolean;
}

/** The three radio cards, top to bottom — wording from `docs/guided-mode.md` §4 G6a's own brief. */
export const GUIDE_CHOOSER_OPTIONS: readonly GuideChooserOptionInfo[] = [
  {
    value: "full",
    label: "Learn as you play",
    body: "A real first game against Rhino. The guide explains each step as it happens.",
    recommended: true,
  },
  {
    value: "hints",
    label: "Hints only",
    body: "Play any scenario. The guide stays quiet unless you're about to make a costly mistake.",
    recommended: false,
  },
  {
    value: "off",
    label: "No guide",
    body: "I know the rules.",
    recommended: false,
  },
] as const;

/** "1 · HOW TO WIN", "2 · HERO & ALTER-EGO", … — the tutorial's real five lessons, in their real order (§3.4), for the "Learn as you play" card's chip row on wide layouts. */
export function guideChooserLessonChips(): readonly string[] {
  return TUTORIAL_LESSONS.map((lesson, index) => `${index + 1} · ${lesson.title}`.toUpperCase());
}

export interface GuideChooserLayout {
  readonly formFactor: FormFactor;
  /** Desktop/tabletLandscape: art on the left, choices on the right (T01). Phone/tabletPortrait: stacked (P01). */
  readonly wide: boolean;
  /** Left art panel on wide layouts; full-bleed background on narrow ones. Always drawn — a picture is never skipped for room. */
  readonly art: Rect;
  readonly banner: Rect;
  readonly subtitle: Rect;
  /** The three radio cards, in `GUIDE_CHOOSER_OPTIONS` order. */
  readonly options: readonly Rect[];
  /** The lesson-chip row inside the first ("Learn as you play") card — wide only; zero-area on narrow. */
  readonly chipsRow: Rect;
  /** Wide only; zero-area on narrow (no Back on P01). */
  readonly back: Rect;
  readonly suitUp: Rect;
}

const PAD = 24;
const NARROW_PAD = 16;
const GAP = 12;
const SUBTITLE_HEIGHT = 40;
const BANNER_HEIGHT = 56;
const OPTION_GAP = 10;
const SUIT_UP_HEIGHT = 52;
const BACK_WIDTH = 96;
/** Room for the lesson chips, up to two wrapped rows (`view/guide-chooser-model.ts`'s own chip widths vary with each lesson's title length, so five chips don't reliably fit one row at every wide width). */
const CHIP_ROW_HEIGHT = 52;
/** Wide art panel width, mirroring `title-menu-layout.ts`'s own split-screen proportions. */
const WIDE_ART_WIDTH_RATIO = 0.42;

/** One radio card's height: taller for the recommended card on wide layouts, which also reserves the chip row. */
function optionHeight(option: GuideChooserOptionInfo, wide: boolean): number {
  if (wide) return option.recommended ? 128 + (CHIP_ROW_HEIGHT - 24) : 78;
  return option.recommended ? 100 : 66;
}

function wideLayout(width: number, height: number, formFactor: FormFactor): GuideChooserLayout {
  const artWidth = Math.round(width * WIDE_ART_WIDTH_RATIO);
  const art: Rect = { x: 0, y: 0, width: artWidth, height };
  const columnLeft = artWidth + PAD;
  const columnWidth = width - columnLeft - PAD;

  // The banner sits at the art panel's own foot, matching T01 — the choices column opens with the subtitle
  // right below the header, so every wide field (art, banner, choices) stays inside its own rect with no
  // overlap to reason about.
  const banner: Rect = {
    x: art.x + 20,
    y: art.height - BANNER_HEIGHT - 20,
    width: Math.min(280, artWidth - 40),
    height: BANNER_HEIGHT,
  };

  const suitUpY = height - PAD - SUIT_UP_HEIGHT;
  const suitUp: Rect = { x: columnLeft, y: suitUpY, width: columnWidth * 0.62, height: SUIT_UP_HEIGHT };
  const back: Rect = {
    x: columnLeft + columnWidth - BACK_WIDTH,
    y: suitUpY,
    width: BACK_WIDTH,
    height: SUIT_UP_HEIGHT,
  };

  const subtitle: Rect = { x: columnLeft, y: PAD, width: columnWidth, height: SUBTITLE_HEIGHT };
  const optionsTop = subtitle.y + subtitle.height + GAP;

  const options: Rect[] = [];
  let chipsRow: Rect = { x: columnLeft, y: optionsTop, width: 0, height: 0 };
  let oy = optionsTop;
  for (const option of GUIDE_CHOOSER_OPTIONS) {
    const h = optionHeight(option, true);
    const rect: Rect = { x: columnLeft, y: oy, width: columnWidth, height: h };
    options.push(rect);
    if (option.recommended) {
      chipsRow = {
        x: columnLeft + 20,
        y: oy + h - CHIP_ROW_HEIGHT - 12,
        width: columnWidth - 40,
        height: CHIP_ROW_HEIGHT,
      };
    }
    oy += h + OPTION_GAP;
  }

  return {
    formFactor,
    wide: true,
    art,
    banner,
    subtitle,
    options,
    chipsRow,
    back,
    suitUp,
  };
}

function narrowLayout(width: number, height: number, formFactor: FormFactor): GuideChooserLayout {
  const pad = NARROW_PAD;
  const column = width - pad * 2;
  const art: Rect = { x: 0, y: 0, width, height: Math.round(height * 0.42) };
  const banner: Rect = {
    x: pad,
    y: art.height - BANNER_HEIGHT - 20,
    width: Math.min(240, column),
    height: BANNER_HEIGHT,
  };

  let y = art.height + 20;
  const subtitle: Rect = { x: pad, y, width: column, height: SUBTITLE_HEIGHT };
  y += subtitle.height + GAP;

  const options: Rect[] = [];
  for (const option of GUIDE_CHOOSER_OPTIONS) {
    const h = optionHeight(option, false);
    options.push({ x: pad, y, width: column, height: h });
    y += h + OPTION_GAP;
  }

  const suitUp: Rect = { x: pad, y: height - pad - SUIT_UP_HEIGHT, width: column, height: SUIT_UP_HEIGHT };

  return {
    formFactor,
    wide: false,
    art,
    banner,
    subtitle,
    options,
    chipsRow: { x: pad, y: subtitle.y, width: 0, height: 0 },
    back: { x: pad, y: suitUp.y, width: 0, height: 0 },
    suitUp,
  };
}

export function guideChooserLayout(width: number, height: number): GuideChooserLayout {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  return wide ? wideLayout(width, height, formFactor) : narrowLayout(width, height, formFactor);
}

/** Every drawn content region except `art` (the picture is a background, not content to keep clear of) — for a no-overlap test. */
export function guideChooserLayoutRects(layout: GuideChooserLayout): readonly Rect[] {
  const rects: Rect[] = [layout.banner, layout.subtitle, ...layout.options, layout.suitUp];
  if (layout.back.width > 0) rects.push(layout.back);
  return rects;
}

/** Focus order: each radio card, then (wide only) Back, then Suit up. */
export function guideChooserFocusOrder(wide: boolean): readonly string[] {
  return [...GUIDE_CHOOSER_OPTIONS.map((option) => `option:${option.value}`), ...(wide ? ["back"] : []), "suit-up"];
}
