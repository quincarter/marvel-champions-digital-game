import { afterEach, describe, expect, it } from "vitest";
import "../mc-section-heading";

afterEach(() => document.body.replaceChildren());

async function heading(set: (el: HTMLElementTagNameMap["mc-section-heading"]) => void) {
  const el = document.createElement("mc-section-heading");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-section-heading", () => {
  it("draws the title and its rule, and the right label beside them", async () => {
    const el = await heading((h) => {
      h.label = "Modular sets";
      h.right = "1 REQUIRED";
    });
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Modular sets");
    expect(root.querySelector(".rule")).not.toBeNull();
    expect(root.querySelector(".row .right")!.textContent).toBe("1 REQUIRED");
  });

  it("drops the right label under the heading when stacked", async () => {
    const el = await heading((h) => {
      h.label = "A";
      h.right = "B";
      h.stacked = true;
    });
    expect(el.shadowRoot!.querySelector(".row .right")).toBeNull();
    expect(el.shadowRoot!.querySelector(".stack")!.textContent).toBe("B");
  });

  it("draws no right label when it has none, and takes a slotted control", async () => {
    const el = await heading((h) => (h.label = "A"));
    expect(el.shadowRoot!.querySelector(".right")).toBeNull();
    expect(el.shadowRoot!.querySelector("slot")).not.toBeNull();
  });

  it("reflects onink", async () => {
    const el = await heading((h) => (h.onink = true));
    expect(el.hasAttribute("onink")).toBe(true);
  });
});
