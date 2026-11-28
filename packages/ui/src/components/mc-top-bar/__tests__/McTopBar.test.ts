import { afterEach, describe, expect, it } from "vitest";
import "../mc-top-bar.js";
import "../../mc-hint-button/mc-hint-button.js";

afterEach(() => document.body.replaceChildren());

async function bar(props: Record<string, unknown>) {
  const el = document.createElement("mc-top-bar");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-top-bar", () => {
  it("prints the title and the right-hand label, and a Back button that is the back focus stop", async () => {
    const el = await bar({ heading: "Choose a scenario", right: "Step 1 of 4", backLabel: "Back" });
    expect(el.shadowRoot!.querySelector(".title")!.textContent).toBe("Choose a scenario");
    expect(el.shadowRoot!.querySelector(".right")!.textContent).toBe("Step 1 of 4");
    expect(el.shadowRoot!.querySelector<HTMLElement>("mc-hint-button")!.dataset.stop).toBe("back");
  });

  it("has no Back button without a label, and keeps its glyph off a compact (phone) bar", async () => {
    const none = await bar({ heading: "T" });
    expect(none.shadowRoot!.querySelector("mc-hint-button")).toBeNull();
    const glyph = { specs: [{ kind: "key", label: "Esc" }], height: 16, ground: "ink", expanded: true, still: true };
    const phone = await bar({ heading: "T", backLabel: "Back", backGlyph: glyph, compact: true });
    expect(phone.shadowRoot!.querySelector<HTMLElement & { glyph: unknown }>("mc-hint-button")!.glyph).toBeNull();
  });

  it("drops its title under the dark mode tab by the distance the screen gives", async () => {
    const el = await bar({ heading: "T", titleDrop: 18 });
    expect(el.style.getPropertyValue("--mc-title-drop")).toBe("18px");
  });
});
