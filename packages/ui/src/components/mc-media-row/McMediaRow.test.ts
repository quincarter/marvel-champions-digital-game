import { afterEach, describe, expect, it } from "vitest";
import "./mc-media-row.js";

afterEach(() => document.body.replaceChildren());

async function mount(props: Record<string, unknown>) {
  const row = document.createElement("mc-media-row");
  Object.assign(row, props);
  document.body.append(row);
  await row.updateComplete;
  return row;
}

describe("mc-media-row", () => {
  it("shows its words, a letter while it has no picture, and a solid badge for a call to action", async () => {
    const row = await mount({
      heading: "Hero Pack",
      meta: "Hero · by Ann",
      summary: "A pack.",
      foot: "1 MB",
      badge: "+ Install",
      solid: true,
      letter: "H",
    });
    expect(row.shadowRoot!.querySelector(".heading")?.textContent).toBe("Hero Pack");
    expect(row.shadowRoot!.querySelector(".meta")?.textContent).toBe("Hero · by Ann");
    expect(row.shadowRoot!.querySelector(".badge.solid")?.textContent).toBe("+ Install");
    const tile = row.shadowRoot!.querySelector("mc-picture-tile")!;
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector(".missing.letter")?.textContent).toBe("H");
  });

  it("composes its picture from mc-picture-tile, fitted whole by default, and lets a load failure through", async () => {
    const row = await mount({ heading: "Pack", src: "/p.png", letter: "P", badge: "" });
    const tile = row.shadowRoot!.querySelector("mc-picture-tile")!;
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector("img")!.getAttribute("style")).toBe("object-fit:contain");
    expect(row.shadowRoot!.querySelector(".badge")).toBeNull();
    const errors: unknown[] = [];
    row.addEventListener("mc-image-error", (event) => errors.push((event as CustomEvent).detail));
    tile.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(errors).toEqual([{ src: "/p.png" }]);
  });

  it("crops around focus-y with fit cover", async () => {
    const row = await mount({ src: "/p.png", fit: "cover", focusY: 0.1 });
    const tile = row.shadowRoot!.querySelector("mc-picture-tile")!;
    await tile.updateComplete;
    expect(tile.shadowRoot!.querySelector("img")!.getAttribute("style")).toContain("object-position:50% 10%");
  });
});
