// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-player-stats-page";
import type { StatsPageModel } from "../mc-player-stats-page.types";

afterEach(() => document.body.replaceChildren());

const header = {
  backLabel: "◂ TROPHIES",
  title: "Your stats",
  played: "5 games played",
  showSource: true,
  source: "you" as const,
  youLabel: "You",
  everyoneLabel: "Everyone",
  backGlyph: undefined,
  sourceGlyph: undefined,
};

async function page(model: StatsPageModel | null) {
  const el = document.createElement("mc-player-stats-page");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-player-stats-page", () => {
  it("composes the header, tabs, controls and a list from the model, and nothing of its own", async () => {
    const el = await page({
      header,
      tabs: {
        tabs: [{ id: "overview", label: "Overview", selected: true }],
        selected: "overview",
        glyph: undefined,
        toggle: null,
      },
      controls: [],
      body: { kind: "list", scrollKey: "overview", blocks: [], side: null },
    });
    const kids = [...el.shadowRoot!.querySelectorAll("mc-top-bar, mc-stats-tabs, mc-stats-controls, mc-stats-list")];
    expect(kids.map((k) => k.localName)).toEqual(["mc-top-bar", "mc-stats-tabs", "mc-stats-controls", "mc-stats-list"]);
    expect(el.list).not.toBeNull();
    expect(el.grid).toBeNull();
  });

  it("says a word while the saves are read, with no tabs", async () => {
    const el = await page({
      header: { ...header, showSource: false },
      tabs: null,
      controls: [],
      body: { kind: "message", text: "Reading your games…" },
    });
    expect(el.shadowRoot!.querySelector("mc-stats-tabs")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-empty-state")!.getAttribute("message")).toBe("Reading your games…");
  });

  it("draws nothing without a model", async () => {
    const el = await page(null);
    expect(el.shadowRoot!.children.length).toBe(0);
  });
});
