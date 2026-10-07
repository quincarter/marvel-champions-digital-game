import { describe, expect, test } from "vitest";
import { extrasArtTitle, parseExtrasArt } from "./extras-art.js";

describe("parseExtrasArt", () => {
  test("lists the folder's files in path order, keyed by file name", () => {
    const found = parseExtrasArt({
      "../../../../art/extras/b-side.png": "/b.png",
      "../../../../art/extras/psylocke-and-angel.png": "/p.png",
    });
    expect(found).toEqual([
      { key: "extras-art:b-side.png", url: "/b.png" },
      { key: "extras-art:psylocke-and-angel.png", url: "/p.png" },
    ]);
  });

  test("an empty folder is no pictures, and a subfolder's files are ignored", () => {
    expect(parseExtrasArt({})).toEqual([]);
    expect(parseExtrasArt({ "../../../../art/extras/_old/x.png": "/x.png" })).toEqual([]);
  });
});

describe("extrasArtTitle", () => {
  test("title case with small words lowercase unless first", () => {
    expect(extrasArtTitle("extras-art:psylocke-and-angel.png")).toBe("Psylocke and Angel");
    expect(extrasArtTitle("the-end-of-days.webp")).toBe("The End of Days");
  });
});
