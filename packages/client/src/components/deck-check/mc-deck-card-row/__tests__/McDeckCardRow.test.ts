// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "../mc-deck-card-row.js";

describe("mc-deck-card-row", () => {
  it("shows the cost pip, the name and the copies, and leaves the pip empty for a card with no cost", async () => {
    const el = document.createElement("mc-deck-card-row");
    el.cost = 2;
    el.costColor = "rgb(1, 2, 3)";
    el.name = "Web-Shooter";
    el.quantity = 3;
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".pip")!.textContent).toBe("2");
    expect(el.shadowRoot!.querySelector<HTMLElement>(".pip")!.style.getPropertyValue("--pip")).toBe("rgb(1, 2, 3)");
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("Web-Shooter");
    expect(el.shadowRoot!.querySelector(".quantity")!.textContent).toBe("×3");
    el.cost = null;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".pip")!.textContent).toBe("");
    el.remove();
  });
});
