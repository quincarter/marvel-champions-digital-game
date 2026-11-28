// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-rules-page.js";
import type { RulesPageModel } from "../mc-rules-page.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<RulesPageModel> = {}): RulesPageModel => ({
  header: { backLabel: "Back", heading: "Rules reference", backGlyph: null, caption: "All", toggle: null },
  tabs: [{ id: "glossary", label: "Glossary" }],
  tab: "glossary",
  search: { query: "", placeholder: "Search rules" },
  glossary: { entries: [], empty: "No rules terms match that search." },
  villain: null,
  cards: null,
  ...over,
});

async function page(m: RulesPageModel) {
  const el = document.createElement("mc-rules-page");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-rules-page", () => {
  it("composes the header, the rail, the search and the glossary in the reader frame", async () => {
    const el = await page(model());
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-reader")!.hasAttribute("no-side")).toBe(true);
    for (const tag of ["mc-rules-header", "mc-rules-tabs", "mc-search-field", "mc-rules-glossary"]) {
      expect(root.querySelector(tag), tag).not.toBeNull();
    }
    expect(root.querySelector("mc-rules-card-list")).toBeNull();
  });

  it("drops the search on the other tabs and shows the card list", async () => {
    const el = await page(
      model({
        tab: "cardList",
        search: null,
        glossary: null,
        cards: { items: [], empty: "No encounter sets in the pool.", cardScale: 1, caption: 46 },
      }),
    );
    expect(el.shadowRoot!.querySelector("mc-search-field")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-rules-card-list")).not.toBeNull();
  });

  it("turns the search field's text into one typed mc-rules event", async () => {
    const el = await page(model());
    const heard = vi.fn();
    el.addEventListener("mc-rules", (event) => heard(event.detail));
    el.shadowRoot!.querySelector("mc-search-field")!.dispatchEvent(
      new CustomEvent("mc-search", { detail: { value: "guard" }, bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "search", value: "guard" });
  });
});
