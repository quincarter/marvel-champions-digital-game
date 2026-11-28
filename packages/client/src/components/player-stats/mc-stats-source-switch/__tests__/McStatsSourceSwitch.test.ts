// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-source-switch";
import type { StatsEventDetail } from "../../shared/stats-events.types";

afterEach(() => document.body.replaceChildren());

async function switcher(source: "you" | "everyone" = "you") {
  const el = document.createElement("mc-stats-source-switch");
  el.source = source;
  el.youLabel = "You";
  el.everyoneLabel = "Everyone";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-source-switch", () => {
  it("draws the pair as two focus stops, the chosen one marked", async () => {
    const el = await switcher("everyone");
    const chips = [...el.shadowRoot!.querySelectorAll("mc-chip")];
    expect(chips.map((c) => c.getAttribute("data-stop"))).toEqual(["source:you", "source:everyone"]);
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
    expect(el.shadowRoot!.querySelectorAll(".segment[data-chosen]")).toHaveLength(1);
  });

  it("says which source was chosen as one typed event, and stops the control's own", async () => {
    const el = await switcher();
    const seen: StatsEventDetail[] = [];
    let raw = 0;
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    document.body.addEventListener("mc-pressed", () => raw++);
    (el.shadowRoot!.querySelectorAll("mc-chip")[1] as HTMLElement & { press(): void }).press();
    expect(seen).toEqual([{ type: "source", source: "everyone" }]);
    expect(raw).toBe(0);
  });
});
