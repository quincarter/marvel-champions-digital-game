// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lesson-row";
import type { LessonRowModel } from "../mc-lesson-row.types";

afterEach(() => document.body.replaceChildren());

const LESSON: LessonRowModel = {
  id: "paying-for-cards",
  index: 2,
  title: "Paying for cards",
  done: false,
  recommended: false,
  doneLabel: "✓ Done",
  nextLabel: "NEXT",
};

async function row(model: LessonRowModel) {
  const el = document.createElement("mc-lesson-row");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const link = (el: HTMLElement) => el.shadowRoot!.querySelector("mc-link-row")!;

describe("mc-lesson-row", () => {
  it("draws its number, its title and a quiet chevron until it is done or next", async () => {
    const el = await row(LESSON);
    expect(link(el).getAttribute("heading")).toBe("Paying for cards");
    expect(link(el).dataset.stop).toBe("lesson:paying-for-cards");
    expect(el.shadowRoot!.querySelector(".badge")!.textContent).toBe("2");
    expect(el.shadowRoot!.querySelector('[slot="trail"]')).toBeNull();
  });

  it("marks a done row with a check in the badge and the word DONE", async () => {
    const el = await row({ ...LESSON, done: true });
    expect(el.shadowRoot!.querySelector(".badge")!.textContent).toBe("✓");
    expect(el.shadowRoot!.querySelector(".badge")!.hasAttribute("data-done")).toBe(true);
    expect(el.shadowRoot!.querySelector(".done")!.textContent).toBe("✓ Done");
  });

  it("steers to the recommended row with a heavy outline and a NEXT stamp", async () => {
    const el = await row({ ...LESSON, recommended: true });
    expect(link(el).hasAttribute("emphasis")).toBe(true);
    expect(el.shadowRoot!.querySelector("mc-stamp")!.getAttribute("label")).toBe("NEXT");
  });

  it("raises its lesson as the pressed action", async () => {
    const el = await row(LESSON);
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    link(el).click();
    expect(seen).toEqual([{ action: { type: "lesson", id: "paying-for-cards" }, hold: false }]);
  });
});
