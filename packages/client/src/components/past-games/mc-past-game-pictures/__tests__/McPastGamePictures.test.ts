// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-game-pictures.js";
import type { McPastGamePictures } from "../McPastGamePictures.js";

afterEach(() => document.body.replaceChildren());

const pictures: McPastGamePictures["pictures"] = [
  { cardId: "rhino", picture: { src: "v.png", missing: "Rhino" }, badges: [] },
  {
    cardId: "spider-man",
    picture: { src: null, missing: "Spider-Man" },
    badges: [{ id: "justice", full: "JUSTICE", code: "JUS", letter: "J" }],
  },
  { cardId: null, picture: { src: null, missing: "Custom" }, badges: [] },
];

async function mount(): Promise<McPastGamePictures> {
  const el = document.createElement("mc-past-game-pictures");
  el.pictures = pictures;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-game-pictures", () => {
  it("draws the villain first and a picture per hero, chips only on a hero that has aspects", async () => {
    const el = await mount();
    const pics = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".pic")];
    expect(pics.map((pic) => pic.dataset.role)).toEqual(["villain", "hero", "hero"]);
    expect(pics.map((pic) => pic.querySelector("mc-past-game-aspects") !== null)).toEqual([false, true, false]);
    expect(pics[1]!.querySelector<HTMLElement & { picture: unknown }>("mc-picture-tile")!.picture).toEqual(
      pictures[1]!.picture,
    );
  });

  it("makes a card picture of each picture that names a card, and not of one that does not", async () => {
    const el = await mount();
    const pics = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".pic")];
    expect(pics.map((pic) => pic.dataset.card ?? null)).toEqual(["rhino", "spider-man", null]);
    const entered = vi.fn();
    el.addEventListener("mc-card-hover", (event) => entered((event as CustomEvent).detail.cardId));
    const pointer = new Event("pointerenter") as Event & { pointerType: string };
    pointer.pointerType = "mouse";
    pics[0]!.dispatchEvent(pointer);
    pics[2]!.dispatchEvent(pointer);
    expect(entered).toHaveBeenCalledTimes(1);
    expect(entered).toHaveBeenCalledWith("rhino");
  });
});
