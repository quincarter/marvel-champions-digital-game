import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { PanelArt } from "../campaign/story.js";
import { TRORS_STORY } from "../campaign/stories/trors.js";
import { campaignArtboardFor, parseCampaignArt } from "./campaign-art.js";

describe("parseCampaignArt", () => {
  test("an artboard is looked up by campaign and name; variants collect; a cover is not an artboard", () => {
    const catalog = parseCampaignArt({
      "../art/campaigns/trors/cover.jpg": "/cover",
      "../art/campaigns/trors/artboards/mountain-facility.webp": "/a",
      "../art/campaigns/trors/artboards/mountain-facility-2.jpg": "/b",
      "../art/campaigns/gmw/artboards/mountain-facility.png": "/c",
    });
    expect(catalog.artboards.get("trors/mountain-facility")?.map((p) => p.url)).toEqual(["/b", "/a"]);
    expect(campaignArtboardFor(catalog, "gmw", "mountain-facility", () => 0)?.url).toBe("/c");
    expect(campaignArtboardFor(catalog, "trors", "the-citadel")).toBeNull();
    expect(catalog.unrecognized).toEqual([]);
  });

  test("a picture outside artboards/ that isn't the cover is reported", () => {
    const catalog = parseCampaignArt({ "../art/campaigns/trors/mountain.webp": "/a" });
    expect(catalog.unrecognized).toEqual(["campaigns/trors/mountain.webp"]);
  });
});

describe("the real art/campaigns folder", () => {
  const stories = [TRORS_STORY];
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns");

  test("every artboard file is one a story names (a typo'd file name would never show)", () => {
    for (const story of stories) {
      const named = new Set<string>();
      const collect = (art: PanelArt | undefined): void => {
        if (art?.kind === "artboard") named.add(art.name);
      };
      for (const issue of story.issues) {
        for (const panel of issue.opener) collect(panel.art);
        collect(issue.aftermathArt);
      }
      const dir = join(root, story.campaignId, "artboards");
      const onDisk = readdirSync(dir)
        .filter((file) => !file.startsWith("."))
        .map((file) => file.slice(0, file.lastIndexOf(".")).replace(/-\d+$/, ""));
      for (const name of onDisk) expect(named, `${story.campaignId}/artboards/${name}`).toContain(name);
    }
  });
});
