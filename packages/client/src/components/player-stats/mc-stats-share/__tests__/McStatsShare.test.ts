// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../../mc-stats-chip-row/mc-stats-chip-row";
import "../mc-stats-share";
import type { StatsEventDetail } from "../../shared/stats-events.types";
import type { StatsShareInput } from "../mc-stats-share.types";

afterEach(() => document.body.replaceChildren());

async function share(input: StatsShareInput | null) {
  const el = document.createElement("mc-stats-share");
  el.input = input;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-share", () => {
  it("offers the chip with the line under it, and a press says share", async () => {
    const el = await share({
      kind: "offer",
      line: "Only the result is sent.",
      chip: { key: "share:global", label: "Share my games", selected: false, action: { type: "share" } },
    });
    expect(el.shadowRoot!.querySelector(".line")!.textContent).toBe("Only the result is sent.");
    const row = el.shadowRoot!.querySelector("mc-stats-chip-row")!;
    await row.updateComplete;
    const seen: StatsEventDetail[] = [];
    el.addEventListener("mc-player-stats", (e) => seen.push(e.detail));
    (row.shadowRoot!.querySelector("mc-chip") as HTMLElement & { press(): void }).press();
    expect(seen).toEqual([{ type: "share" }]);
  });

  it("says Sharing on once it is on, with no chip", async () => {
    const el = await share({ kind: "on", label: "Sharing on" });
    expect(el.shadowRoot!.querySelector(".on")!.textContent).toBe("Sharing on");
    expect(el.shadowRoot!.querySelector("mc-stats-chip-row")).toBeNull();
  });

  it("draws nothing without an input", async () => {
    const el = await share(null);
    expect(el.shadowRoot!.children.length).toBe(0);
  });
});
