// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-hero-shelf.js";
import type { McHeroShelf } from "../McHeroShelf.js";
import type { HeroShelfModel, HeroTileModel, SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

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
  picture: null,
  inspect: true,
});

const shelf = (over: Partial<HeroShelfModel> = {}): HeroShelfModel => ({
  id: "core",
  title: "Core Set",
  count: "6 identities ·",
  cover: null,
  open: true,
  seeAll: "See all ▸",
  tiles: [tile("a"), tile("b")],
  ...over,
});

/** A shelf that never folds leaves `open` out. */
const neverFolds = ({ open: _open, ...rest }: HeroShelfModel): HeroShelfModel => rest;

async function mount(model: HeroShelfModel): Promise<McHeroShelf> {
  const element = document.createElement("mc-hero-shelf") as McHeroShelf;
  element.shelf = model;
  element.previousLabel = "Earlier heroes";
  element.nextLabel = "More heroes";
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const heard = (element: Element): SeatsEvent[] => {
  const seen: SeatsEvent[] = [];
  element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
  return seen;
};
const root = (element: McHeroShelf): ShadowRoot => element.shadowRoot!;

describe("mc-hero-shelf", () => {
  it("shows the title and count in the header, one header stop and its tiles in the row", async () => {
    const element = await mount(shelf());
    const header = root(element).querySelector("mc-section-header") as unknown as {
      label: string;
      count: string;
      open: boolean;
    };
    expect(header.label).toBe("Core Set");
    expect(header.count).toBe("6 identities ·");
    expect(header.open).toBe(true);
    expect(root(element).querySelector<HTMLElement>(".tap")!.dataset.stop).toBe("hero-shelf:core");
    expect(element.row!.shadowRoot!.querySelectorAll("mc-hero-tile")).toHaveLength(2);
  });

  it("raises fold from the header and all from See all", async () => {
    const element = await mount(shelf());
    const seen = heard(element);
    root(element).querySelector<HTMLElement>(".tap")!.click();
    root(element).querySelector<HTMLElement>(".all")!.click();
    expect(seen).toEqual([
      { type: "shelf", id: "core", change: "fold" },
      { type: "shelf", id: "core", change: "all" },
    ]);
  });

  it("opens the pack from the header of a shelf that never folds", async () => {
    const element = await mount(neverFolds(shelf()));
    const seen = heard(element);
    root(element).querySelector<HTMLElement>(".tap")!.click();
    expect(seen).toEqual([{ type: "shelf", id: "core", change: "all" }]);
    expect(root(element).querySelector(".tap")!.hasAttribute("aria-expanded")).toBe(false);
  });

  it("says folded in markup and shows no tiles or buttons while folded", async () => {
    const element = await mount(shelf({ open: false }));
    expect(root(element).querySelector(".tap")!.getAttribute("aria-expanded")).toBe("false");
    expect(element.row!.shadowRoot!.querySelectorAll("mc-hero-tile")).toHaveLength(0);
    expect(element.row!.shadowRoot!.querySelector(".chev")).toBeNull();
  });

  it("leaves out See all when the model has none", async () => {
    const element = await mount(shelf({ seeAll: "" }));
    expect(root(element).querySelector(".all")).toBeNull();
  });

  it("lets a tile's press bubble out as the one mc-seats event", async () => {
    const element = await mount(shelf());
    const seen = heard(element);
    element.row!.shadowRoot!.querySelector("mc-hero-tile")!.shadowRoot!.querySelector<HTMLElement>(".press")!.click();
    expect(seen).toEqual([{ type: "hero", key: "hero:a", via: "press" }]);
  });
});
