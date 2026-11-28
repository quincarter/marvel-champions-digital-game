// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../../mc-stats-credited/mc-stats-credited";
import "../mc-stats-matchup-head";

afterEach(() => document.body.replaceChildren());

async function head(kind: "heat" | "stamps", axis: "row" | "column" = "row", cursor = false) {
  const el = document.createElement("mc-stats-matchup-head");
  el.kind = kind;
  el.axis = axis;
  el.cursor = cursor;
  el.entry = { name: "Rhino", picture: { src: "/r.png" }, cardId: "01094" };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-matchup-head", () => {
  it("leads with the card's picture on the stamp grid, and has the name alone on the heat grid", async () => {
    const stamps = await head("stamps");
    expect(stamps.shadowRoot!.querySelector("mc-picture-tile")!.getAttribute("data-card-id")).toBe("01094");
    expect(stamps.shadowRoot!.querySelector("mc-stats-credited")!.getAttribute("label")).toBe("Rhino");
    document.body.replaceChildren();
    const heat = await head("heat");
    expect(heat.shadowRoot!.querySelector("mc-picture-tile")).toBeNull();
  });

  it("reflects its axis, kind and the cursor for the stylesheet", async () => {
    const el = await head("heat", "column", true);
    expect([el.getAttribute("axis"), el.getAttribute("kind"), el.hasAttribute("cursor")]).toEqual([
      "column",
      "heat",
      true,
    ]);
  });
});
