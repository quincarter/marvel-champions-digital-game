import { describe, expect, it } from "vitest";
import "./mc-credits-list.js";
import type { CreditsListRow } from "./McCreditsList.js";

const rows: CreditsListRow[] = [
  { kind: "notice", text: "A fan project." },
  { kind: "section", title: "Card scans", count: "2" },
  {
    kind: "entry",
    title: "Core Set",
    lines: [
      { text: "Shown in: every card", tone: "small" },
      { text: "Scans by the community", tone: "body" },
    ],
  },
];

async function mounted(): Promise<HTMLElementTagNameMap["mc-credits-list"]> {
  const list = document.createElement("mc-credits-list");
  list.rows = rows;
  document.body.append(list);
  await list.updateComplete;
  return list;
}

describe("mc-credits-list", () => {
  it("draws the notice, each section with its count, and each entry's lines in order", async () => {
    const list = await mounted();
    const root = list.shadowRoot!;
    expect(root.querySelector(".notice")?.textContent).toBe("A fan project.");
    expect(root.querySelector(".section h2")?.textContent).toBe("Card scans");
    expect(root.querySelector(".section .count")?.textContent).toBe("2");
    const lines = [...root.querySelectorAll(".entry p")].map((p) => [p.className, p.textContent]);
    expect(lines).toEqual([
      ["title", "Core Set"],
      ["small", "Shown in: every card"],
      ["body", "Scans by the community"],
    ]);
    list.remove();
  });

  it("finds a row's element and the scroller for the focus ring and paging", async () => {
    const list = await mounted();
    expect(list.rowElement(2)?.classList.contains("entry")).toBe(true);
    expect(list.scroller?.classList.contains("scroller")).toBe(true);
    list.remove();
  });
});
