/**
 * `tutorial-resume.ts` (guided mode §3.12): the pure lesson-to-resume pick and the prompt decision, independent
 * of any scene or store — `scenes/title.ts` is what actually wires this to a real save/prefs pair.
 */
import { describe, expect, test } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { SAVE_SCHEMA } from "../engine/game-storage.js";
import { defaultGuidePrefs, type GuidePrefs, type TutorialProgress } from "./guide-prefs.js";
import { firstUnfinishedTutorialLesson, tutorialResumeDecisionFor } from "./tutorial-resume.js";
import { TUTORIAL_LESSONS } from "./tutorial-lessons.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

const save = (overrides: Partial<SaveMeta> = {}): SaveMeta => ({
  id: "g1",
  schema: SAVE_SCHEMA,
  config: CONFIG,
  createdAt: 0,
  updatedAt: 0,
  status: "active",
  round: 1,
  commandCount: 0,
  outcome: null,
  campaignId: null,
  campaignNodeId: null,
  ...overrides,
});

const prefs = (overrides: { readonly tutorial?: Partial<TutorialProgress> } = {}): GuidePrefs => ({
  ...defaultGuidePrefs,
  tutorial: { ...defaultGuidePrefs.tutorial, ...overrides.tutorial },
});

describe("firstUnfinishedTutorialLesson", () => {
  test("skips how-to-win and returns the first lesson not done", () => {
    expect(firstUnfinishedTutorialLesson(prefs())).toBe("paying-for-cards");
    expect(
      firstUnfinishedTutorialLesson(prefs({ tutorial: { lessonsDone: ["how-to-win", "paying-for-cards"] } })),
    ).toBe("hero-and-alter-ego");
  });

  test("null once every lesson is done", () => {
    const lessonsDone = TUTORIAL_LESSONS.map((lesson) => lesson.id);
    expect(firstUnfinishedTutorialLesson(prefs({ tutorial: { lessonsDone } }))).toBeNull();
  });
});

describe("tutorialResumeDecisionFor", () => {
  test("plain for a save with no guided marker", () => {
    expect(tutorialResumeDecisionFor(save(), prefs())).toEqual({ kind: "plain" });
  });

  test("tutorial, naming the first unfinished lesson", () => {
    const decision = tutorialResumeDecisionFor(
      save({ guided: { kind: "tutorial" } }),
      prefs({ tutorial: { lessonsDone: ["how-to-win", "paying-for-cards"] } }),
    );
    expect(decision).toEqual({ kind: "tutorial", lessonId: "hero-and-alter-ego", title: "Hero & alter-ego" });
  });

  test("plain once the tutorial was stopped outright, even with lessons left", () => {
    expect(
      tutorialResumeDecisionFor(save({ guided: { kind: "tutorial" } }), prefs({ tutorial: { skipped: true } })),
    ).toEqual({
      kind: "plain",
    });
    expect(
      tutorialResumeDecisionFor(save({ guided: { kind: "tutorial" } }), prefs({ tutorial: { finished: true } })),
    ).toEqual({ kind: "plain" });
  });

  test("plain once every lesson is already done", () => {
    const lessonsDone = TUTORIAL_LESSONS.map((lesson) => lesson.id);
    expect(
      tutorialResumeDecisionFor(save({ guided: { kind: "tutorial" } }), prefs({ tutorial: { lessonsDone } })),
    ).toEqual({
      kind: "plain",
    });
  });

  test("aspect saves always prompt, regardless of tutorial progress", () => {
    const decision = tutorialResumeDecisionFor(
      save({ guided: { kind: "aspect", aspect: "justice" } }),
      prefs({ tutorial: { finished: true } }),
    );
    expect(decision).toEqual({ kind: "aspect", aspect: "justice" });
  });

  test("mechanic Try-it saves prompt a restart, and a retired lesson opens plainly", () => {
    expect(
      tutorialResumeDecisionFor(
        save({ guided: { kind: "mechanic", mechanic: "storm" } }),
        prefs({ tutorial: { finished: true } }),
      ),
    ).toEqual({ kind: "mechanic", mechanic: "storm" });
    expect(tutorialResumeDecisionFor(save({ guided: { kind: "mechanic", mechanic: "gone" } }), prefs())).toEqual({
      kind: "plain",
    });
  });
});
