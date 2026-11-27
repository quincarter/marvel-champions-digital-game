import { afterEach, describe, expect, it, vi } from "vitest";
import "./mc-shelf-roster.js";
import type { ShelfRosterItem, ShelfRosterModel, ShelfRosterShelf } from "./mc-shelf-roster.types.js";

afterEach(() => document.body.replaceChildren());

const item = (id: string, over: Partial<ShelfRosterItem> = {}): ShelfRosterItem => ({
  id,
  cardId: `card-${id}`,
  picture: { src: null, missing: "no picture" },
  card: {
    src: null,
    focusY: 0,
    dim: false,
    chip: "",
    chipTone: "action",
    title: `Villain ${id}`,
    detail: "STAGES I-III",
    detailTone: "meta",
    initial: "V",
  },
  selected: false,
  inspect: true,
  ...over,
});

const shelf = (id: string, over: Partial<ShelfRosterShelf> = {}): ShelfRosterShelf => ({
  id,
  title: `Pack ${id}`,
  count: "2 scenarios",
  cover: null,
  open: true,
  seeAll: "See all",
  items: [item(`${id}1`), item(`${id}2`)],
  ...over,
});

const model = (over: Partial<ShelfRosterModel> = {}): ShelfRosterModel => ({
  mode: "shelves",
  shelves: [shelf("core"), shelf("twc")],
  cardWidth: 280,
  cardHeight: 320,
  gap: 12,
  contentWidth: 600,
  previousLabel: "Scroll left",
  nextLabel: "Scroll right",
  emptyText: null,
  clearLabel: "",
  ...over,
});

async function mount(m: ShelfRosterModel): Promise<HTMLElementTagNameMap["mc-shelf-roster"]> {
  const el = document.createElement("mc-shelf-roster");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const press = (target: Element): void => {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1 };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  target.dispatchEvent(new PointerEvent("pointerup", at));
};

describe("mc-shelf-roster", () => {
  it("draws a header and a sideways row a shelf, a tile each, and names the pictures for a hover popover", async () => {
    const el = await mount(model());
    expect(el.shadowRoot!.querySelectorAll(".shelf")).toHaveLength(2);
    expect(el.rowOf("core")).toBeTruthy();
    expect(el.elementOf("entry:core1")?.tagName).toBe("MC-PICTURE-CARD");
    expect(el.hoverFaces().map((face) => face.cardId)).toEqual(["card-core1", "card-core2", "card-twc1", "card-twc2"]);
  });

  it("lays a folded shelf as its header alone, with the fold, See all and no row", async () => {
    const el = await mount(model({ shelves: [shelf("core", { open: false })] }));
    expect(el.rowOf("core")).toBeNull();
    expect(el.elementOf("fold:core")?.getAttribute("aria-expanded")).toBe("false");
    expect(el.elementOf("all:core")?.textContent?.trim()).toBe("See all");
  });

  it("lays a grid as the first shelf tiles with no header", async () => {
    const el = await mount(model({ mode: "grid" }));
    expect(el.shadowRoot!.querySelector(".head")).toBeNull();
    expect(el.elementOf("entry:core2")).toBeTruthy();
    expect(el.elementOf("entry:twc1")).toBeNull();
  });

  it("raises fold and all from the header, and a tile mc-activate", async () => {
    const el = await mount(model());
    const keys: string[] = [];
    el.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    press(el.elementOf("fold:core")!);
    press(el.elementOf("all:twc")!);
    const tile = el.elementOf("entry:core1")!;
    press(tile.shadowRoot!.querySelector(".tap")!);
    expect(keys).toEqual(["fold:core", "all:twc", "entry:core1"]);
  });

  it("marks the chosen tile and gives only an inspectable one an inspect key", async () => {
    const items = [item("a", { selected: true }), item("b", { inspect: false })];
    const el = await mount(model({ shelves: [shelf("core", { items })] }));
    expect(el.elementOf("entry:a")!.hasAttribute("selected")).toBe(true);
    expect(el.elementOf("entry:a")!.getAttribute("inspect-key")).toBe("entry:a");
    expect(el.elementOf("entry:b")!.getAttribute("inspect-key")).toBe("");
  });

  it("says its words with a Clear button in place of the shelves", async () => {
    const el = await mount(model({ shelves: [], emptyText: "No scenario matches.", clearLabel: "Clear" }));
    expect((el.shadowRoot!.querySelector("mc-empty-state") as { message: string }).message).toBe(
      "No scenario matches.",
    );
    expect(el.elementOf("clear")).toBeTruthy();
    expect(el.elementOf("fold:core")).toBeNull();
  });

  it("says a row cannot page when it has nothing more to show", async () => {
    const el = await mount(model());
    expect(el.canPageShelf("core", -1)).toBe(false);
    expect(el.pageShelf("core", 1)).toBeNull();
    expect(el.readScroll()).toEqual({ top: 0, rows: {} });
  });

  it("loads a tile picture only once the tile has been near the box, and keeps it", async () => {
    const observed: Element[] = [];
    let report: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
          report = callback;
        }
        observe(target: Element): void {
          observed.push(target);
        }
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    try {
      const withSource = (id: string) => item(id, { picture: { src: `/${id}.webp` } });
      const el = await mount(model({ shelves: [shelf("core", { items: [withSource("a"), withSource("b")] })] }));
      const srcOf = (id: string): string | null =>
        (el.elementOf(`entry:${id}`) as unknown as { picture: { src: string | null } }).picture.src;
      expect(observed).toHaveLength(2);
      expect(srcOf("a")).toBeNull();
      report([{ target: el.elementOf("entry:a")!, isIntersecting: true }]);
      await el.updateComplete;
      expect(srcOf("a")).toBe("/a.webp");
      expect(srcOf("b")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("mc-shelf-roster keys, dimming and row-paging glyphs", () => {
  it("reports a tile's own key where it has one (a hero on two shelves), and dims a tile that is not available", async () => {
    const el = await mount(
      model({
        shelves: [
          shelf("rec", { items: [item("a", { key: "hero-rec:a" })] }),
          shelf("core", { items: [item("a", { key: "hero:a", dim: true })] }),
        ],
      }),
    );
    expect(el.elementOf("hero-rec:a")).toBeTruthy();
    expect(el.elementOf("hero:a")?.hasAttribute("data-dim")).toBe(true);
    expect(el.elementOf("hero-rec:a")?.hasAttribute("data-dim")).toBe(false);
    const heard: string[] = [];
    el.addEventListener("mc-activate", (event) => heard.push((event as CustomEvent<{ key: string }>).detail.key));
    el.elementOf("hero:a")!
      .shadowRoot!.querySelector<HTMLElement>(".tap")!
      .dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1 }),
      );
    el.elementOf("hero:a")!
      .shadowRoot!.querySelector<HTMLElement>(".tap")!
      .dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1 }),
      );
    expect(heard).toEqual(["hero:a"]);
  });

  it("draws a trigger glyph beside the chevrons of only the shelf the hint names", async () => {
    const spec = { kind: "pad" as const, label: "LT", shape: "pill" };
    const el = await mount(model({ hint: { shelfId: "core", previous: [spec], next: null, height: 18, still: true } }));
    const hints = el.shadowRoot!.querySelectorAll(".hint");
    expect(hints).toHaveLength(1);
    expect(hints[0]!.closest(".shelf")!.querySelector("[data-row='core']")).toBeTruthy();
    expect(el.shadowRoot!.querySelector(".chevrons.hinted")).toBeTruthy();
  });
});
