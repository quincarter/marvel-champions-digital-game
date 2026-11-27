import { describe, expect, it } from "vitest";
import "./mc-section-header.js";

describe("mc-section-header", () => {
  it("draws its label at its size with a rule, and leaves the rule out when asked", async () => {
    const header = document.createElement("mc-section-header");
    header.label = "Undo";
    header.size = 20;
    document.body.append(header);
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector(".label")?.textContent).toBe("Undo");
    expect(header.shadowRoot!.querySelector(".label")?.getAttribute("style")).toContain("font-size:20px");
    expect(header.shadowRoot!.querySelector(".rule")).not.toBeNull();
    header.rule = false;
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector(".rule")).toBeNull();
    header.remove();
  });
});
