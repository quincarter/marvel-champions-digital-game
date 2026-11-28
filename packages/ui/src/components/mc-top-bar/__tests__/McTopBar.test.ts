import { afterEach, describe, expect, it } from "vitest";
import "../mc-top-bar.js";
import "../../mc-hint-button/mc-hint-button.js";
import "../../controls/mc-chip/mc-chip.js";
import { setThemeTab } from "../../../shared/theme-tab.js";

afterEach(() => {
  document.body.replaceChildren();
  setThemeTab(null);
});

async function bar(props: Record<string, unknown>, width = 0) {
  const el = document.createElement("mc-top-bar");
  // happy-dom lays nothing out: say how wide the bar is.
  Object.defineProperty(el, "clientWidth", { value: width });
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-top-bar", () => {
  it("prints the title and the right-hand label, and a Back button that is the back focus stop", async () => {
    const el = await bar({ heading: "Choose a scenario", right: "Step 1 of 4", backLabel: "Back" });
    expect(el.shadowRoot!.querySelector(".titles .title")!.textContent).toBe("Choose a scenario");
    expect(el.shadowRoot!.querySelector(".right")!.textContent).toBe("Step 1 of 4");
    expect(el.shadowRoot!.querySelector<HTMLElement>("mc-hint-button")!.dataset.stop).toBe("back");
  });

  it("prints an eyebrow over the title and a subtitle under it", async () => {
    const el = await bar({ heading: "T", eyebrow: "Over", subtitle: "Sub" });
    expect(el.shadowRoot!.querySelector(".eyebrow")!.textContent).toBe("Over");
    expect(el.shadowRoot!.querySelector(".subtitle")!.textContent).toBe("Sub");
  });

  it("has no Back button without a label, and keeps its glyph off a compact (phone) bar", async () => {
    const none = await bar({ heading: "T" });
    expect(none.shadowRoot!.querySelector("mc-hint-button")).toBeNull();
    const glyph = { specs: [{ kind: "key", label: "Esc" }], height: 16, ground: "ink", expanded: true, still: true };
    const phone = await bar({ heading: "T", backLabel: "Back", backGlyph: glyph, compact: true });
    expect(phone.shadowRoot!.querySelector<HTMLElement & { glyph: unknown }>("mc-hint-button")!.glyph).toBeNull();
  });

  it("holds a slotted control at its right end", async () => {
    const el = await bar({ heading: "T" });
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="end"]');
    expect(slot!.closest(".end")).not.toBeNull();
  });

  it("draws a close x with the close stop in the close variant, and raises mc-press for it", async () => {
    const el = await bar({ heading: "Lesson", variant: "close", backLabel: "Back" });
    const close = el.shadowRoot!.querySelector<HTMLElement>("mc-chip.close")!;
    expect(close.dataset.stop).toBe("close");
    expect(close.getAttribute("aria-label")).toBe("Back");
    let pressed = 0;
    el.addEventListener("mc-press", () => (pressed += 1));
    close.dispatchEvent(
      new CustomEvent("mc-pressed", { detail: { action: "close", hold: false }, bubbles: true, composed: true }),
    );
    expect(pressed).toBe(1);
  });

  it("drops its title to its own row while the dark mode tab is up on a narrow bar, and keeps it with no tab", async () => {
    const el = await bar({ heading: "Rules", backLabel: "Back" }, 375);
    expect(el.hasAttribute("dropped")).toBe(false);
    setThemeTab({ left: 170, right: 214, bottom: 32 });
    expect(el.hasAttribute("dropped")).toBe(true);
    expect(el.style.getPropertyValue("--mc-top-bar-first-row")).toBe("40px");
    setThemeTab(null);
    expect(el.hasAttribute("dropped")).toBe(false);
  });

  it("keeps a short title beside Back on a wide bar, since the tab sits well clear of it", async () => {
    setThemeTab({ left: 490, right: 534, bottom: 38 });
    const el = await bar({ heading: "Rules", backLabel: "Back" }, 1024);
    expect(el.hasAttribute("dropped")).toBe(false);
  });
});
