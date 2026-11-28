// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-stats-small-tile";

afterEach(() => document.body.replaceChildren());

describe("mc-stats-small-tile", () => {
  it("says a caption, a headline and a line, and is a focus stop", async () => {
    const el = document.createElement("mc-stats-small-tile");
    el.stop = "tile:aspect";
    el.label = "Favorite aspect";
    el.value = "Justice";
    el.detail = "6 games";
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(el.getAttribute("data-stop")).toBe("tile:aspect");
    expect(root.querySelector(".caption")!.textContent).toBe("Favorite aspect");
    expect(root.querySelector(".value")!.textContent).toBe("Justice");
    expect(root.querySelector(".body")!.textContent).toBe("6 games");
  });
});
