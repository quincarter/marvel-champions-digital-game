// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-page";
import { pauseModel } from "../../../../components/pause/test-support";
import type { PausePageModel } from "../../../../components/pause/pause.types";
import type { PauseEventDetail } from "../../../../components/pause/shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

async function page(model: PausePageModel) {
  const el = document.createElement("mc-pause-page");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const tags = (el: HTMLElement): string[] =>
  [...el.shadowRoot!.querySelectorAll("*")].map((n) => n.localName).filter((n) => n.startsWith("mc-"));

describe("mc-pause-page", () => {
  it("composes the ink menu and the search over the rules and the log on a wide screen", async () => {
    const el = await page(pauseModel());
    expect(el.getAttribute("mode")).toBe("wide");
    const names = tags(el);
    for (const tag of [
      "mc-pause-header",
      "mc-pause-menu",
      "mc-search-field",
      "mc-pause-rules",
      "mc-pause-log",
      "mc-pause-confirm",
    ])
      expect(names).toContain(tag);
    expect(names).not.toContain("mc-pause-table");
    expect(el.shadowRoot!.querySelector(".right.ink")).toBeNull();
  });

  it("swaps the rules for the full log, and for the results (on an ink pane) when something is typed", async () => {
    const full = await page(pauseModel({ logExpanded: true }));
    expect(tags(full)).not.toContain("mc-pause-rules");
    expect(tags(full)).toContain("mc-pause-log");
    const found = await page(
      pauseModel({
        searching: true,
        results: { note: "Searching…", groups: [] },
        search: { value: "so", placeholder: "", clearLabel: "" },
      }),
    );
    expect(tags(found)).toContain("mc-pause-results");
    expect(found.shadowRoot!.querySelector(".right.ink")).not.toBeNull();
    expect(found.searchField!.value).toBe("so");
  });

  it("is one sheet with the Reference and Table groups on a phone, and the log in place of the Table when open", async () => {
    const el = await page(pauseModel({ mode: "phone" }));
    const names = tags(el);
    expect(names).toContain("mc-pause-quick");
    expect(names).toContain("mc-pause-table");
    expect(names).not.toContain("mc-pause-rules");
    el.model = pauseModel({ mode: "phone", logExpanded: true });
    await el.updateComplete;
    expect(tags(el)).not.toContain("mc-pause-table");
    expect(tags(el)).toContain("mc-pause-log");
  });

  it("covers the sheet with the confirm and makes it inert while it is up", async () => {
    const el = await page(pauseModel({ confirm: { sentence: "Concede?", yes: "Yes", cancel: "Cancel" } }));
    expect(el.shadowRoot!.querySelector(".stage")!.hasAttribute("inert")).toBe(true);
    expect(el.shadowRoot!.querySelector("mc-pause-confirm")!.shadowRoot!.querySelector(".dialog")).not.toBeNull();
  });

  it("lets a section's event bubble out of the page", async () => {
    const el = await page(pauseModel());
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector("mc-pause-menu")!
      .shadowRoot!.querySelector<HTMLElement>('[data-stop="resume"]')!
      .dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(seen).toEqual([{ type: "menu", id: "resume" }]);
  });
});
