// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../../mc-stats-credited/mc-stats-credited";
import "../mc-stats-matchup-tile";
import type { StatsMatchupTileModel } from "../mc-stats-matchup-tile.types";

afterEach(() => document.body.replaceChildren());

const tile: StatsMatchupTileModel = {
  column: 3,
  name: "Spider-Man",
  look: "won",
  ribbon: "Expert · 2",
  color: "#6b3fa0",
  ink: "#ffffff",
  picture: { src: "/s.png" },
  cardId: "01001a",
};

async function make(model: StatsMatchupTileModel | null) {
  const el = document.createElement("mc-stats-matchup-tile");
  el.tile = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-matchup-tile", () => {
  it("is a focus stop for its column and says what you did in a ribbon of words", async () => {
    const el = await make(tile);
    const root = el.shadowRoot!;
    expect(el.getAttribute("data-stop")).toBe("tile:3");
    expect(el.getAttribute("look")).toBe("won");
    expect(root.querySelector(".ribbon")!.textContent).toBe("Expert · 2");
    expect(root.querySelector("mc-stats-credited")!.getAttribute("label")).toBe("Spider-Man");
    expect(root.querySelector("mc-picture-tile")!.getAttribute("data-card-id")).toBe("01001a");
  });

  it("reflects a pairing not beaten so the stylesheet can stand it back", async () => {
    const el = await make({ ...tile, look: "unplayed", ribbon: "Not played" });
    expect(el.getAttribute("look")).toBe("unplayed");
  });
});
