import { describe, expect, it } from "vitest";
import { CAMPAIGN_ART } from "../art/campaign-art.js";
import { SHADOWLAND_STORY } from "../campaign/stories/shadowland.js";
import {
  EXTRAS_ENTRIES,
  Extras,
  NO_EXTRAS_PROGRESS,
  shadowlandArtEntriesOf,
  unlockHint,
  type ExtrasProgress,
} from "./extras.js";
import { SHADOWLAND_COMIC_CREDIT, SHADOWLAND_EXTRAS } from "./shadowland-extras.js";

const open = (progress: Partial<ExtrasProgress>) => new Extras({ ...NO_EXTRAS_PROGRESS, ...progress });
const shown = (extras: Extras): string[] =>
  shadowlandArtEntriesOf()
    .filter((entry) => extras.isOpen(entry.unlock))
    .map((entry) => entry.title);

describe("Shadowland's earned artwork", () => {
  it("puts every panel and comic page on the Artwork shelf (the first panel is the cover, filed under the campaign)", () => {
    const art = EXTRAS_ENTRIES.art.map((entry) => entry.id);
    const files = [...CAMPAIGN_ART.artboards.keys(), ...CAMPAIGN_ART.pages.keys()].filter((key) =>
      key.startsWith("shadowland/"),
    );
    expect(files).toHaveLength(11);
    expect(shadowlandArtEntriesOf()).toHaveLength(10);
    for (const entry of shadowlandArtEntriesOf()) expect(art).toContain(entry.id);
    expect(EXTRAS_ENTRIES.art.some((entry) => entry.title === "Shadowland")).toBe(true);
  });

  it("is locked until played: nothing is open on a fresh profile", () => {
    expect(shown(open({}))).toEqual([]);
  });

  it("opens each scenario win's share, and the campaign win opens the last page", () => {
    expect(shown(open({ wonScenarioIds: ["shadows-in-the-night"] }))).toEqual([
      "Hand Ninja",
      "Iron Fist Faces Matt",
      "Old Pals",
    ]);
    expect(shown(open({ lostScenarioIds: ["shadow-labyrinth"], playedScenarioIds: ["shadow-labyrinth"] }))).toEqual([]);
    expect(shown(open({ wonScenarioIds: ["shadow-labyrinth", "heart-of-shadow"] }))).toHaveLength(6);
    expect(
      shown(open({ wonScenarioIds: ["shadow-labyrinth", "heart-of-shadow"], wonCampaignIds: ["shadowland"] })),
    ).toContain("End Your Suffering");
    const everything = open({
      wonScenarioIds: ["shadows-in-the-night", "shadow-labyrinth", "heart-of-shadow"],
      wonCampaignIds: ["shadowland"],
    });
    expect(shown(everything)).toHaveLength(SHADOWLAND_EXTRAS.length);
  });
});

describe("Shadowland's story pages", () => {
  it("credits the six comic pages (and only them) with the 2010 series on screen", () => {
    const pages = SHADOWLAND_STORY.pages ?? [];
    for (const page of pages.filter((candidate) => /^0\d-/.test(candidate.file))) {
      expect(page.credit, page.file).toMatch(/Shadowland.*2010.*Diggle/);
    }
    for (const page of pages.filter((candidate) => !/^0\d-/.test(candidate.file))) {
      expect(page.credit, page.file).toBeUndefined();
    }
  });

  it("hints at the scenario, not a random or unmet villain", () => {
    const hint = (id: string) => unlockHint(SHADOWLAND_EXTRAS.find((extra) => extra.file === id)!.unlock);
    expect(hint("hand-ninja")).toBe("Win Shadows in the Night");
    expect(hint("dojo")).toBe("Win Shadow Labyrinth");
    expect(hint("throne")).toBe("Win Heart of Shadow");
    expect(hint("06-end-your-suffering")).toBe("Complete the Shadowland campaign");
    expect(unlockHint({ kind: "scenarioWon", scenarioId: "rhino" })).toBe("Beat Rhino");
    // Fear No Evil's villain is a player's pick, so it names the scenario too.
    expect(unlockHint({ kind: "scenarioWon", scenarioId: "the-getaway" })).toBe("Win The Getaway");
    // "The" is not doubled for a box whose name starts with it.
    expect(unlockHint({ kind: "campaignWon", campaignId: "trors" })).toBe("Complete The Rise of Red Skull campaign");
  });

  it("shows a comic page's credit as a line of its entry (the full-size viewer draws lines), not a panel's", () => {
    for (const entry of shadowlandArtEntriesOf()) {
      const isPage = SHADOWLAND_EXTRAS.find((extra) => entry.title === extra.title)!.kind === "page";
      const lines = entry.content.kind === "gallery" ? entry.content.lines : [];
      expect(lines, entry.title).toEqual(isPage ? [SHADOWLAND_COMIC_CREDIT] : []);
    }
  });

  it("leaves Shadowland's scenarios out of the Villains gallery", () => {
    expect(EXTRAS_ENTRIES.villains.some((entry) => entry.id.startsWith("villain:shadow"))).toBe(false);
    expect(EXTRAS_ENTRIES.villains.some((entry) => entry.id === "villain:heart-of-shadow")).toBe(false);
  });

  it("reads the panels as the openers and the comic pages as the aftermath, two issues' worth in order", () => {
    const [one, two, three] = SHADOWLAND_STORY.issues;
    const files = (refs: readonly { page: string }[] | undefined) => [...new Set((refs ?? []).map((ref) => ref.page))];
    expect(files(one!.comicBeats)).toEqual(["shadowland-daredevil", "hand-ninja"]);
    expect(files(one!.aftermathBeats)).toEqual(["01-iron-fist", "02-spider-man"]);
    expect(files(two!.comicBeats)).toEqual(["dojo", "daredevil-flame"]);
    expect(files(two!.aftermathBeats)).toEqual(["03-radar-sense", "04-all-who-dare"]);
    expect(files(three!.comicBeats)).toEqual(["throne"]);
    expect(files(three!.aftermathBeats)).toEqual(["05-wakey-wakey", "06-end-your-suffering"]);
  });
});
