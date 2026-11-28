// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-unlocks-list.js";
import type { McUnlocksList } from "../McUnlocksList.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McUnlocksList> {
  const el = document.createElement("mc-unlocks-list");
  el.rows = [
    { kind: "section", id: "s", title: "Core" },
    { kind: "wave", id: "w1", title: "Wave 1", status: "Open", open: true },
    { kind: "switch", id: "h1", title: "Hero", detail: "d", state: "OFF", on: false, stop: true, unavailable: false },
    {
      kind: "switch",
      id: "sc1",
      title: "Scenario",
      detail: "d",
      state: "Earned",
      on: false,
      stop: false,
      unavailable: true,
    },
  ];
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-unlocks-list", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".section")!.textContent).toBe("Core");
    expect(root.querySelector(".wave-title")!.textContent).toBe("Wave 1");
    const rows = [...root.querySelectorAll("mc-switch-row")];
    expect(rows.map((r) => r.getAttribute("data-stop"))).toEqual(["row:h1", ""]);
    expect(el.rowElement("h1")).not.toBeNull();
    expect(el.scroller).not.toBeNull();
  });
});
