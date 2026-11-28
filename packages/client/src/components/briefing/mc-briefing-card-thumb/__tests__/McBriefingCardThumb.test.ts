
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import type { PressEvent } from "@mc/ui";
import { briefingEvents, find, mount, press } from "../../test-support.js";
import "../mc-briefing-card-thumb.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-card-thumb", () => {
  it("a press and a hold both open the card in Inspect, as the same action", async () => {
    const el = await mount("mc-briefing-card-thumb", {
      stop: "call-inspect:0",
      card: { cardId: "01001", name: "Desperate Measures" },
      picture: { src: null, missing: "No scan" },
    });
    const seen: PressEvent["detail"][] = [];
    el.addEventListener("mc-pressed", (event) => seen.push((event as PressEvent).detail));
    press(el);
    (el as unknown as { inspect(): void }).inspect();
    expect(seen.map((s) => s.hold)).toEqual([false, true]);
    expect(seen[0]!.action).toEqual({ type: "inspect", cardId: "01001", name: "Desperate Measures" });
    expect(el.getAttribute("data-stop")).toBe("call-inspect:0");
  });

  it("with no card it is the plain frame and presses nothing", async () => {
    const el = await mount("mc-briefing-card-thumb", { picture: { src: null, missing: "No scan" } });
    const seen = briefingEvents(el);
    const pressed: unknown[] = [];
    el.addEventListener("mc-pressed", (event) => pressed.push(event));
    press(el);
    expect(pressed).toEqual([]);
    expect(seen).toEqual([]);
  });

  it("draws the magnifier badge only when asked", async () => {
    const plain = await mount("mc-briefing-card-thumb", { card: { cardId: "1", name: "A" } });
    expect(find(plain, ".badge")).toBeNull();
    const badged = await mount("mc-briefing-card-thumb", { card: { cardId: "1", name: "A" }, badge: true });
    expect(find(badged, ".badge")).not.toBeNull();
  });
});
