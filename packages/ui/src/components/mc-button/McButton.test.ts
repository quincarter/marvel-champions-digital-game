import { describe, expect, it } from "vitest";
import "./mc-button.js";

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, button: 0 });
}

async function button(): Promise<{ element: HTMLElementTagNameMap["mc-button"]; presses: () => number }> {
  const element = document.createElement("mc-button");
  element.label = "On";
  document.body.append(element);
  await element.updateComplete;
  let count = 0;
  element.addEventListener("mc-press", () => count++);
  return { element, presses: () => count };
}

describe("mc-button", () => {
  it("presses on a tap: down and up on it, close together", async () => {
    const { element, presses } = await button();
    element.dispatchEvent(pointer("pointerdown", 10, 10));
    element.dispatchEvent(pointer("pointerup", 13, 12));
    expect(presses()).toBe(1);
    element.remove();
  });

  it("does not press when the finger lifts over it at the end of a swipe", async () => {
    const { element, presses } = await button();
    // A swipe that began elsewhere: only the lift lands here.
    element.dispatchEvent(pointer("pointerup", 10, 10));
    // A swipe that began here but travelled.
    element.dispatchEvent(pointer("pointerdown", 10, 10));
    element.dispatchEvent(pointer("pointermove", 10, 60));
    element.dispatchEvent(pointer("pointerup", 10, 12));
    // A list scrolled under the finger between the press and the lift.
    element.dispatchEvent(pointer("pointerdown", 10, 10));
    window.dispatchEvent(new Event("scroll"));
    element.dispatchEvent(pointer("pointerup", 10, 10));
    expect(presses()).toBe(0);
    element.remove();
  });

  it("does not press when a list it sits in scrolled under the press, even inside a shadow root", async () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const scroller = document.createElement("div");
    Object.assign(scroller.style, { height: "40px", overflow: "auto" });
    const element = document.createElement("mc-button");
    scroller.append(element);
    root.append(scroller);
    document.body.append(host);
    await element.updateComplete;
    let count = 0;
    element.addEventListener("mc-press", () => count++);
    element.dispatchEvent(pointer("pointerdown", 10, 10));
    // The scroll event of an element inside a shadow root is not composed: only its offset tells.
    scroller.scrollTop = 30;
    element.dispatchEvent(pointer("pointerup", 10, 10));
    expect(count).toBe(0);
    scroller.scrollTop = 0;
    element.dispatchEvent(pointer("pointerdown", 10, 10));
    element.dispatchEvent(pointer("pointerup", 10, 10));
    expect(count).toBe(1);
    host.remove();
  });

  it("does nothing while disabled, and reflects its state for the stylesheet", async () => {
    const { element, presses } = await button();
    element.disabled = true;
    element.selected = true;
    await element.updateComplete;
    element.dispatchEvent(pointer("pointerdown", 10, 10));
    element.dispatchEvent(pointer("pointerup", 10, 10));
    expect(presses()).toBe(0);
    expect(element.hasAttribute("disabled")).toBe(true);
    expect(element.hasAttribute("selected")).toBe(true);
    expect(element.shadowRoot!.querySelector(".label")!.textContent).toBe("On");
    element.remove();
  });
});
