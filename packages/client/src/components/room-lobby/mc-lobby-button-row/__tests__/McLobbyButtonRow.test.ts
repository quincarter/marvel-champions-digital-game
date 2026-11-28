// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-lobby-button-row.js";
import type { McLobbyButtonRow } from "../McLobbyButtonRow.js";
import type { LobbyButtonModel } from "../../room-lobby.types.js";

afterEach(() => document.body.replaceChildren());

const button = (key: string): LobbyButtonModel => ({
  stop: `epic:${key}`,
  label: key,
  kind: "secondary",
  command: { type: "epic", key: `epic:${key}` },
});

async function mount(row: readonly LobbyButtonModel[]): Promise<McLobbyButtonRow> {
  const element = document.createElement("mc-lobby-button-row") as McLobbyButtonRow;
  element.row = row;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-lobby-button-row", () => {
  it("draws one lobby button per model, in order, each with its stop", async () => {
    const element = await mount([button("fewer"), button("more")]);
    const buttons = [...element.shadowRoot!.querySelectorAll("mc-lobby-button")];
    expect(buttons.map((b) => (b as unknown as { stop: string }).stop)).toEqual(["epic:fewer", "epic:more"]);
  });

  it("hides itself when the row is empty", async () => {
    const element = await mount([]);
    expect(element.hasAttribute("hidden")).toBe(true);
    element.row = [button("fewer")];
    await element.updateComplete;
    expect(element.hasAttribute("hidden")).toBe(false);
  });
});
