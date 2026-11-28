import { afterEach, describe, expect, it } from "vitest";
import { ASPECT_GUIDES } from "../guide/aspects.js";
import { defaultGuidePrefs, markAspectLessonDone, markLessonDone } from "../guide/guide-prefs.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { boxPages } from "./new-in-box-model.js";
import {
  continueLearningLabel,
  continueLearningLesson,
  howToPlayFocusOrder,
  howToPlayModules,
  howToPlayProgressOf,
} from "./how-to-play-model.js";

describe("howToPlayProgressOf", () => {
  it("counts the basics lessons and the aspects' Try its, and is complete only with all of them", () => {
    const total = TUTORIAL_LESSONS.length + ASPECT_GUIDES.filter((g) => g.aspect !== "basic").length;
    expect(howToPlayProgressOf(defaultGuidePrefs)).toEqual({ done: 0, total });
    let prefs = defaultGuidePrefs;
    for (const lesson of TUTORIAL_LESSONS) prefs = markLessonDone(prefs, lesson.id);
    expect(howToPlayProgressOf(prefs).done).toBe(TUTORIAL_LESSONS.length);
    for (const guide of ASPECT_GUIDES) if (guide.aspect !== "basic") prefs = markAspectLessonDone(prefs, guide.aspect);
    expect(howToPlayProgressOf(prefs)).toEqual({ done: total, total });
  });
});

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

  it("lists the four Core aspects and 'Pool, skipping Basic", () => {
    const modules = howToPlayModules(defaultGuidePrefs);
    expect(modules.aspects.map((a) => a.aspect)).toEqual(["justice", "aggression", "leadership", "protection", "pool"]);
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

describe("the New in each box band", () => {
  const pages = boxPages(() => true);
  const withBoxes = howToPlayModules(defaultGuidePrefs, pages);

  it("has one row per unlocked page, titled after the box, and none when nothing is unlocked", () => {
    expect(withBoxes.boxes.map((b) => b.title)).toEqual(pages.map((p) => p.title));
    expect(withBoxes.boxes.map((b) => b.id)).toContain("mojo");
    expect(howToPlayModules(defaultGuidePrefs, []).boxes).toEqual([]);
    expect(howToPlayModules(defaultGuidePrefs).boxes).toEqual([]);
  });

  it("puts every box row in the focus order after the reference row", () => {
    const order = howToPlayFocusOrder(withBoxes);
    expect(order.slice(-2 - pages.length)).toEqual([
      "reference",
      ...pages.map((p) => `box:${p.id}`),
      "continue-learning",
    ]);
  });
});

describe("How to play in Spanish", () => {
  afterEach(useEnglish);

  it("words the lessons, the aspects and the reference row in Spanish, then English again", () => {
    useSpanish();
    const modules = howToPlayModules(defaultGuidePrefs);
    expect(modules.lessons.map((lesson) => lesson.title)).toEqual([
      "Cómo ganar",
      "Pagar las cartas",
      "Héroe y alter ego",
      "La fase del villano",
      "Amenaza e intervención",
    ]);
    expect(modules.aspects.find((aspect) => aspect.aspect === "justice")).toMatchObject({
      name: "Justicia",
      tagline: "Intervenir: mantiene la Amenaza lejos del plan",
    });
    expect(modules.reference.title).toBe("Reglas y glosario");
    expect(continueLearningLabel(modules)).toBe("Seguir aprendiendo ▸");
    useEnglish();
    const english = howToPlayModules(defaultGuidePrefs);
    expect(english.lessons.map((lesson) => lesson.title)).toEqual(TUTORIAL_LESSONS.map((lesson) => lesson.title));
    expect(english.aspects.map((aspect) => [aspect.name, aspect.tagline])).toEqual(
      ASPECT_GUIDES.filter((guide) => guide.aspect !== "basic").map((guide) => [guide.name, guide.tagline]),
    );
  });
});
