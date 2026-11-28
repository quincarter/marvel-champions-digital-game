// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-tile.js";
import { hear, mount } from "../../shared/__tests__/test-mount.js";
import type { McPackTile } from "../McPackTile.js";
import type { PackTileModel } from "../mc-pack-tile.types.js";

const tile: PackTileModel = {
  id: "wolverine-x",
  name: "Wolverine X",
  meta: "Hero pack · by Someone",
  summary: "A new take.",
  foot: "1.2 MB",
  badge: "+ Install",
  solid: true,
  letter: "W",
  thumb: { src: "blob:thumb", retry: "pack-art:wolverine-x:cover.webp", fit: "contain" },
};

describe("mc-pack-tile", () => {
  it("is the pack look of a media row with the pack's words, and names where its picture came from", async () => {
    const el = await mount<McPackTile>("mc-pack-tile", { tile });
    const row = el.shadowRoot!.querySelector<HTMLElement & Record<string, unknown>>("mc-media-row")!;
    expect(row.heading).toBe("Wolverine X");
    expect(row.badge).toBe("+ Install");
    expect(row.solid).toBe(true);
    expect(row.src).toBe("blob:thumb");
    expect(row.retry).toBe("pack-art:wolverine-x:cover.webp");
    el.remove();
  });

  it("is a focus stop named tile:<id>, and a press (the route's Enter) says open-pack", async () => {
    const el = await mount<McPackTile>("mc-pack-tile", { tile });
    expect(el.getAttribute("data-stop")).toBe("tile:wolverine-x");
    expect(el.getAttribute("data-key")).toBe("tile:wolverine-x");
    const heard = hear(el);
    el.click();
    expect(heard).toEqual([{ type: "open-pack", id: "wolverine-x" }]);
    el.remove();
  });

  it("says nothing without a tile", async () => {
    const el = await mount<McPackTile>("mc-pack-tile");
    const heard = hear(el);
    el.click();
    expect(heard).toEqual([]);
    el.remove();
  });
});
