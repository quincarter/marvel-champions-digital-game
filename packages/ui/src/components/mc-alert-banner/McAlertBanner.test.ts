import { afterEach, describe, expect, it } from "vitest";
import "./mc-alert-banner.js";
import type { AlertBannerModel } from "./mc-alert-banner.types.js";

afterEach(() => document.body.replaceChildren());

const model = (): AlertBannerModel => ({
  heading: "UPDATE AVAILABLE",
  detail: "Version 1.2.0",
  text: { x: 12, y: 8, width: 200 },
  buttons: [
    { key: "update", label: "Update", kind: "primary", rect: { x: 220, y: 8, width: 90, height: 32 } },
    { key: "close", label: "✕", kind: "quiet", rect: { x: 316, y: 8, width: 32, height: 32 } },
  ],
});

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-alert-banner", () => {
  it("draws its heading over its detail where the layout puts them, and a button for each action", async () => {
    const el = document.createElement("mc-alert-banner");
    el.model = model();
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector(".heading")!.textContent).toBe("UPDATE AVAILABLE");
    expect(root.querySelector(".detail")!.textContent).toBe("Version 1.2.0");
    expect(root.querySelector(".heading")!.getAttribute("style")).toMatch(
      /left:\s*12px;\s*top:\s*8px;\s*width:\s*200px/,
    );
    expect(root.querySelector(".detail")!.getAttribute("style")).toMatch(/top:\s*24px/);
    expect(el.elementOf("update")).not.toBeNull();
    expect(el.elementOf("close")).not.toBeNull();
  });

  it("reports a tap on an action with its key, and draws nothing without a model", async () => {
    const el = document.createElement("mc-alert-banner");
    el.model = model();
    document.body.append(el);
    await el.updateComplete;
    const seen: string[] = [];
    el.addEventListener("mc-activate", (e) => seen.push((e as CustomEvent<{ key: string }>).detail.key));
    const menu = el.elementOf("update")!;
    await (menu as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    tap(menu.shadowRoot!.querySelector("mc-button")!);
    expect(seen).toEqual(["update"]);
    el.model = null;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".box")).toBeNull();
  });
});
