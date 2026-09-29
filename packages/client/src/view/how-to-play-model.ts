/**
 * "How to play" (guided mode G6c part 1, `docs/guided-mode.md` §4): the learning hub Title's own menu opens, plus
 * Settings' "Play the tutorial", the round debrief's "Replay a lesson" and the chips' "Aspects ▸" once G10c lands.
 * Pure data plus a pure layout, the same split as `guide-chooser-model.ts`/`how-to-win-model.ts`.
 *
 * **Three modules**, each reading done/next state straight from the live `GuidePrefs` (`guide/guide-store.ts`)
 * rather than any second copy of progress:
 * - **THE BASICS**: the tutorial's real five lessons (`guide/tutorial-lessons.ts` `TUTORIAL_LESSONS`), each ✓ done
 *   or "Next" — the first one not in `prefs.tutorial.lessonsDone` is the recommended one.
 * - **ASPECTS**: the four playable aspects from `guide/aspects.ts` `ASPECT_GUIDES` (Basic is skipped — it has a
 *   tip card, not a lesson, per §5.4's own table), each with its tagline and a done mark from
 *   `prefs.aspectLessonsDone`. §5.4's `'Pool` isn't in `ASPECT_GUIDES` yet either, so nothing extra is needed here
 *   to skip it.
 * - **REFERENCE**: rules reference and glossary — one row, no progress state.
 *
 * `howToPlayModules` never throws on missing content the way `how-to-win-model.ts` does for the tutorial matchup:
 * every row here is drawn from data (`TUTORIAL_LESSONS`, `ASPECT_GUIDES`) that already exists at build time, so a
 * missing lesson or aspect would be a real bug caught by `tutorial-lessons.test.ts`/`aspects.test.ts`, not
 * something this screen needs to guard against a second time.
 *
 * **Layout is two parts.** `howToPlayHeaderLayout` sizes the fixed header (Back ×, title) — never scrolled.
 * `howToPlayContentLayout` sizes everything below it in *content space*: `x` absolute (screen space, already
 * inset by the scene's own padding), `y` measured from the content's own top (0) — the same convention
 * `McScrollRegion` (`ui/scroll-region.ts`) documents for every other scrolling screen in this app (Settings,
 * Table setup). The scene wraps that in a `McScrollRegion` viewport starting just below the header, so a short
 * phone screen scrolls the modules while the header stays put, and a tall desktop window shows the whole thing
 * with no scrollbar at all (`McScrollRegion` clamps its own offset to 0 when the content already fits).
 */
import { ASPECT_GUIDES, type AspectGuide } from "../guide/aspects.js";
import type { GuidePrefs } from "../guide/guide-prefs.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import { contentSlotHeights, formFactorFor, type FormFactor, type Rect } from "./layout.js";

export interface LessonRowInfo {
  readonly id: string;
  /** 1-based position in `TUTORIAL_LESSONS`, for "1", "2", … row numbering. */
  readonly index: number;
  readonly title: string;
  readonly done: boolean;
  /** True for the first lesson not yet done — the hub's own "GUIDE PICK" for where to go next. */
  readonly recommended: boolean;
}

export interface AspectRowInfo {
  readonly aspect: AspectGuide["aspect"];
  readonly name: string;
  readonly tagline: string;
  readonly done: boolean;
}

export interface ReferenceRowInfo {
  readonly title: string;
  readonly detail: string;
}

export interface HowToPlayModules {
  readonly lessons: readonly LessonRowInfo[];
  /** Index into `lessons` of the row "Continue learning ▸" starts, or `null` when every lesson is done. */
  readonly recommendedLessonIndex: number | null;
  readonly aspects: readonly AspectRowInfo[];
  readonly reference: ReferenceRowInfo;
}

/** The hub's three modules, built from the live `GuidePrefs` — no second progress record. */
export function howToPlayModules(prefs: GuidePrefs): HowToPlayModules {
  let recommendedLessonIndex: number | null = null;
  const lessons: LessonRowInfo[] = TUTORIAL_LESSONS.map((lesson, index) => {
    const done = prefs.tutorial.lessonsDone.includes(lesson.id);
    const recommended = !done && recommendedLessonIndex === null;
    if (recommended) recommendedLessonIndex = index;
    return { id: lesson.id, index: index + 1, title: lesson.title, done, recommended };
  });

  const aspects: AspectRowInfo[] = ASPECT_GUIDES.filter((guide) => guide.aspect !== "basic").map((guide) => ({
    aspect: guide.aspect,
    name: guide.name,
    tagline: guide.tagline,
    done: prefs.aspectLessonsDone.includes(guide.aspect),
  }));

  return {
    lessons,
    recommendedLessonIndex,
    aspects,
    reference: { title: "Rules & glossary", detail: "Every keyword and the full rules reference, searchable." },
  };
}

