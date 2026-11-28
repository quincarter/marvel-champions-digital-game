// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-deck-check-page.js";
import type { DeckCheckPageModel } from "../mc-deck-check-page.types.js";

const model: DeckCheckPageModel = {
  header: {
    backLabel: "Back",
    title: "SPIDER-MAN — JUSTICE",
    badgeText: "40 CARDS · LEGAL",
    badgeTone: "legal",
    meta: "40",
  },
  rail: {
    aspectHeading: "Aspect",
    aspects: [{ aspect: "pool", label: "'Pool", chosen: false, tipLabel: "'Pool" }],
    tips: {
      pool: {
        heading: "'Pool",
        tagline: "A tagline",
        body: "A tip.",
        linkLabel: "Aspects",
        linkReason: "Soon",
        linkAvailable: false,
      },
    },
    filterHeading: "Filter",
    chips: [
      { id: "all", label: "All" },
      { id: "ally", label: "Allies" },
    ],
    curveHeading: "Cost curve",
    bars: [{ label: "0", count: 2, highlight: true }],
  },
  curve: {
    heading: "RESOURCE CURVE",
    average: "avg 1.0",
    bars: [{ label: "0", count: 2, highlight: true }],
    tiles: [{ id: "resource", text: "Resources 2" }],
    rows: [{ id: "a", cost: 1, costColor: "", name: "A", quantity: 2 }],
  },
  composition: { heading: "COMPOSITION BY ASPECT", tiles: [{ id: "justice", text: "Justice 2" }], empty: "No cards." },
  tabs: [
    { id: "curve", label: "Curve" },
    { id: "cards", label: "Cards" },
    { id: "aspect", label: "Aspect" },
  ],
  panel: { heading: "YOUR DECK", groups: [], more: "" },
  sortLabel: "Sort: Aspect",
  actions: { editLabel: "Edit deck", startLabel: "Start game", startUnavailable: "" },
  cards: { faces: [], groups: [], note: "", cardScale: 1, desktop: true },
};

const mount = async (size: "wide" | "narrow" | "phone") => {
  const el = document.createElement("mc-deck-check-page");
  el.size = size;
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
};

const tags = (el: Element): string[] => [...el.shadowRoot!.querySelectorAll("*")].map((node) => node.localName);

describe("mc-deck-check-page", () => {
  it("composes the rail, the cards and the panel on the wide layout, and no tabs", async () => {
    const el = await mount("wide");
    const parts = tags(el);
    for (const tag of [
      "mc-top-bar",
      "mc-deck-composition",
      "mc-deck-type-filter",
      "mc-cost-curve",
      "mc-deck-card-sections",
      "mc-deck-list-panel",
      "mc-deck-actions",
    ])
      expect(parts).toContain(tag);
    expect(parts).not.toContain("mc-tab-rail");
    el.remove();
  });

  it("composes the tabs, the tab's body and the footer on a narrow layout, one tab at a time", async () => {
    const el = await mount("phone");
    expect(tags(el)).toContain("mc-tab-rail");
    expect(tags(el)).toContain("mc-deck-summary");
    expect(tags(el)).not.toContain("mc-deck-composition");
    el.tab = "aspect";
    await el.updateComplete;
    expect(tags(el)).toContain("mc-deck-group-tiles");
    el.tab = "cards";
    await el.updateComplete;
    expect(tags(el)).toContain("mc-deck-card-sections");
    expect(el.shadowRoot!.querySelector('[data-stop="deck-sort"]')).not.toBeNull();
    el.remove();
  });

  it("turns a tab rail activation into a typed tab event, and keeps the activation to itself", async () => {
    const el = await mount("phone");
    const heard = vi.fn();
    const leaked = vi.fn();
    el.addEventListener("mc-deck-check", (event) => heard(event.detail));
    document.body.addEventListener("mc-activate", leaked);
    el.shadowRoot!.querySelector("mc-tab-rail")!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "tab:cards", id: "cards" }, bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "tab", tab: "cards" });
    expect(leaked).not.toHaveBeenCalled();
    el.remove();
  });

  it("shows the open aspect's tip on a plate pointing at its segment, and says tip-close and tip-link from it", async () => {
    const el = await mount("wide");
    expect(el.shadowRoot!.querySelector("mc-tip-plate")).toBeNull();
    el.openTip = "pool";
    await el.updateComplete;
    await el.updateComplete;
    const plate = el.shadowRoot!.querySelector<HTMLElement & { heading: string; body: string; anchor: Element | null }>(
      "mc-tip-plate",
    )!;
    expect(plate.heading).toBe("'Pool");
    expect(plate.body).toBe("A tip.");
    expect(plate.anchor).toBe(el.shadowRoot!.querySelector("mc-deck-composition")!.anchorOf("pool"));
    const heard = vi.fn();
    el.addEventListener("mc-deck-check", (event) => heard(event.detail));
    plate.dispatchEvent(new CustomEvent("mc-tip-close", { bubbles: true, composed: true }));
    plate.dispatchEvent(new CustomEvent("mc-tip-link", { bubbles: true, composed: true }));
    expect(heard.mock.calls.map(([detail]) => detail)).toEqual([
      { type: "tip-close" },
      { type: "tip-link", aspect: "pool" },
    ]);
    el.remove();
  });
});
