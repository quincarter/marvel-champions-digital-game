import { describe, expect, it } from "vitest";
import { ASPECT_GUIDES } from "../guide/aspects.js";
import { defaultGuidePrefs, markAspectLessonDone, markLessonDone } from "../guide/guide-prefs.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import { rectsOverlap } from "./layout.js";
import {
  continueLearningLabel,
  continueLearningLesson,
  howToPlayContentLayout,
  howToPlayContentLayoutRects,
  howToPlayFocusOrder,
  howToPlayHeaderLayout,
  howToPlayModules,
} from "./how-to-play-model.js";

describe("howToPlayModules", () => {
  it("lists all five tutorial lessons, none done and lesson 1 recommended, from fresh prefs", () => {
    const modules = howToPlayModules(defaultGuidePrefs);
    expect(modules.lessons).toHaveLength(TUTORIAL_LESSONS.length);
    expect(modules.lessons.every((l) => !l.done)).toBe(true);
    expect(modules.recommendedLessonIndex).toBe(0);
    expect(modules.lessons[0]!.recommended).toBe(true);
    expect(modules.lessons.filter((l) => l.recommended)).toHaveLength(1);
  });

  it("numbers lessons 1-based in tutorial order", () => {
    const modules = howToPlayModules(defaultGuidePrefs);
    modules.lessons.forEach((lesson, i) => expect(lesson.index).toBe(i + 1));
  });

  it("marks lessons done from prefs.tutorial.lessonsDone and recommends the first not done", () => {
    let prefs = markLessonDone(defaultGuidePrefs, TUTORIAL_LESSONS[0]!.id);
    prefs = markLessonDone(prefs, TUTORIAL_LESSONS[1]!.id);
    const modules = howToPlayModules(prefs);
    expect(modules.lessons[0]!.done).toBe(true);
    expect(modules.lessons[1]!.done).toBe(true);
    expect(modules.lessons[2]!.done).toBe(false);
    expect(modules.recommendedLessonIndex).toBe(2);
    expect(modules.lessons[2]!.recommended).toBe(true);
  });

  it("recommends nothing once every lesson is done", () => {
    let prefs = defaultGuidePrefs;
    for (const lesson of TUTORIAL_LESSONS) prefs = markLessonDone(prefs, lesson.id);
    const modules = howToPlayModules(prefs);
    expect(modules.recommendedLessonIndex).toBeNull();
    expect(modules.lessons.every((l) => !l.recommended)).toBe(true);
  });

  it("lists Justice, Aggression, Leadership and Protection, skipping Basic", () => {
    const modules = howToPlayModules(defaultGuidePrefs);
    expect(modules.aspects.map((a) => a.aspect)).toEqual(["justice", "aggression", "leadership", "protection"]);
    expect(modules.aspects).toHaveLength(ASPECT_GUIDES.length - 1);
  });

  it("marks an aspect done from prefs.aspectLessonsDone", () => {
    const prefs = markAspectLessonDone(defaultGuidePrefs, "justice");
    const modules = howToPlayModules(prefs);
    expect(modules.aspects.find((a) => a.aspect === "justice")!.done).toBe(true);
    expect(modules.aspects.find((a) => a.aspect === "aggression")!.done).toBe(false);
  });

  it("carries each aspect's real tagline, not a second hand-copied one", () => {
    const modules = howToPlayModules(defaultGuidePrefs);
    for (const row of modules.aspects) {
      const guide = ASPECT_GUIDES.find((g) => g.aspect === row.aspect)!;
      expect(row.tagline).toBe(guide.tagline);
      expect(row.name).toBe(guide.name);
    }
  });
});

describe("continueLearningLabel / continueLearningLesson", () => {
  it("says Continue learning and points at the recommended lesson when one is unfinished", () => {
    const modules = howToPlayModules(defaultGuidePrefs);
    expect(continueLearningLabel(modules)).toBe("Continue learning ▸");
    expect(continueLearningLesson(modules).id).toBe(TUTORIAL_LESSONS[0]!.id);
  });

  it("says Play it again and points at lesson 1 once every lesson is done", () => {
    let prefs = defaultGuidePrefs;
    for (const lesson of TUTORIAL_LESSONS) prefs = markLessonDone(prefs, lesson.id);
    const modules = howToPlayModules(prefs);
    expect(continueLearningLabel(modules)).toBe("Play it again ▸");
    expect(continueLearningLesson(modules).id).toBe(TUTORIAL_LESSONS[0]!.id);
  });
});

