import { describe, expect, it } from "vitest";
import { gamepadIntentFor } from "./gamepad.js";
import { abilityPageCount, abilitySlotOf, layerActionOf, layerBindingOf, layerSheet } from "./pad-layers.js";

describe("pad layers", () => {
  it("binds LT to Attack / Thwart / Recover / Change form on A X Y B and Undo / End turn on LB / RB", () => {
    expect([0, 2, 3, 1, 4, 5].map((index) => layerActionOf("lt", index))).toEqual([
      "attack",
      "thwart",
      "recover",
      "changeForm",
      "undo",
      "endTurn",
    ]);
  });

  it("binds RT to the four abilities in A X Y B order, with LB / RB paging", () => {
    expect([0, 2, 3, 1, 4, 5].map((index) => layerActionOf("rt", index))).toEqual([
      "ability1",
      "ability2",
      "ability3",
      "ability4",
      "pagePrevious",
      "pageNext",
    ]);
    expect(abilitySlotOf("ability3")).toBe(2);
    expect(abilitySlotOf("attack")).toBeNull();
    expect(layerActionOf("rt", 7)).toBeNull();
  });

  it("leaves LT and RT alone with no meaning in the base table", () => {
    expect(gamepadIntentFor(6)).toBeNull();
    expect(gamepadIntentFor(7)).toBeNull();
  });

  it("finds the layer and button that do an action", () => {
    expect(layerBindingOf("undo")).toEqual({ layer: "lt", index: 4 });
    expect(layerBindingOf("ability4")).toEqual({ layer: "rt", index: 1 });
    expect(layerBindingOf("pageNext")).toEqual({ layer: "rt", index: 5 });
  });

  it("draws each family's own labels, and the Switch swap moves the confirm-position glyphs", () => {
    const xbox = layerSheet("lt", "xbox", false);
    expect(xbox.trigger?.label).toBe("LT");
    expect(xbox.rows.map((row) => row.glyph?.label)).toEqual(["A", "X", "Y", "B", "LB", "RB"]);
    expect(layerSheet("rt", "playstation", false).trigger?.label).toBe("R2");
    expect(layerSheet("lt", "playstation", false).rows[0]!.glyph?.symbol).toBe("cross");
    // With the Switch layout the press that acts as position 0 is the button labelled A.
    expect(layerSheet("lt", "nintendo", true).rows[0]!.glyph?.label).toBe("A");
    expect(layerSheet("lt", "nintendo", false).rows[0]!.glyph?.label).toBe("B");
  });

  it("greys LT actions the Board says are unavailable", () => {
    const sheet = layerSheet("lt", "xbox", false, { enabled: { attack: false, undo: false } });
    const byAction = Object.fromEntries(sheet.rows.map((row) => [row.action, row.enabled]));
    expect(byAction).toMatchObject({ attack: false, thwart: true, undo: false, endTurn: true });
  });

  it("names the usable abilities on RT, greys empty slots, and pages", () => {
    const abilities = ["Quinjet", "Web-Shooters", "Danger Sense", "Backflip", "Swinging Strike", "Aunt May"];
    const first = layerSheet("rt", "xbox", false, { abilities });
    expect(first.rows.slice(0, 4).map((row) => row.label)).toEqual(abilities.slice(0, 4));
    expect(first.rows.map((row) => row.enabled)).toEqual([true, true, true, true, false, true]);
    const second = layerSheet("rt", "xbox", false, { abilities, abilityPage: 1 });
    expect(second.rows.slice(0, 2).map((row) => row.label)).toEqual(["Swinging Strike", "Aunt May"]);
    expect(second.rows.map((row) => row.enabled)).toEqual([true, true, false, false, true, false]);
    const none = layerSheet("rt", "xbox", false, { abilities: [] });
    expect(none.rows.every((row) => !row.enabled)).toBe(true);
    expect(abilityPageCount(abilities)).toBe(2);
    expect(abilityPageCount([])).toBe(1);
  });

  it("reads as a legend, every slot available, when the Board gives no ability list", () => {
    expect(layerSheet("rt", "xbox", false).rows.every((row) => row.enabled)).toBe(true);
    expect(layerSheet("rt", "xbox", false).rows[0]!.label).toBe("Ability 1");
  });
});
