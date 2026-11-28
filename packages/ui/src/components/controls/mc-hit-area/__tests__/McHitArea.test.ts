import { afterEach, describe, expect, it } from "vitest";
import "../mc-hit-area";

afterEach(() => document.body.replaceChildren());

describe("mc-hit-area", () => {
  it("draws nothing and raises its action when pressed", async () => {
    const el = document.createElement("mc-hit-area");
    el.action = "cards";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.children.length).toBe(0);
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.press();
    expect(seen).toEqual([{ action: "cards", hold: false }]);
  });
});
