// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-results";
import type { PauseResultsInput } from "../../pause.types";
import type { PauseEventDetail } from "../../shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

const input: PauseResultsInput = {
  note: "",
  groups: [
    {
      title: "Settings",
      rows: [
        {
          kind: "switch",
          row: {
            stop: "result:sound",
            title: "Sound",
            detail: "",
            state: "OFF",
            on: false,
            unavailable: false,
            action: { type: "setting", id: "sound" },
          },
        },
        {
          kind: "choice",
          row: {
            title: "Card size",
            detail: "How big.",
            look: "cell",
            options: [
              {
                stop: "result:card-size:small",
                label: "Small",
                selected: true,
                action: { type: "setting", id: "card-size", value: "small" },
              },
            ],
          },
        },
      ],
    },
    {
      title: "Rules",
      rows: [
        {
          kind: "link",
          row: {
            stop: "result:glossary",
            title: "Search in the glossary",
            detail: "",
            variant: "result",
            action: { type: "result", id: "glossary" },
          },
        },
      ],
    },
  ],
};

async function results(i: PauseResultsInput) {
  const el = document.createElement("mc-pause-results");
  el.input = i;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-results", () => {
  it("draws each group's heading and its rows by kind, and a note only when there is one", async () => {
    const el = await results(input);
    const root = el.shadowRoot!;
    expect([...root.querySelectorAll(".heading")].map((h) => h.textContent)).toEqual(["Settings", "Rules"]);
    expect(root.querySelector("mc-switch-row")).not.toBeNull();
    expect(root.querySelector("mc-segments")).not.toBeNull();
    expect(root.querySelector("mc-pause-link-row")).not.toBeNull();
    expect(root.querySelector(".note")).toBeNull();
    el.input = { note: "Searching…", groups: [] };
    await el.updateComplete;
    expect(root.querySelector(".note")!.textContent).toBe("Searching…");
  });

  it("raises a setting's press and a link's press as mc-pause", async () => {
    const el = await results(input);
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="result:sound"]')!.click();
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="result:glossary"]')!.click();
    expect(seen).toEqual([
      { type: "setting", id: "sound" },
      { type: "result", id: "glossary" },
    ]);
  });
});
