// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-rec-strip.js";
import type { McRecStrip } from "../McRecStrip.js";
import type { HeroShelfModel, HeroTileModel, SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const tile = (id: string): HeroTileModel => ({
  key: `hero-rec:${id}`,
  cardId: id,
  title: id,
  subtitle: "Pairs with seat 1",
  warning: null,
  stamps: [],
  tag: null,
  plate: "Team-Up with Phoenix",
  selected: false,
  dim: false,
  picture: null,
  inspect: true,
});

const shelf = (over: Partial<HeroShelfModel> = {}): HeroShelfModel => ({
  id: "recommended",
  title: "Recommended for seat 2",
  count: "2 heroes · Hide",
  cover: null,
  open: true,
  seeAll: "",
  tiles: [tile("a"), tile("b")],
  ...over,
});

async function mount(model: HeroShelfModel): Promise<McRecStrip> {
  const element = document.createElement("mc-rec-strip") as McRecStrip;
  element.shelf = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-rec-strip", () => {
  it("shows the title, the count and the Show or Hide word, with rec-toggle as its one header stop", async () => {
    const element = await mount(shelf());
    const header = element.shadowRoot!.querySelector("mc-section-header") as unknown as {
      label: string;
      count: string;
    };
    expect(header.label).toBe("Recommended for seat 2");
    expect(header.count).toBe("2 heroes · Hide");
    const stops = [...element.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map(
      (part) => part.dataset.stop,
    );
    expect(stops).toEqual(["rec-toggle"]);
    expect(element.row!.shadowRoot!.querySelectorAll("mc-hero-tile")).toHaveLength(2);
  });

  it("raises the rec-toggle action, never a shelf event", async () => {
    const element = await mount(shelf());
    const seen: SeatsEvent[] = [];
    element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    element.shadowRoot!.querySelector<HTMLElement>(".tap")!.click();
    expect(seen).toEqual([{ type: "action", action: "rec-toggle" }]);
  });

  it("is its header alone while hidden, saying so in aria-expanded", async () => {
    const element = await mount(shelf({ open: false, tiles: [], count: "2 heroes · Show" }));
    expect(element.shadowRoot!.querySelector(".tap")!.getAttribute("aria-expanded")).toBe("false");
    expect(element.row!.shadowRoot!.querySelectorAll("mc-hero-tile")).toHaveLength(0);
  });
});
