// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-aspect-list";
import type { AspectRowModel } from "../../mc-aspect-row/mc-aspect-row.types";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

const aspect = (name: string): AspectRowModel => ({
  aspect: name,
  name,
  tagline: `${name} tagline`,
  done: false,
  doneLabel: "✓ Done",
});

async function list(rows: AspectRowModel[]) {
  const el = document.createElement("mc-aspect-list");
  el.heading = "ASPECTS";
  el.aspects = rows;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-aspect-list", () => {
  it("draws its label and a row per aspect", async () => {
    const el = await list([aspect("justice"), aspect("aggression")]);
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("ASPECTS");
    expect(el.shadowRoot!.querySelectorAll("mc-aspect-row")).toHaveLength(2);
  });

  it("draws nothing without aspects", async () => {
    expect((await list([])).shadowRoot!.querySelector(".label")).toBeNull();
  });

  it("turns a press on a row into one mc-learn aspect event", async () => {
    const el = await list([aspect("justice")]);
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    el.shadowRoot!.querySelector("mc-aspect-row")!.shadowRoot!.querySelector<HTMLElement>("mc-link-row")!.click();
    expect(heard).toEqual([{ type: "aspect", aspect: "justice" }]);
  });
});
