import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { PanelArt } from "../campaign/story.js";
import { TRORS_STORY } from "../campaign/stories/trors.js";
import { GMW_STORY } from "../campaign/stories/gmw.js";
import {
  CAMPAIGN_ART,
  campaignArtboardFor,
  campaignCoverFor,
  campaignPageFor,
  parseCampaignArt,
} from "./campaign-art.js";

describe("parseCampaignArt", () => {
  test("an artboard is looked up by campaign and name; variants collect; a cover is read separately, not as an artboard", () => {
    const catalog = parseCampaignArt({
      "../art/campaigns/trors/cover.jpg": "/cover",
      "../art/campaigns/trors/artboards/mountain-facility.webp": "/a",
      "../art/campaigns/trors/artboards/mountain-facility-2.jpg": "/b",
      "../art/campaigns/gmw/artboards/mountain-facility.png": "/c",
    });
    expect(catalog.artboards.get("trors/mountain-facility")?.map((p) => p.url)).toEqual(["/b", "/a"]);
    expect(campaignArtboardFor(catalog, "gmw", "mountain-facility", () => 0)?.url).toBe("/c");
    expect(campaignArtboardFor(catalog, "trors", "the-citadel")).toBeNull();
    expect(campaignCoverFor(catalog, "trors")?.url).toBe("/cover");
    expect(campaignCoverFor(catalog, "gmw")).toBeNull();
    expect(catalog.unrecognized).toEqual([]);
  });

  test("a comic page is looked up by campaign and file name, with no variant convention", () => {
    const catalog = parseCampaignArt({
      "../art/campaigns/gmw/pages/01-badoon.jpg": "/p1",
      "../art/campaigns/gmw/pages/02-museum.jpg": "/p2",
    });
    expect(campaignPageFor(catalog, "gmw", "01-badoon")?.url).toBe("/p1");
    expect(campaignPageFor(catalog, "gmw", "02-museum")?.url).toBe("/p2");
    expect(campaignPageFor(catalog, "gmw", "03-nebula")).toBeNull();
    expect(catalog.unrecognized).toEqual([]);
  });

  test("a picture outside artboards/pages that isn't the cover is reported", () => {
    const catalog = parseCampaignArt({ "../art/campaigns/trors/mountain.webp": "/a" });
    expect(catalog.unrecognized).toEqual(["campaigns/trors/mountain.webp"]);
  });
});

describe("the real art/campaigns folder", () => {
  const stories = [TRORS_STORY, GMW_STORY];
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

  test("every comic page file is one the box's story names in its `pages` list (a typo'd file name would never show)", () => {
    for (const story of stories) {
      const dir = join(root, story.campaignId, "pages");
      if (!existsSync(dir)) continue;
      const named = new Set((story.pages ?? []).map((page) => page.file));
      const onDisk = readdirSync(dir)
        .filter((file) => !file.startsWith(".") && file !== "CREDITS.md")
        .map((file) => file.slice(0, file.lastIndexOf(".")));
      for (const file of onDisk) expect(named, `${story.campaignId}/pages/${file}`).toContain(file);
    }
  });

  test("rulebook/ holds only official rulebook pages named page_NNN.jpg, and never reaches the client", () => {
    for (const campaignId of readdirSync(root)) {
      const dir = join(root, campaignId, "rulebook");
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => !f.startsWith("."))) {
        expect(file, `${campaignId}/rulebook/${file}`).toMatch(/^(page_\d{3}\.jpg|SOURCE\.md)$/);
      }
    }
    for (const picture of [...CAMPAIGN_ART.pages.values(), ...CAMPAIGN_ART.covers.values()]) {
      expect(picture.key).not.toContain("/rulebook/");
    }
    for (const pictures of CAMPAIGN_ART.artboards.values())
      for (const picture of pictures) expect(picture.key).not.toContain("/rulebook/");
  });
});
