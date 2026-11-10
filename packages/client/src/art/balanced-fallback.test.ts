import { describe, expect, it } from "vitest";
import { normalScansFor } from "./balanced-fallback.js";

describe("normalScansFor", () => {
  it("names the normal scan a Balanced scan stands in for, in every image type", () => {
    expect(normalScansFor("bundles/cards/16070-balanced.png")).toEqual([
      "bundles/cards/16070.png",
      "bundles/cards/16070.webp",
      "bundles/cards/16070.jpg",
      "bundles/cards/16070.jpeg",
      "bundles/cards/16070.avif",
    ]);
  });

  it("strips a variant too", () => {
    expect(normalScansFor("bundles/cards/16106a-balanced-nokree.png")[0]).toBe("bundles/cards/16106a.png");
  });

  it("has nothing for any other path", () => {
    expect(normalScansFor("bundles/cards/16070.png")).toEqual([]);
  });
});
