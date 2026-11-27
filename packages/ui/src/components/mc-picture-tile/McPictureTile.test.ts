import { afterEach, describe, expect, it } from "vitest";
import "./mc-picture-tile.js";

afterEach(() => document.body.replaceChildren());

describe("mc-picture-tile", () => {
  it("fills its box cropped around the focal point, lazily", async () => {
    const tile = document.createElement("mc-picture-tile");
    tile.src = "/a.png";
    tile.subject = { x: 0.5, y: 0.2 };
    document.body.append(tile);
    await tile.updateComplete;
    const img = tile.shadowRoot!.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("style")).toContain("object-fit:cover;object-position:50% 20%");
  });

  it("fits the whole picture with fit contain, and draws or drops the frame", async () => {
    const tile = document.createElement("mc-picture-tile");
    tile.src = "/a.png";
    tile.fit = "contain";
    document.body.append(tile);
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector("img")!.getAttribute("style")).toBe("object-fit:contain");
    expect(tile.shadowRoot!.querySelector(".tile")!.getAttribute("style")).toBe("outline-width:2px");
    tile.frame = 0;
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector(".tile")!.getAttribute("style")).toBe("outline:none");
  });

  it("ghosts a dim picture and reflects its ground", async () => {
    const tile = document.createElement("mc-picture-tile");
    tile.src = "/a.png";
    tile.dim = true;
    tile.ground = "parchment";
    document.body.append(tile);
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector("img")!.classList.contains("dim")).toBe(true);
    expect(tile.getAttribute("ground")).toBe("parchment");
    expect(tile.hasAttribute("dim")).toBe(true);
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
    // A fresh URL for the same box is tried again.
    tile.src = "/fresh.png";
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector("img")?.getAttribute("src")).toBe("/fresh.png");
  });

  it("raises mc-image-load when the picture loads", async () => {
    const tile = document.createElement("mc-picture-tile");
    tile.src = "/a.png";
    document.body.append(tile);
    await tile.updateComplete;
    let loaded = 0;
    tile.addEventListener("mc-image-load", () => loaded++);
    tile.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("load"));
    expect(loaded).toBe(1);
  });
});
