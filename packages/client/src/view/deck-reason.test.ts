import { describe, expect, it } from "vitest";
import { NOT_LEGAL_REASON, NOT_READY_REASON } from "./deck-list-model.js";
import { deckReasonText } from "./deck-reason.js";

describe("deckReasonText", () => {
  it("passes the English verdicts and an engine message through in English", () => {
    expect(deckReasonText(NOT_READY_REASON, "en")).toBe("Not ready yet");
    expect(deckReasonText(NOT_LEGAL_REASON, "en")).toBe("This deck is not legal.");
    expect(deckReasonText("Needs 40 cards.", "en")).toBe("Needs 40 cards.");
    expect(deckReasonText(null)).toBeNull();
  });

  it("translates the known verdicts into Spanish and leaves an engine message alone", () => {
    expect(deckReasonText(NOT_READY_REASON, "es")).toBe("Aún no está listo");
    expect(deckReasonText(NOT_LEGAL_REASON, "es")).toBe("Este mazo no es válido.");
    expect(deckReasonText("Needs 40 cards.", "es")).toBe("Needs 40 cards.");
  });
});
