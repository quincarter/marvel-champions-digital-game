// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-link-list";
import type { LinkListRow } from "../mc-link-list.types";
import type { LearnEventDetail } from "../../shared/learn-events.types";

afterEach(() => document.body.replaceChildren());

const ROWS: LinkListRow[] = [
  { stop: "box:core", heading: "Core rules added later", detail: "3 entries", action: { type: "box", id: "core" } },
  { stop: "box:mg", heading: "New in Mutant Genesis", detail: "5 entries", action: { type: "box", id: "mg" } },
];

async function list(rows: LinkListRow[], columns = 1) {
  const el = document.createElement("mc-link-list");
  el.heading = "NEW IN EACH BOX";
  el.rows = rows;
  el.columns = columns;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-link-list", () => {
  it("draws its label and a row per entry with its stop", async () => {
    const el = await list(ROWS, 2);
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>("mc-link-row")];
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("NEW IN EACH BOX");
    expect(rows.map((row) => row.dataset.stop)).toEqual(["box:core", "box:mg"]);
    expect(rows[1]!.getAttribute("detail")).toBe("5 entries");
    expect(el.getAttribute("columns")).toBe("2");
  });

  it("draws nothing without rows", async () => {
    expect((await list([])).shadowRoot!.querySelector(".label")).toBeNull();
  });

  it("raises the pressed row's own event as mc-learn", async () => {
    const el = await list(ROWS);
    const heard: LearnEventDetail[] = [];
    el.addEventListener("mc-learn", (e) => heard.push(e.detail));
    el.shadowRoot!.querySelectorAll<HTMLElement>("mc-link-row")[1]!.click();
    expect(heard).toEqual([{ type: "box", id: "mg" }]);
  });
});
