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

  it("draws no chip for an empty one, a display title, a two-line detail and the chosen frame", async () => {
    const card = await mount({ ...model, chip: "", title: "Rhino", titleDisplay: true, detailLines: 2 });
    card.selected = true;
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector(".chip")).toBeNull();
    expect(card.shadowRoot!.querySelector(".title.display")!.textContent).toBe("Rhino");
    expect(card.shadowRoot!.querySelector(".detail.two")).not.toBeNull();
    expect(card.style.getPropertyValue("--mc-card-border")).toBe("4px");
    expect(card.style.getPropertyValue("--mc-card-frame")).toBe("var(--mc-line-red)");
  });

  it("raises mc-inspect on a right-click when it has an inspect key", async () => {
    const card = await mount(model);
    card.activateKey = "entry:rhino";
    card.inspectKey = "entry:rhino";
    await card.updateComplete;
    const seen: string[] = [];
    card.addEventListener("mc-inspect", (event) => seen.push((event as CustomEvent<{ key: string }>).detail.key));
    card
      .shadowRoot!.querySelector(".tap")!
      .dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(seen).toEqual(["entry:rhino"]);
  });

  it("sizes the caption strip", async () => {
    const card = await mount({ ...model, captionHeight: 60 });
    expect(card.shadowRoot!.querySelector(".caption")!.getAttribute("style")).toContain("height:60px");
    expect(card.shadowRoot!.querySelector(".art")!.getAttribute("style")).toContain("bottom:60px");
  });
});

describe("mc-picture-card press control", () => {
  it("is a real button named by the card's words, pressed when selected, and keyboard-activatable", async () => {
    const card = document.createElement("mc-picture-card");
    card.model = { ...model, selected: true };
    card.setAttribute("activate-key", "entry:spider");
    document.body.append(card);
    await card.updateComplete;
    const button = card.shadowRoot!.querySelector("button.tap") as HTMLButtonElement;
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("aria-label")).toBe("Spider-Man, Win 3 games, LOCKED");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    const keys: string[] = [];
    card.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    button.click(); // detail 0: what Enter or Space on a focused button sends
    expect(keys).toEqual(["entry:spider"]);
  });

  it("takes an explicit label over the derived name", async () => {
    const card = document.createElement("mc-picture-card");
    card.model = model;
    card.label = "Open Spider-Man";
    card.setAttribute("activate-key", "k");
    document.body.append(card);
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector("button.tap")!.getAttribute("aria-label")).toBe("Open Spider-Man");
  });

  it("tells the screen when its button takes focus, so a keyboard route can follow it", async () => {
    const card = document.createElement("mc-picture-card");
    card.model = model;
    card.setAttribute("activate-key", "entry:spider");
    document.body.append(card);
    await card.updateComplete;
    const keys: string[] = [];
    card.addEventListener("mc-tile-focus", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    (card.shadowRoot!.querySelector("button.tap") as HTMLButtonElement).focus();
    expect(keys).toEqual(["entry:spider"]);
  });
});
