// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-games-filters.js";
import type { McPastGamesFilters } from "../McPastGamesFilters.js";

afterEach(() => document.body.replaceChildren());

async function mount(glyph?: McPastGamesFilters["glyph"]): Promise<McPastGamesFilters> {
  const el = document.createElement("mc-past-games-filters");
  el.tabs = [
    { id: "all", label: "All (3)" },
    { id: "won", label: "Wins (2)" },
    { id: "lost", label: "Losses (1)" },
  ];
  el.selected = "won";
  el.glyph = glyph;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-games-filters", () => {
  it("is a tab rail whose stops are filter:<id>, the chosen one selected", async () => {
    const el = await mount();
    const rail = el.shadowRoot!.querySelector<HTMLElement & { selected: string; prefix: string }>("mc-tab-rail")!;
    expect(rail.prefix).toBe("filter:");
    expect(rail.selected).toBe("won");
    await (rail as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const stops = [...rail.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((tab) => tab.dataset.stop);
    expect(stops).toEqual(["filter:all", "filter:won", "filter:lost"]);
  });

  it("says which filter a tab chose, and stops the rail's own event", async () => {
    const el = await mount();
    const heard = vi.fn();
    const outer = vi.fn();
    document.body.addEventListener("mc-activate", outer);
    el.addEventListener("mc-past-games", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-tab-rail")!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "filter:lost", id: "lost" }, bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "filter", filter: "lost" });
    expect(outer).not.toHaveBeenCalled();
  });

  it("hangs the LB / RB glyph only while the scene gives one", async () => {
    const el = await mount();
    expect(el.shadowRoot!.querySelector("mc-glyph-hint")).toBeNull();
    el.glyph = { specs: [], height: 14, ground: "paper", openness: 1 };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-glyph-hint")).not.toBeNull();
  });
});
