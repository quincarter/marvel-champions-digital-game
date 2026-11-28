// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-grid.js";
import { keepScroll, keptScroll } from "../../shared/list-scroll.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McPackGrid } from "../McPackGrid.js";
import type { PackTileModel } from "../../mc-pack-tile/mc-pack-tile.types.js";

const tileOf = (id: string): PackTileModel => ({
  id,
  name: id,
  meta: "",
  summary: "",
  foot: "",
  badge: "+ Install",
  solid: true,
  letter: id.charAt(0).toUpperCase(),
  thumb: { src: null, fit: "contain" },
});

describe("mc-pack-grid", () => {
  it("draws one pack tile per pack, in a native scroller named list:grid", async () => {
    const el = await mount<McPackGrid>("mc-pack-grid", { tiles: [tileOf("a"), tileOf("b")], listId: "grid:all" });
    const scroller = el.scroller!;
    expect(scroller.getAttribute("data-key")).toBe("list:grid");
    expect(scroller.classList.contains("scroller")).toBe(true);
    expect([...scroller.querySelectorAll("mc-pack-tile")].map((t) => t.getAttribute("data-stop"))).toEqual([
      "tile:a",
      "tile:b",
    ]);
    el.remove();
  });

  it("keeps a list's scroll place under its id and puts it back when that list comes round again", async () => {
    keepScroll("grid:heroes", 180);
    const el = await mount<McPackGrid>("mc-pack-grid", { tiles: [tileOf("a")], listId: "grid:all" });
    el.listId = "grid:heroes";
    await el.updateComplete;
    expect(el.scroller!.scrollTop).toBe(180);
    el.remove();
  });

  it("sends the list to its top when a new filter raises scrollFrom", async () => {
    const el = await mount<McPackGrid>("mc-pack-grid", { tiles: [tileOf("a")], listId: "grid:all", scrollFrom: 0 });
    keepScroll("grid:all", 90);
    el.scrollFrom = 1;
    await el.updateComplete;
    expect(keptScroll("grid:all")).toBe(0);
    el.remove();
  });
});
