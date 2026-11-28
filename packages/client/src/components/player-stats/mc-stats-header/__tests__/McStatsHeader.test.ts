// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-header";
import type { StatsEventDetail } from "../../shared/stats-events.types";
import type { StatsHeaderInput } from "../mc-stats-header.types";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<StatsHeaderInput> = {}): StatsHeaderInput => ({
  backLabel: "◂ TITLE",
  title: "Your stats",
  played: "17 games played",
  showSource: true,
  source: "you",
  youLabel: "You",
  everyoneLabel: "Everyone",
  backGlyph: undefined,
  sourceGlyph: undefined,
  ...over,
});

async function header(i: StatsHeaderInput | null, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-stats-header");
  el.input = i;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-header", () => {
  it("draws Back as the first stop, the title, the figure and the switch", async () => {
    const el = await header(input());
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-button")!.getAttribute("data-stop")).toBe("back");
    expect(root.querySelector(".title")!.textContent).toBe("Your stats");
    expect(root.querySelector(".played")!.textContent).toBe("17 games played");
    expect(root.querySelector("mc-stats-source-switch")).not.toBeNull();
  });

  it("leaves the switch out until the stats have loaded, and the figure out when there is none", async () => {
    const el = await header(input({ showSource: false, played: "" }));
    expect(el.shadowRoot!.querySelector("mc-stats-source-switch")).toBeNull();
    expect(el.shadowRoot!.querySelector(".played")).toBeNull();
  });

  it("says back as one typed event", async () => {
    const el = await header(input());
    const seen: StatsEventDetail[] = [];
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector("mc-button")!.dispatchEvent(new CustomEvent("mc-press"));
    expect(seen).toEqual([{ type: "back" }]);
  });

  it("draws nothing without an input", async () => {
    const el = await header(null);
    expect(el.shadowRoot!.children.length).toBe(0);
  });
});
