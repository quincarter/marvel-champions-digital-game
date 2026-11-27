import { describe, expect, it } from "vitest";
import { CAMPAIGN_COPY_ES, ISSUE_COPY_ES, VILLAIN_ES } from "./campaign-copy-es.js";
import { blurbIn, campaignNameIn, issueTitleIn, taglineIn, villainIn, volumeNameIn } from "./campaign-text.js";
import { SAGA_VOLUMES, storyFor } from "./story.js";

describe("campaign text", () => {
  it("names every base box in Spanish by its official product name", () => {
    expect(campaignNameIn("trors", "The Rise of Red Skull", "es")).toBe("La Tiranía de Cráneo Rojo");
    expect(campaignNameIn("mut_gen", "Mutant Genesis", "es")).toBe("Génesis Mutante");
    for (const volume of SAGA_VOLUMES) {
      expect(campaignNameIn(volume.campaignId, volume.name, "es").length).toBeGreaterThan(0);
      expect(campaignNameIn(volume.campaignId, volume.name, "en")).toBe(volume.name);
    }
  });

  it("leaves a pack campaign's name as the pack wrote it", () => {
    const custom = { campaignId: "pack-x", name: "My Campaign", custom: { packId: "p", packName: "P" } };
    expect(volumeNameIn(custom, "es")).toBe("My Campaign");
    expect(campaignNameIn("pack-x", "My Campaign", "es")).toBe("My Campaign");
  });

  it("has a Spanish tagline and pitch for every box with a story, and a title for every issue", () => {
    for (const volume of SAGA_VOLUMES) {
      const story = storyFor(volume.campaignId);
      expect(story, volume.campaignId).toBeDefined();
      expect(CAMPAIGN_COPY_ES[volume.campaignId], `${volume.campaignId} copy`).toBeDefined();
      expect(taglineIn(volume.campaignId, story!.tagline, "es")).not.toBe(story!.tagline);
      expect(blurbIn(volume.campaignId, story!.blurb, "es")).not.toBe(story!.blurb);
      for (const issue of story!.issues) {
        const entry = ISSUE_COPY_ES[`${volume.campaignId}/${issue.nodeId}`];
        expect(entry, `${volume.campaignId}/${issue.nodeId}`).toBeDefined();
        expect(issueTitleIn(volume.campaignId, issue.nodeId, issue.title, "es")).toBe(entry!.title);
      }
    }
  });

  it("lists no Spanish issue that the stories do not have", () => {
    const real = new Set(
      SAGA_VOLUMES.flatMap((volume) =>
        (storyFor(volume.campaignId)?.issues ?? []).map((i) => `${volume.campaignId}/${i.nodeId}`),
      ),
    );
    expect(Object.keys(ISSUE_COPY_ES).filter((key) => !real.has(key))).toEqual([]);
  });

  it("bills a villain by its official Spanish name, and an unlisted one in English", () => {
    expect(villainIn("Crossbones", "es")).toBe("Calavera");
    expect(villainIn("Krahllak", "es")).toBe("Krahllak");
    expect(villainIn("Crossbones", "en")).toBe("Crossbones");
    expect(Object.values(VILLAIN_ES).every((name) => !/secuaz/i.test(name))).toBe(true);
  });

  it("keeps English where the language is English", () => {
    expect(taglineIn("trors", "A story in five issues", "en")).toBe("A story in five issues");
  });
});
