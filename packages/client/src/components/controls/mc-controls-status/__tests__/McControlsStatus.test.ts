// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-controls-status.js";
import type { McControlsStatus } from "../McControlsStatus.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McControlsStatus> {
  const el = document.createElement("mc-controls-status");
  el.connected = true;
  el.text = "Xbox controller connected";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-controls-status", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector(".text")!.textContent).toBe("Xbox controller connected");
    expect(root.querySelector(".text")!.getAttribute("role")).toBe("status");
    expect(el.hasAttribute("connected")).toBe(true);
  });
});
