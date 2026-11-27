// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import { gatePanels } from "./busy-gate.js";

const pointer = (type: string): PointerEvent =>
  new PointerEvent(type, { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 });

describe("gatePanels", () => {
  it("disarms a press already down and makes the panel inert; a lift releases nothing", async () => {
    const sheet = document.createElement("mc-sheet");
    sheet.nodes = [{ kind: "tap", key: "go", rect: { x: 0, y: 0, width: 50, height: 50 } }];
    document.body.append(sheet);
    await sheet.updateComplete;
    const keys: string[] = [];
    sheet.addEventListener("mc-activate", (event) => keys.push((event as CustomEvent<{ key: string }>).detail.key));
    const target = sheet.elementOf("go")!;
    target.dispatchEvent(pointer("pointerdown"));
    gatePanels([sheet, null], true);
    target.dispatchEvent(pointer("pointerup"));
    expect(keys).toEqual([]);
    expect(sheet.inert).toBe(true);
    gatePanels([sheet], false);
    expect(sheet.inert).toBe(false);
    target.dispatchEvent(pointer("pointerdown"));
    target.dispatchEvent(pointer("pointerup"));
    expect(keys).toEqual(["go"]);
    sheet.remove();
  });
});