describe("howToPlayHeaderLayout", () => {
  const sizes: readonly [number, number][] = [
    [390, 844],
    [1024, 768],
    [1440, 900],
  ];
  for (const [width, height] of sizes) {
    it(`fits close and title inside the header at ${width}x${height}`, () => {
      const layout = howToPlayHeaderLayout(width, height);
      expect(layout.close.x).toBeGreaterThanOrEqual(0);
      expect(layout.title.x + layout.title.width).toBeLessThanOrEqual(width + 1);
      expect(layout.close.y + layout.close.height).toBeLessThanOrEqual(layout.header.height);
    });
  }
});

describe("howToPlayContentLayout", () => {
  const modules = howToPlayModules(defaultGuidePrefs);
  const sizes: readonly [number, number][] = [
    [390, 844], // phone
    [1024, 768], // tablet landscape
    [1440, 900], // desktop
  ];

  for (const [width, height] of sizes) {
    it(`lays out one row per lesson/aspect plus reference and Continue learning, no overlap, at ${width}x${height}`, () => {
      const layout = howToPlayContentLayout(width, height, modules);
      expect(layout.lessonRows).toHaveLength(modules.lessons.length);
      expect(layout.aspectRows).toHaveLength(modules.aspects.length);
      const rects = howToPlayContentLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
        }
      }
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
      }
      // `heights` (McScrollRegion's own scroll-math input) sums to the real stacked total, gaps included.
      expect(layout.heights.reduce((a, b) => a + b, 0)).toBe(layout.totalHeight);
      // Every slot is non-negative: `VariableListScroll#topOf` sums this array, so a negative entry (found in
      // browser verification: concatenating two side-by-side columns into one cumulative sequence without
      // accounting for their shared y=0 start) corrupts every row's own scroll position after it.
      for (const h of layout.heights) expect(h).toBeGreaterThanOrEqual(0);
    });

    it(`gives every row a valid index into heights, matching its own content-space y, at ${width}x${height}`, () => {
      const layout = howToPlayContentLayout(width, height, modules);
      const topOf = (index: number): number => layout.heights.slice(0, index).reduce((a, b) => a + b, 0);
      layout.lessonScrollIndex.forEach((index, i) => {
        expect(topOf(index)).toBe(layout.lessonRows[i]!.y);
      });
      expect(topOf(layout.continueScrollIndex)).toBe(layout.continueLearning.y);
      if (!layout.wide) {
        layout.aspectScrollIndex.forEach((index, i) => {
          expect(topOf(index)).toBe(layout.aspectRows[i]!.y);
        });
        expect(topOf(layout.referenceScrollIndex)).toBe(layout.referenceRow.y);
      }
    });
  }

  for (const [width, height] of sizes) {
    it(`gives the content body real top padding above "THE BASICS", not flush under the header, at ${width}x${height}`, () => {
      const layout = howToPlayContentLayout(width, height, modules);
      // Content-space y (`view/how-to-play-model.ts`'s own doc comment: `y` measured from the content's own top,
      // `0` — the scene translates this into screen space by `viewport.y`, the header's own bottom edge). A
      // `basicsLabel.y` of 0 is the bug this pins against: the label drawn flush under the ink header with no
      // gap at all (found in browser verification, phone).
      expect(layout.basicsLabel.y).toBeGreaterThan(0);
      // Bounded, not just "some positive number" — a runaway top pad would just move the same "flush against
      // something" bug down to flush-against-the-header's-shadow instead of fixing it.
      expect(layout.basicsLabel.y).toBeLessThanOrEqual(40);
    });
  }

  it("is one stacked column on phone and two columns (Basics left, Aspects+Reference right) on tablet landscape/desktop", () => {
    expect(howToPlayContentLayout(390, 844, modules).wide).toBe(false);
    const wideLayout = howToPlayContentLayout(1024, 768, modules);
    expect(wideLayout.wide).toBe(true);
    // The right column's rows sit to the right of the left column's lesson rows.
    const leftRight = wideLayout.lessonRows[0]!.x + wideLayout.lessonRows[0]!.width;
    expect(wideLayout.aspectRows[0]!.x).toBeGreaterThanOrEqual(leftRight);
    expect(wideLayout.referenceRow.x).toBeGreaterThanOrEqual(leftRight);
  });
});

describe("howToPlayFocusOrder", () => {
  it("orders close, every lesson, every aspect, reference, then continue learning", () => {
    const modules = howToPlayModules(defaultGuidePrefs);
    const order = howToPlayFocusOrder(modules);
    expect(order[0]).toBe("close");
    expect(order.at(-2)).toBe("reference");
    expect(order.at(-1)).toBe("continue-learning");
    for (const lesson of modules.lessons) expect(order).toContain(`lesson:${lesson.id}`);
    for (const aspect of modules.aspects) expect(order).toContain(`aspect:${aspect.aspect}`);
  });
});
