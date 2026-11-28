// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seats-roster.js";
import type { McSeatsRoster } from "../McSeatsRoster.js";
import type { HeroShelfModel, HeroTileModel, SeatsEvent, SeatsRosterModel } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const tile = (id: string, prefix = "hero"): HeroTileModel => ({
  key: `${prefix}:${id}`,
  cardId: id,
  title: id,
  subtitle: "",
  warning: null,
  stamps: [],
  tag: null,
  plate: null,
  selected: false,
  dim: false,
  picture: null,
  inspect: true,
});

const shelf = (id: string, over: Partial<HeroShelfModel> = {}): HeroShelfModel => ({
  id,
  title: id,
  count: "2 identities ·",
  cover: null,
  open: true,
  seeAll: "See all ▸",
  tiles: [tile(`${id}-a`), tile(`${id}-b`)],
  ...over,
});

/** A shelf that never folds leaves `open` out. */
const neverFolds = ({ open: _open, ...rest }: HeroShelfModel): HeroShelfModel => rest;

const roster = (over: Partial<SeatsRosterModel> = {}): SeatsRosterModel => ({
  mode: "shelves",
  shelves: [shelf("recommended", { seeAll: "", tiles: [tile("rec-a", "hero-rec")] }), shelf("core"), shelf("wave2")],
  drillBack: null,
  emptyText: null,
  clearLabel: "Clear",
  previousLabel: "Earlier heroes",
  nextLabel: "More heroes",
  pagingHintShelf: null,
  ...over,
});

async function mount(model: SeatsRosterModel): Promise<McSeatsRoster> {
  const element = document.createElement("mc-seats-roster") as McSeatsRoster;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  // The parts render a turn later than the roster does.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return element;
}

const root = (element: McSeatsRoster): ShadowRoot => element.shadowRoot!;
const heard = (element: Element): SeatsEvent[] => {
  const seen: SeatsEvent[] = [];
  element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
  return seen;
};

/** Every focus stop under the element, in document order, through open shadow roots. */
function stopsOf(node: ParentNode): string[] {
  const found: string[] = [];
  for (const child of node.querySelectorAll<HTMLElement>("*")) {
    if (child.dataset.stop) found.push(child.dataset.stop);
    if (child.shadowRoot) found.push(...stopsOf(child.shadowRoot));
  }
  return found;
}

describe("mc-seats-roster", () => {
  it("draws the Recommended strip first and a shelf per pack after it", async () => {
    const element = await mount(roster());
    const parts = [...root(element).querySelectorAll("[data-shelf]")].map((part) => [
      part.localName,
      part.getAttribute("data-shelf"),
    ]);
    expect(parts).toEqual([
      ["mc-rec-strip", "recommended"],
      ["mc-hero-shelf", "core"],
      ["mc-hero-shelf", "wave2"],
    ]);
  });

  it("keeps the contract's stop keys: rec-toggle, hero-shelf:<pack>, hero-rec:<card> and hero:<card>", async () => {
    const element = await mount(roster());
    expect(stopsOf(root(element)).sort()).toEqual(
      [
        "rec-toggle",
        "hero-rec:rec-a",
        "hero-shelf:core",
        "hero:core-a",
        "hero:core-b",
        "hero-shelf:wave2",
        "hero:wave2-a",
        "hero:wave2-b",
      ].sort(),
    );
  });

  it("lets a tile's press and a shelf's See all out as mc-seats events", async () => {
    const element = await mount(roster());
    const seen = heard(element);
    const core = root(element).querySelector<HTMLElement>('[data-shelf="core"]')!;
    core.shadowRoot!.querySelector<HTMLElement>(".all")!.click();
    core
      .shadowRoot!.querySelector("mc-hero-row")!
      .shadowRoot!.querySelector("mc-hero-tile")!
      .shadowRoot!.querySelector<HTMLElement>(".press")!
      .click();
    root(element).querySelector("mc-rec-strip")!.shadowRoot!.querySelector<HTMLElement>(".tap")!.click();
    expect(seen).toEqual([
      { type: "shelf", id: "core", change: "all" },
      { type: "hero", key: "hero:core-a", via: "press" },
      { type: "action", action: "rec-toggle" },
    ]);
  });

  it("gives the scroller to every part so the pictures load near the view", async () => {
    const element = await mount(roster());
    const scroller = root(element).querySelector(".scroller");
    const parts = [...root(element).querySelectorAll<HTMLElement & { scrollRoot: Element | null }>("[data-shelf]")];
    expect(scroller).not.toBeNull();
    expect(parts.map((part) => part.scrollRoot)).toEqual([scroller, scroller, scroller]);
  });

  it("hands the pad's paging glyphs to the one shelf named, and none to the rest", async () => {
    const pagingGlyphs = { previous: null, next: null, height: 24, still: false };
    const element = await mount(roster({ pagingHintShelf: "core", pagingGlyphs }));
    const hints = [...root(element).querySelectorAll<HTMLElement & { hint: unknown }>("[data-shelf]")].map(
      (part) => part.hint,
    );
    expect(hints).toEqual([null, pagingGlyphs, null]);
  });

  it("wraps one pack's tiles in grid mode, under a back button that raises drill-back", async () => {
    const element = await mount(
      roster({ mode: "grid", shelves: [neverFolds(shelf("core", { seeAll: "" }))], drillBack: "◂ All packs" }),
    );
    const seen = heard(element);
    expect(root(element).querySelector("mc-hero-row")!.hasAttribute("wrap")).toBe(true);
    expect(stopsOf(root(element)).sort()).toEqual(["drill-back", "hero:core-a", "hero:core-b"]);
    root(element).querySelector<HTMLElement>(".back")!.click();
    expect(seen).toEqual([{ type: "action", action: "drill-back" }]);
  });

  it("says nothing matches with a Clear button, and no shelves", async () => {
    const element = await mount(roster({ emptyText: "No heroes match", shelves: [] }));
    const seen = heard(element);
    expect((root(element).querySelector("mc-empty-state") as unknown as { message: string }).message).toBe(
      "No heroes match",
    );
    expect(root(element).querySelector("[data-shelf]")).toBeNull();
    root(element).querySelector<HTMLElement>("[data-stop=hero-clear]")!.click();
    expect(seen).toEqual([{ type: "action", action: "hero-clear" }]);
  });

  it("has no Clear button when the model gives it no word", async () => {
    const element = await mount(roster({ emptyText: "No heroes match", shelves: [], clearLabel: "" }));
    expect(root(element).querySelector(".clear")).toBeNull();
  });

  it("remembers the scroll position and puts it back", async () => {
    const element = await mount(roster());
    const scroller = root(element).querySelector<HTMLElement>(".scroller")!;
    const row = root(element)
      .querySelector<HTMLElement>('[data-shelf="core"]')!
      .shadowRoot!.querySelector("mc-hero-row")!
      .shadowRoot!.querySelector<HTMLElement>(".row")!;
    scroller.scrollTop = 120;
    row.scrollLeft = 340;
    const saved = element.readScroll();
    expect(saved).toEqual({ top: 120, rows: { core: 340 } });
    scroller.scrollTop = 0;
    row.scrollLeft = 0;
    element.restoreScroll(saved);
    expect([scroller.scrollTop, row.scrollLeft]).toEqual([120, 340]);
  });

  it("pages a named shelf's row and reports nothing for an unknown one", async () => {
    const element = await mount(roster());
    expect(element.pageShelf("nope", 1)).toBeNull();
    expect(element.pageShelf("core", 1)).toBeNull();
  });
});
