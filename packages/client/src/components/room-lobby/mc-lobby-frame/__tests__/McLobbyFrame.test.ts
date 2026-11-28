// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-frame.js";
import type { McLobbyFrame } from "../McLobbyFrame.js";

afterEach(() => document.body.replaceChildren());

async function mount(heading: string): Promise<McLobbyFrame> {
  const element = document.createElement("mc-lobby-frame") as McLobbyFrame;
  element.heading = heading;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-frame", () => {
  it("shows its heading and a slot for the content", async () => {
    const element = await mount("Settings");
    expect(element.shadowRoot!.querySelector("h2")!.textContent).toBe("Settings");
    expect(element.shadowRoot!.querySelector(".body slot")).not.toBeNull();
  });

  it("has no heading row without a heading, and still offers the end slot", async () => {
    const element = await mount("");
    expect(element.shadowRoot!.querySelector("h2")).toBeNull();
    expect(element.shadowRoot!.querySelector('slot[name="end"]')).not.toBeNull();
  });
});
