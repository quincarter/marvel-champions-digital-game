// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-game-actions.js";
import type { McPastGameActions } from "../McPastGameActions.js";

afterEach(() => document.body.replaceChildren());

const actions: McPastGameActions["actions"] = [
  { action: "watch", label: "Watch" },
  { action: "share", label: "Share link" },
  { action: "export", label: "Export" },
  { action: "log", label: "Log" },
];

async function mount(busy = false): Promise<McPastGameActions> {
  const el = document.createElement("mc-past-game-actions");
  el.gameId = "g1";
  el.actions = actions;
  el.busy = busy;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-game-actions", () => {
  it("has a stop for each action, Watch first and primary", async () => {
    const el = await mount();
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLElement & { kind: string }>("mc-button")];
    expect(buttons.map((button) => button.dataset.stop)).toEqual([
      "action:watch",
      "action:share",
      "action:export",
      "action:log",
    ]);
    expect(buttons.map((button) => button.kind)).toEqual(["primary", "secondary", "secondary", "secondary"]);
  });

  it("says which action on which game was pressed", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-past-games", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="action:export"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "action", id: "g1", action: "export" });
  });

  it("dims every button while one runs", async () => {
    const el = await mount(true);
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLElement & { disabled: boolean }>("mc-button")];
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});
