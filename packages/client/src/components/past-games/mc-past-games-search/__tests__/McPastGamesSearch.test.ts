// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-games-search.js";
import type { McPastGamesSearch } from "../McPastGamesSearch.js";
import type { PastGamesSearchModel } from "../mc-past-games-search.types.js";

afterEach(() => document.body.replaceChildren());

const model: PastGamesSearchModel = {
  value: "rhi",
  placeholder: "Search games",
  clearLabel: "Clear",
  exportLabel: "Export for MC Tracker (CSV)",
  exportDisabled: false,
};

async function mount(m: PastGamesSearchModel = model): Promise<McPastGamesSearch> {
  const el = document.createElement("mc-past-games-search");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-games-search", () => {
  it("is two stops: the export button, and the search field holding the accepted text", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector<HTMLElement>("mc-button")!.dataset.stop).toBe("export-tracker");
    const field = root.querySelector<HTMLElement & { value: string; placeholder: string }>("mc-search-field")!;
    expect(field.dataset.stop).toBe("search");
    expect(field.value).toBe("rhi");
    expect(field.placeholder).toBe("Search games");
    expect(el.field).toBe(field);
  });

  it("raises the export and dims it while there is nothing to export", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-past-games", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-button")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "export-tracker" });
    el.model = { ...model, exportDisabled: true };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement & { disabled: boolean }>("mc-button")!.disabled).toBe(true);
  });
});
