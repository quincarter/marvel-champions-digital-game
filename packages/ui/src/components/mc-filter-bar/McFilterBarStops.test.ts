import { afterEach, describe, expect, it, vi } from "vitest";
import "./mc-filter-bar.js";
import type { McFilterBar } from "./McFilterBar.js";

afterEach(() => document.body.replaceChildren());

const chips = [
  { id: "tag:a", label: "a", selected: false },
  { id: "tag:b", label: "b", selected: true },
];

async function bar(stops: boolean): Promise<McFilterBar> {
  const el = document.createElement("mc-filter-bar");
  Object.assign(el, { chips, prefix: "chip:", stops });
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-filter-bar as focus stops", () => {
  it("marks each chip with data-stop (its key) only when asked", async () => {
    const on = await bar(true);
    expect([...on.shadowRoot!.querySelectorAll("mc-filter-chip")].map((c) => c.getAttribute("data-stop"))).toEqual([
      "chip:tag:a",
      "chip:tag:b",
    ]);
    on.remove();
    const off = await bar(false);
    expect(off.shadowRoot!.querySelector("mc-filter-chip")!.hasAttribute("data-stop")).toBe(false);
  });

  it("presses a chip when the route click()s its stop, and raises mc-activate with its id", async () => {
    const el = await bar(true);
    const heard = vi.fn();
    el.addEventListener("mc-activate", (event) => heard((event as CustomEvent).detail));
    const chip = el.shadowRoot!.querySelector<HTMLElement>('[data-stop="chip:tag:a"]')!;
    await (chip as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    chip.click();
    expect(heard).toHaveBeenCalledWith({ key: "chip:tag:a", id: "tag:a" });
  });
});
