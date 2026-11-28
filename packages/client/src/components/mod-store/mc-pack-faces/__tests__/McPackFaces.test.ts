// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-faces.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McPackFaces } from "../McPackFaces.js";

describe("mc-pack-faces", () => {
  it("draws the cover, then each featured face, and names what each says while it has no picture", async () => {
    const el = await mount<McPackFaces>("mc-pack-faces", {
      pictures: {
        cover: { src: "blob:cover", missing: "" },
        faces: [
          { src: "blob:a", missing: "Hero", hover: { cardId: "c1", face: { kind: "hero" } } },
          { src: null, missing: "Alter-ego", hover: { cardId: "c1", face: { kind: "alterEgo" } } },
        ],
        square: null,
      },
    });
    expect(el.shadowRoot!.querySelectorAll(".cover").length).toBe(1);
    const faces = el.shadowRoot!.querySelectorAll(".face");
    expect(faces.length).toBe(2);
    const second = faces[1]!.querySelector<HTMLElement & { picture: { missing: string } }>("mc-picture-tile")!;
    expect(second.picture.missing).toBe("Alter-ego");
    el.remove();
  });

  it("raises the card hover when the mouse moves onto a face, and not for a finger", async () => {
    const el = await mount<McPackFaces>("mc-pack-faces", {
      pictures: {
        cover: null,
        faces: [{ src: "blob:a", missing: "Hero", hover: { cardId: "c1", face: { kind: "hero" } } }],
        square: null,
      },
    });
    const heard: unknown[] = [];
    el.addEventListener("mc-card-hover", (event) => heard.push((event as CustomEvent).detail.cardId));
    const face = el.shadowRoot!.querySelector(".face")!;
    const enter = (pointerType: string): void => {
      const event = new Event("pointerenter");
      Object.assign(event, { pointerType });
      face.dispatchEvent(event);
    };
    enter("touch");
    enter("mouse");
    expect(heard).toEqual(["c1"]);
    el.remove();
  });

  it("draws one square slot, with the pack's initial, for a pack with neither a cover nor a card", async () => {
    const el = await mount<McPackFaces>("mc-pack-faces", {
      pictures: { cover: null, faces: [], square: { src: null, missing: "W", fit: "contain" } },
    });
    expect(el.shadowRoot!.querySelectorAll(".square").length).toBe(1);
    expect(el.shadowRoot!.querySelector(".face")).toBeNull();
    el.remove();
  });
});
