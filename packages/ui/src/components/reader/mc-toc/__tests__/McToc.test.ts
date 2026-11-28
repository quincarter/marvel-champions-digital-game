import { afterEach, describe, expect, it, vi } from "vitest";
import "../mc-toc";

afterEach(() => document.body.replaceChildren());

async function toc(set: (el: HTMLElementTagNameMap["mc-toc"]) => void) {
  const el = document.createElement("mc-toc");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-toc", () => {
  it("draws a row per section, each a focus stop, and marks the open one", async () => {
    const el = await toc((t) => {
      t.rows = [
        { key: "toc:0", title: "Cover" },
        { key: "toc:1", title: "Setup" },
      ];
      t.selected = "toc:1";
    });
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".row")];
    expect(rows.map((row) => row.dataset.stop)).toEqual(["toc:0", "toc:1"]);
    expect(rows[1]!.hasAttribute("data-selected")).toBe(true);
    expect(rows[0]!.getAttribute("aria-current")).toBe("false");
  });

  it("answers a pointer-less click (the focus route's Enter) with its key", async () => {
    const el = await toc((t) => (t.rows = [{ key: "toc:0", title: "Cover" }]));
    const heard = vi.fn();
    el.addEventListener("mc-activate", (event) => heard((event as CustomEvent<{ key: string }>).detail.key));
    el.shadowRoot!.querySelector<HTMLElement>(".row")!.click();
    expect(heard).toHaveBeenCalledWith("toc:0");
  });

  it("says why it is empty when it has a message", async () => {
    const el = await toc((t) => (t.empty = "Nothing matches."));
    expect(el.shadowRoot!.querySelector("mc-empty-state")!.getAttribute("message")).toBe("Nothing matches.");
  });
});
