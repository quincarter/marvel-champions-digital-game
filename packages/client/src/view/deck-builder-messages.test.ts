import { describe, expect, it } from "vitest";
import { t } from "../i18n/translate.js";
import { deckReasonText } from "./deck-reason.js";
import { NOT_LEGAL_REASON } from "./deck-list-model.js";

describe("the deck screens' notices read in Spanish", () => {
  it("names the delete confirmation's button and the irreversible warning", () => {
    const message = t("decks.stats.confirmMessage", { name: "Mi mazo" }, "es");
    expect(message).toContain("Mi mazo");
    expect(message).toMatch(/Confirmar borrado/);
    expect(message).not.toMatch(/Press Confirm delete/);
  });

  it("words a save, a gone campaign run and the failures", () => {
    expect(t("deckBuilder.savedNote", undefined, "es")).toBe("Guardado en tus mazos.");
    expect(t("deckBuilder.campaignGone", undefined, "es")).toMatch(/no se guardó nada/);
    expect(t("deckBuilder.saveFailed", undefined, "es")).toMatch(/No se pudo guardar/);
    expect(t("deckBuilder.rewardFailed", undefined, "es")).toMatch(/No se pudo cambiar/);
  });

  it("translates a blocked deck's known reason for the tooltip, and passes a free-form one through", () => {
    expect(deckReasonText(NOT_LEGAL_REASON, "es")).toBe(t("deckPicker.reason.notLegal", undefined, "es"));
    expect(deckReasonText(NOT_LEGAL_REASON, "es")).not.toBe(NOT_LEGAL_REASON);
    expect(deckReasonText("Needs 40 cards.", "es")).toBe("Needs 40 cards.");
  });
});
