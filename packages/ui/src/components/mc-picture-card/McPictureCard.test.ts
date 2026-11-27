import { afterEach, describe, expect, it } from "vitest";
import "./mc-picture-card.js";
import type { McPictureCardModel } from "./mc-picture-card.types.js";

afterEach(() => document.body.replaceChildren());

const model: McPictureCardModel = {
  src: "/a.png",
  focusY: 0.2,
  dim: true,
  chip: "LOCKED",
  chipTone: "locked",
  title: "Spider-Man",
  detail: "Win 3 games",
  detailTone: "alert",
  initial: "S",
};

async function mount(m: McPictureCardModel) {
  const card = document.createElement("mc-picture-card");
  card.model = m;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe("mc-picture-card", () => {
  it("composes a lazy, dimmed picture tile, the chip, and the caption with the alert detail", async () => {
    const card = await mount(model);
    const tile = card.shadowRoot!.querySelector("mc-picture-tile")!;
    await tile.updateComplete;
    const img = tile.shadowRoot!.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.classList.contains("dim")).toBe(true);
    expect(img.style.objectPosition).toBe("50% 20%");
    expect(card.shadowRoot!.querySelector(".chip.locked")!.textContent).toBe("LOCKED");
    expect(card.shadowRoot!.querySelector(".title")!.textContent).toBe("Spider-Man");
    expect(card.shadowRoot!.querySelector(".detail.alert")!.textContent).toBe("Win 3 games");
    expect(card.shadowRoot!.querySelector(".initial")).toBeNull();
  });

  it("stands the faint initial in for a missing picture", async () => {
    const card = await mount({ ...model, src: null, dim: false, chipTone: "action", detailTone: "meta" });
    expect(card.shadowRoot!.querySelector("mc-picture-tile")).toBeNull();
    expect(card.shadowRoot!.querySelector(".initial")!.textContent).toBe("S");
    expect(card.shadowRoot!.querySelector(".chip.locked")).toBeNull();
    expect(card.shadowRoot!.querySelector(".detail.alert")).toBeNull();
  });

  it("stands the initial in when its picture fails to load, and lets the error through to the screen", async () => {
    const card = await mount(model);
    const errors: unknown[] = [];
    card.addEventListener("mc-image-error", (event) => errors.push((event as CustomEvent).detail));
    const tile = card.shadowRoot!.querySelector("mc-picture-tile")!;
    await tile.updateComplete;
    tile.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    await card.updateComplete;
    expect(errors).toEqual([{ src: "/a.png" }]);
    expect(card.shadowRoot!.querySelector(".initial")!.textContent).toBe("S");
  });

  it("sizes the caption strip", async () => {
    const card = await mount({ ...model, captionHeight: 60 });
    expect(card.shadowRoot!.querySelector(".caption")!.getAttribute("style")).toContain("height:60px");
    expect(card.shadowRoot!.querySelector(".art")!.getAttribute("style")).toContain("bottom:60px");
  });
});
