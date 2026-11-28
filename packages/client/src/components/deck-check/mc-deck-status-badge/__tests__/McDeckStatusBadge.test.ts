// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "../mc-deck-status-badge.js";

describe("mc-deck-status-badge", () => {
  it("shows its words and reflects its tone", async () => {
    const el = document.createElement("mc-deck-status-badge");
    el.text = "40 CARDS · LEGAL";
    el.tone = "illegal";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toBe("40 CARDS · LEGAL");
    expect(el.getAttribute("tone")).toBe("illegal");
    el.remove();
  });
});
