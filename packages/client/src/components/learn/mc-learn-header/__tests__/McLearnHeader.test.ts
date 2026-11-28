// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-learn-header";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

async function header(set: (el: HTMLElementTagNameMap["mc-learn-header"]) => void) {
  const el = document.createElement("mc-learn-header");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-learn-header", () => {
  it("hands the title, the close and the tab's room to the bar and sizes it", async () => {
    const el = await header((h) => {
      h.heading = "How to play";
      h.closeLabel = "Back";
      h.drop = 12;
      h.max = 200;
      h.barHeight = 64;
    });
    const bar = el.shadowRoot!.querySelector("mc-close-bar")!;
    expect(bar.getAttribute("heading")).toBe("How to play");
    expect(bar.getAttribute("close-label")).toBe("Back");
    expect(bar.getAttribute("drop")).toBe("12");
    expect(bar.getAttribute("max")).toBe("200");
    expect(bar.style.getPropertyValue("--bar-height")).toBe("64px");
  });

  it("draws progress ticks only when it is given them", async () => {
    const el = await header((h) => (h.heading = "Lesson 1 of 5"));
    expect(el.shadowRoot!.querySelector("mc-step-ticks")).toBeNull();
    el.ticks = { count: 5, filled: 1, label: "Lesson 1 of 5" };
    await el.updateComplete;
    const ticks = el.shadowRoot!.querySelector("mc-step-ticks")!;
    expect(ticks.getAttribute("count")).toBe("5");
    expect(ticks.getAttribute("slot")).toBe("end");
  });

  it("raises one mc-learn close when its × is pressed", async () => {
    const el = await header(() => undefined);
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    const bar = el.shadowRoot!.querySelector("mc-close-bar")!;
    bar.shadowRoot!.querySelector<HTMLElement>("mc-chip")!.click();
    expect(heard).toEqual([{ type: "close" }]);
  });
});
