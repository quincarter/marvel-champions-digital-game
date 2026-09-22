import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import { createCampaignLog, type CampaignDefinition, type CampaignLog, type CampaignSeatSetup } from "@mc/engine";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { campaignLogSheet } from "./campaign-log-model.js";

const trorsSeats: readonly CampaignSeatSetup[] = [
  {
    seatNumber: 1,
    identityCardId: cardId("hawkeye"),
    deck: { identityCardId: cardId("hawkeye"), aspects: ["leadership"], cards: [] },
  },
  {
    seatNumber: 2,
    identityCardId: cardId("spider-woman"),
    deck: { identityCardId: cardId("spider-woman"), aspects: ["aggression", "justice"], cards: [] },
  },
];

const freshLog = (modes: CampaignLog["modes"] = {}): CampaignLog =>
  createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
    id: "log-model-test",
    seats: trorsSeats,
    modes,
    poolVersion: "log-model-test",
    seed: 1,
  });

describe("campaignLogSheet: MC10's real definition", () => {
  test("shared and per-seat rows carry every field's label and citation, ids rendered by default", () => {
    const log = {
      ...freshLog(),
      shared: { experimental: { kind: "cardList" as const, cardIds: [cardId("04155"), cardId("04156")] } },
      seats: [
        { ...freshLog().seats[0]!, fields: { techUpgrade: { kind: "cardRef" as const, cardId: cardId("04155") } } },
        freshLog().seats[1]!,
      ],
    };
    const sheet = campaignLogSheet(TRORS_CAMPAIGN_DEFINITION, log);

    const experimental = sheet.shared.find((row) => row.id === "experimental");
    expect(experimental).toMatchObject({
      label: "Experimental Weapons added to encounter deck",
      citation: "MC10 p. 5",
    });
    expect(experimental?.rendered).toBe("04155, 04156");

    expect(sheet.seats).toHaveLength(2);
    const seat1 = sheet.seats.find((seat) => seat.seatNumber === 1);
    const techUpgrade = seat1?.fields.find((row) => row.id === "techUpgrade");
    expect(techUpgrade?.rendered).toBe("04155");
  });

  test("a card-name resolver is used when given, not just the raw id", () => {
    const log = {
      ...freshLog(),
      shared: { experimental: { kind: "cardList" as const, cardIds: [cardId("04155")] } },
    };
    const sheet = campaignLogSheet(TRORS_CAMPAIGN_DEFINITION, log, (id) => (id === "04155" ? "Repulsor Blast" : id));
    expect(sheet.shared.find((row) => row.id === "experimental")?.rendered).toBe("Repulsor Blast");
  });

  test("an unwritten field renders as an em dash, not a crash", () => {
    const sheet = campaignLogSheet(TRORS_CAMPAIGN_DEFINITION, freshLog());
    expect(sheet.shared.find((row) => row.id === "delayCounters")?.rendered).toBe("—");
  });

  test("a mode-gated field is absent from a standard campaign and present in an expert one", () => {
    const standard = campaignLogSheet(TRORS_CAMPAIGN_DEFINITION, freshLog({}));
    expect(standard.seats[0]?.fields.some((row) => row.id === "remainingHp")).toBe(false);

    const expert = campaignLogSheet(
      TRORS_CAMPAIGN_DEFINITION,
      freshLog({ campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true } }),
    );
    expect(expert.seats[0]?.fields.some((row) => row.id === "remainingHp")).toBe(true);
  });
});

describe("campaignLogSheet: a hidden field, on a synthetic definition (MC10 has none)", () => {
  const HIDDEN_DEFINITION: CampaignDefinition = {
    ...TRORS_CAMPAIGN_DEFINITION,
    logFields: [
      {
        id: "secret",
        label: "A.I.M. Evidence",
        scope: "shared",
        type: { kind: "text" },
        hidden: true,
        citation: "MC50 p. 5",
      },
    ],
  };

  test("a hidden field still gets a labelled row, but never its value", () => {
    const log = { ...freshLog(), hidden: { secret: { kind: "text" as const, value: "the villain is Zola" } } };
    const sheet = campaignLogSheet(HIDDEN_DEFINITION, log);
    expect(sheet.shared).toEqual([
      { id: "secret", label: "A.I.M. Evidence", citation: "MC50 p. 5", rendered: "not yet known" },
    ]);
  });
});
