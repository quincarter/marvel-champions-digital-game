// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-hero-tile.js";
import type { McHeroTile } from "../McHeroTile.js";
import type { HeroTileModel, SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const tile = (over: Partial<HeroTileModel> = {}): HeroTileModel => ({
  key: "hero:01001a",
  cardId: "01001a",
  title: "Spider-Man",
  subtitle: "Core Set · Peter Parker",
  warning: null,
  stamps: [{ label: "JUSTICE", fill: "#ffd400", ink: "#111" }],
  tag: null,
  plate: null,
  selected: false,
  dim: false,
  picture: { src: "blob:spidey" },
  inspect: true,
  ...over,
});

async function mount(model: HeroTileModel, near = true): Promise<McHeroTile> {
  const element = document.createElement("mc-hero-tile") as McHeroTile;
  element.model = model;
  element.near = near;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const root = (element: McHeroTile): ShadowRoot => element.shadowRoot!;
const heard = (element: McHeroTile): SeatsEvent[] => {
  const seen: SeatsEvent[] = [];
  element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
  return seen;
};

describe("mc-hero-tile", () => {
  it("shows the title and the subtitle, with the model's key as the one stop", async () => {
    const element = await mount(tile());
    expect(root(element).querySelector(".title")!.textContent).toBe("Spider-Man");
    expect(root(element).querySelector(".line")!.textContent).toBe("Core Set · Peter Parker");
    const stops = [...root(element).querySelectorAll<HTMLElement>("[data-stop]")].map((part) => part.dataset.stop);
    expect(stops).toEqual(["hero:01001a"]);
  });

  it("puts a warning in place of the caption line, and the tag and plate on the picture", async () => {
    const element = await mount(tile({ warning: "Not enough cards", tag: "SEAT 2", plate: "Team-Up with Phoenix" }));
    const line = root(element).querySelector(".line")!;
    expect(line.textContent).toBe("Not enough cards");
    expect(line.classList.contains("caution")).toBe(true);
    expect(root(element).querySelector(".tag")!.textContent).toBe("SEAT 2");
    expect(root(element).querySelector(".plate")!.textContent).toBe("Team-Up with Phoenix");
  });

  it("writes each aspect as a word on its stamp, carrying its colours as properties", async () => {
    const element = await mount(tile());
    const stamp = root(element).querySelector<HTMLElement>(".stamp")!;
    expect(stamp.textContent).toBe("JUSTICE");
    expect(stamp.style.getPropertyValue("--stamp-fill")).toBe("#ffd400");
  });

  it("marks the chosen tile and the dimmed one in markup, not only in colour", async () => {
    const element = await mount(tile({ selected: true, dim: true, tag: "SEAT 1" }));
    const press = root(element).querySelector<HTMLElement>(".press")!;
    expect(press.hasAttribute("data-selected")).toBe(true);
    expect(press.hasAttribute("data-dim")).toBe(true);
    expect(press.getAttribute("aria-pressed")).toBe("true");
    expect(press.getAttribute("aria-label")).toBe("Spider-Man, Core Set · Peter Parker, SEAT 1");
  });

  it("names itself with the model's label when it has one", async () => {
    const element = await mount(tile({ label: "Spider-Man, 3 decks" }));
    expect(root(element).querySelector(".press")!.getAttribute("aria-label")).toContain("Spider-Man, 3 decks");
  });

  it("raises a press from a keyboard click and an inspect from inspect()", async () => {
    const element = await mount(tile());
    const seen = heard(element);
    root(element).querySelector<HTMLElement>(".press")!.click();
    element.inspect();
    expect(seen).toEqual([
      { type: "hero", key: "hero:01001a", via: "press" },
      { type: "hero", key: "hero:01001a", via: "inspect" },
    ]);
  });

  it("does not inspect a tile whose model says no", async () => {
    const element = await mount(tile({ inspect: false }));
    const seen = heard(element);
    element.inspect();
    expect(seen).toEqual([]);
  });

  it("loads the picture while near and lets the URL go when it is not", async () => {
    const element = await mount(tile(), true);
    const picture = (): { src: string | null } =>
      (root(element).querySelector("mc-picture-tile") as unknown as { picture: { src: string | null } }).picture;
    expect(picture().src).toBe("blob:spidey");
    element.near = false;
    await element.updateComplete;
    expect(picture().src).toBeNull();
    element.near = true;
    await element.updateComplete;
    expect(picture().src).toBe("blob:spidey");
  });

  it("draws the initial where there is no picture", async () => {
    const element = await mount(tile({ picture: null }));
    expect(root(element).querySelector(".initial")!.textContent).toBe("S");
  });

  it("raises the card hover events from the picture for its card id, and holds back the card inspect", async () => {
    const element = await mount(tile());
    const names: string[] = [];
    for (const name of ["mc-card-hover", "mc-card-hover-end", "mc-card-inspect"]) {
      element.addEventListener(name, () => names.push(name));
    }
    const art = element.artElement!;
    art.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    art.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    art.dispatchEvent(new CustomEvent("mc-card-inspect", { bubbles: true, composed: true, detail: { cardId: "x" } }));
    expect(names).toEqual(["mc-card-hover", "mc-card-hover-end"]);
  });
});
