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

  test("phone shows one tab's zones and none of the others", () => {
    for (const active of PHONE_TABS) {
      const layout = boardLayout(rectOf(REFERENCE_VIEWPORTS.phone), { playerCount: 3, activeTab: active });
      expect(layout.zones[active], active).not.toBeNull();
      // Every other tab is absent, not merely stacked underneath: five zones
      // sharing one rectangle is five zones drawn on top of each other.
      for (const other of PHONE_TABS) {
        if (other !== active) expect(layout.zones[other], `${active} hides ${other}`).toBeNull();
      }
    }
  });

  test("the Me tab carries the play area under the identity, without overlapping it", () => {
    const layout = boardLayout(rectOf(REFERENCE_VIEWPORTS.phone), { playerCount: 1, activeTab: "me" });
    const me = layout.zones.me!;
    const playArea = layout.zones.playArea!;
    expect(playArea.y).toBeGreaterThanOrEqual(me.y + me.height);
    expect(playArea.y + playArea.height).toBeLessThanOrEqual(layout.zones.hand!.y);
  });

  test("the Enemies tab carries the encounter piles above the enemies", () => {
    const layout = boardLayout(rectOf(REFERENCE_VIEWPORTS.phone), { playerCount: 1, activeTab: "enemies" });
    const piles = layout.zones.encounter!;
    const enemies = layout.zones.enemies!;
    expect(enemies.y).toBeGreaterThanOrEqual(piles.y + piles.height);
    // The piles ride with the Enemies tab, so they vanish with it.
    expect(boardLayout(rectOf(REFERENCE_VIEWPORTS.phone), { playerCount: 1, activeTab: "log" }).zones.encounter).toBeNull();
  });

  test("a solo game has no Team tab to show", () => {
    const layout = boardLayout(rectOf(REFERENCE_VIEWPORTS.phone), { playerCount: 1, activeTab: "team" });
    expect(layout.zones.team).toBeNull();
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

describe("tall screens share one board", () => {
  test("a tablet in portrait is tabbed, like a phone and unlike a long table", () => {
    // The two boards in the design set are shaped by orientation, not by
    // device: a 768×1024 tablet is far closer to the phone's tall, narrow
    // shape than to a long table, and the landscape layout gave it a game log
    // too narrow to read a line in.
    const portrait = boardLayout(rectOf(REFERENCE_VIEWPORTS.tabletPortrait), { playerCount: 1, activeTab: "log" });
    expect(portrait.formFactor).toBe("tabletPortrait");
    expect(portrait.tabbed).toBe(true);
    expect(portrait.zones.tabs).not.toBeNull();

    const landscape = boardLayout(rectOf(REFERENCE_VIEWPORTS.tabletLandscape), { playerCount: 1 });
    expect(landscape.tabbed).toBe(false);
    expect(landscape.zones.tabs).toBeNull();
  });

  test("the portrait tablet's log gets the full width, not an eleventh of it", () => {
    const portrait = boardLayout(rectOf(REFERENCE_VIEWPORTS.tabletPortrait), { playerCount: 1, activeTab: "log" });
    const log = portrait.zones.log!;
    expect(log.width).toBeGreaterThan(REFERENCE_VIEWPORTS.tabletPortrait.width * 0.8);
  });

  test("every tall layout parks a two-row action bar at the bottom edge", () => {
    for (const name of ["phone", "tabletPortrait"] as const) {
      const layout = boardLayout(rectOf(REFERENCE_VIEWPORTS[name]), { playerCount: 1 });
      const bar = layout.zones.actionBar!;
      expect(bar.height, name).toBe(hit.target + hit.primary);
      expect(bar.y + bar.height, name).toBe(REFERENCE_VIEWPORTS[name].height);
    }
  });
});
