import { afterEach, describe, expect, it } from "vitest";
import "./mc-menu-button.js";
import "../mc-menu-grid/mc-menu-grid.js";
import type { MenuButton } from "./mc-menu-button.types.js";

afterEach(() => document.body.replaceChildren());

const rect = { x: 0, y: 0, width: 200, height: 48 };
const button = (over: Partial<MenuButton> = {}): MenuButton => ({
  key: "play",
  label: "Play",
  kind: "primary",
  rect,
  ...over,
});

async function mount(model: MenuButton) {
  const el = document.createElement("mc-menu-button");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-menu-button", () => {
  it("is an mc-button of its kind and label, and reflects kind and disabled", async () => {
    const el = await mount(button({ disabled: true, plain: true, wrap: true, keyshortcuts: "Enter", size: 14 }));
    const inner = el.shadowRoot!.querySelector("mc-button")!;
    expect(inner.getAttribute("kind")).toBe("primary");
    expect((inner as unknown as { label: string }).label).toBe("Play");
    expect(["plain", "wrap", "disabled"].every((name) => inner.hasAttribute(name))).toBe(true);
    expect(inner.getAttribute("aria-keyshortcuts")).toBe("Enter");
    expect(inner.getAttribute("style")).toContain("--mc-button-size:14px");
    expect(el.getAttribute("kind")).toBe("primary");
    expect(el.hasAttribute("disabled")).toBe(true);
  });

  it("hangs a count badge and a tag on the button as decoration, and names an icon for assistive tech", async () => {
    const el = await mount(
      button({
        badge: "3",
        tag: "BETA",
        icon: {
          rect: { x: 8, y: 8, width: 24, height: 24 },
          grid: 24,
          ops: [{ k: "circle", cx: 12, cy: 12, r: 8, fill: "currentColor" }],
          label: "Steam",
        },
      }),
    );
    expect(el.shadowRoot!.querySelector(".badge")!.textContent).toBe("3");
    expect(el.shadowRoot!.querySelector(".tag")!.textContent).toBe("BETA");
    expect(el.shadowRoot!.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe("Steam");
    expect(el.shadowRoot!.querySelectorAll("svg circle")).toHaveLength(1);
  });

  it("draws nothing without a model", async () => {
    const el = document.createElement("mc-menu-button");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-button")).toBeNull();
  });

  it("reports a tap through the grid as mc-activate with its key, and none for a disabled one", async () => {
    const grid = document.createElement("mc-menu-grid");
    grid.items = [button(), button({ key: "off", label: "Off", disabled: true })];
    document.body.append(grid);
    await grid.updateComplete;
    const seen: string[] = [];
    grid.addEventListener("mc-activate", (e) => seen.push((e as CustomEvent<{ key: string }>).detail.key));
    for (const key of ["play", "off"]) {
      const menu = grid.elementOf(key)!;
      await (menu as unknown as { updateComplete: Promise<unknown> }).updateComplete;
      tap(menu.shadowRoot!.querySelector("mc-button")!);
    }
    expect(seen).toEqual(["play"]);
  });
});
