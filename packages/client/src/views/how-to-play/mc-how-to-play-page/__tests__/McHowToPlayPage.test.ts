// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-how-to-play-page";
import type { HowToPlayPageModel } from "../mc-how-to-play-page.types";
import type { LearnEventDetail } from "../../../../components/learn/shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

const MODEL: HowToPlayPageModel = {
  header: { heading: "How to play", closeLabel: "Back", glyph: undefined },
  lessons: {
    heading: "THE BASICS",
    rows: [
      {
        id: "how-to-win",
        index: 1,
        title: "How to win",
        done: false,
        recommended: true,
        doneLabel: "✓ Done",
        nextLabel: "NEXT",
      },
    ],
  },
  aspects: {
    heading: "ASPECTS",
    rows: [{ aspect: "justice", name: "Justice", tagline: "Thwarting", done: false, doneLabel: "✓ Done" }],
  },
  reference: {
    heading: "REFERENCE",
    rows: [{ stop: "reference", heading: "Rules & glossary", detail: "Every keyword", action: { type: "reference" } }],
  },
  boxes: { heading: "NEW IN EACH BOX", rows: [] },
  continue: { label: "Continue learning ▸", starting: false },
};

async function page(model: HowToPlayPageModel | null = MODEL, mode: "wide" | "narrow" = "wide") {
  const el = document.createElement("mc-how-to-play-page");
  el.mode = mode;
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-how-to-play-page", () => {
  it("composes the header, the lists and the continue bar", async () => {
    const root = (await page()).shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-lesson-list", "mc-aspect-list", "mc-continue-bar"])
      expect(root.querySelectorAll(tag), tag).toHaveLength(1);
    expect(root.querySelectorAll("mc-link-list")).toHaveLength(2);
    expect(root.querySelector('mc-link-list[heading="NEW IN EACH BOX"]')!.getAttribute("columns")).toBe("2");
  });

  it("lays the box rows in one column on a narrow screen and draws nothing without a model", async () => {
    const narrow = await page(MODEL, "narrow");
    expect(narrow.shadowRoot!.querySelector('mc-link-list[heading="NEW IN EACH BOX"]')!.getAttribute("columns")).toBe(
      "1",
    );
    const none = await page(null);
    expect(none.shadowRoot!.querySelector("mc-lesson-list")).toBeNull();
  });

  it("lets one mc-learn event through from a lesson row", async () => {
    const el = await page();
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    const list = el.shadowRoot!.querySelector("mc-lesson-list")!;
    list.shadowRoot!.querySelector("mc-lesson-row")!.shadowRoot!.querySelector<HTMLElement>("mc-link-row")!.click();
    expect(heard).toEqual([{ type: "lesson", id: "how-to-win" }]);
    expect(el.scroller).not.toBeNull();
  });
});
