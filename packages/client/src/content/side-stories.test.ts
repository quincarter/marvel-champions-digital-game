import { describe, expect, it } from "vitest";
import { SIDE_STORY_ART, sideStoryPageArt } from "../art/side-stories-art.js";
import { ACHIEVEMENTS } from "../progression/achievements.js";
import { SIDE_STORIES } from "./side-stories.js";

describe("side stories", () => {
  for (const story of SIDE_STORIES) {
    it(`${story.id}: names a real achievement and a picture for every page`, () => {
      expect(ACHIEVEMENTS.some((a) => a.id === story.achievementId)).toBe(true);
      expect(story.pages.length).toBeGreaterThan(0);
      for (const page of story.pages)
        expect(sideStoryPageArt(SIDE_STORY_ART, story.id, page.file), page.file).not.toBeNull();
    });

    it(`${story.id}: reads every page panel by panel inside the page, ending on the whole page`, () => {
      for (const page of story.pages) {
        expect(page.lettered).toBe(true);
        expect(page.beats.length).toBeGreaterThan(1);
        expect(page.beats.at(-1)!.panel).toEqual({ x: 0, y: 0, w: page.width, h: page.height });
        for (const { panel } of page.beats) {
          expect(panel.x >= 0 && panel.y >= 0, page.file).toBe(true);
          expect(panel.x + panel.w <= page.width && panel.y + panel.h <= page.height, page.file).toBe(true);
        }
      }
    });
  }
});
