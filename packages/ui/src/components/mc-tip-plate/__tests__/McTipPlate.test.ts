import { describe, expect, it, vi } from "vitest";
import "../mc-tip-plate.js";

describe("mc-tip-plate", () => {
  it("is hidden without an anchor and placed inside the viewport with one", async () => {
    const el = document.createElement("mc-tip-plate");
    el.text = "A tip";
    el.viewport = { x: 0, y: 0, width: 400, height: 300 };
    Object.defineProperty(el, "offsetHeight", { value: 60 });
    document.body.append(el);
    await el.updateComplete;
    expect(el.hasAttribute("hidden")).toBe(true);
    el.anchor = { x: 10, y: 20, width: 100, height: 40 };
    await el.updateComplete;
    expect(el.hasAttribute("hidden")).toBe(false);
    expect(el.hasAttribute("placed")).toBe(true);
    const left = parseFloat(el.style.left);
    const top = parseFloat(el.style.top);
    expect(left).toBeGreaterThanOrEqual(4);
    expect(left + parseFloat(el.style.width)).toBeLessThanOrEqual(396);
    expect(top).toBeGreaterThanOrEqual(60);
    el.remove();
  });

  it("raises mc-tip-dismiss on a click with no pointer (the focus route's press)", async () => {
    const el = document.createElement("mc-tip-plate");
    document.body.append(el);
    const heard = vi.fn();
    el.addEventListener("mc-tip-dismiss", heard);
    el.click();
    expect(heard).toHaveBeenCalledTimes(1);
    el.remove();
  });
});