/** "Continue learning ▸" / "Play it again ▸" (once every lesson is done) — the hub's one red primary action's label. */
export function continueLearningLabel(modules: HowToPlayModules): string {
  return modules.recommendedLessonIndex === null ? "Play it again ▸" : "Continue learning ▸";
}

/** The lesson `"Continue learning ▸"` starts — the recommended one, or lesson 1 again once every lesson is done. */
export function continueLearningLesson(modules: HowToPlayModules): LessonRowInfo {
  return modules.lessons[modules.recommendedLessonIndex ?? 0]!;
}

const HEADER_HEIGHT = 64;
const CLOSE_SIZE = 44;
const PAD = 28;
const NARROW_PAD = 16;

export interface HowToPlayHeaderLayout {
  readonly formFactor: FormFactor;
  readonly pad: number;
  readonly header: Rect;
  readonly close: Rect;
  readonly title: Rect;
}

/** The fixed header — Back ×, "HOW TO PLAY" — never inside the scroll region. */
export function howToPlayHeaderLayout(width: number, height: number): HowToPlayHeaderLayout {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const pad = wide ? PAD : NARROW_PAD;
  const close: Rect = { x: pad, y: (HEADER_HEIGHT - CLOSE_SIZE) / 2, width: CLOSE_SIZE, height: CLOSE_SIZE };
  const header: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const title: Rect = {
    x: close.x + close.width + 12,
    y: 0,
    width: width - close.x - close.width - 12 - pad,
    height: HEADER_HEIGHT,
  };
  return { formFactor, pad, header, close, title };
}

export interface HowToPlayContentLayout {
  readonly formFactor: FormFactor;
  /** Desktop/tabletLandscape: two columns, Basics left, Aspects+Reference stacked right. Phone/tabletPortrait: one stacked column. */
  readonly wide: boolean;
  /** Content-space (`y` from 0) — every rect below is drawn inside a `McScrollRegion` at these coordinates. */
  readonly basicsLabel: Rect;
  /** One row per `HowToPlayModules.lessons` entry, same order. */
  readonly lessonRows: readonly Rect[];
  readonly aspectsLabel: Rect;
  /** One row per `HowToPlayModules.aspects` entry, same order. */
  readonly aspectRows: readonly Rect[];
  readonly referenceLabel: Rect;
  readonly referenceRow: Rect;
  readonly continueLearning: Rect;
  /** The content's own total height (`contentSlotHeights`'s own gap-inclusive convention) — `McScrollRegion`'s `heights` sums this for its scroll clamp. */
  readonly heights: readonly number[];
  readonly totalHeight: number;
  /**
   * Each row's own index into `heights`, for `McScrollRegion#scrollIntoView` (`topOf(heights, index)` must equal
   * that row's real content-space `y`, which only holds for rows in the *same* cumulative-sum sequence `heights`
   * was built from). On a narrow (single-column) layout every row is in that one sequence, so every index here is
   * exact. On a **wide** (two-column) layout the right column (Aspects, Reference) isn't part of the left
   * column's own cumulative sequence `heights` uses for `clamp`'s total — `aspectScrollIndex`/`referenceScrollIndex`
   * fall back to the nearest real checkpoint (the bottom of Basics) rather than a wrong mid-sequence number, so
   * `ensureVisible` still scrolls toward the right column without claiming a pixel-exact position it can't have
   * inside a single linear `heights` sequence that only tracks one column.
   */
  readonly lessonScrollIndex: readonly number[];
  readonly aspectScrollIndex: readonly number[];
  readonly referenceScrollIndex: number;
  readonly continueScrollIndex: number;
}

const SECTION_GAP = 28;
const LABEL_HEIGHT = 24;
const LABEL_ROW_GAP = 8;
const ROW_GAP = 10;
const LESSON_ROW_HEIGHT = 64;
const ASPECT_ROW_HEIGHT = 76;
const REFERENCE_ROW_HEIGHT = 64;
const CONTINUE_HEIGHT = 56;
const COLUMN_GAP = 24;

interface StackedSection {
  readonly label: Rect;
  readonly rows: readonly Rect[];
  readonly bottom: number;
}

/** One "LABEL + N rows" section stacked at `(x, top)`, each row `rowHeight` tall — the shape Basics, Aspects and Reference all share. */
function section(x: number, top: number, width: number, rowHeight: number, count: number): StackedSection {
  const label: Rect = { x, y: top, width, height: LABEL_HEIGHT };
  let y = top + LABEL_HEIGHT + LABEL_ROW_GAP;
  const rows: Rect[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({ x, y, width, height: rowHeight });
    y += rowHeight + ROW_GAP;
  }
  // No trailing `ROW_GAP` after the section's last row — the caller adds `SECTION_GAP` between sections itself.
  const bottom = count > 0 ? y - ROW_GAP : y;
  return { label, rows, bottom };
}

