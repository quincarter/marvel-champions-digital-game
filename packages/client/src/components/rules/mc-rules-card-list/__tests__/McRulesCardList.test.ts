// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-rules-card-list.js";

afterEach(() => document.body.replaceChildren());

describe("mc-rules-card-list", () => {
  it("lists section labels and a set element per encounter set", async () => {
    const el = document.createElement("mc-rules-card-list");
    el.items = [
      { kind: "label", text: "IN THIS GAME" },
      { kind: "set", set: { setId: "rhino", heading: "RHINO · 1 CARD", tiles: [] } },
    ];
    el.cardScale = 1.25;
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("IN THIS GAME");
    expect(el.shadowRoot!.querySelectorAll("mc-rules-card-set")).toHaveLength(1);
    expect(el.style.getPropertyValue("--card-scale")).toBe("1.25");
  });

  it("says why there is nothing to list", async () => {
    const el = document.createElement("mc-rules-card-list");
    el.empty = "No encounter sets in the pool.";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-empty-state")!.getAttribute("message")).toBe(
      "No encounter sets in the pool.",
    );
  });
});
