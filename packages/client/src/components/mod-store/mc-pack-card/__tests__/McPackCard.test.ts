// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-card.js";
import { hear, mount } from "../../shared/__tests__/test-mount.js";
import type { McPackCard } from "../McPackCard.js";
import type { GalleryTileModel } from "../mc-pack-card.types.js";

const card: GalleryTileModel = {
  key: "card:x-001",
  name: "Claw Slash",
  typeLine: "Event · Attack",
  quantity: 2,
  src: "blob:card",
  missing: "Claw Slash",
  hover: { cardId: "x-001" },
};

describe("mc-pack-card", () => {
  it("says the name and type line, with ×2 past one copy", async () => {
    const el = await mount<McPackCard>("mc-pack-card", { card });
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("Claw Slash");
    expect(el.shadowRoot!.querySelector(".type")!.textContent).toBe("Event · Attack");
    expect(el.shadowRoot!.querySelector(".quantity")!.textContent).toBe("×2");
    el.card = { ...card, quantity: 1 };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".quantity")).toBeNull();
    el.remove();
  });

  it("is a stop named by the gallery's key; Enter and the route's Inspect both say card", async () => {
    const el = await mount<McPackCard>("mc-pack-card", { card });
    expect(el.getAttribute("data-stop")).toBe("card:x-001");
    const heard = hear(el);
    el.click();
    el.inspect();
    expect(heard).toEqual([
      { type: "card", key: "card:x-001" },
      { type: "card", key: "card:x-001" },
    ]);
    el.remove();
  });

  it("raises the hover for its card when the mouse is over the picture, and nothing for a card with none", async () => {
    const el = await mount<McPackCard>("mc-pack-card", { card });
    const heard: string[] = [];
    el.addEventListener("mc-card-hover", (event) => heard.push((event as CustomEvent).detail.cardId));
    const enter = new Event("pointerenter");
    Object.assign(enter, { pointerType: "mouse" });
    el.shadowRoot!.querySelector(".picture")!.dispatchEvent(enter);
    expect(heard).toEqual(["x-001"]);
    el.card = { ...card, hover: null };
    await el.updateComplete;
    el.shadowRoot!.querySelector(".picture")!.dispatchEvent(enter);
    expect(heard).toEqual(["x-001"]);
    el.remove();
  });
});
