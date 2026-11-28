// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-save-data-status.js";
import type { McSaveDataStatus } from "../McSaveDataStatus.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McSaveDataStatus> {
  const el = document.createElement("mc-save-data-status");
  el.input = { text: "Problem: no service", tone: "error", exportLabel: "Export" };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-save-data-status", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".mark")).not.toBeNull();
    expect(root.querySelector("[data-stop='status-export']")).not.toBeNull();
    expect(root.querySelector(".line")!.textContent).toContain("Problem: no service");
  });

  it("has no mark or Export on a plain status", async () => {
    const el = await mount();
    el.input = { text: "Done", tone: "ok", exportLabel: null };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".mark")).toBeNull();
    expect(el.shadowRoot!.querySelector("mc-hint-button")).toBeNull();
  });
});
