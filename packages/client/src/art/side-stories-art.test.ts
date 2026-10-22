import { describe, expect, it } from "vitest";
import { parseSideStoryArt } from "./side-stories-art.js";

describe("side-story pages", () => {
  it("groups pages by story folder in file-name order and skips holding folders and loose files", () => {
    const art = parseSideStoryArt({
      "../../../../art/side-stories/date/page-11.jpg": "b",
      "../../../../art/side-stories/date/page-06.jpg": "a",
      "../../../../art/side-stories/_pending/page-01.jpg": "x",
      "../../../../art/side-stories/loose.jpg": "y",
    });
    expect([...art.keys()]).toEqual(["date"]);
    expect(art.get("date")).toEqual([
      { key: "side-story-art:date/page-06.jpg", url: "a" },
      { key: "side-story-art:date/page-11.jpg", url: "b" },
    ]);
  });
});
