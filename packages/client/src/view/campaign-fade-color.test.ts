import { describe, expect, it } from "vitest";
import { CAMPAIGN_FADE_COLOR_VALUES } from "../settings.js";
import {
  CAMPAIGN_FADE_COLOR_FILLS,
  CAMPAIGN_FADE_COLOR_LABELS,
  PANE_TEXT_COLOR,
  campaignFadeFillOf,
  contrastRatio,
  paneGroundUnder,
} from "./campaign-fade-color.js";

describe("the campaign pane's fade colours", () => {
  it("has a label and a ground for each value", () => {
    for (const color of CAMPAIGN_FADE_COLOR_VALUES) {
      expect(CAMPAIGN_FADE_COLOR_LABELS[color].length).toBeGreaterThan(0);
      expect(CAMPAIGN_FADE_COLOR_FILLS[color]).toBeGreaterThan(0);
    }
    expect(CAMPAIGN_FADE_COLOR_VALUES).toEqual(["grey", "blue", "red", "purple", "green"]);
  });

  it("reads an unknown value as grey", () => {
    expect(campaignFadeFillOf("pink" as never)).toBe(CAMPAIGN_FADE_COLOR_FILLS.grey);
  });

  // AA for body text is 4.5:1. The art is faded, but a picture can have any tone under a line of text: checked with
  // no art, then black, mid-grey and pure white art (the worst case), each with the veil over it.
  it.each(CAMPAIGN_FADE_COLOR_VALUES)("keeps %s dark enough for the pane's pale text (AA, 4.5:1)", (color) => {
    for (const art of [null, 0, 128, 255]) {
      const ground = paneGroundUnder(color, art);
      expect(contrastRatio(PANE_TEXT_COLOR, ground), `${color} under art ${art}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
