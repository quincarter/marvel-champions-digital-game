// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-unlocks-guide.js";
import type { McUnlocksGuide } from "../McUnlocksGuide.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McUnlocksGuide> {
  const el = document.createElement("mc-unlocks-guide");
  el.sections = [{ heading: "Points", paragraphs: ["One"], bullets: ["a", "b"] }];
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-unlocks-guide", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("h3")!.textContent).toBe("Points");
    expect(root.querySelectorAll("li").length).toBe(2);
    expect(root.querySelector("[data-key='guide-text']")).not.toBeNull();
  });
});
