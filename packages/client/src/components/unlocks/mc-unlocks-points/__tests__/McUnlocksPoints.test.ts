// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-unlocks-points.js";
import type { McUnlocksPoints } from "../McUnlocksPoints.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McUnlocksPoints> {
  const el = document.createElement("mc-unlocks-points");
  el.heading = "12 points";
  el.detail = "Earn more by playing.";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-unlocks-points", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".heading")!.textContent).toBe("12 points");
    expect(root.querySelector(".detail")!.textContent).toBe("Earn more by playing.");
  });
});
