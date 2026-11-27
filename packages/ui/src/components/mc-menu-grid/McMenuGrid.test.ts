import { describe, expect, it } from "vitest";
import "./mc-menu-grid.js";
import type { MenuButton } from "../mc-menu-button/mc-menu-button.types.js";

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, button: 0 });
}

const item = (key: string, extra: Partial<MenuButton> = {}): MenuButton => ({
  key,
  label: key,
  kind: "secondary",
  rect: { x: 10, y: 20, width: 200, height: 44 },
  ...extra,
});

async function grid(items: readonly MenuButton[]) {
  const element = document.createElement("mc-menu-grid");
  element.items = items;
  document.body.append(element);
  await element.updateComplete;
  const buttons = [...element.renderRoot.querySelectorAll("mc-menu-button")];
  await Promise.all(buttons.map((button) => button.updateComplete));
  const activations: string[] = [];
  element.addEventListener("mc-activate", (event) =>
    activations.push((event as CustomEvent<{ key: string }>).detail.key),
  );
  return { element, buttons, activations };
}

const tap = (target: Element): void => {
  target.dispatchEvent(pointer("pointerdown", 5, 5));
  target.dispatchEvent(pointer("pointerup", 6, 6));
};

describe("mc-menu-grid", () => {
  it("places each button at its rect and finds it by key", async () => {
    const { element, buttons } = await grid([item("a"), item("b", { rect: { x: 0, y: 70, width: 90, height: 44 } })]);
    expect(buttons).toHaveLength(2);
    expect(buttons[1]!.getAttribute("style")).toContain("top:70px");
    expect(element.elementOf("b")).toBe(buttons[1]);
    expect(element.elementOf("missing")).toBeNull();
    element.remove();
  });

  it("reports a tap on a button with its key, and nothing for a disabled one", async () => {
    const { element, buttons, activations } = await grid([item("go"), item("off", { disabled: true })]);
    tap(buttons[0]!.renderRoot.querySelector("mc-button")!);
    tap(buttons[1]!.renderRoot.querySelector("mc-button")!);
    expect(activations).toEqual(["go"]);
    element.remove();
  });

  it("draws a button's badge, tag and icon over it without taking a press", async () => {
    const { element, buttons } = await grid([
      item("store", {
        badge: "3",
        tag: "BETA",
        icon: {
          rect: { x: 14, y: 8, width: 24, height: 24 },
          grid: 24,
          ops: [{ k: "circle", cx: 12, cy: 12, r: 10, stroke: "currentColor", sw: 2 }],
          label: "Played on Windows",
        },
      }),
    ]);
    const root = buttons[0]!.renderRoot;
    expect(root.querySelector(".badge")?.textContent).toBe("3");
    expect(root.querySelector(".tag")?.textContent).toBe("BETA");
    expect(root.querySelector(".icon svg circle")).not.toBeNull();
    expect(root.querySelector(".tip")?.textContent).toBe("Played on Windows");
    element.remove();
  });
});
