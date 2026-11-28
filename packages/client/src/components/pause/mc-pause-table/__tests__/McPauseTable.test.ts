// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-table";
import type { PauseTableInput } from "../../pause.types";
import type { PauseEventDetail } from "../../shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

const input: PauseTableInput = {
  guideRun: [{ id: "guide-stop-tutorial", label: "Stop tutorial" }],
  tableHeading: "Table",
  cardSize: {
    title: "Card size",
    detail: "",
    look: "cell",
    options: [
      { stop: "table:card-size:small", label: "Small", selected: false, action: { type: "card-size", value: "small" } },
      { stop: "table:card-size:large", label: "Large", selected: true, action: { type: "card-size", value: "large" } },
    ],
  },
  rows: [
    {
      stop: "table:sound",
      title: "Sound",
      detail: "Music and effects.",
      state: "ON",
      on: true,
      unavailable: false,
      action: { type: "table", id: "sound" },
    },
  ],
  guideHeading: "Guide",
  level: null,
  guideRows: [],
};

async function table() {
  const el = document.createElement("mc-pause-table");
  el.input = input;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-table", () => {
  it("draws the guided run's buttons, the card size, and a row per setting, each a stop", async () => {
    const el = await table();
    const root = el.shadowRoot!;
    expect(root.querySelector('[data-stop="guide-stop-tutorial"]')).not.toBeNull();
    expect(root.querySelector("mc-segments")).not.toBeNull();
    expect(root.querySelector('mc-switch-row[data-stop="table:sound"]')).not.toBeNull();
    expect(root.querySelectorAll(".heading").length).toBe(2);
  });

  it("turns a row's press and a button's press into mc-pause", async () => {
    const el = await table();
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="table:sound"]')!.click();
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="guide-stop-tutorial"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(seen).toEqual([
      { type: "table", id: "sound" },
      { type: "menu", id: "guide-stop-tutorial" },
    ]);
  });
});
