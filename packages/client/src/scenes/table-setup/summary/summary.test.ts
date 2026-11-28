import { afterEach, describe, expect, it, vi } from "vitest";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import { testFrame, nodesOf } from "../shared/test-frame.js";
import { footerLineOf } from "./footer-line.js";
import { drawCompactFooter, drawCompactSummary, drawSummary, type SummaryLayout } from "./summary.js";
import type { SummaryEvents, SummaryInput } from "./summary.types.js";

afterEach(() => vi.restoreAllMocks());

const glyphs = (b: { button: (o: never) => void }): SheetGlyphs =>
  ({ button: (builder: typeof b, entry: never) => builder.button(entry) }) as unknown as SheetGlyphs;
const input = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  rows: [{ label: "Villain", value: "Rhino" }],
  seedText: "123",
  watchable: false,
  room: false,
  scenario: { id: "rhino", villainCardId: "01094" } as never,
  villainName: "Rhino",
  showVillain: false,
  starting: false,
  dealBlocked: null,
  status: "",
  footerLine: "RHINO · STAGE I",
  ...over,
});
const events = (): SummaryEvents & { readonly log: string[] } => {
  const log: string[] = [];
  return {
    log,
    reroll: () => log.push("reroll"),
    toggleWatch: () => log.push("watch"),
    deal: () => log.push("deal"),
    focusSeed: () => log.push("seed"),
  };
};
const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const layout: SummaryLayout = {
  wide: true,
  header: rect(1100, 90, 260, 26),
  rows: rect(1100, 130, 260, 126),
  rule: rect(1100, 270, 260, 1),
  seed: rect(1100, 290, 160, 44),
  reroll: rect(1270, 290, 90, 44),
  seedHelper: rect(1100, 340, 260, 60),
  watch: rect(1100, 700, 260, 44),
  dealItOut: rect(1100, 760, 260, 56),
};

describe("the summary section", () => {
  it("draws the seed, Reroll, the watch toggle and Deal it out as presses with focus stops", () => {
    const { f, b, reg } = testFrame();
    const on = events();
    drawSummary(f, glyphs(b), input(), on, layout);
    expect([...reg.stops.keys()].sort()).toEqual(["deal-it-out", "reroll", "seed", "watch"]);
    for (const key of ["reroll", "watch", "deal-it-out", "seed"]) reg.actions.get(key)!();
    expect(on.log).toEqual(["reroll", "watch", "deal", "seed"]);
    expect(nodesOf(b.nodes, "textField")[0]).toMatchObject({ key: "seed", value: "123" });
  });

  it("leaves the watch choice out in a room, where the game is always watchable", () => {
    const { f, b, reg } = testFrame();
    drawSummary(f, glyphs(b), input({ room: true }), events(), layout);
    expect(reg.stops.has("watch")).toBe(false);
  });

  it("dims Deal it out while the picks are short or the game is being dealt, saying why", () => {
    const blocked = testFrame();
    drawSummary(blocked.f, glyphs(blocked.b), input({ dealBlocked: "Pick 1 more set" }), events(), layout);
    expect(nodesOf(blocked.b.nodes, "button").find((n) => n.key === "deal-it-out")?.disabled).toBe("Pick 1 more set");
    const dealing = testFrame();
    drawSummary(dealing.f, glyphs(dealing.b), input({ starting: true }), events(), layout);
    expect(nodesOf(dealing.b.nodes, "button").find((n) => n.key === "deal-it-out")?.disabled).toBe(true);
  });

  it("draws the phone's seed and watch rows in the page and its footer with the deal button", () => {
    const { f, b, reg } = testFrame();
    const on = events();
    expect(drawCompactSummary(f, input(), on, "seed", rect(16, 800, 340, 100))).toBe(true);
    expect(drawCompactSummary(f, input(), on, "watch", rect(16, 920, 340, 60))).toBe(true);
    expect(drawCompactSummary(f, input(), on, "encounterPanel", rect(0, 0, 1, 1))).toBe(false);
    drawCompactFooter(f, glyphs(b), input(), on, {
      footer: rect(0, 760, 390, 84),
      footerSummary: rect(16, 770, 358, 14),
      dealItOut: rect(16, 790, 358, 44),
    });
    expect(reg.stops.get("seed")!.view).toBeTypeOf("function");
    expect(reg.stops.get("deal-it-out")!.view).toBeUndefined();
  });
});

describe("footerLineOf", () => {
  const facts = { villainName: "Rhino", stage: "I", difficulty: "Standard", heroes: 1, modulars: 2, blocked: null };
  it("says the villain's stage, the difficulty, the heroes and the modular sets", () => {
    expect(footerLineOf(facts)).toBe("Rhino · Stage I · Standard · 1 hero · 2 modulars");
  });
  it("says why the game cannot be dealt instead, and omits the stage before there is a preview", () => {
    expect(footerLineOf({ ...facts, blocked: "Pick 1 more set" })).toBe("Pick 1 more set");
    expect(footerLineOf({ ...facts, stage: null })).toBe("Rhino · Standard");
  });
});
