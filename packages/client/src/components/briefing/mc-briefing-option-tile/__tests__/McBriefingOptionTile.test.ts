// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import type { PressEvent } from "@mc/ui";
import { briefingEvents, find, findAll, mount, press, wordsOf } from "../../test-support.js";
import "../mc-briefing-option-tile.js";

afterEach(() => document.body.replaceChildren());

const base = {
  stop: "role:brawler",
  action: { type: "role", id: "brawler" },
  title: "Brawler",
  body: "Hits hard.",
  available: true,
};

describe("mc-briefing-option-tile", () => {
  it("an available tile is one focus stop whose press raises its action", async () => {
    const el = await mount("mc-briefing-option-tile", { tile: { ...base, footer: "Adds Aggression" } });
    const card = find(el, "mc-press-card")!;
    expect(card.getAttribute("data-stop")).toBe("role:brawler");
    const seen: PressEvent["detail"][] = [];
    el.addEventListener("mc-pressed", (event) => seen.push((event as PressEvent).detail));
    press(card);
    expect(seen).toEqual([{ action: base.action, hold: false }]);
    expect(wordsOf(el)).toContain("Brawler");
    expect(wordsOf(el)).toContain("Adds Aggression");
  });

  it("a tile that cannot be picked has no stop, takes no press, and says why in words", async () => {
    const el = await mount("mc-briefing-option-tile", {
      tile: { ...base, available: false, body: "TAKEN BY SEAT 1", bodyWarn: true },
    });
    const card = find(el, "mc-press-card")!;
    expect(card.getAttribute("data-stop") ?? "").toBe("");
    expect(card.hasAttribute("dim")).toBe(true);
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (event) => seen.push(event));
    press(card);
    expect(seen).toEqual([]);
    expect(wordsOf(el)).toContain("TAKEN BY SEAT 1");
  });

  it("a tile whose action is a Briefing detail raises mc-briefing and keeps mc-pressed to itself", async () => {
    const el = await mount("mc-briefing-option-tile", {
      tile: { ...base, stop: "call-option:x", action: { type: "answer", picked: ["x"] } },
    });
    const seen = briefingEvents(el);
    const pressed: unknown[] = [];
    document.body.addEventListener("mc-pressed", (event) => pressed.push(event), { once: true });
    press(find(el, "mc-press-card")!);
    expect(seen).toEqual([{ type: "answer", picked: ["x"] }]);
    expect(pressed).toEqual([]);
  });

  it("wears aspect chips with their words, and the switched-on state as the selected frame", async () => {
    const el = await mount("mc-briefing-option-tile", {
      tile: { ...base, on: true, chips: [{ aspect: "aggression", label: "Aggression" }] },
    });
    expect(findAll(el, "mc-aspect-chip")).toHaveLength(1);
    expect(find(el, "mc-press-card")!.hasAttribute("selected")).toBe(true);
  });
});
