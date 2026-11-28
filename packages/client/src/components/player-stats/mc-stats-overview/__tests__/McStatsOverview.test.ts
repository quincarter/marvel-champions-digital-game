// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-overview";
import type { StatsTileModel } from "../mc-stats-overview.types";

afterEach(() => document.body.replaceChildren());

const tiles: StatsTileModel[] = [
  { kind: "record", id: "record", caption: "Wins–losses", record: "3–1", rate: "75%", fraction: 0.75, detail: "" },
  {
    kind: "portrait",
    id: "hero",
    hero: true,
    label: "Favorite hero",
    name: "Spider-Man",
    detail: "4 games",
    extra: "",
    picture: null,
  },
  { kind: "figures", id: "per-game", label: "Each game", lines: [{ label: "Rounds", value: "7" }] },
  { kind: "small", id: "aspect", label: "Favorite aspect", value: "Justice", detail: "2 games" },
];

async function overview(list: readonly StatsTileModel[]) {
  const el = document.createElement("mc-stats-overview");
  el.tiles = list;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-overview", () => {
  it("draws each tile as its own element, a focus stop under tile:<id>", async () => {
    const el = await overview(tiles);
    const drawn = [...el.shadowRoot!.querySelectorAll(".grid > *")];
    expect(drawn.map((d) => d.localName)).toEqual([
      "mc-stats-record-tile",
      "mc-stats-portrait-tile",
      "mc-stats-figures-tile",
      "mc-stats-small-tile",
    ]);
    expect(drawn.map((d) => d.getAttribute("data-stop"))).toEqual([
      "tile:record",
      "tile:hero",
      "tile:per-game",
      "tile:aspect",
    ]);
  });

  it("stands the favorite hero tall (showcase) only when there is one", async () => {
    const withHero = await overview(tiles);
    expect(withHero.shadowRoot!.querySelector(".grid")!.classList.contains("showcase")).toBe(true);
    document.body.replaceChildren();
    const without = await overview(tiles.filter((t) => t.kind !== "portrait"));
    expect(without.shadowRoot!.querySelector(".grid")!.classList.contains("showcase")).toBe(false);
  });

  it("gives the hero tile the hero variant and the rest the stack", async () => {
    const el = await overview([
      ...tiles,
      { kind: "portrait", id: "villain", hero: false, label: "v", name: "Rhino", detail: "", extra: "", picture: null },
    ]);
    const portraits = [...el.shadowRoot!.querySelectorAll("mc-stats-portrait-tile")];
    expect(portraits.map((p) => p.getAttribute("variant"))).toEqual(["hero", "stack"]);
  });
});
