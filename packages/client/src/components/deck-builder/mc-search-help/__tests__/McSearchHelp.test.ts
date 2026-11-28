// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-search-help.js";
import type { McSearchHelp } from "../McSearchHelp.js";
import type { SearchHelpModel } from "../mc-search-help.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<SearchHelpModel> = {}): SearchHelpModel => ({
  title: "Search help",
  backLabel: "Back",
  useLabel: "Use",
  copyLabel: "Copy",
  copiedLabel: "Copied",
  failedLabel: "Failed",
  rows: [
    { kind: "heading", text: "How it works" },
    { kind: "note", text: "Words match names." },
    { kind: "query", query: "o:2", meaning: "Cost 2" },
    { kind: "query", query: "t:ally", meaning: "Allies" },
  ],
  copied: null,
  ...over,
});

describe("mc-search-help", () => {
  it("names Use and Copy by their row, then Back, as the stops the specs use", async () => {
    const el = await mount<McSearchHelp>("mc-search-help", { model: model() });
    expect(stopKeys(el)).toEqual(["use:2", "copy:2", "use:3", "copy:3", "back"]);
  });

  it("says use or copy for the query on the row, and close for Back", async () => {
    const el = await mount<McSearchHelp>("mc-search-help", { model: model() });
    const seen = builderEvents(el);
    press(stop(el, "use:3"));
    press(stop(el, "copy:2"));
    press(stop(el, "back"));
    expect(seen).toEqual([
      { type: "help-use", query: "t:ally" },
      { type: "help-copy", index: 2, query: "o:2" },
      { type: "sheet-close" },
    ]);
  });

  it("says Copied on the row whose copy worked, and Failed when it did not", async () => {
    const ok = await mount<McSearchHelp>("mc-search-help", { model: model({ copied: { index: 2, ok: true } }) });
    expect((stop(ok, "copy:2") as unknown as { label: string }).label).toBe("Copied");
    expect((stop(ok, "copy:3") as unknown as { label: string }).label).toBe("Copy");
    document.body.replaceChildren();
    const bad = await mount<McSearchHelp>("mc-search-help", { model: model({ copied: { index: 3, ok: false } }) });
    expect((stop(bad, "copy:3") as unknown as { label: string }).label).toBe("Failed");
  });

  it("draws headings and notes as words", async () => {
    const el = await mount<McSearchHelp>("mc-search-help", { model: model() });
    expect(inner(el, "h3")!.textContent).toBe("How it works");
    expect(inner(el, "p")!.textContent).toBe("Words match names.");
  });
});
