// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-unlocks-switches.js";
import type { McUnlocksSwitches } from "../McUnlocksSwitches.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McUnlocksSwitches> {
  const el = document.createElement("mc-unlocks-switches");
  el.all = { title: "All", detail: "d", state: "OFF", on: false };
  el.printAndPlay = { title: "PnP", detail: "d", state: "ON", on: true };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-unlocks-switches", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const rows = [...root.querySelectorAll("mc-switch-row")];
    expect(rows.map((r) => r.getAttribute("data-stop"))).toEqual(["row:all", "row:pnp"]);
  });

  it("says which switch was pressed as one mc-unlocks event", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-unlocks", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-switch-row")!.dispatchEvent(
      new CustomEvent("mc-pressed", {
        detail: { action: { type: "all" }, hold: false },
        bubbles: true,
        composed: true,
      }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "all" });
  });
});
