import { afterEach, describe, expect, it } from "vitest";
import "../mc-progress-bar.js";
import type { McProgressBar } from "../McProgressBar.js";

afterEach(() => document.body.replaceChildren());

async function bar(fraction: number, label = ""): Promise<McProgressBar> {
  const el = document.createElement("mc-progress-bar");
  el.fraction = fraction;
  el.label = label;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-progress-bar", () => {
  it("fills its share of the track and says it as a progressbar", async () => {
    const el = await bar(0.4, "4 / 10");
    expect(el.style.getPropertyValue("--mc-progress")).toBe("0.4");
    expect(el.getAttribute("role")).toBe("progressbar");
    expect(el.getAttribute("aria-valuenow")).toBe("40");
    expect(el.getAttribute("aria-label")).toBe("4 / 10");
    expect(el.hasAttribute("empty")).toBe(false);
  });

  it("clamps a fraction outside 0 to 1, and draws no fill at nothing", async () => {
    const over = await bar(3);
    expect(over.style.getPropertyValue("--mc-progress")).toBe("1");
    const none = await bar(0);
    expect(none.hasAttribute("empty")).toBe(true);
    expect(none.hasAttribute("aria-label")).toBe(false);
  });
});
