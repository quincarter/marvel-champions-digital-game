// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-split-tile";

afterEach(() => document.body.replaceChildren());

describe("mc-stats-split-tile", () => {
  it("hands its parts to a labelled bar under the caption", async () => {
    const el = document.createElement("mc-stats-split-tile");
    el.stop = "tile:lose";
    el.label = "How you lose";
    el.detail = "Mostly schemes.";
    el.parts = [{ count: 3, color: "#c62828", label: "Scheme 3" }];
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(el.getAttribute("data-stop")).toBe("tile:lose");
    expect(root.querySelector(".caption")!.textContent).toBe("How you lose");
    const bar = root.querySelector("mc-segment-bar")!;
    expect(bar.parts).toHaveLength(1);
    expect(bar.hasAttribute("labels")).toBe(true);
    expect(root.querySelector(".body")!.textContent).toBe("Mostly schemes.");
  });
});
