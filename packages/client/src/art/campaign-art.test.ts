import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { PanelArt } from "../campaign/story.js";
import { TRORS_STORY } from "../campaign/stories/trors.js";
import { GMW_STORY } from "../campaign/stories/gmw.js";
import { MOJO_STORY } from "../campaign/stories/mojo.js";
import {
  CAMPAIGN_ART,
  RULEBOOK_CAMPAIGN_IDS,
  campaignArtboardFor,
  campaignCoverFor,
  campaignPageFor,
  campaignRulebookPageFor,
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

  test("a rulebook page is looked up by campaign and zero-padded page number, with no variant convention", () => {
    const catalog = parseCampaignArt({
      "../art/campaigns/sm/rulebook/page_008.jpg": "/r8",
      "../art/campaigns/sm/rulebook/page_010.jpg": "/r10",
    });
    expect(campaignRulebookPageFor(catalog, "sm", 8)?.url).toBe("/r8");
    expect(campaignRulebookPageFor(catalog, "sm", 10)?.url).toBe("/r10");
    expect(campaignRulebookPageFor(catalog, "sm", 9)).toBeNull();
    expect(campaignRulebookPageFor(catalog, "gmw", 8)).toBeNull();
    expect(catalog.unrecognized).toEqual([]);
  });

  test("a picture outside artboards/pages that isn't the cover is reported", () => {
    const catalog = parseCampaignArt({ "../art/campaigns/trors/mountain.webp": "/a" });
    expect(catalog.unrecognized).toEqual(["campaigns/trors/mountain.webp"]);
  });
});

describe("an artboard page", () => {
  test("is found by its file name under artboards/, a comic page of that name winning, and absent when neither exists", () => {
    const catalog = parseCampaignArt({
      "../art/campaigns/mojo/artboards/spiral.jpg": "/art",
      "../art/campaigns/mojo/pages/01-broadcast.jpg": "/page",
    });
    expect(campaignPageFor(catalog, "mojo", "spiral")?.url).toBe("/art");
    expect(campaignPageFor(catalog, "mojo", "01-broadcast")?.url).toBe("/page");
    expect(campaignPageFor(catalog, "mojo", "hallway")).toBeNull();
  });
});

describe("the real art/campaigns folder", () => {
  test("MojoMania has its cover, and every illustrated page has its picture", () => {
    expect(campaignCoverFor(CAMPAIGN_ART, "mojo")).not.toBeNull();
    for (const page of MOJO_STORY.pages!.filter((p) => p.artboard)) {
      expect(campaignPageFor(CAMPAIGN_ART, "mojo", page.file), page.file).not.toBeNull();
    }
  });

  const stories = [TRORS_STORY, GMW_STORY, MOJO_STORY];
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
      for (const page of story.pages ?? []) if (page.artboard) named.add(page.file);
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

  test("rulebook/ holds only official rulebook pages named page_NNN.jpg, kept out of pages/covers/artboards", () => {
    for (const campaignId of readdirSync(root)) {
      const dir = join(root, campaignId, "rulebook");
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => !f.startsWith("."))) {
        expect(file, `${campaignId}/rulebook/${file}`).toMatch(/^(page_\d{3}\.jpg|SOURCE\.md)$/);
      }
    }
    // Rulebook pages reach the client only through `rulebookPages` (a one-off scenario intro,
    // `campaign/scenario-intros.ts`) — never mixed into the campaign reader's own pages/covers/artboards.
    for (const picture of [...CAMPAIGN_ART.pages.values(), ...CAMPAIGN_ART.covers.values()]) {
      expect(picture.key).not.toContain("/rulebook/");
    }
    for (const pictures of CAMPAIGN_ART.artboards.values())
      for (const picture of pictures) expect(picture.key).not.toContain("/rulebook/");
    // The boxes actually wired to a rulebook-page intro (`RULEBOOK_CAMPAIGN_IDS`) each got at least one.
    for (const campaignId of RULEBOOK_CAMPAIGN_IDS) {
      const own = [...CAMPAIGN_ART.rulebookPages.keys()].filter((slot) => slot.startsWith(`${campaignId}/`));
      expect(own.length, campaignId).toBeGreaterThan(0);
      for (const slot of own) expect(CAMPAIGN_ART.rulebookPages.get(slot)!.key).toContain("/rulebook/");
    }
  });
});
