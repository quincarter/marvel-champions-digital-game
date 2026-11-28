// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-seats-notice.js";
import type { McSeatsNotice } from "../McSeatsNotice.js";
import type { SeatsEvent } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

async function mount(text: string): Promise<McSeatsNotice> {
  const element = document.createElement("mc-seats-notice") as McSeatsNotice;
  element.text = text;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-seats-notice", () => {
  it("says its words and raises the conflict-notice action from its stop", async () => {
    const element = await mount("2 cards can't be played ▸");
    const button = element.shadowRoot!.querySelector<HTMLElement>('[data-stop="conflict-notice"]')!;
    expect(button.textContent).toBe("2 cards can't be played ▸");
    const seen: SeatsEvent[] = [];
    element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
    button.click();
    expect(seen).toEqual([{ type: "action", action: "conflict-notice" }]);
  });

  it("draws nothing without words", async () => {
    const element = await mount("");
    expect(element.shadowRoot!.querySelector("button")).toBeNull();
  });
});
