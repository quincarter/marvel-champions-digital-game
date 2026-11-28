// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-log-line";

afterEach(() => document.body.replaceChildren());

describe("mc-pause-log-line", () => {
  it("is a stop named by its line, draws the beat, the words and the undo mark, and raises a moment", async () => {
    const el = document.createElement("mc-pause-log-line");
    el.line = { id: "l7", ref: "R3.2", words: "Spider-Man attacks Rhino", stop: "moment:l7" };
    document.body.append(el);
    await el.updateComplete;
    expect(el.getAttribute("data-stop")).toBe("moment:l7");
    const root = el.shadowRoot!;
    expect(root.querySelector(".ref")!.textContent).toBe("R3.2");
    expect(root.querySelector(".words")!.textContent).toBe("Spider-Man attacks Rhino");
    expect(root.querySelector(".undo")!.textContent).toBe("↶");
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.click();
    expect(seen).toEqual([{ action: { type: "moment", id: "l7" }, hold: false }]);
  });
});
