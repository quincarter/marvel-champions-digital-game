/**
 * Pad detection from the `Gamepad.id` strings browsers really report, and the glyph each position carries.
 * The risk is a wrong family (PlayStation glyphs on an 8BitDo) or a Switch-layout swap applied twice under Steam.
 */

import { describe, expect, test } from "vitest";
import {
  detectPad,
  padGlyphOf,
  physicalIndexOf,
  resolvePadFamily,
  usesNintendoSwap,
  vendorProductOf,
} from "./pad-family.js";

describe("detectPad", () => {
  test.each([
    ["Xbox 360 Controller (XInput STANDARD GAMEPAD)", "xbox"],
    ["045e-0b13-Xbox Wireless Controller", "xbox"],
    ["Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)", "xbox"],
    ["DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)", "playstation"],
    ["54c-9cc-Wireless Controller", "playstation"],
    ["Wireless Controller", "playstation"],
    ["Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)", "nintendo"],
    ["57e-2009-Pro Controller", "nintendo"],
    // 8BitDo Ultimate in Switch mode reports as a Pro Controller; the Ultimate 2 in X-input mode as an Xbox 360 pad.
    ["8BitDo Ultimate 2 Wireless Controller (STANDARD GAMEPAD Vendor: 2dc8 Product: 6012)", "xbox"],
    ["8BitDo Ultimate Wireless Controller for Switch (Vendor: 2dc8 Product: 3106)", "nintendo"],
    ["8BitDo Ultimate 2C Wireless Controller", "xbox"],
    ["Some Unknown Pad", "xbox"],
  ])("%s → %s", (id, family) => {
    expect(detectPad(id).family).toBe(family);
  });

  test("Steam's virtual pad and the Steam Deck are Xbox, flagged Steam, and the Deck is a handheld", () => {
    expect(detectPad("Steam Virtual Gamepad (STANDARD GAMEPAD Vendor: 28de Product: 11ff)")).toEqual({
      family: "xbox",
      steam: true,
      handheld: false,
    });
    expect(detectPad("28de-1205-Steam Deck")).toEqual({ family: "xbox", steam: true, handheld: true });
  });

  test("vendorProductOf reads Chromium's and Firefox's forms, and nothing from a bare name", () => {
    expect(vendorProductOf("X (STANDARD GAMEPAD Vendor: 054C Product: 0CE6)")).toEqual({
      vendor: "054c",
      product: "0ce6",
    });
    expect(vendorProductOf("54c-9cc-Wireless Controller")).toEqual({ vendor: "054c", product: "09cc" });
    expect(vendorProductOf("Xbox 360 Controller (XInput STANDARD GAMEPAD)")).toBeNull();
  });
});

describe("family setting and the Switch-layout swap", () => {
  const nintendo = detectPad("57e-2009-Pro Controller");
  const steam = detectPad("28de-11ff-Steam Virtual Gamepad");

  test("auto follows detection, else Xbox; a chosen family wins", () => {
    expect(resolvePadFamily("auto", nintendo)).toBe("nintendo");
    expect(resolvePadFamily("auto", null)).toBe("xbox");
    expect(resolvePadFamily("playstation", nintendo)).toBe("playstation");
  });

  test("the swap applies only to a Nintendo family, with the setting on, outside Steam", () => {
    expect(usesNintendoSwap("nintendo", true, nintendo)).toBe(true);
    expect(usesNintendoSwap("nintendo", false, nintendo)).toBe(false);
    expect(usesNintendoSwap("xbox", true, nintendo)).toBe(false);
    // Steam's own "Use Nintendo layout" already swapped the buttons: never twice.
    expect(usesNintendoSwap("nintendo", true, steam)).toBe(false);
  });

  test("the swap trades bottom with right and left with top, and nothing else", () => {
    expect([0, 1, 2, 3, 4, 12].map((index) => physicalIndexOf(index, true))).toEqual([1, 0, 3, 2, 4, 12]);
    expect(physicalIndexOf(0, false)).toBe(0);
  });
});

describe("padGlyphOf", () => {
  test("labels each family's face buttons by position", () => {
    expect([0, 1, 2, 3].map((index) => padGlyphOf("xbox", index)?.label)).toEqual(["A", "B", "X", "Y"]);
    expect([0, 1, 2, 3].map((index) => padGlyphOf("playstation", index)?.label)).toEqual(["✕", "○", "□", "△"]);
    expect([0, 1, 2, 3].map((index) => padGlyphOf("nintendo", index)?.label)).toEqual(["B", "A", "Y", "X"]);
  });

  test("names shoulders, triggers and the system buttons per family", () => {
    expect(padGlyphOf("xbox", 7)).toEqual({ label: "RT", shape: "trigger", name: "Right trigger" });
    expect(padGlyphOf("playstation", 9)?.label).toBe("Options");
    expect(padGlyphOf("nintendo", 6)?.label).toBe("ZL");
  });

  test("an index past the standard 17 is an extra button; the home button is never drawn", () => {
    expect(padGlyphOf("xbox", 17)).toEqual({ label: "E1", shape: "system", name: "Extra 1" });
    expect(padGlyphOf("xbox", 16)).toBeNull();
  });
});
