import { afterEach, describe, expect, it } from "vitest";
import "../../../controls/mc-chip/mc-chip";
import "../mc-close-bar";

afterEach(() => document.body.replaceChildren());

async function bar(set: (el: HTMLElementTagNameMap["mc-close-bar"]) => void) {
  const el = document.createElement("mc-close-bar");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-close-bar", () => {
  it("draws the title, a close stop and the end slot", async () => {
    const el = await bar((b) => {
      b.heading = "How to play";
      b.closeLabel = "Back";
    });
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("How to play");
    const close = root.querySelector<HTMLElement>("mc-chip.close")!;
    expect(close.dataset.stop).toBe("close");
    expect(close.getAttribute("aria-label")).toBe("Back");
    expect(root.querySelector('slot[name="end"]')).not.toBeNull();
  });

  it("takes the drop and the width the dark mode tab leaves it", async () => {
    const el = await bar((b) => {
      b.heading = "Lesson";
      b.drop = 18;
      b.max = 120;
    });
    const title = el.shadowRoot!.querySelector<HTMLElement>(".title")!;
    expect(title.style.getPropertyValue("--drop")).toBe("18px");
    expect(title.style.getPropertyValue("--max")).toBe("120px");
  });

  it("raises mc-pressed with the close action when the close is pressed", async () => {
    const el = await bar(() => undefined);
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.shadowRoot!.querySelector<HTMLElement>("mc-chip.close")!.click();
    expect(seen).toEqual([{ action: "close", hold: false }]);
  });
});
