// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, findAll, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-seat-header.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-seat-header", () => {
  it("shows the seat and hero in capitals with the deck aspect chips under them", async () => {
    const el = await mount("mc-briefing-seat-header", {
      model: {
        title: "SEAT 1 · COLOSSUS",
        picture: { src: "colossus.png" },
        stamps: [{ aspect: "protection", label: "Protection" }],
      },
    });
    expect(wordsOf(el)).toContain("SEAT 1 · COLOSSUS");
    expect(findAll(el, "mc-aspect-chip")).toHaveLength(1);
    expect(find(el, "mc-picture-tile")).not.toBeNull();
  });

  it("a hero with no picture yet gets the plain frame, and a deck with no aspect no chips", async () => {
    const el = await mount("mc-briefing-seat-header", { model: { title: "SEAT 2 · WASP", picture: null, stamps: [] } });
    expect(find(el, "mc-picture-tile")).toBeNull();
    expect(find(el, ".chips")).toBeNull();
  });
});
