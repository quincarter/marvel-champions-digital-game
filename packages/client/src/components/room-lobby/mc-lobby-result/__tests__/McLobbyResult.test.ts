// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-result.js";
import type { McLobbyResult } from "../McLobbyResult.js";
import type { LobbyStartResultModel } from "../mc-lobby-result.types.js";

afterEach(() => document.body.replaceChildren());

const MODEL: LobbyStartResultModel = {
  headline: "The game did not start",
  lines: ["Seat 1 (Ana): Spider-Man, deck too small", "Seat 2: no deck"],
  dismiss: { stop: "start-result-dismiss", label: "Dismiss", kind: "secondary", command: { type: "dismiss-result" } },
};

async function mount(model: LobbyStartResultModel | null): Promise<McLobbyResult> {
  const element = document.createElement("mc-lobby-result") as McLobbyResult;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-result", () => {
  it("draws nothing without a model", async () => {
    const element = await mount(null);
    expect(element.shadowRoot!.querySelector(".box")).toBeNull();
  });

  it("shows the headline with its mark and a line per seat", async () => {
    const element = await mount(MODEL);
    const root = element.shadowRoot!;
    expect(root.querySelector(".headline")?.textContent).toBe("The game did not start");
    expect(root.querySelector(".mark")?.textContent).toBe("!");
    expect([...root.querySelectorAll(".line")].map((l) => l.textContent)).toEqual(MODEL.lines);
  });

  it("presses Dismiss with the model's own command", async () => {
    const element = await mount(MODEL);
    const button = element.shadowRoot!.querySelector("mc-lobby-button")!;
    await (button as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const seen: unknown[] = [];
    element.addEventListener("mc-pressed", (event) => seen.push((event as CustomEvent).detail.action));
    button.shadowRoot!.querySelector<HTMLElement>("mc-button")!.click();
    expect(seen).toEqual([{ type: "dismiss-result" }]);
  });
});
