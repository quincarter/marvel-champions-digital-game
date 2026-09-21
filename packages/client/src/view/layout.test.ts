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
  panelShape,
  PANEL_TEXT_MIN_WIDTH,
  PHONE_TABS,
  REFERENCE_VIEWPORTS,
  statBlockLayout,
  villainRowSlots,
  widePanelWidthFor,
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

  /**
   * A maximized 16″ MacBook window, a 1920×1080 display, a portrait-ish
   * desktop window: each makes the player band taller than the design's
   * 1440×900 canvas without making it wider. Reported from the desktop app as
   * the hero card "getting clipped" again — the identity's fixed 24% column
   * turned taller than wide, read as a card-shaped slot, and lost its
   * attachment chips and the readable scan.
   */
  const TALL_WINDOWS = [
    ["macbook 16 maximized", { width: 1728, height: 1117 }],
    ["1080p display", { width: 1920, height: 1080 }],
    ["tall desktop window", { width: 1440, height: 1200 }],
    ["tall tablet landscape", { width: 1100, height: 900 }],
  ] as const;

  test.each(TALL_WINDOWS)("%s: the identity column is wide enough to show its card whole beside a text column", (_name, size) => {
    const layout = boardLayout(rectOf(size), { playerCount: 1 });
    const me = layout.zones.me!;
    expect(me.width).toBeGreaterThanOrEqual(widePanelWidthFor(me.height));
    expect(panelShape(me)).toBe("wide");
  });

  test.each(TALL_WINDOWS)("%s: the identity column never takes more than 30% of the table from the play area", (_name, size) => {
    for (const playerCount of [1, 4]) {
      const layout = boardLayout(rectOf(size), { playerCount });
      const { me, playArea, team } = layout.zones;
      // The band runs from the identity's left edge to the right edge of its last column.
      const usable = (team ? team.x + team.width : playArea!.x + playArea!.width) - me!.x;
      expect(me!.width).toBeLessThanOrEqual(usable * 0.3 + 0.5);
      expect(playArea!.width).toBeGreaterThan(me!.width);
    }
  });

  test("the identity column keeps the 1440×900 canvas's width where the card already fits", () => {
    const me = boardLayout(rectOf(REFERENCE_VIEWPORTS.desktop), { playerCount: 1 }).zones.me!;
    // The canvas gives it 300px; the card needs 302 here, so it barely moves.
    expect(me.width).toBeGreaterThanOrEqual(300);
    expect(me.width).toBeLessThanOrEqual(304);
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

  /**
   * The villain panel's bug (`docs`/task brief: "VILLAIN · STAGE II is overdrawn
   * by the ATK/SCH badges"): a caller lays this out against whatever's left
   * under the name/subtitle it already drew, which can be far shorter than the
   * ~97px a `BADGE_MAX` row plus the HP plate wants. Without a shrink, the block
   * bottom-pins itself using that oversized height and its `top` lands above
   * `rect.y` — over whatever the caller drew there.
   */
  test("a wide panel too short for BADGE_MAX shrinks its badges rather than starting above its own rect", () => {
    const rect: Rect = { x: 0, y: 40, width: 171, height: 75 };
    const block = statBlockLayout(rect, 2, true);
    expect(block.badges.every((badge) => badge.size < BADGE_MAX)).toBe(true);
    expect(block.top).toBeGreaterThanOrEqual(rect.y);
    expect(block.height).toBeLessThanOrEqual(rect.height);
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

describe("villainRowSlots", () => {
  test("one villain gets the whole rect", () => {
    const rect: Rect = { x: 5, y: 5, width: 280, height: 128 };
    expect(villainRowSlots(rect, 1)).toEqual([rect]);
  });

  test("four villains at a desktop-ish width (800×600) fit on one row", () => {
    // Roughly `enemies` at 800×600 (tabletLandscape): comfortably wider than four panels at the compact floor.
    const rect: Rect = { x: 0, y: 0, width: 434, height: 128 };
    const slots = villainRowSlots(rect, 4);
    expect(slots).toHaveLength(4);
    expect(new Set(slots.map((s) => s.y)).size).toBe(1);
    for (const slot of slots) {
      expect(slot.width).toBeGreaterThan(0);
      expect(slot.x + slot.width).toBeLessThanOrEqual(rect.x + rect.width + 0.001);
    }
  });

  test("four villains too narrow for one row (a phone's 359px content width) wrap into more than one row", () => {
    const rect: Rect = { x: 0, y: 0, width: 200, height: 240 };
    const slots = villainRowSlots(rect, 4);
    expect(slots).toHaveLength(4);
    const rowYs = new Set(slots.map((s) => s.y));
    expect(rowYs.size).toBeGreaterThan(1);
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThanOrEqual(rect.x);
      expect(slot.x + slot.width).toBeLessThanOrEqual(rect.x + rect.width + 0.001);
      expect(slot.y + slot.height).toBeLessThanOrEqual(rect.y + rect.height + 0.001);
    }
  });

  test("no villains draws nothing", () => {
    expect(villainRowSlots({ x: 0, y: 0, width: 100, height: 100 }, 0)).toEqual([]);
  });

  test("slots never overlap within a row", () => {
    const rect: Rect = { x: 0, y: 0, width: 300, height: 200 };
    const slots = villainRowSlots(rect, 3);
    const sorted = [...slots].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.x).toBeGreaterThanOrEqual(sorted[i - 1]!.x + sorted[i - 1]!.width - 0.001);
    }
  });
});

describe("widePanelWidthFor", () => {
  test("is the card at the panel's height plus the text column and its insets", () => {
    const height = 249;
    const cardWidth = Math.round((height - 6) * CARD_ASPECT);
    expect(widePanelWidthFor(height)).toBe(cardWidth + PANEL_TEXT_MIN_WIDTH + 22);
  });
});

describe("panelShape", () => {
  test("a card-row slot reads as the card", () => {
    const [slot] = cardRow({ x: 0, y: 0, width: 600, height: 200 }, 3);
    expect(panelShape(slot!)).toBe("card");
  });

  test("a panel with a text column's worth of room beside the card is wide", () => {
    expect(panelShape({ x: 0, y: 0, width: 300, height: 249 })).toBe("wide");
  });

  test("a slot taller than it is wide reads as the card unless the caller asks for the wide panel", () => {
    const tallIdentitySlot: Rect = { x: 0, y: 0, width: 300, height: 351 };
    expect(panelShape(tallIdentitySlot)).toBe("card");
    expect(panelShape(tallIdentitySlot, "wide")).toBe("wide");
  });
});

describe("a phone on its side", () => {
  // A Pixel 11 Pro XL and an iPhone held sideways, in CSS pixels.
  const sideways = [
    { width: 915, height: 412 },
    { width: 844, height: 390 },
  ];

  test.each(sideways)("$width×$height is a phone in landscape, not a tablet", ({ width, height }) => {
    expect(formFactorFor(width, height)).toBe("phoneLandscape");
  });

  test("a real tablet in landscape is still a tablet", () => {
    expect(formFactorFor(1024, 768)).toBe("tabletLandscape");
    expect(formFactorFor(1180, 820)).toBe("tabletLandscape");
  });

  test.each(sideways)("$width×$height: the tabbed board, every zone inside the viewport and none overlapping", ({ width, height }) => {
    for (const activeTab of ["threat", "enemies", "me", "team", "log"] as const) {
      const layout = boardLayout({ x: 0, y: 0, width, height }, { playerCount: 2, activeTab });
      expect(layout.tabbed).toBe(true);
      const rects = Object.values(layout.zones).filter((rect): rect is NonNullable<typeof rect> => rect !== null);
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
      }
      rects.forEach((a, i) =>
        rects.slice(i + 1).forEach((b) => {
          const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
          expect(apart).toBe(true);
        }),
      );
    }
  });

  test("the tab rail is a column, and the content keeps a playable height", () => {
    const layout = boardLayout({ x: 0, y: 0, width: 915, height: 412 }, { playerCount: 1, activeTab: "me" });
    const { tabs, me, playArea, hand, actionBar } = layout.zones;
    expect(tabs!.height).toBeGreaterThan(tabs!.width);
    expect(me!.height).toBeGreaterThanOrEqual(150);
    expect(playArea!.y).toBe(me!.y);
    expect(hand!.height).toBeGreaterThanOrEqual(96);
    expect(actionBar!.height).toBe(hit.primary);
  });
});
