import { afterEach, describe, expect, it } from "vitest";
import "./mc-card-sections.js";
import type { CardSectionsModel } from "./mc-card-sections.types.js";

afterEach(() => document.body.replaceChildren());

const model: CardSectionsModel = {
  contentWidth: 600,
  columns: 2,
  cellHeight: 220,
  gap: 6,
  sections: [
    {
      kind: "faces",
      title: "IDENTITY · 2 FACES",
      tileWidth: 100,
      tileHeight: 140,
      tiles: [
        { id: "0.0", cardId: "hero", picture: { src: null }, label: "Hero", name: "Spider-Man" },
        { id: "0.1", cardId: "hero", picture: { src: null }, label: "Alter-Ego", name: "Peter Parker" },
      ],
    },
    {
      kind: "cards",
      title: "JUSTICE · 2",
      cells: [
        {
          id: "01001",
          cardId: "01001",
          cost: 2,
          costColor: "#c00",
          name: "Swinging Web Kick",
          typeWord: "Event",
          picture: { src: null },
          rules: "Deal 4 damage.",
          quantity: 2,
        },
      ],
    },
    { kind: "note", text: "No cards match." },
  ],
};

async function mount() {
  const el = document.createElement("mc-card-sections");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const press = (target: Element): void => {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1 };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  target.dispatchEvent(new PointerEvent("pointerup", at));
};

describe("mc-card-sections", () => {
  it("draws face tiles, card cells and notes, found by key, with the scans named for a hover popover", async () => {
    const el = await mount();
    expect(el.elementOf("face:0.1")).toBeTruthy();
    expect(el.elementOf("card:01001")?.textContent).toContain("Swinging Web Kick");
    expect(el.elementOf("card:01001")?.textContent).toContain("×2");
    expect(el.shadowRoot!.querySelector(".note")!.textContent).toBe("No cards match.");
    expect(el.hoverFaces().map((face) => face.key)).toEqual(["face:0.0", "face:0.1", "card:01001"]);
  });

  it("raises mc-activate with the face or card key on a tap", async () => {
    const el = await mount();
    const keys: string[] = [];
    el.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    press(el.elementOf("face:0.0")!);
    press(el.elementOf("card:01001")!);
    expect(keys).toEqual(["face:0.0", "card:01001"]);
  });

  it("marks every face and cell as a focus stop, and presses one on a click with no pointer (the focus route)", async () => {
    const el = await mount();
    expect(el.elementOf("card:01001")!.dataset.stop).toBe("card:01001");
    const keys: string[] = [];
    el.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    el.elementOf("card:01001")!.click();
    expect(keys).toEqual(["card:01001"]);
  });

  it("raises the card hover and Inspect events from a picture, with the face a face tile names", async () => {
    const el = await mount();
    const heard: string[] = [];
    el.addEventListener("mc-card-hover", (event) => heard.push(event.detail.cardId));
    const picture = el.elementOf("card:01001")!.querySelector("mc-picture-tile")!;
    picture.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    expect(heard).toEqual(["01001"]);
  });
});
