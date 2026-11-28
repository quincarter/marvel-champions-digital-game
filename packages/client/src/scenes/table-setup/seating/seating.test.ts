import { afterEach, describe, expect, it, vi } from "vitest";
import { testFrame, nodesOf, tapKeys } from "../shared/test-frame.js";
import { drawCompactSeating, drawSeating, spotKey, type SeatingLayout } from "./seating.js";
import type { SeatCell, SeatingEvents, SeatingInput } from "./seating.types.js";

afterEach(() => vi.restoreAllMocks());

const seat = (index: number, selected: boolean): SeatCell => ({
  index,
  name: `Hero ${index}`,
  meta: selected ? "First player" : `Seat ${index + 1}`,
  chipLabel: index === 0 ? "YOU" : `S${index + 1}`,
  selected,
  identityCardId: undefined,
});
const input = (over: Partial<SeatingInput> = {}): SeatingInput => ({
  seats: [seat(0, true), seat(1, false), seat(2, false)],
  room: false,
  ...over,
});
const events = (): SeatingEvents & { readonly log: string[] } => {
  const log: string[] = [];
  return { log, pick: (i) => log.push(`pick:${i}`), roll: () => log.push("roll") };
};
const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const layout: SeatingLayout = {
  wide: true,
  header: rect(24, 300, 600, 26),
  random: rect(530, 300, 90, 26),
  row: rect(24, 336, 600, 60),
};

describe("the Seating section", () => {
  it("draws a seat per hero, each a press that picks it, with a keyed spot for the token", () => {
    const { f, b, reg } = testFrame();
    const on = events();
    drawSeating(f, input(), on, layout, 0);
    expect(tapKeys(b.nodes)).toEqual(["first-player:0", "first-player:1", "first-player:2"]);
    reg.actions.get("first-player:2")!();
    expect(on.log).toEqual(["pick:2"]);
    const spots = nodesOf(b.nodes, "box").flatMap((n) => (n.key ? [n.key] : []));
    expect(spots).toEqual([spotKey(0), spotKey(1), spotKey(2)]);
  });

  it("keeps Random on the header line on wide and as a dashed cell in the row on a tablet in portrait", () => {
    const wide = testFrame();
    drawSeating(wide.f, input(), events(), layout, 0);
    expect(wide.b.nodes.some((n) => n.kind === "button" && n.key === "first-player:random")).toBe(true);
    const tablet = testFrame();
    drawSeating(tablet.f, input(), events(), { ...layout, wide: false }, 0);
    expect(tapKeys(tablet.b.nodes)).toContain("first-player:random");
    expect(nodesOf(tablet.b.nodes, "box").some((n) => n.dashed)).toBe(true);
  });

  it("rolls the first player from Random", () => {
    const { f, reg } = testFrame();
    const on = events();
    drawSeating(f, input(), on, layout, 0);
    reg.actions.get("first-player:random")!();
    expect(on.log).toEqual(["roll"]);
  });

  it("shows only a note in a room, where the players bring their own heroes", () => {
    const { f, reg } = testFrame();
    drawSeating(f, input({ room: true }), events(), layout, 0);
    expect(reg.actions.size).toBe(0);
  });

  it("draws the phone's chips in the scrolling page, with the token's spot on each", () => {
    const { f, b, reg } = testFrame();
    const on = events();
    expect(drawCompactSeating(f, input(), on, "firstPlayer", rect(16, 600, 340, 58))).toBe(true);
    expect([...reg.stops.keys()]).toEqual([
      "first-player:0",
      "first-player:1",
      "first-player:2",
      "first-player:random",
    ]);
    expect(nodesOf(b.nodes, "box").filter((n) => n.key?.startsWith("seat-spot:"))).toHaveLength(3);
    expect(drawCompactSeating(f, input(), on, "difficulty", rect(0, 0, 1, 1))).toBe(false);
  });
});
