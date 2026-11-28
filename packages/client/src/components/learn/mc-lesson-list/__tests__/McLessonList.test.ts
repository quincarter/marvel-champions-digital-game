// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lesson-list";
import type { LessonRowModel } from "../../mc-lesson-row/mc-lesson-row.types";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

const lesson = (id: string, index: number): LessonRowModel => ({
  id,
  index,
  title: id,
  done: false,
  recommended: index === 1,
  doneLabel: "✓ Done",
  nextLabel: "NEXT",
});

async function list(lessons: LessonRowModel[]) {
  const el = document.createElement("mc-lesson-list");
  el.heading = "THE BASICS";
  el.lessons = lessons;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-lesson-list", () => {
  it("draws its label and a row per lesson, in order", async () => {
    const el = await list([lesson("how-to-win", 1), lesson("paying", 2)]);
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("THE BASICS");
    expect(el.shadowRoot!.querySelectorAll("mc-lesson-row")).toHaveLength(2);
  });

  it("draws nothing without lessons", async () => {
    const el = await list([]);
    expect(el.shadowRoot!.querySelector(".label")).toBeNull();
  });

  it("turns a press on a row into one mc-learn lesson event", async () => {
    const el = await list([lesson("how-to-win", 1)]);
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    const row = el.shadowRoot!.querySelector("mc-lesson-row")!;
    row.shadowRoot!.querySelector<HTMLElement>("mc-link-row")!.click();
    expect(heard).toEqual([{ type: "lesson", id: "how-to-win" }]);
  });
});
