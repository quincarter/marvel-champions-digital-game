import { describe, expect, it } from "vitest";
import { copySizeFor, copySourceOf, hasCopy, rosterSizeFor } from "./roster-size.js";

describe("rosterSizeFor", () => {
  it("shrinks a landscape picture until its height covers a 2x tile", () => {
    expect(rosterSizeFor(1920, 1080)).toEqual({ width: 1564, height: 880 });
  });
  it("shrinks a portrait picture until its width covers a 2x tile", () => {
    expect(rosterSizeFor(2000, 4000)).toEqual({ width: 600, height: 1200 });
  });
  it("never enlarges a small picture", () => {
    expect(rosterSizeFor(400, 500)).toEqual({ width: 400, height: 500 });
  });
});

describe("copySizeFor", () => {
  it("caps a display copy's long edge", () => {
    expect(copySizeFor("display", 3975, 3056)).toEqual({ width: 2048, height: 1575 });
    expect(copySizeFor("display", 600, 927)).toEqual({ width: 600, height: 927 });
  });
});

describe("hasCopy", () => {
  it("covers hero and villain pictures for tiles, not outcome scenes", () => {
    expect(hasCopy("roster", "heroes/10001a-hulk/hero.jpg")).toBe(true);
    expect(hasCopy("roster", "scenarios/rhino/villain.jpg")).toBe(true);
    expect(hasCopy("roster", "scenarios/rhino/villain-2.png")).toBe(true);
    expect(hasCopy("roster", "scenarios/rhino/villain-wins.jpg")).toBe(false);
    expect(hasCopy("roster", "scenarios/rhino/intro.jpg")).toBe(false);
  });
  it("covers title pictures for display copies only", () => {
    expect(hasCopy("display", "title/wallpaper-1.jpg")).toBe(true);
    expect(hasCopy("roster", "title/wallpaper-1.jpg")).toBe(false);
  });
});

describe("copySourceOf", () => {
  it("reads a module id with a roster query", () => {
    expect(copySourceOf(String.raw`C:\repo\art\heroes\10001a-hulk\hero.jpg?roster`)).toEqual({
      kind: "roster",
      file: "C:/repo/art/heroes/10001a-hulk/hero.jpg",
      underArt: "heroes/10001a-hulk/hero.jpg",
    });
  });
  it("ignores plain imports and pictures without a copy", () => {
    expect(copySourceOf("/repo/art/heroes/x/hero.jpg")).toBeNull();
    expect(copySourceOf("/repo/art/extras/a.png?roster")).toBeNull();
  });
});
