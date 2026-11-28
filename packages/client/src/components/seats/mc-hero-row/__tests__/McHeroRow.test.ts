// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../mc-hero-row.js";
import type { McHeroRow } from "../McHeroRow.js";
import type { McHeroTile } from "../../mc-hero-tile/McHeroTile.js";
import type { HeroTileModel } from "../../seats.types.js";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const tile = (id: string): HeroTileModel => ({
  key: `hero:${id}`,
  cardId: id,
  title: id,
  subtitle: "",
  warning: null,
  stamps: [],
  tag: null,
  plate: null,
  selected: false,
  dim: false,
  picture: { src: `blob:${id}` },
  inspect: true,
});

/** An observer that reports nothing until a test says which targets are in view. */
class FakeObserver {
  static all: FakeObserver[] = [];
  readonly targets = new Set<Element>();
  constructor(
    readonly callback: (entries: Partial<IntersectionObserverEntry>[]) => void,
    readonly options: IntersectionObserverInit,
  ) {
    FakeObserver.all.push(this);
  }
  observe(target: Element): void {
    this.targets.add(target);
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
  }
  report(isIntersecting: (target: Element) => boolean): void {
    this.callback([...this.targets].map((target) => ({ target, isIntersecting: isIntersecting(target) })));
  }
}

async function mount(props: Partial<McHeroRow> = {}): Promise<McHeroRow> {
  const row = document.createElement("mc-hero-row") as McHeroRow;
  Object.assign(row, { tiles: [tile("a"), tile("b"), tile("c")], previousLabel: "Earlier", nextLabel: "More" }, props);
  const head = document.createElement("span");
  head.slot = "head";
  head.textContent = "Core Set";
  row.append(head);
  document.body.append(row);
  await row.updateComplete;
  return row;
}

const tiles = (row: McHeroRow): McHeroTile[] => [...row.shadowRoot!.querySelectorAll<McHeroTile>("mc-hero-tile")];

describe("mc-hero-row", () => {
  it("draws a tile per model in order, with the slotted head, and ‹ › buttons named with the shelf", async () => {
    const row = await mount({ shelfLabel: "Core Set" });
    expect(tiles(row).map((element) => element.model!.key)).toEqual(["hero:a", "hero:b", "hero:c"]);
    expect(row.querySelector("[slot=head]")!.textContent).toBe("Core Set");
    const labels = [...row.shadowRoot!.querySelectorAll(".chev")].map((button) => button.getAttribute("aria-label"));
    expect(labels).toEqual(["Earlier: Core Set", "More: Core Set"]);
  });

  it("is only its strip while folded, with no buttons on the tiles it hides", async () => {
    const row = await mount({ open: false });
    expect(tiles(row)).toEqual([]);
    expect(row.shadowRoot!.querySelector(".chevrons")).toBeNull();
  });

  it("wraps with no buttons in a grid", async () => {
    const row = await mount({ wrap: true });
    expect(row.shadowRoot!.querySelector(".chevrons")).toBeNull();
    expect(tiles(row)).toHaveLength(3);
    expect(row.canPage(1)).toBe(false);
  });

  it("pages the row by a share of its width from the buttons and says which tile is first", async () => {
    const row = await mount();
    const scroller = row.rowElement!;
    Object.defineProperty(scroller, "clientWidth", { value: 400 });
    Object.defineProperty(scroller, "scrollWidth", { value: 1000 });
    scroller.getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
    tiles(row).forEach((element, index) => {
      element.getBoundingClientRect = () => ({ right: 200 * (index + 1) - scroller.scrollLeft }) as DOMRect;
    });
    expect(row.canPage(-1)).toBe(false);
    expect(row.canPage(1)).toBe(true);
    row.shadowRoot!.querySelector<HTMLElement>('[data-action="next"]')!.click();
    expect(scroller.scrollLeft).toBe(340);
    expect(row.page(-1)).toBe("hero:a");
    expect(scroller.scrollLeft).toBe(0);
    expect(row.page(-1)).toBeNull();
  });

  it("draws the pad's paging glyphs beside the buttons while hinted", async () => {
    const row = await mount({ hint: { previous: [{ label: "LT" } as never], next: null, height: 24, still: false } });
    expect(row.shadowRoot!.querySelector(".chevrons")!.classList.contains("hinted")).toBe(true);
    expect(row.shadowRoot!.querySelectorAll("mc-glyph")).toHaveLength(1);
  });

  it("loads only the tiles near the row's view and lets the ones that scroll off go", async () => {
    FakeObserver.all = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const row = await mount();
    expect(tiles(row).map((element) => element.near)).toEqual([false, false, false]);
    const [self, tileWatcher] = [
      FakeObserver.all.find((o) => o.targets.has(row))!,
      FakeObserver.all.find((o) => o !== FakeObserver.all.find((s) => s.targets.has(row)))!,
    ];
    self.report(() => true);
    tileWatcher.report((target) => (target as HTMLElement).dataset.key !== "hero:c");
    await row.updateComplete;
    expect(tiles(row).map((element) => element.near)).toEqual([true, true, false]);
    tileWatcher.report((target) => (target as HTMLElement).dataset.key === "hero:c");
    await row.updateComplete;
    expect(tiles(row).map((element) => element.near)).toEqual([false, false, true]);
  });

  it("holds every picture while the row itself is far down the page", async () => {
    FakeObserver.all = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const row = await mount();
    const self = FakeObserver.all.find((o) => o.targets.has(row))!;
    const tileWatcher = FakeObserver.all.find((o) => o !== self)!;
    tileWatcher.report(() => true);
    self.report(() => false);
    await row.updateComplete;
    expect(tiles(row).map((element) => element.near)).toEqual([false, false, false]);
  });
});
