// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-controls-diagram.js";
import type { McControlsDiagram } from "../McControlsDiagram.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McControlsDiagram> {
  const el = document.createElement("mc-controls-diagram");
  el.input = { diagram: { viewBox: [10, 10], ops: [], glyphs: [], missing: undefined }, caption: "Xbox layout", testLine: "Last input: A" };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-controls-diagram", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-controller-diagram")).not.toBeNull();
    expect(root.querySelector(".caption")!.textContent).toContain("Xbox layout");
    expect(root.querySelector("[data-key='input-test']")!.textContent).toContain("Last input: A");
  });

  it("has no test line without a connected pad", async () => {
    const el = await mount();
    el.input = { ...el.input!, testLine: null };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("[data-key='input-test']")).toBeNull();
  });
});
