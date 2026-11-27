import { afterEach, describe, expect, it } from "vitest";
import "./mc-shelf-roster.js";
import type { McPictureCardModel } from "../mc-picture-card/mc-picture-card.types.js";
import type { ShelfRosterCard, ShelfRosterModel, ShelfRosterShelf } from "./mc-shelf-roster.types.js";

afterEach(() => document.body.replaceChildren());

const cardModel = (title: string): McPictureCardModel => ({
  src: null,
  focusY: 0.2,
  dim: false,
  chip: "",
  chipTone: "action",
  title,
  detail: "Precon",
  detailTone: "meta",
  initial: title.slice(0, 1),
});

const card = (id: string): ShelfRosterCard => ({
  key: `hero:${id}`,
  cardId: `card-${id}`,
  model: cardModel(id),
  picture: { src: null, missing: "no picture" },
});

const shelf = (id: string, ids: readonly string[], over: Partial<ShelfRosterShelf> = {}): ShelfRosterShelf => ({
  id,
  key: `hero-shelf:${id}`,
  title: `Shelf ${id}`,
  count: `${ids.length} heroes`,
  cards: ids.map(card),
  ...over,
});

const model = (over: Partial<ShelfRosterModel> = {}): ShelfRosterModel => ({
  mode: "shelves",
  shelves: [shelf("core", ["a", "b"]), shelf("wave1", ["c"], { open: false, collapsed: true })],
  cardWidth: 200,
  cardHeight: 300,
  gap: 12,
  shelfGap: 18,
  headerHeight: 28,
  emptyText: null,
  previousLabel: "Earlier heroes",
  nextLabel: "Later heroes",
  ...over,
});

async function roster(m: ShelfRosterModel): Promise<HTMLElementTagNameMap["mc-shelf-roster"]> {
  const el = document.createElement("mc-shelf-roster");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-shelf-roster", () => {
  it("draws a header and a row of cards a shelf, and only the header of a folded one", async () => {
    const el = await roster(model());
    expect(el.elementOf("hero-shelf:core")).toBeTruthy();
    expect(el.elementOf("hero:a")).toBeTruthy();
    expect(el.elementOf("hero:b")).toBeTruthy();
    expect(el.elementOf("hero-shelf:wave1")).toBeTruthy();
    expect(el.elementOf("hero:c")).toBeNull();
    expect(el.rowOf("wave1")).toBeNull();
    // The fold mark is a shape: a header that says whether it is open.
    const folded = el.elementOf("hero-shelf:wave1")!.querySelector("mc-section-header")!;
    expect(folded.open).toBe(false);
  });

  it("names every card picture for a hover popover, with its identity card", async () => {
    const el = await roster(model({ shelves: [shelf("core", ["a", "b"], { cards: [card("a"), card("b")] })] }));
    await Promise.all([...el.renderRoot.querySelectorAll("mc-picture-card")].map((c) => c.updateComplete));
    expect(el.hoverFaces().map((face) => face.cardId)).toEqual(["card-a", "card-b"]);
  });

  it("raises mc-activate with a card's key, a header's and a link's, on a tap", async () => {
    const el = await roster(
      model({ shelves: [shelf("core", ["a"], { link: { label: "See all ▸", key: "see-all:core" } })] }),
    );
    const heard: string[] = [];
    el.addEventListener("mc-activate", (event) => heard.push((event as CustomEvent<{ key: string }>).detail.key));
    const tap = (element: HTMLElement): void => {
      const init = { pointerId: 1, button: 0, clientX: 5, clientY: 5, bubbles: true, composed: true };
      element.dispatchEvent(new PointerEvent("pointerdown", init));
      element.dispatchEvent(new PointerEvent("pointerup", init));
    };
    tap(el.elementOf("hero:a")!);
    tap(el.elementOf("hero-shelf:core")!);
    tap(el.elementOf("see-all:core")!);
    expect(heard).toEqual(["hero:a", "hero-shelf:core", "see-all:core"]);
  });

  it("does not raise mc-activate for a press that moved past the tap slop (a swipe's lift)", async () => {
    const el = await roster(model());
    const heard: string[] = [];
    el.addEventListener("mc-activate", (event) => heard.push((event as CustomEvent<{ key: string }>).detail.key));
    const target = el.elementOf("hero:a")!;
    target.dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 5, clientY: 5, bubbles: true }),
    );
    target.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, button: 0, clientX: 90, clientY: 5, bubbles: true }),
    );
    expect(heard).toEqual([]);
  });

  it("wraps the first shelf's cards with no header in grid mode", async () => {
    const el = await roster(model({ mode: "grid", shelves: [shelf("core", ["a", "b", "c"])] }));
    expect(el.renderRoot.querySelector(".grid")).toBeTruthy();
    expect(el.elementOf("hero:c")).toBeTruthy();
    expect(el.elementOf("hero-shelf:core")).toBeNull();
  });

  it("says why nothing is shown and offers its action", async () => {
    const el = await roster(
      model({ shelves: [], emptyText: "No hero matches.", emptyAction: { label: "Clear", key: "hero-clear" } }),
    );
    expect(el.renderRoot.querySelector("mc-empty-state")!.message).toBe("No hero matches.");
    const heard: string[] = [];
    el.addEventListener("mc-activate", (event) => heard.push((event as CustomEvent<{ key: string }>).detail.key));
    el.elementOf("hero-clear")!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true }));
    expect(heard).toEqual(["hero-clear"]);
  });

  it("keeps and restores where it is scrolled", async () => {
    const el = await roster(model());
    el.scrollState = { top: 0, lefts: { core: 0 } };
    expect(el.scrollState.top).toBe(0);
    expect(el.scrollState.lefts).toEqual({});
  });

  it("has a chevron for each end of a row, named for assistive tech", async () => {
    const el = await roster(model());
    expect(el.elementOf("chev:core:prev")?.getAttribute("aria-label")).toBe("Earlier heroes");
    expect(el.elementOf("chev:core:next")?.getAttribute("aria-label")).toBe("Later heroes");
  });
});
