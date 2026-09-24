import { describe, expect, test } from "vitest";
import { storyFor } from "../campaign/story.js";
import { comicReaderViewOf, nextComicBeat, prevComicBeat, resolveComicBeats } from "./comic-reader-model.js";

describe("comic reader model", () => {
  const story = storyFor("gmw")!;
  const issue = story.issues.find((candidate) => candidate.nodeId === "brotherhood-of-badoon")!;
  const steps = resolveComicBeats(story.pages!, issue.comicBeats!);

  test("resolves every ref to its page and beat, in order", () => {
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.page.file)).toEqual(["01-badoon", "01-badoon", "01-badoon"]);
    expect(steps.map((step) => step.beatIndexInPage)).toEqual([0, 1, 2]);
  });

  test("an unknown page or beat throws — a story-authoring bug, not a runtime state", () => {
    expect(() => resolveComicBeats(story.pages!, [{ page: "nope", beatIndex: 0 }])).toThrow(/unknown page/);
    expect(() => resolveComicBeats(story.pages!, [{ page: "01-badoon", beatIndex: 99 }])).toThrow(/no beat/);
  });

  test("the first beat reads BEAT 1 OF N, isFirst, and NEXT — not SUIT UP", () => {
    const view = comicReaderViewOf(steps, 0, ["16001a", "16029a"]);
    expect(view.step.beatLabel).toBe("BEAT 1 OF 3");
    expect(view.isFirst).toBe(true);
    expect(view.isLast).toBe(false);
    expect(view.ctaLabel).toBe("NEXT ▸");
  });

  test("the last beat reads SUIT UP and isLast", () => {
    const view = comicReaderViewOf(steps, steps.length - 1, ["16001a", "16029a"]);
    expect(view.isLast).toBe(true);
    expect(view.ctaLabel).toBe("SUIT UP ▸");
  });

  test("a hero line falls back to narration when that hero is not on the roster", () => {
    const view = comicReaderViewOf(steps, 2, []);
    const groot = view.step.lines.find((line) => line.speaker.kind === "narrator");
    expect(groot?.text).toBe("Groot has already picked a Badoon up by the collar.");
  });

  test("the page strip lists every distinct page once, marking the current one active", () => {
    const view = comicReaderViewOf(steps, 1, []);
    expect(view.pageStrip).toEqual([{ file: "01-badoon", active: true }]);
  });

  test("next/prev clamp at the ends", () => {
    expect(nextComicBeat(0, 3)).toBe(1);
    expect(nextComicBeat(2, 3)).toBe(2);
    expect(prevComicBeat(0)).toBe(0);
    expect(prevComicBeat(2)).toBe(1);
  });

  test("current out of range clamps rather than throwing", () => {
    expect(comicReaderViewOf(steps, 99, []).step.beatLabel).toBe("BEAT 3 OF 3");
    expect(comicReaderViewOf(steps, -5, []).step.beatLabel).toBe("BEAT 1 OF 3");
  });

  test("a page strip spanning two pages (the museum split) lists both files", () => {
    const museum2 = story.issues.find((candidate) => candidate.nodeId === "infiltrate-the-museum")!;
    const museum3 = story.issues.find((candidate) => candidate.nodeId === "escape-the-museum")!;
    const stepsAcrossIssues = resolveComicBeats(story.pages!, [...museum2.comicBeats!, ...museum3.comicBeats!]);
    const view = comicReaderViewOf(stepsAcrossIssues, stepsAcrossIssues.length - 1, []);
    expect(view.pageStrip).toEqual([{ file: "02-museum", active: true }]);
  });
});
