import { describe, expect, test } from "vitest";
import { rectsOverlap, type Rect } from "./layout.js";
import {
  GUIDE_LEVEL_ROW_HEIGHT,
  settingsLayout,
  settingsLayoutRects,
  type SettingsSectionSpec,
} from "./settings-layout.js";

/** docs/phase4-screen-gaps.md §0/§5: phone, tablet portrait/landscape and desktop. */
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

/** Sections in the shape `scenes/settings.ts` builds them, with real detail strings, one of every row shape. */
const SECTIONS: readonly SettingsSectionSpec[] = [
  {
    id: "gameplay",
    title: "Gameplay",
    items: [
      {
        kind: "toggle",
        id: "confirm-end-turn",
        detail:
          "Ask before End turn whenever a basic attack, thwart or recover is still open, for you or an ally. Off ends the turn straight away.",
      },
    ],
  },
  {
    id: "villain",
    title: "Villain phase",
    items: [
      {
        kind: "tiles",
        id: "villain-auto",
        detail: "How the villain phase moves from one beat to the next.",
        count: 3,
      },
      { kind: "segmented", id: "villain-speed", detail: "How long each beat stays up.", controlWidth: 204 },
    ],
  },
  {
    id: "cards",
    title: "Cards",
    items: [
      {
        kind: "segmented",
        id: "card-size",
        detail: "How large cards are drawn on the table and in every sheet.",
        controlWidth: 520,
      },
      {
        kind: "toggle",
        id: "large-card-text",
        detail:
          "Reads a card's full rules text larger in the Inspect sheet — the screen whose whole job is reading a card closely.",
      },
    ],
  },
  { id: "empty", title: "Empty", items: [] },
  {
    id: "guide",
    title: "Guide",
    items: [
      { kind: "level", id: "guide-level" },
      {
        kind: "toggle",
        id: "play-tutorial",
        detail: "A short scripted first game against Rhino with Spider-Man — five lessons long.",
      },
      {
        kind: "toggle",
        id: "lethal",
        detail: "Catches ending your turn in hero form with no ready defender against a lethal-looking attack.",
      },
    ],
  },
  {
    id: "more",
    title: "More",
    items: [
      { kind: "toggle", id: "rules", detail: "Look up any keyword, rule or ruling, with the cards it applies to." },
    ],
  },
];

const contentRects = (layout: ReturnType<typeof settingsLayout>): Rect[] =>
  layout.content.sections.flatMap((s) => [...(s.heading ? [s.heading] : []), ...s.items.map((i) => i.row)]);

