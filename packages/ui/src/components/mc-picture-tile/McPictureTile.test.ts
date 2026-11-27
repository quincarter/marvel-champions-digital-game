import { describe, expect, it } from "vitest";
import "./mc-picture-tile.js";

describe("mc-picture-tile", () => {
  it("fills its box cropped around the focal point, lazily", async () => {
    const tile = document.createElement("mc-picture-tile");
    tile.src = "/a.png";
    tile.focusY = 0.2;
    document.body.append(tile);
    await tile.updateComplete;
    const img = tile.shadowRoot!.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("style")).toContain("object-fit:cover;object-position:50% 20%");
    tile.remove();
  });

  it("says the missing word with no picture, and again once its picture fails to load", async () => {
    const tile = document.createElement("mc-picture-tile");
    tile.missing = "No scan";
    document.body.append(tile);
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector(".missing")?.textContent).toBe("No scan");
    tile.src = "/gone.png";
    await tile.updateComplete;
    const errors: unknown[] = [];
    tile.addEventListener("mc-image-error", (event) => errors.push((event as CustomEvent).detail));
    tile.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    await tile.updateComplete;
    expect(errors).toEqual([{ src: "/gone.png" }]);
    expect(tile.shadowRoot!.querySelector("img")).toBeNull();
    expect(tile.shadowRoot!.querySelector(".missing")?.textContent).toBe("No scan");
    tile.remove();
  });
});
