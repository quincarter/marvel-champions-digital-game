// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-rules-glossary.js";

afterEach(() => document.body.replaceChildren());

describe("mc-rules-glossary", () => {
  it("draws an entry card per term", async () => {
    const el = document.createElement("mc-rules-glossary");
    el.entries = [
      { id: "guard", name: "Guard", definition: "d", cite: "c", tiles: [], more: 0 },
      { id: "toughness", name: "Toughness", definition: "d", cite: "c", tiles: [], more: 0 },
    ];
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("mc-rules-entry")).toHaveLength(2);
    expect(el.scroller).not.toBeNull();
  });

  it("says so when the search matches nothing", async () => {
    const el = document.createElement("mc-rules-glossary");
    el.empty = "No rules terms match that search.";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-empty-state")!.getAttribute("message")).toBe(
      "No rules terms match that search.",
    );
  });
});
