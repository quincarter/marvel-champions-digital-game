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
import { t, type MessageKey } from "../i18n/translate.js";

export type GuideChooserValue = "full" | "hints" | "off";

export interface GuideChooserOptionInfo {
  readonly value: GuideChooserValue;
  /** The card's title and body, as app-text keys (`i18n/en.ts`), read through `t()` when drawn. */
  readonly labelKey: MessageKey;
  readonly bodyKey: MessageKey;
  readonly recommended: boolean;
}

/** The three radio cards, top to bottom — wording from `docs/guided-mode.md` §4 G6a's own brief. */
export const GUIDE_CHOOSER_OPTIONS: readonly GuideChooserOptionInfo[] = [
  {
    value: "full",
    labelKey: "guide.full.label",
    bodyKey: "guide.full.body",
    recommended: true,
  },
  {
    value: "hints",
    labelKey: "guide.hints.label",
    bodyKey: "guide.hints.body",
    recommended: false,
  },
  {
    value: "off",
    labelKey: "guide.off.label",
    bodyKey: "guide.off.body",
    recommended: false,
  },
] as const;

/** "1 · HOW TO WIN", "2 · HERO & ALTER-EGO", … — the tutorial's real five lessons, in their real order (§3.4), for the "Learn as you play" card's chip row on wide layouts. */
export function guideChooserLessonChips(): readonly string[] {
  return TUTORIAL_LESSONS.map((lesson, index) =>
    `${index + 1} · ${t(`howToPlay.lesson.${lesson.id}` as MessageKey)}`.toLocaleUpperCase(),
  );
}

/** Focus order: each radio card, then (wide only) Back, then Suit up. */
export function guideChooserFocusOrder(wide: boolean): readonly string[] {
  return [...GUIDE_CHOOSER_OPTIONS.map((option) => `option:${option.value}`), ...(wide ? ["back"] : []), "suit-up"];
}
