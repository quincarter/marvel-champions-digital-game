import { afterEach, describe, expect, it } from "vitest";
import "../mc-link-row";

afterEach(() => document.body.replaceChildren());

async function row(set: (el: HTMLElementTagNameMap["mc-link-row"]) => void) {
  const el = document.createElement("mc-link-row");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-link-row", () => {
  it("draws its heading and detail and a chevron by default", async () => {
    const el = await row((r) => {
      r.heading = "Rules & glossary";
      r.detail = "Every rule";
    });
    const root = el.shadowRoot!;
    expect(root.querySelector(".heading")!.textContent).toBe("Rules & glossary");
    expect(root.querySelector(".detail")!.textContent).toBe("Every rule");
    expect(root.querySelector(".chev")!.textContent).toBe("▸");
  });

  it("leaves out an empty detail and reflects the emphasis", async () => {
    const el = await row((r) => {
      r.heading = "Lesson";
      r.emphasis = true;
    });
    expect(el.shadowRoot!.querySelector(".detail")).toBeNull();
    expect(el.hasAttribute("emphasis")).toBe(true);
  });

  it("raises mc-pressed with its action on click()", async () => {
    const el = await row((r) => {
      r.stop = "reference";
      r.action = { type: "reference" };
    });
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.click();
    expect(seen).toEqual([{ action: { type: "reference" }, hold: false }]);
    expect(el.dataset.stop).toBe("reference");
  });
});