describe("settingsLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no heading or row overlaps another, in draw order, at ${name}`, () => {
      const rects = contentRects(settingsLayout({ x: 0, y: 0, width, height }, SECTIONS));
      for (let i = 1; i < rects.length; i++) {
        expect(rects[i]!.y, `rect ${i} starts below rect ${i - 1}`).toBeGreaterThanOrEqual(
          rects[i - 1]!.y + rects[i - 1]!.height,
        );
      }
    });

    test(`the header, the tab rail and the body viewport stack without overlapping inside the panel, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, SECTIONS);
      const [header, tabs, body] = settingsLayoutRects(layout);
      expect(rectsOverlap(header!, tabs!)).toBe(false);
      expect(rectsOverlap(tabs!, body!)).toBe(false);
      expect(tabs!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
      expect(body!.y).toBeGreaterThanOrEqual(tabs!.y + tabs!.height);
      expect(body!.y + body!.height).toBeLessThanOrEqual(layout.panel.y + layout.panel.height + 0.001);
    });

    test(`every segmented control and tile sits inside its own row, at ${name}`, () => {
      const layout = settingsLayout({ x: 0, y: 0, width, height }, SECTIONS);
      for (const item of layout.content.sections.flatMap((s) => s.items)) {
        for (const inner of [...(item.control ? [item.control] : []), ...item.tiles]) {
          expect(inner.x).toBeGreaterThanOrEqual(item.row.x);
          expect(inner.x + inner.width).toBeLessThanOrEqual(item.row.x + item.row.width);
          expect(inner.y).toBeGreaterThanOrEqual(item.row.y);
          expect(inner.y + inner.height).toBeLessThanOrEqual(item.row.y + item.row.height + 0.001);
        }
      }
    });
  }

  test("a section with no rows draws no heading", () => {
    const { content } = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, SECTIONS);
    expect(content.sections.map((s) => s.id)).toEqual(["gameplay", "villain", "cards", "guide", "more"]);
  });

  test("slots list every heading and row in draw order, and each carries its own index into them", () => {
    const { content } = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, SECTIONS);
    expect(content.slots).toEqual(contentRects(settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, SECTIONS)));
    for (const section of content.sections) {
      if (section.heading) expect(content.slots[section.headingSlot]).toBe(section.heading);
      for (const item of section.items) expect(content.slots[item.slot]).toBe(item.row);
    }
  });

  for (const { name, width, height } of SIZES) {
    test(`the scroll heights cover the whole content, padding included, so the last row scrolls fully into view, at ${name}`, () => {
      const { content } = settingsLayout({ x: 0, y: 0, width, height }, SECTIONS);
      expect(content.slotHeights).toHaveLength(content.slots.length);
      expect(content.slotHeights.reduce((a, b) => a + b, 0)).toBeCloseTo(content.totalHeight);
      const last = content.slots[content.slots.length - 1]!;
      expect(content.totalHeight - (last.y + last.height)).toBeGreaterThanOrEqual(24);
    });
  }

  test("an untitled section draws no heading and takes no slot for one", () => {
    const { content } = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, [
      { id: "cards", title: "", items: [{ kind: "toggle", id: "t", detail: "Detail." }] },
    ]);
    expect(content.sections[0]!.heading).toBeNull();
    expect(content.sections[0]!.headingSlot).toBe(-1);
    expect(content.slots).toEqual([content.sections[0]!.items[0]!.row]);
    expect(content.sections[0]!.items[0]!.slot).toBe(0);
  });

  test("a longer detail makes a taller toggle row, so nothing runs into the row below it", () => {
    const toggle = (detail: string): SettingsSectionSpec[] => [
      { id: "s", title: "S", items: [{ kind: "toggle", id: "t", detail }] },
    ];
    const short = settingsLayout({ x: 0, y: 0, width: 390, height: 844 }, toggle("Short."));
    const long = settingsLayout({ x: 0, y: 0, width: 390, height: 844 }, toggle("A much longer detail. ".repeat(10)));
    expect(long.content.sections[0]!.items[0]!.row.height).toBeGreaterThan(
      short.content.sections[0]!.items[0]!.row.height,
    );
  });

  test("the Guide level row keeps its fixed height", () => {
    const { content } = settingsLayout({ x: 0, y: 0, width: 390, height: 844 }, SECTIONS);
    const level = content.sections.find((s) => s.id === "guide")!.items[0]!;
    expect(level.row.height).toBe(GUIDE_LEVEL_ROW_HEIGHT);
  });

  test("tiles sit side by side on a desktop and stack at phone width", () => {
    const tilesAt = (width: number, height: number) =>
      settingsLayout({ x: 0, y: 0, width, height }, SECTIONS).content.sections[1]!.items[0]!.tiles;
    const desktop = tilesAt(1440, 900);
    expect(new Set(desktop.map((t) => t.y)).size).toBe(1);
    const phone = tilesAt(390, 844);
    expect(new Set(phone.map((t) => t.x)).size).toBe(1);
    expect(phone[1]!.y).toBeGreaterThanOrEqual(phone[0]!.y + phone[0]!.height);
  });

  test("a segmented control sits beside its text on a desktop and drops under it at phone width", () => {
    // Beat speed's narrow control fits beside its text on a desktop; Card size's wide one stacks on a phone.
    const desktop = settingsLayout({ x: 0, y: 0, width: 1440, height: 900 }, SECTIONS).content.sections[1]!.items[1]!;
    expect(desktop.stacked).toBe(false);
    expect(desktop.control!.x + desktop.control!.width).toBeGreaterThan(desktop.row.x + desktop.row.width - 10);
    const phone = settingsLayout({ x: 0, y: 0, width: 390, height: 844 }, SECTIONS).content.sections[2]!.items[0]!;
    expect(phone.stacked).toBe(true);
    expect(phone.control!.x).toBeLessThan(phone.row.x + 10);
    expect(phone.control!.width).toBeLessThanOrEqual(phone.row.width);
  });

  test("the body viewport shrinks shorter than its content once the panel runs out of room, at phone height", () => {
    const layout = settingsLayout({ x: 0, y: 0, width: 390, height: 600 }, SECTIONS);
    expect(layout.bodyViewport.height).toBeLessThan(layout.content.totalHeight);
  });

  test("the body viewport is exactly the content's own height when there's room to spare (no dead scroll space)", () => {
    const layout = settingsLayout({ x: 0, y: 0, width: 1440, height: 2000 }, SECTIONS);
    expect(layout.bodyViewport.height).toBe(layout.content.totalHeight);
  });
});
