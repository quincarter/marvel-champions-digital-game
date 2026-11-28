// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-aspect-row";
import type { AspectRowModel } from "../mc-aspect-row.types";

afterEach(() => document.body.replaceChildren());

const ASPECT: AspectRowModel = {
  aspect: "justice",
  name: "Justice",
  tagline: "Thwarting",
  done: false,
  doneLabel: "✓ Done",
};

async function row(model: AspectRowModel) {
  const el = document.createElement("mc-aspect-row");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-aspect-row", () => {
  it("draws the aspect's chip with its name and its tagline, and is the aspect's stop", async () => {
    const el = await row(ASPECT);
    const root = el.shadowRoot!;
    const chip = root.querySelector("mc-aspect-chip")!;
    expect(chip.getAttribute("aspect")).toBe("justice");
    expect(chip.getAttribute("label")).toBe("Justice");
    expect(root.querySelector(".tagline")!.textContent).toBe("Thwarting");
    expect(root.querySelector<HTMLElement>("mc-link-row")!.dataset.stop).toBe("aspect:justice");
    expect(root.querySelector(".done")).toBeNull();
  });

  it("says DONE once the aspect's lesson is finished", async () => {
    const el = await row({ ...ASPECT, done: true });
    expect(el.shadowRoot!.querySelector(".done")!.textContent).toBe("✓ Done");
  });

  it("raises its aspect as the pressed action", async () => {
    const el = await row(ASPECT);
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.shadowRoot!.querySelector<HTMLElement>("mc-link-row")!.click();
    expect(seen).toEqual([{ action: { type: "aspect", aspect: "justice" }, hold: false }]);
  });
});
