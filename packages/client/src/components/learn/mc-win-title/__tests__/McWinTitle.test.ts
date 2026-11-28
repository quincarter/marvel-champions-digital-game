// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-win-title";

afterEach(() => document.body.replaceChildren());

describe("mc-win-title", () => {
  it("draws its two lines, the second as the losing one", async () => {
    const el = document.createElement("mc-win-title");
    el.first = "ONE WAY TO WIN.";
    el.second = "TWO WAYS TO LOSE.";
    document.body.append(el);
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll(".line")];
    expect(lines.map((l) => l.textContent)).toEqual(["ONE WAY TO WIN.", "TWO WAYS TO LOSE."]);
    expect(lines[1]!.classList.contains("lose")).toBe(true);
  });
});
