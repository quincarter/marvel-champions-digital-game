// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-stats-aspect-stamps";

afterEach(() => document.body.replaceChildren());

describe("mc-stats-aspect-stamps", () => {
  it("draws a stamp with the aspect's word on it and its detail beside it", async () => {
    const el = document.createElement("mc-stats-aspect-stamps");
    el.caption = "ASPECTS";
    el.aspects = [
      { aspect: "justice", label: "JUSTICE", fill: "#f4c20d", ink: "#14110d", detail: "5 games · 3 won" },
      { aspect: "pool", label: "'POOL", fill: "#f48fb1", ink: "#14110d", detail: "2 games · 1 won" },
    ];
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".caption")!.textContent).toBe("ASPECTS");
    expect([...root.querySelectorAll(".stamp")].map((s) => s.textContent)).toEqual(["JUSTICE", "'POOL"]);
    expect([...root.querySelectorAll(".detail")].map((s) => s.textContent)).toEqual([
      "5 games · 3 won",
      "2 games · 1 won",
    ]);
    expect((root.querySelector(".stamp") as HTMLElement).style.getPropertyValue("--stamp-fill")).toBe("#f4c20d");
  });
});
