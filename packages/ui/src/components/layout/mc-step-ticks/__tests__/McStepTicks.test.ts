import { afterEach, describe, expect, it } from "vitest";
import "../mc-step-ticks";

afterEach(() => document.body.replaceChildren());

async function ticks(set: (el: HTMLElementTagNameMap["mc-step-ticks"]) => void) {
  const el = document.createElement("mc-step-ticks");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-step-ticks", () => {
  it("draws count ticks with the first filled ones marked", async () => {
    const el = await ticks((t) => {
      t.count = 5;
      t.filled = 2;
    });
    const all = [...el.shadowRoot!.querySelectorAll(".tick")];
    expect(all).toHaveLength(5);
    expect(all.map((tick) => tick.hasAttribute("data-on"))).toEqual([true, true, false, false, false]);
  });

  it("names itself for a screen reader and draws none for a count of zero", async () => {
    const el = await ticks((t) => {
      t.count = 0;
      t.label = "Lesson 1 of 5";
    });
    expect(el.getAttribute("aria-label")).toBe("Lesson 1 of 5");
    expect(el.getAttribute("role")).toBe("img");
    expect(el.shadowRoot!.querySelectorAll(".tick")).toHaveLength(0);
  });
});
