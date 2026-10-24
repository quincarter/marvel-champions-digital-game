import { describe, expect, it } from "vitest";
import { defaultSettings } from "../settings.js";
import { SHORTCUTS, shortcutCaps, type ShortcutId } from "./input-shortcuts.js";
import {
  controllerCaptionOf,
  controllerStateOf,
  keyboardGroupsOf,
  keyboardHandRowInfoOf,
  nextSettingsAfterKeyboardHand,
  padLayerSectionsOf,
  nextSettingsAfterHints,
  nextSettingsAfterNintendo,
  nextSettingsAfterPadFamily,
  nintendoToggleInfoOf,
  padDisplayName,
  padFamilyRowInfoOf,
  padRowsOf,
  padStatusOf,
  STEAM_NINTENDO_DETAIL,
} from "./controls-rows.js";
import { detectPad } from "./pad-family.js";

const deck = detectPad("Steam Virtual Gamepad (STANDARD GAMEPAD Vendor: 28de Product: 1205)");
const xbox = detectPad("Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)");
const pro = detectPad("Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)");

describe("controls rows", () => {
  it("names the pad without the browser's vendor tail", () => {
    expect(padDisplayName("Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)")).toBe(
      "Xbox 360 Controller",
    );
    expect(padDisplayName("054c-0ce6-DualSense Wireless Controller")).toBe("DualSense Wireless Controller");
  });

  it("words the status line for each situation", () => {
    expect(padStatusOf(null, null)).toEqual({ connected: false, text: "No controller connected" });
    expect(padStatusOf("Xbox 360 Controller (Vendor: 045e Product: 028e)", xbox).text).toBe(
      "Xbox controller connected · Xbox 360 Controller",
    );
    expect(padStatusOf("Steam Deck", deck).text).toBe("Steam Deck controls · through Steam Input");
    // A DualSense connected before any press: the status names it, and an Xbox label override does not change that.
    const dualsense = detectPad("DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)");
    expect(padStatusOf("DualSense Wireless Controller (Vendor: 054c Product: 0ce6)", dualsense).text).toBe(
      "PlayStation controller connected · DualSense Wireless Controller",
    );
    expect(controllerStateOf({ ...defaultSettings(), padGlyphFamily: "xbox" }, dualsense).family).toBe("xbox");
  });

  it("locks the Nintendo toggle off under Steam, with its reason", () => {
    const info = nintendoToggleInfoOf({ ...defaultSettings(), nintendoLayout: true }, deck);
    expect(info.locked?.chip).toBe("STEAM");
    expect(info.on).toBe(false);
    expect(info.detail).toBe(STEAM_NINTENDO_DETAIL);
    expect(nintendoToggleInfoOf(defaultSettings(), xbox).locked).toBeUndefined();
  });

  it("changes only its own setting", () => {
    const base = defaultSettings();
    expect(nextSettingsAfterPadFamily(base, "playstation")).toEqual({ ...base, padGlyphFamily: "playstation" });
    expect(nextSettingsAfterNintendo(base).nintendoLayout).toBe(!base.nintendoLayout);
    expect(nextSettingsAfterHints(base).inputGlyphs).toBe(!base.inputGlyphs);
    expect(padFamilyRowInfoOf(base).options.map((o) => o.label)).toEqual(["Auto", "Xbox", "PlayStation", "Switch"]);
  });

  it("draws the handheld for a handheld pad and the family otherwise", () => {
    expect(controllerStateOf(defaultSettings(), deck).kind).toBe("handheld");
    expect(controllerStateOf(defaultSettings(), pro).kind).toBe("nintendo");
    expect(controllerStateOf({ ...defaultSettings(), padGlyphFamily: "playstation" }, xbox).kind).toBe("playstation");
  });

  it("reads Y as Inspect, hold to zoom, and shows the swap on a Switch layout", () => {
    const xboxRows = padRowsOf("xbox", false);
    expect(xboxRows.find((r) => r.id === "inspect")!.action).toBe("Inspect · hold to zoom");
    expect(xboxRows.find((r) => r.id === "inspect")!.glyphs[0]).toMatchObject({ label: "Y" });
    // On a Switch with the swap, the confirm meaning sits on the button labelled A.
    expect(padRowsOf("nintendo", true).find((r) => r.id === "activate")!.glyphs[0]).toMatchObject({ label: "A" });
    expect(padRowsOf("nintendo", false).find((r) => r.id === "activate")!.glyphs[0]).toMatchObject({ label: "B" });
    expect(padRowsOf("playstation", false).find((r) => r.id === "activate")!.glyphs[0]).toMatchObject({
      symbol: "cross",
    });
  });

  it("describes the layout in one caption line", () => {
    expect(controllerCaptionOf("nintendo", pro, true)).toContain("A (right) confirms");
    expect(controllerCaptionOf("xbox", deck, false)).toContain("Steam Input");
  });

  it("lists the keyboard map for the active hand in three groups", () => {
    for (const hand of ["left", "right"] as const) {
      const groups = keyboardGroupsOf(hand);
      expect(groups.map((g) => g.title)).toEqual(["EVERYWHERE", "ON THE TABLE", "DECISION POPUP"]);
      const shown = groups.flatMap((g) => g.rows.flatMap((r) => r.glyphs.map((k) => k.label)));
      const ids: ShortcutId[] = SHORTCUTS.map((shortcut) => shortcut.id).filter(
        (id) => !["activate", "cancel", "pause", "zonePrevious", "zoneNext"].includes(id),
      );
      for (const id of ids) for (const cap of shortcutCaps(id, hand)) expect(shown, `${hand} ${id}`).toContain(cap);
    }
    const left = keyboardGroupsOf("left").flatMap((g) => g.rows.flatMap((r) => r.glyphs.map((k) => k.label)));
    const right = keyboardGroupsOf("right").flatMap((g) => g.rows.flatMap((r) => r.glyphs.map((k) => k.label)));
    expect(left).toContain("W");
    expect(left).not.toContain("I");
    expect(right).toContain("I");
    expect(right).not.toContain("W");
  });

  it("offers the keyboard hand as a Left / Right row that changes only keyboardHand", () => {
    const base = defaultSettings();
    expect(keyboardHandRowInfoOf(base).options.map((o) => o.label)).toEqual(["Left", "Right"]);
    expect(keyboardHandRowInfoOf(base).selected).toBe("left");
    expect(nextSettingsAfterKeyboardHand(base, "right")).toEqual({ ...base, keyboardHand: "right" });
  });

  it("lists HOLD LT and HOLD RT sections with the trigger beside each button, and no LT / RT rows in BUTTONS", () => {
    const sections = padLayerSectionsOf("xbox", false);
    expect(sections.map((s) => s.title)).toEqual(["HOLD LT", "HOLD RT"]);
    const lt = sections[0]!.rows;
    expect(lt.map((r) => r.action)).toEqual(["Attack", "Thwart", "Recover", "Change form", "Undo", "End turn"]);
    expect(lt[0]!.glyphs.map((g) => g.label)).toEqual(["LT", "A"]);
    expect(lt[5]!.glyphs.map((g) => g.label)).toEqual(["LT", "RB"]);
    expect(sections[1]!.rows[0]!.glyphs.map((g) => g.label)).toEqual(["RT", "A"]);
    expect(padRowsOf("xbox", false).some((r) => r.id === "undo" || r.id === "endTurn")).toBe(false);
  });
});
