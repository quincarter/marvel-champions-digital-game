// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-scenario-select-page.js";
import type { McScenarioSelectPage } from "../mc-scenario-select-page.js";
import type { ScenarioSelectPageModel } from "../mc-scenario-select-page.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<ScenarioSelectPageModel> = {}): ScenarioSelectPageModel => ({
  wide: true,
  phone: false,
  topBar: {
    backLabel: "Back",
    title: "Choose a scenario",
    right: "Step 1",
    backGlyph: null,
  },
  filters: {
    searchValue: "",
    placeholder: "Search",
    clearLabel: "Clear",
    searchShown: true,
    searchToggle: null,
    filtersButton: null,
    inspectHint: null,
    chipsShown: true,
    chips: [],
  },
  shelves: {
    randomRow: { drillBack: null, title: "", buttons: [{ id: "random-box", label: "Random box" }] },
    roster: {
      mode: "shelves",
      shelves: [],
      cardWidth: 0,
      cardHeight: 0,
      gap: 12,
      contentWidth: 0,
      previousLabel: "",
      nextLabel: "",
      emptyText: null,
      clearLabel: "",
    },
  },
  stats: [{ label: "Main scheme", value: "x" }],
  picked: {
    heading: "Stages",
    picked: true,
    emptyText: "",
    emptyHint: "",
    collapsible: false,
    open: false,
    summary: "",
    note: "",
    stages: [],
    record: null,
    sets: [],
    stats: [],
  },
  actions: { customize: null, next: "Go", nextDisabled: null, nextGlyph: null, caption: "", captionIsLock: false },
  ...over,
});

async function page(m: ScenarioSelectPageModel): Promise<McScenarioSelectPage> {
  const el = document.createElement("mc-scenario-select-page");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-scenario-select-page", () => {
  it("only composes section elements: no raw control or text of its own", async () => {
    const el = await page(model());
    const tags = [...el.shadowRoot!.querySelectorAll("*")].map((node) => node.tagName.toLowerCase());
    expect(tags.filter((tag) => tag.startsWith("mc-"))).toEqual([
      "mc-top-bar",
      "mc-scenario-filters",
      "mc-scenario-shelves",
      "mc-scenario-stats",
      "mc-scenario-picked",
      "mc-scenario-actions",
    ]);
    expect(tags.filter((tag) => ["button", "input", "a", "p", "span"].includes(tag))).toEqual([]);
  });

  it("follows the model's arrangement by attribute, and draws the stat strip under the shelves only when wide", async () => {
    const wide = await page(model());
    expect(wide.hasAttribute("wide")).toBe(true);
    expect(wide.shadowRoot!.querySelector("mc-scenario-stats")).not.toBeNull();
    const narrow = await page(model({ wide: false, phone: true }));
    expect(narrow.hasAttribute("wide")).toBe(false);
    expect(narrow.hasAttribute("phone")).toBe(true);
    expect(narrow.shadowRoot!.querySelector("mc-scenario-stats")).toBeNull();
  });

  it("a narrow open stages sheet covers the list, which keeps its box", async () => {
    const open = model({
      wide: false,
      picked: { ...model().picked, collapsible: true, open: true },
    });
    const el = await page(open);
    expect(el.shadowRoot!.querySelector(".browse")!.hasAttribute("data-covered")).toBe(true);
    expect(el.shadowRoot!.querySelector(".side")!.hasAttribute("data-open")).toBe(true);
    const shut = await page(model({ wide: false, picked: { ...model().picked, collapsible: true } }));
    expect(shut.shadowRoot!.querySelector(".browse")!.hasAttribute("data-covered")).toBe(false);
  });

  it("lets a section's event reach the scene from the page", async () => {
    const el = await page(model());
    const seen: unknown[] = [];
    el.addEventListener("mc-scenario-select", (event) => seen.push((event as CustomEvent).detail));
    const actions = el.shadowRoot!.querySelector("mc-scenario-actions")!;
    const next = actions.shadowRoot!.querySelector<HTMLElement>('[data-stop="next"]')!;
    next.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 0 }));
    expect(seen).toEqual([{ type: "press", key: "next" }]);
  });

  it("turns the top bar's Back press into the screen's own back press", async () => {
    const el = await page(model());
    const seen: unknown[] = [];
    el.addEventListener("mc-scenario-select", (event) => seen.push((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "press", key: "back" }]);
  });

  it("exposes the search field and the roster for the scene's caret and scroll rules", async () => {
    const el = await page(model());
    await el.updateComplete;
    expect(el.searchField).not.toBeNull();
    expect(el.roster).not.toBeNull();
  });
});
