import { afterEach, describe, expect, it } from "vitest";
import "../mc-dialog";

afterEach(() => document.body.replaceChildren());

const tap = (target: Element): void => {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0, pointerType: "touch" };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  target.dispatchEvent(new PointerEvent("pointerup", at));
};

async function dialog() {
  const el = document.createElement("mc-dialog");
  el.heading = "Search help";
  el.innerHTML = `<p>body</p><button slot="footer">Back</button>`;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-dialog", () => {
  it("draws its heading and puts the body and footer in their slots", async () => {
    const el = await dialog();
    expect(el.shadowRoot!.querySelector(".heading")!.textContent).toBe("Search help");
    expect(el.shadowRoot!.querySelector('slot[name="footer"]')).not.toBeNull();
    expect(el.scroller).not.toBeNull();
  });

  it("says dismiss for a tap on the scrim, and not for one inside the box", async () => {
    const el = await dialog();
    let dismissed = 0;
    el.addEventListener("mc-dialog-dismiss", () => dismissed++);
    tap(el.shadowRoot!.querySelector(".box")!);
    expect(dismissed).toBe(0);
    tap(el.shadowRoot!.querySelector(".scrim")!);
    expect(dismissed).toBe(1);
  });

  it("sets its widest from the width property", async () => {
    const el = await dialog();
    el.width = 720;
    await el.updateComplete;
    expect(el.style.getPropertyValue("--dialog-width")).toBe("720px");
  });
});
