// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-tabs";
import type { StatsEventDetail } from "../../shared/stats-events.types";

afterEach(() => document.body.replaceChildren());

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "heroes", label: "Heroes" },
];

async function strip(set: (el: HTMLElementTagNameMap["mc-stats-tabs"]) => void = () => undefined) {
  const el = document.createElement("mc-stats-tabs");
  el.tabs = tabs;
  el.selected = "overview";
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-tabs", () => {
  it("hands the tabs to the rail and marks the chosen one", async () => {
    const el = await strip();
    const rail = el.shadowRoot!.querySelector("mc-tab-rail")!;
    expect(rail.tabs.map((t) => t.id)).toEqual(["overview", "heroes"]);
    expect(rail.selected).toBe("overview");
    expect(rail.style.getPropertyValue("--tab-count")).toBe("2");
  });

  it("says a tab pressed as one typed event and stops the rail's own", async () => {
    const el = await strip();
    const seen: StatsEventDetail[] = [];
    let raw = 0;
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    document.body.addEventListener("mc-activate", () => raw++);
    el.shadowRoot!.querySelector("mc-tab-rail")!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "tab:heroes", id: "heroes" }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "tab", tab: "heroes" }]);
    expect(raw).toBe(0);
  });

  it("draws a phone's Filters chip at the end of the row as a focus stop, and none without one", async () => {
    const none = await strip();
    expect(none.shadowRoot!.querySelector(".toggle")).toBeNull();
    const el = await strip((e) => {
      e.toggle = {
        key: "filter:toggle",
        label: "▸ Filters",
        selected: false,
        action: { type: "filter", filter: "toggle" },
      };
    });
    expect(el.shadowRoot!.querySelector(".toggle mc-chip")!.getAttribute("data-stop")).toBe("filter:toggle");
  });
});
