import { afterEach, describe, expect, it } from "vitest";
import "./mc-picture-tile.js";
import { objectPositionFor } from "../../shared/crop.js";

afterEach(() => document.body.replaceChildren());

describe("mc-picture-tile with a PictureSource", () => {
  it("fits the whole picture when it has no cover, on its own ground, and crops when it has", async () => {
    const tile = document.createElement("mc-picture-tile");
    tile.picture = { src: "/a.png", fill: "#123456" };
    document.body.append(tile);
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector("img")!.getAttribute("style")).toBe("object-fit:contain");
    expect(tile.shadowRoot!.querySelector(".tile")!.getAttribute("style")).toContain("background:#123456");
    tile.picture = { src: "/a.png", cover: { x: 0.5, y: 0.3 } };
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector("img")!.getAttribute("style")).toContain("object-position:50% 30%");
  });

  it("says the picture missing word with no src, and asks once per retry key with the key in the detail", async () => {
    const tile = document.createElement("mc-picture-tile");
    tile.picture = { src: null, missing: "No scan" };
    document.body.append(tile);
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector(".missing")?.textContent).toBe("No scan");
    const asked: unknown[] = [];
    tile.addEventListener("mc-image-error", (e) => asked.push((e as CustomEvent).detail));
    tile.picture = { src: "/gone.png", retry: "hero:1" };
    await tile.updateComplete;
    tile.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    await tile.updateComplete;
    tile.picture = { src: "/gone2.png", retry: "hero:1" };
    await tile.updateComplete;
    tile.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(asked).toEqual([{ src: "/gone.png", key: "hero:1" }]);
    tile.shadowRoot!.querySelector("img");
  });
});

describe("objectPositionFor", () => {
  it("is a share of the overflow for a plain point, and the crop middle kept inside the picture when centered", () => {
    const box = { width: 100, height: 100 };
    expect(objectPositionFor({ x: 0.5, y: 0.2 }, undefined, box)).toBe("50% 20%");
    // A 200x100 picture in a 100x100 box shows a 100 wide crop: a point at the left edge keeps it at the left.
    expect(objectPositionFor({ x: 0, y: 0.5, centered: true }, { width: 200, height: 100 }, box)).toBe("0% 50%");
    expect(objectPositionFor({ x: 0.5, y: 0.5, centered: true }, { width: 200, height: 100 }, box)).toBe("50% 50%");
    expect(objectPositionFor({ x: 1, y: 0.5, centered: true }, { width: 200, height: 100 }, box)).toBe("100% 50%");
    // Before the size is known, the point is used as a share.
    expect(objectPositionFor({ x: 0.25, y: 0.5, centered: true }, undefined, box)).toBe("25% 50%");
  });
});
