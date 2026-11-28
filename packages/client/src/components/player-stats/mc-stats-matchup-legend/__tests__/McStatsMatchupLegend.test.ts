// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-stats-matchup-legend";

afterEach(() => document.body.replaceChildren());

describe("mc-stats-matchup-legend", () => {
  it("draws a swatch and a word for each look", async () => {
    const el = document.createElement("mc-stats-matchup-legend");
    el.entries = [
      { kind: "tier", label: "Expert", color: "#6b3fa0" },
      { kind: "played", label: "Played, not beaten", color: "" },
      { kind: "unplayed", label: "Not played", color: "" },
    ];
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect([...root.querySelectorAll(".entry")].map((e) => e.textContent)).toEqual([
      "Expert",
      "Played, not beaten",
      "Not played",
    ]);
    expect([...root.querySelectorAll(".swatch")].map((s) => s.getAttribute("data-kind"))).toEqual([
      "tier",
      "played",
      "unplayed",
    ]);
    expect((root.querySelector(".swatch") as HTMLElement).style.getPropertyValue("--swatch")).toBe("#6b3fa0");
  });
});
