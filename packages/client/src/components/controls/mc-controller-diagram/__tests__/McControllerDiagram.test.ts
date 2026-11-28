// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-controller-diagram.js";
import type { McControllerDiagram } from "../McControllerDiagram.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McControllerDiagram> {
  const el = document.createElement("mc-controller-diagram");
  el.diagram = {
    viewBox: [100, 50],
    ops: [
      { k: "rect", x: 0, y: 0, w: 100, h: 50, fill: "#fff" },
      { k: "text", x: 5, y: 10, text: "LB", size: 4, weight: 800, anchor: "start", fill: "#000", font: "body" },
    ],
    glyphs: [{ x: 50, y: 25, height: 10, maxWidth: 12, spec: { kind: "key", label: "A" } }],
    missing: undefined,
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-controller-diagram", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 100 50");
    expect(root.querySelector("text")!.textContent).toBe("LB");
    expect(root.querySelectorAll("mc-glyph").length).toBe(1);
  });
});
