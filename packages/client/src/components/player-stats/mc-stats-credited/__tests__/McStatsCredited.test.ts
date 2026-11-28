// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-stats-credited";

afterEach(() => document.body.replaceChildren());

async function credited(label: string, lines = 1) {
  const el = document.createElement("mc-stats-credited");
  el.label = label;
  el.lines = lines;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-credited", () => {
  it("draws a plain name as one clipped span", async () => {
    const el = await credited("Rhino");
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("Rhino");
    expect(el.shadowRoot!.querySelector(".credit")).toBeNull();
  });

  it("keeps a custom pack's credit apart from the name that gets cut", async () => {
    const el = await credited("The Rose (by PermaKarma)");
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("The Rose");
    expect(el.shadowRoot!.querySelector(".credit")!.textContent).toBe("by PermaKarma");
  });

  it("reflects the line count for the stylesheet and gives the name the lines the credit leaves", async () => {
    const el = await credited("A Very Long Name (by Someone)", 3);
    expect(el.getAttribute("lines")).toBe("3");
    expect(el.style.getPropertyValue("--name-lines")).toBe("2");
  });
});
