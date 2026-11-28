// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-button.js";
import type { McLobbyButton } from "../McLobbyButton.js";
import { commandKeyOf, meaningOf } from "../mc-lobby-button.types.js";
import type { LobbyButtonModel, LobbyEvent } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const REMOVE: LobbyEvent = { type: "seat", seat: "s1", action: "remove", participant: "p2" };
const MODEL: LobbyButtonModel = { stop: "seat:s1", label: "Remove", kind: "secondary", command: REMOVE };

async function mount(model: LobbyButtonModel): Promise<McLobbyButton> {
  const element = document.createElement("mc-lobby-button") as McLobbyButton;
  element.model = model;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const pressed = (element: McLobbyButton): unknown[] => {
  const seen: unknown[] = [];
  element.addEventListener("mc-pressed", (event) => seen.push((event as CustomEvent).detail.action));
  return seen;
};

const inner = (element: McLobbyButton): HTMLElement => element.shadowRoot!.querySelector("mc-button")!;

describe("mc-lobby-button", () => {
  it("puts its stop on the inner button and raises its command when the stop is pressed", async () => {
    const element = await mount(MODEL);
    const seen = pressed(element);
    expect(inner(element).dataset.stop).toBe("seat:s1");
    inner(element).click();
    expect(seen).toEqual([REMOVE]);
  });

  it("stamps a meaning that names the command, its target and its look", async () => {
    const element = await mount(MODEL);
    const before = element.dataset.meaning;
    expect(before).toBe(meaningOf(REMOVE, "secondary", "Remove", true, ""));
    expect(element.dataset.meaningStop).toBe("seat:s1");
    element.command = { type: "seat", seat: "s1", action: "remove", participant: "p3" };
    await element.updateComplete;
    expect(element.dataset.meaning).not.toBe(before);
    element.label = "Leave";
    await element.updateComplete;
    expect(element.dataset.meaning).toContain("|Leave|");
  });

  it("raises blocked with its reason while off, and nothing without one", async () => {
    const element = await mount({ ...MODEL, enabled: false, reason: "Every seat needs a deck." });
    const seen = pressed(element);
    inner(element).click();
    expect(seen).toEqual([{ type: "blocked", reason: "Every seat needs a deck." }]);
    element.reason = "";
    await element.updateComplete;
    inner(element).click();
    expect(seen).toHaveLength(1);
  });

  it("does not let the inner press reach the page", async () => {
    const element = await mount(MODEL);
    let leaked = 0;
    document.body.addEventListener("mc-press", () => leaked++);
    inner(element).click();
    expect(leaked).toBe(0);
  });

  it("keys a command by its fields in a fixed order", () => {
    expect(commandKeyOf({ type: "seat", seat: "s1", action: "remove", participant: "p2" })).toBe(
      "seat|action:remove|participant:p2|seat:s1",
    );
    expect(commandKeyOf(null)).toBe("");
  });
});