export function howToPlayContentLayout(
  width: number,
  height: number,
  modules: HowToPlayModules,
): HowToPlayContentLayout {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  const pad = wide ? PAD : NARROW_PAD;
  const contentWidth = width - pad * 2;

  if (wide) {
    const leftWidth = Math.round((contentWidth - COLUMN_GAP) * 0.48);
    const rightWidth = contentWidth - COLUMN_GAP - leftWidth;
    const rightX = pad + leftWidth + COLUMN_GAP;

    const basics = section(pad, 0, leftWidth, LESSON_ROW_HEIGHT, modules.lessons.length);
    const aspects = section(rightX, 0, rightWidth, ASPECT_ROW_HEIGHT, modules.aspects.length);
    const reference = section(rightX, aspects.bottom + SECTION_GAP, rightWidth, REFERENCE_ROW_HEIGHT, 1);

    const bottom = Math.max(basics.bottom, reference.bottom);
    const continueLearning: Rect = { x: pad, y: bottom + SECTION_GAP, width: contentWidth, height: CONTINUE_HEIGHT };
    const totalHeight = continueLearning.y + continueLearning.height;
    // `heights` only tracks the left column (Basics) plus one bridging slot up to the union bottom — the right
    // column (Aspects, Reference) isn't part of this single linear sequence (`HowToPlayContentLayout.aspectScrollIndex`'s
    // own doc comment explains why two side-by-side columns can't both be exact positions in one cumulative sum).
    // The bridging slot still makes the *total* (and so `McScrollRegion`'s scroll clamp) correct either way.
    const bridge: Rect = { x: pad, y: bottom, width: contentWidth, height: 0 };
    const rects = [basics.label, ...basics.rows, bridge, continueLearning];
    const heights = contentSlotHeights(rects);
    const bridgeIndex = 1 + basics.rows.length;

    return {
      formFactor,
      wide,
      basicsLabel: basics.label,
      lessonRows: basics.rows,
      aspectsLabel: aspects.label,
      aspectRows: aspects.rows,
      referenceLabel: reference.label,
      referenceRow: reference.rows[0]!,
      continueLearning,
      heights,
      totalHeight,
      lessonScrollIndex: basics.rows.map((_, i) => i + 1),
      aspectScrollIndex: aspects.rows.map(() => bridgeIndex),
      referenceScrollIndex: bridgeIndex,
      continueScrollIndex: heights.length - 1,
    };
  }

  const basics = section(pad, 0, contentWidth, LESSON_ROW_HEIGHT, modules.lessons.length);
  const aspects = section(pad, basics.bottom + SECTION_GAP, contentWidth, ASPECT_ROW_HEIGHT, modules.aspects.length);
  const reference = section(pad, aspects.bottom + SECTION_GAP, contentWidth, REFERENCE_ROW_HEIGHT, 1);
  const continueLearning: Rect = {
    x: pad,
    y: reference.bottom + SECTION_GAP,
    width: contentWidth,
    height: CONTINUE_HEIGHT,
  };
  const totalHeight = continueLearning.y + continueLearning.height;
  // One single stacked column, so every row really is next in this one cumulative sequence — every index below is
  // exact (unlike the wide branch above).
  const rects = [
    basics.label,
    ...basics.rows,
    aspects.label,
    ...aspects.rows,
    reference.label,
    ...reference.rows,
    continueLearning,
  ];
  const heights = contentSlotHeights(rects);
  const lessonBase = 1;
  const aspectBase = lessonBase + basics.rows.length + 1;
  const referenceIndex = aspectBase + aspects.rows.length + 1;

  return {
    formFactor,
    wide,
    basicsLabel: basics.label,
    lessonRows: basics.rows,
    aspectsLabel: aspects.label,
    aspectRows: aspects.rows,
    referenceLabel: reference.label,
    referenceRow: reference.rows[0]!,
    continueLearning,
    heights,
    totalHeight,
    lessonScrollIndex: basics.rows.map((_, i) => lessonBase + i),
    aspectScrollIndex: aspects.rows.map((_, i) => aspectBase + i),
    referenceScrollIndex: referenceIndex,
    continueScrollIndex: heights.length - 1,
  };
}

/** Every drawn row (not section labels — a label is a header, not content to keep clear of) — for a no-overlap test. */
export function howToPlayContentLayoutRects(layout: HowToPlayContentLayout): readonly Rect[] {
  return [...layout.lessonRows, ...layout.aspectRows, layout.referenceRow, layout.continueLearning];
}

/** Focus order: close, every lesson row, every aspect row, reference, then Continue learning. */
export function howToPlayFocusOrder(modules: HowToPlayModules): readonly string[] {
  return [
    "close",
    ...modules.lessons.map((lesson) => `lesson:${lesson.id}`),
    ...modules.aspects.map((aspect) => `aspect:${aspect.aspect}`),
    "reference",
    "continue-learning",
  ];
}
