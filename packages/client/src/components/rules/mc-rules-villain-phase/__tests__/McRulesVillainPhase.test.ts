// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-rules-villain-phase.js";

afterEach(() => document.body.replaceChildren());

describe("mc-rules-villain-phase", () => {
  it("lists a step element per step, with the citation under the list", async () => {
    const el = document.createElement("mc-rules-villain-phase");
    el.steps = [0, 1, 2].map((index) => ({
      index,
      label: `${index + 1}.`,
      detail: "d",
      current: false,
      picture: null,
    }));
    el.citation = "RRG 1.8 p. 47";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("mc-rules-step")).toHaveLength(3);
    expect(el.shadowRoot!.querySelector(".citation")!.textContent).toBe("RRG 1.8 p. 47");
    expect(el.scroller).not.toBeNull();
  });
});
