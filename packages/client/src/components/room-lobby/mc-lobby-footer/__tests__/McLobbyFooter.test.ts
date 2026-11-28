// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-footer.js";
import type { McLobbyFooter } from "../McLobbyFooter.js";
import type { LobbyEvent, LobbyFooterModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const START: LobbyFooterModel = {
  words: "Every seat needs a deck.",
  bold: false,
  hidden: false,
  buttons: [
    {
      stop: "start",
      label: "Start",
      kind: "primary",
      display: true,
      enabled: false,
      reason: "Every seat needs a deck.",
      command: { type: "footer", action: "start" },
    },
  ],
};

async function mount(model: LobbyFooterModel): Promise<McLobbyFooter> {
  const element = document.createElement("mc-lobby-footer") as McLobbyFooter;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-footer", () => {
  it("says its words under the footer-words key", async () => {
    const element = await mount({ ...START, buttons: [] });
    expect(element.shadowRoot!.querySelector('[data-key="footer-words"]')!.textContent).toBe(
      "Every seat needs a deck.",
    );
    expect(element.shadowRoot!.querySelector("mc-lobby-button")).toBeNull();
  });

  it("a Start that is off still raises blocked with its reason", async () => {
    const element = await mount(START);
    const seen: LobbyEvent[] = [];
    element.addEventListener("mc-room-lobby", (event) => seen.push((event as CustomEvent<LobbyEvent>).detail));
    const button = element.shadowRoot!.querySelector("mc-lobby-button") as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await button.updateComplete;
    button.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();
    expect(seen).toEqual([{ type: "blocked", reason: "Every seat needs a deck." }]);
  });

  it("hides while the keyboard covers it", async () => {
    const element = await mount({ ...START, hidden: true });
    expect(element.hasAttribute("hidden")).toBe(true);
  });
});
