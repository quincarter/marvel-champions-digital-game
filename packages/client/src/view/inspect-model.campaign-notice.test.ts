/**
 * The "Spent for good" notice (RRG 1.8 p. 29): a card whose own text removes it from the campaign says, on its
 * Inspect sheet, that losing and retrying won't bring it back, and links the Rules glossary entry for the rule.
 */
import { describe, expect, test } from "vitest";
import { POOL_CARDS } from "../content/pool.js";
import { rulesGlossaryPoolOf } from "./rules-reference.js";
import { campaignNoticeFor, cardInspectModel } from "./inspect-model.js";

const card = (id: string) => POOL_CARDS.find((candidate) => (candidate.id as string) === id);

describe("campaign notice", () => {
  test("a TRoRS TECH upgrade that removes itself from the campaign carries the notice and its rule", () => {
    const notice = cardInspectModel(card("04155"), { kind: "front" }).campaignNotice;
    expect(notice?.heading).toBe("Spent for good");
    expect(notice?.text).toContain("Even if you lose this battle and retry, this card stays spent and removed.");
    expect(notice?.linkLabel).toBe("Rule: Removed from the campaign (RRG 1.8 p. 29)");
  });

  test("every card that removes itself from the campaign gets it, and no other card does", () => {
    const withNotice = POOL_CARDS.filter(
      (candidate) => cardInspectModel(candidate, { kind: "front" }).campaignNotice !== null,
    );
    expect(withNotice.map((candidate) => candidate.id as string).sort()).toEqual(["04155", "04156", "04157", "04158"]);
  });

  test("the link's query finds exactly the glossary entry it names", () => {
    const notice = campaignNoticeFor("Discard this card and remove it from the campaign log → draw 5 cards.");
    const found = rulesGlossaryPoolOf(POOL_CARDS, notice?.rulesQuery ?? "");
    expect(found.map((entry) => entry.id)).toEqual(["removedFromCampaign"]);
  });

  test("a card with no campaign removal has no notice", () => {
    expect(campaignNoticeFor("Hero Action: Draw 1 card.")).toBeNull();
  });
});
