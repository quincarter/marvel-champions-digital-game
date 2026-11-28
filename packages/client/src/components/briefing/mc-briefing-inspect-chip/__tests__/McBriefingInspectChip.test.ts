// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import type { PressEvent } from "@mc/ui";
import { find, mount, press } from "../../test-support.js";
import "../mc-briefing-inspect-chip.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-inspect-chip", () => {
  it("a press raises the inspect action for its card, and a hold raises the same", async () => {
    const el = await mount("mc-briefing-inspect-chip", {
      label: "Inspect",
      stop: "mission-mission",
      card: { cardId: "01001", name: "Mission" },
    });
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (event) => seen.push((event as PressEvent).detail));
    press(el);
    (el as unknown as { inspect(): void }).inspect();
    const action = { type: "inspect", cardId: "01001", name: "Mission" };
    expect(seen).toEqual([
      { action, hold: false },
      { action, hold: true },
    ]);
    expect(el.getAttribute("data-stop")).toBe("mission-mission");
    expect(find(el, ".chip")?.textContent).toBe("Inspect");
  });
});
