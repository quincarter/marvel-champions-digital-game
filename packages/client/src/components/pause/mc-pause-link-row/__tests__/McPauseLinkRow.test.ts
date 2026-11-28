// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-pause-link-row";
import type { PauseLinkInput } from "../../pause.types";

afterEach(() => document.body.replaceChildren());

const row = (over: Partial<PauseLinkInput> = {}): PauseLinkInput => ({
  stop: "quick:glossary",
  title: "Keyword glossary",
  detail: "3 terms on the table",
  variant: "panel",
  action: { type: "quick", id: "glossary" },
  ...over,
});

async function link(r: PauseLinkInput) {
  const el = document.createElement("mc-pause-link-row");
  el.row = r;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-link-row", () => {
  it("is a focus stop that raises its action, and draws a chevron", async () => {
    const el = await link(row());
    expect(el.getAttribute("data-stop")).toBe("quick:glossary");
    expect(el.shadowRoot!.querySelector(".chev")).not.toBeNull();
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.click();
    expect(seen).toEqual([{ action: { type: "quick", id: "glossary" }, hold: false }]);
  });

  it("draws a compact cell as its title alone, and a disabled row with no chevron that does nothing", async () => {
    const compact = await link(row({ variant: "compact", title: "Music" }));
    expect(compact.shadowRoot!.querySelector(".detail")).toBeNull();
    expect(compact.shadowRoot!.querySelector(".title")!.textContent).toBe("Music");
    const off = await link(row({ disabled: true }));
    expect(off.shadowRoot!.querySelector(".chev")).toBeNull();
    const seen: unknown[] = [];
    off.addEventListener("mc-pressed", () => seen.push(1));
    off.click();
    expect(seen).toEqual([]);
  });

  it("marks what a search matched in a result's title and detail, and shows where it was found", async () => {
    const el = await link(
      row({
        variant: "result",
        title: "Card size",
        detail: "Bigger cards",
        place: "Settings",
        titleRanges: [{ start: 0, end: 4 }],
        detailRanges: [{ start: 7, end: 12 }],
      }),
    );
    const marks = [...el.shadowRoot!.querySelectorAll("mark")].map((m) => m.textContent);
    expect(marks).toEqual(["Card", "cards"]);
    expect(el.shadowRoot!.querySelector(".place")!.textContent).toBe("Settings");
  });
});
