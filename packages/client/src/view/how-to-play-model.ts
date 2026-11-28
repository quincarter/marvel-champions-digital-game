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
import type { BoxPage } from "./new-in-box-model.js";
import { t, type MessageKey } from "../i18n/translate.js";

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

/** One "New in this box" row on the hub (`view/new-in-box-model.ts`): the page it opens and its one-line summary. */
export interface BoxRowInfo {
  readonly id: BoxPage["id"];
  readonly title: string;
  readonly summary: string;
}

export interface HowToPlayModules {
  readonly lessons: readonly LessonRowInfo[];
  /** Index into `lessons` of the row "Continue learning ▸" starts, or `null` when every lesson is done. */
  readonly recommendedLessonIndex: number | null;
  readonly aspects: readonly AspectRowInfo[];
  readonly reference: ReferenceRowInfo;
  /** One row per "New in this box" page the player has unlocked (none while no box has a page), release order. */
  readonly boxes: readonly BoxRowInfo[];
}

/**
 * The hub's modules, built from the live `GuidePrefs` — no second progress record. `boxPages` is the unlocked
 * "New in this box" pages (`view/new-in-box-model.ts#boxPages`); the scene passes the player's own unlocks.
 */
export function howToPlayModules(prefs: GuidePrefs, boxPages: readonly BoxPage[] = []): HowToPlayModules {
  let recommendedLessonIndex: number | null = null;
  const lessons: LessonRowInfo[] = TUTORIAL_LESSONS.map((lesson, index) => {
    const done = prefs.tutorial.lessonsDone.includes(lesson.id);
    const recommended = !done && recommendedLessonIndex === null;
    if (recommended) recommendedLessonIndex = index;
    // Worded in the player's language at call time (`i18n/`), so a language switch applies.
    const title = t(`howToPlay.lesson.${lesson.id}` as MessageKey);
    return { id: lesson.id, index: index + 1, title, done, recommended };
  });

  const aspects: AspectRowInfo[] = ASPECT_GUIDES.filter((guide) => guide.aspect !== "basic").map((guide) => ({
    aspect: guide.aspect,
    name: t(`aspect.${guide.aspect}` as MessageKey),
    tagline: t(`howToPlay.tagline.${guide.aspect}` as MessageKey),
    done: prefs.aspectLessonsDone.includes(guide.aspect),
  }));

  return {
    lessons,
    recommendedLessonIndex,
    aspects,
    reference: { title: t("howToPlay.referenceTitle"), detail: t("howToPlay.referenceDetail") },
    boxes: boxPages.map((page) => ({ id: page.id, title: page.title, summary: page.summary })),
  };
}

/**
 * How much of How to Play is done: the five basics lessons and every aspect's Try it, the rows the hub marks ✓. What
 * the "Studying Like Doctor Strange" achievement counts (`progression/achievements.ts`).
 */
export function howToPlayProgressOf(prefs: GuidePrefs): { readonly done: number; readonly total: number } {
  const modules = howToPlayModules(prefs);
  const rows = [...modules.lessons, ...modules.aspects];
  return { done: rows.filter((row) => row.done).length, total: rows.length };
}

/** "Continue learning ▸" / "Play it again ▸" (once every lesson is done) — the hub's one red primary action's label. */
export function continueLearningLabel(modules: HowToPlayModules): string {
  return modules.recommendedLessonIndex === null ? t("howToPlay.playAgain") : t("howToPlay.continue");
}

/** The lesson `"Continue learning ▸"` starts — the recommended one, or lesson 1 again once every lesson is done. */
export function continueLearningLesson(modules: HowToPlayModules): LessonRowInfo {
  return modules.lessons[modules.recommendedLessonIndex ?? 0]!;
}

/** Focus order: close, every lesson row, every aspect row, reference, every box row, then Continue learning. */
export function howToPlayFocusOrder(modules: HowToPlayModules): readonly string[] {
  return [
    "close",
    ...modules.lessons.map((lesson) => `lesson:${lesson.id}`),
    ...modules.aspects.map((aspect) => `aspect:${aspect.aspect}`),
    "reference",
    ...modules.boxes.map((box) => `box:${box.id}`),
    "continue-learning",
  ];
}
