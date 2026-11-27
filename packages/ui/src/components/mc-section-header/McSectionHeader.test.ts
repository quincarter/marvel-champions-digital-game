import { afterEach, describe, expect, it } from "vitest";
import "./mc-section-header.js";
import type { McSectionHeader } from "./McSectionHeader.js";

afterEach(() => document.body.replaceChildren());

async function mount(props: Partial<McSectionHeader> = {}): Promise<McSectionHeader> {
  const header = document.createElement("mc-section-header");
  Object.assign(header, props);
  document.body.append(header);
  await header.updateComplete;
  return header;
}

describe("mc-section-header", () => {
  it("draws its label at its size with a rule, and leaves the rule out when asked", async () => {
    const header = await mount({ label: "Undo", size: 20 });
    expect(header.shadowRoot!.querySelector(".label")?.textContent).toContain("Undo");
    expect(header.shadowRoot!.querySelector(".label")?.getAttribute("style")).toContain("font-size:20px");
    expect(header.shadowRoot!.querySelector(".rule")).not.toBeNull();
    header.rule = false;
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector(".rule")).toBeNull();
  });

  it("leaves the size to its look when none is given", async () => {
    const header = await mount({ label: "Heroes" });
    expect(header.shadowRoot!.querySelector(".label")?.hasAttribute("style")).toBe(false);
  });

  it("shows a count at the right, and under the row instead of in line with underline", async () => {
    const header = await mount({ label: "Heroes", count: "3 of 7", underline: true });
    expect(header.shadowRoot!.querySelector(".count")?.textContent).toBe("3 of 7");
    expect(header.shadowRoot!.querySelector(".head")?.classList.contains("under")).toBe(true);
    expect(header.shadowRoot!.querySelector(".rule")).toBeNull();
    header.underline = false;
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector(".rule")).not.toBeNull();
  });

  it("leads a folding section with a chevron that says whether it is open, never for a plain heading", async () => {
    const header = await mount({ label: "Heroes", level: "small", underline: true });
    expect(header.shadowRoot!.textContent).not.toMatch(/[▸▾]/);
    header.open = false;
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector(".label")?.textContent).toBe("▸ Heroes");
    header.open = true;
    await header.updateComplete;
    expect(header.shadowRoot!.querySelector(".label")?.textContent).toBe("▾ Heroes");
    expect(header.shadowRoot!.querySelector(".head")?.classList.contains("small")).toBe(true);
  });
});
