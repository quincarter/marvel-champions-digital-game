// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-rules-card-set.js";

afterEach(() => document.body.replaceChildren());

describe("mc-rules-card-set", () => {
  it("draws the heading and a tile stop per card, and says which was pressed", async () => {
    const el = document.createElement("mc-rules-card-set");
    el.set = {
      setId: "rhino",
      heading: "RHINO · 2 CARDS",
      tiles: [
        { key: "row:card:rhino:01", name: "Rhino", cardId: "01", picture: { src: "a.png" } },
        { key: "row:card:rhino:02", name: "Stampede", cardId: "02", picture: { src: null } },
      ],
    };
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".heading")!.textContent).toBe("RHINO · 2 CARDS");
    const tiles = [...root.querySelectorAll<HTMLElement>("button.tile")];
    expect(tiles.map((tile) => tile.dataset.stop)).toEqual(["row:card:rhino:01", "row:card:rhino:02"]);
    expect(tiles[1]!.querySelector(".missing")).not.toBeNull();
    const heard = vi.fn();
    el.addEventListener("mc-rules", (event) => heard(event.detail));
    tiles[0]!.click();
    expect(heard).toHaveBeenCalledWith({ type: "card", key: "row:card:rhino:01" });
  });
});
