import { describe, expect, test } from "vitest";
import { hit } from "../tokens.js";
import {
  boardLayout,
  cardRow,
  CARD_ASPECT,
  formFactorFor,
  PHONE_TABS,
  REFERENCE_VIEWPORTS,
  type Rect,
  type ZoneName,
} from "./layout.js";

const rectOf = (size: { readonly width: number; readonly height: number }): Rect => ({ x: 0, y: 0, ...size });

const ZONE_NAMES: readonly ZoneName[] = [
  "chrome",
  "tabs",
  "threat",
  "enemies",
  "me",
  "playArea",
  "team",
  "encounter",
  "log",
  "hand",
  "actionBar",
];

describe("formFactorFor", () => {
  test("classifies the design canvases' reference viewports", () => {
    expect(formFactorFor(390, 844)).toBe("phone");
    expect(formFactorFor(768, 1024)).toBe("tabletPortrait");
    expect(formFactorFor(1024, 768)).toBe("tabletLandscape");
    expect(formFactorFor(1440, 900)).toBe("desktop");
  });
});

describe("boardLayout", () => {
  test.each(Object.entries(REFERENCE_VIEWPORTS))("%s: every zone stays inside the viewport", (_name, size) => {
    const viewport = rectOf(size);
    const layout = boardLayout(viewport, { playerCount: 4 });

    for (const name of ZONE_NAMES) {
      const zone = layout.zones[name];
      if (!zone) continue;
      expect(zone.width, name).toBeGreaterThan(0);
      expect(zone.height, name).toBeGreaterThan(0);
      expect(zone.x, name).toBeGreaterThanOrEqual(viewport.x);
      expect(zone.y, name).toBeGreaterThanOrEqual(viewport.y);
      expect(zone.x + zone.width, name).toBeLessThanOrEqual(viewport.x + viewport.width + 0.5);
      expect(zone.y + zone.height, name).toBeLessThanOrEqual(viewport.y + viewport.height + 0.5);
    }
  });

  test("a solo game has no team strip", () => {
    const solo = boardLayout(rectOf(REFERENCE_VIEWPORTS.desktop), { playerCount: 1 });
    const four = boardLayout(rectOf(REFERENCE_VIEWPORTS.desktop), { playerCount: 4 });

    expect(solo.zones.team).toBeNull();
    expect(four.zones.team).not.toBeNull();
    // The space the team strip would take goes back to the play area.
    expect(solo.zones.playArea!.width).toBeGreaterThan(four.zones.playArea!.width);
  });

  test("phone parks the action bar at the thumb, below the hand, and never scrolls it away", () => {
    const viewport = rectOf(REFERENCE_VIEWPORTS.phone);
    const layout = boardLayout(viewport, { playerCount: 2, activeTab: "enemies" });

    expect(layout.tabbed).toBe(true);
    expect(layout.activeTab).toBe("enemies");
    const bar = layout.zones.actionBar!;
    // Abilities row (44) above the commit row (52), flush to the bottom edge.
    expect(bar.height).toBe(hit.target + hit.primary);
    expect(bar.y + bar.height).toBe(viewport.height);
    expect(layout.zones.hand!.y + layout.zones.hand!.height).toBe(bar.y);
    expect(layout.zones.tabs!.height).toBe(hit.target);
  });

  test("phone gives every tabbed zone the same rectangle, since one shows at a time", () => {
    const layout = boardLayout(rectOf(REFERENCE_VIEWPORTS.phone), { playerCount: 3 });
    const content = layout.zones.threat!;

    for (const tab of PHONE_TABS) {
      expect(layout.zones[tab], tab).toEqual(content);
    }
  });

  test("the long table keeps the villain band above the player band, both above the hand", () => {
    const layout = boardLayout(rectOf(REFERENCE_VIEWPORTS.desktop), { playerCount: 2 });
    const { enemies, threat, me, playArea, hand, chrome } = layout.zones;

    expect(layout.tabbed).toBe(false);
    expect(layout.zones.tabs).toBeNull();
    // Villain band sits under the chrome bar and above the player band.
    expect(enemies!.y).toBeGreaterThanOrEqual(chrome!.y + chrome!.height);
    expect(threat!.y).toBe(enemies!.y);
    expect(me!.y).toBeGreaterThan(enemies!.y + enemies!.height - 1);
    expect(playArea!.y).toBe(me!.y);
    expect(me!.y + me!.height).toBeLessThanOrEqual(hand!.y);
    // Schemes left of the villain, per the Long Table canvas.
    expect(threat!.x).toBeLessThan(enemies!.x);
  });

  test("zones in a band do not overlap", () => {
    const layout = boardLayout(rectOf(REFERENCE_VIEWPORTS.tabletLandscape), { playerCount: 4 });
    const band = [layout.zones.threat!, layout.zones.enemies!, layout.zones.encounter!];

    for (let i = 1; i < band.length; i++) {
      expect(band[i]!.x).toBeGreaterThanOrEqual(band[i - 1]!.x + band[i - 1]!.width);
    }
  });
});

describe("cardRow", () => {
  const bounds: Rect = { x: 0, y: 0, width: 400, height: 140 };

  test("keeps the physical card ratio and centres a row that fits", () => {
    const slots = cardRow(bounds, 3);

    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(slot.width / slot.height).toBeCloseTo(CARD_ASPECT, 5);
      expect(slot.height).toBeLessThanOrEqual(bounds.height);
    }
    const rowWidth = slots.at(-1)!.x + slots.at(-1)!.width - slots[0]!.x;
    expect(slots[0]!.x).toBeCloseTo((bounds.width - rowWidth) / 2, 5);
  });

  test("a crowded row overlaps rather than leaving the zone", () => {
    const slots = cardRow(bounds, 12);

    expect(slots).toHaveLength(12);
    expect(slots[0]!.x).toBe(bounds.x);
    expect(slots.at(-1)!.x + slots.at(-1)!.width).toBeLessThanOrEqual(bounds.x + bounds.width + 0.5);
    // Still ratio-correct, just smaller.
    expect(slots[0]!.width / slots[0]!.height).toBeCloseTo(CARD_ASPECT, 5);
  });

  test("an empty zone produces no slots", () => {
    expect(cardRow(bounds, 0)).toEqual([]);
  });
});
