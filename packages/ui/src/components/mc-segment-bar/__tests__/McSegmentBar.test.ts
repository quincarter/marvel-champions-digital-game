// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-segment-bar";

afterEach(() => document.body.replaceChildren());

async function bar(set: (el: HTMLElementTagNameMap["mc-segment-bar"]) => void) {
  const el = document.createElement("mc-segment-bar");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-segment-bar", () => {
  it("makes each part as wide as its share and drops a part with none", async () => {
    const el = await bar((b) => {
      b.parts = [
        { count: 3, color: "red" },
        { count: 0, color: "blue" },
        { count: 1, color: "green" },
      ];
    });
    const parts = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".part")];
    expect(parts.map((p) => p.style.width)).toEqual(["75%", "25%"]);
  });

  it("leaves the rest empty when the total is larger than the parts", async () => {
    const el = await bar((b) => {
      b.total = 10;
      b.parts = [{ count: 2, color: "red" }];
    });
    expect(el.shadowRoot!.querySelector<HTMLElement>(".part")!.style.width).toBe("20%");
  });

  it("writes the words on a part only with labels on, and sets the height", async () => {
    const el = await bar((b) => {
      b.height = 28;
      b.parts = [{ count: 1, color: "red", label: "Scheme 1" }];
    });
    expect(el.shadowRoot!.querySelector(".part")!.textContent!.trim()).toBe("");
    expect(el.style.getPropertyValue("--bar-height")).toBe("28px");
    el.labels = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".part")!.textContent!.trim()).toBe("Scheme 1");
  });
});
