import { describe, expect, test } from "vitest";
import { hit } from "../tokens.js";
import {
  BADGE_MAX,
  badgeExtent,
  boardLayout,
  cardRow,
  cardStatColumn,
  CARD_ASPECT,
  formFactorFor,
  PHONE_TABS,
  REFERENCE_VIEWPORTS,
  statBlockLayout,
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

  test("every slot is tagged full when fan is off, even a crowded row", () => {
    const slots = cardRow(bounds, 12);
    expect(slots.every((slot) => slot.kind === "full")).toBe(true);
  });

  test("fan does nothing when the row already fits", () => {
    const fanned = cardRow(bounds, 3, { fan: true });
    const plain = cardRow(bounds, 3);
    expect(fanned).toEqual(plain);
  });

  test("a fanned row that's too crowded keeps full-size cards for as many as fit, then collapses the rest to spines", () => {
    // 400px wide, ~90px-tall cards (63px wide at CARD_ASPECT) plus a 6px gap
    // fit 5 at full size; a 9-card hand should keep those 5 full and collapse
    // the other 4.
    const slots = cardRow(bounds, 9, { fan: true, gap: 6 });
    expect(slots).toHaveLength(9);
    const full = slots.filter((slot) => slot.kind === "full");
    const spines = slots.filter((slot) => slot.kind === "spine");
    expect(full.length).toBeGreaterThan(0);
    expect(spines.length).toBeGreaterThan(0);
    expect(full.length + spines.length).toBe(9);
    // Spines are narrower than full cards, but still card-ratio-tall.
    for (const spine of spines) {
      expect(spine.width).toBeLessThan(full[0]!.width);
      expect(spine.height).toBe(full[0]!.height);
    }
  });

  test("a fanned, overflowing row starts flush at the zone's edge and is allowed to run past its width", () => {
    const slots = cardRow(bounds, 9, { fan: true, gap: 6 });
    expect(slots[0]!.x).toBe(bounds.x);
    const last = slots.at(-1)!;
    // The row keeps growing rather than shrinking to fit — the scene scrolls
    // to it instead (PLAN.md Phase 4, "the phone hand crowds at six cards").
    expect(last.x + last.width).toBeGreaterThan(bounds.x + bounds.width);
  });

  test("fanned slots never overlap each other", () => {
    const slots = cardRow(bounds, 9, { fan: true, gap: 6 });
    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i]!.x).toBeGreaterThanOrEqual(slots[i - 1]!.x + slots[i - 1]!.width);
    }
  });

  test('"expanded" ("Fan out") keeps every card full-size, none collapsed, even past capacity', () => {
    const slots = cardRow(bounds, 9, { fan: "expanded", gap: 6 });
    expect(slots).toHaveLength(9);
    expect(slots.every((slot) => slot.kind === "full")).toBe(true);
    // Every card is the same size, so the row is strictly wider than the
    // collapsed fan's — more scrolling in exchange for nothing hidden.
    const expandedWidth = slots.at(-1)!.x + slots.at(-1)!.width;
    const collapsedWidth = cardRow(bounds, 9, { fan: true, gap: 6 }).reduce((max, s) => Math.max(max, s.x + s.width), 0);
    expect(expandedWidth).toBeGreaterThan(collapsedWidth);
  });

  test('"expanded" still lays out normally when the row already fits', () => {
    expect(cardRow(bounds, 3, { fan: "expanded" })).toEqual(cardRow(bounds, 3));
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

describe("stat badges", () => {
  test("a row of badges and the HP plate stay inside the panel and clear of each other", () => {
    const rect: Rect = { x: 10, y: 20, width: 120, height: 200 };
    const block = statBlockLayout(rect, 3, true);

    expect(block.badges).toHaveLength(3);
    for (const badge of block.badges) {
      expect(badge.cx - badge.size / 2).toBeGreaterThanOrEqual(rect.x);
      expect(badge.cx + badge.size / 2).toBeLessThanOrEqual(rect.x + rect.width);
    }
    for (let index = 1; index < block.badges.length; index++) {
      expect(block.badges[index]!.cx - block.badges[index - 1]!.cx).toBeGreaterThanOrEqual(block.badges[index]!.size);
    }
    const hp = block.hp!;
    const first = block.badges[0]!;
    expect(hp.y).toBeGreaterThanOrEqual(first.cy + badgeExtent(first.size).below);
    expect(hp.y + hp.height).toBeLessThanOrEqual(rect.y + rect.height);
    expect(block.height).toBeLessThanOrEqual(rect.height);
  });

  test("a wide panel caps the badges instead of blowing them up", () => {
    const block = statBlockLayout({ x: 0, y: 0, width: 600, height: 300 }, 2, true);
    for (const badge of block.badges) expect(badge.size).toBe(BADGE_MAX);
  });

  test("a stat block with no stats still places the HP plate", () => {
    const rect: Rect = { x: 0, y: 0, width: 100, height: 120 };
    const block = statBlockLayout(rect, 0, true);
    expect(block.badges).toHaveLength(0);
    expect(block.hp!.y + block.hp!.height).toBe(rect.y + rect.height);
  });

  test.each([140, 70])("a card-shaped column keeps every badge above the HP plate (card %ipx tall)", (height) => {
    const inner: Rect = { x: 0, y: 0, width: 100, height };
    const column = cardStatColumn(inner, 2, true);
    const hp = column.hp!;

    for (const badge of column.badges) {
      expect(badge.cy + badgeExtent(badge.size).below).toBeLessThanOrEqual(hp.y);
      expect(badge.cx - badge.size / 2).toBeGreaterThanOrEqual(inner.x);
    }
    const [top, next] = column.badges;
    const { above, below } = badgeExtent(top!.size);
    expect(next!.cy - top!.cy).toBeGreaterThanOrEqual(above + below);
  });
});
