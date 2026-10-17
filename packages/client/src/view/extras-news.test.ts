import { describe, expect, test } from "vitest";
import type { ExtrasContent, ExtrasEntry, ExtrasSlide, ExtrasTab, ExtrasUnlock } from "../progression/extras.js";
import { extrasNewsHeadline, newExtrasOf, openExtrasOf, type ExtrasNewsItem } from "./extras-news.js";

const entry = (id: string, tab: ExtrasTab, title: string, content?: ExtrasContent): ExtrasEntry => ({
  id,
  tab,
  title,
  subtitle: "",
  thumb: null,
  unlock: { kind: "scenarioPlayed", scenarioId: id },
  content: content ?? { kind: "book", bookId: id },
});
const slide = (caption: string, unlock: ExtrasUnlock): ExtrasSlide =>
  ({ picture: {} as ExtrasSlide["picture"], caption, unlock }) as ExtrasSlide;

const rhinoFile = entry("villain:rhino", "villains", "Rhino", {
  kind: "gallery",
  lines: [],
  slides: [slide("Rhino", { kind: "always" }), slide("Rhino falls", { kind: "scenarioWon", scenarioId: "rhino" })],
});
const entries = [entry("music:A", "music", "Song A"), rhinoFile];

/** Opens what `open` names: scenario ids played, and "won" for the defeat scene. */
const progress = (played: string[], won = false) => ({
  isOpen: (unlock: ExtrasUnlock) =>
    unlock.kind === "always" ||
    (unlock.kind === "scenarioPlayed" && played.includes(unlock.scenarioId)) ||
    (unlock.kind === "scenarioWon" && won),
  openSlides: (content: ExtrasContent) =>
    content.kind === "gallery" ? content.slides.filter((s) => s.unlock.kind === "always" || won) : [],
});

describe("what opened", () => {
  test("an entry, then the picture a win adds inside it", () => {
    const before = openExtrasOf(progress(["villain:rhino"]), entries);
    expect([...before.keys()]).toEqual(["villain:rhino"]);
    const after = openExtrasOf(progress(["villain:rhino", "music:A"], true), entries);
    expect(newExtrasOf(new Set(before.keys()), after).map((item) => item.title)).toEqual(["Song A", "Rhino falls"]);
  });

  test("nothing new, nothing to say", () => {
    const open = openExtrasOf(progress(["music:A"]), entries);
    expect(newExtrasOf(new Set(open.keys()), open)).toEqual([]);
  });
});

describe("the notice's lines", () => {
  const item = (tab: ExtrasTab, title: string): ExtrasNewsItem => ({ id: title, tab, title });

  test("one thing names itself", () => {
    expect(extrasNewsHeadline([item("music", "The Rhino Has Fallen")])).toEqual({
      label: "New song earned",
      title: "The Rhino Has Fallen",
    });
    expect(extrasNewsHeadline([item("villains", "Klaw")]).label).toBe("New villain file");
  });

  test("several of a kind are counted", () => {
    expect(extrasNewsHeadline([item("music", "A"), item("music", "B"), item("music", "C")])).toEqual({
      label: "3 new songs earned",
      title: "A and 2 more",
    });
  });

  test("a mix leads with a song", () => {
    expect(extrasNewsHeadline([item("villains", "Klaw"), item("music", "Master of Sound")])).toEqual({
      label: "2 new extras unlocked",
      title: "Master of Sound and 1 more",
    });
  });
});
