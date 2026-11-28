// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-past-games-file-button.js";
import type { McPastGamesFileButton } from "../McPastGamesFileButton.js";

afterEach(() => document.body.replaceChildren());

async function mount(disabled = false): Promise<McPastGamesFileButton> {
  const el = document.createElement("mc-past-games-file-button");
  el.model = { label: "Open a replay file", disabled };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-past-games-file-button", () => {
  it("is the open-file stop, with the folder mark, and says open-file when pressed", async () => {
    const el = await mount();
    const button = el.shadowRoot!.querySelector<HTMLElement & { label: string }>("mc-button")!;
    expect(button.dataset.stop).toBe("open-file");
    expect(button.label).toBe("Open a replay file");
    expect(el.shadowRoot!.querySelector("svg.icon")).not.toBeNull();
    const heard = vi.fn();
    el.addEventListener("mc-past-games", (event) => heard((event as CustomEvent).detail));
    button.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "open-file" });
  });

  it("dims the button and its mark while something runs", async () => {
    const el = await mount(true);
    expect(el.hasAttribute("disabled")).toBe(true);
    expect(el.shadowRoot!.querySelector<HTMLElement & { disabled: boolean }>("mc-button")!.disabled).toBe(true);
  });
});
