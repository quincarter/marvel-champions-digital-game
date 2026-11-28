// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-log";
import type { PauseLogInput } from "../../pause.types";
import type { PauseEventDetail } from "../../shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<PauseLogInput> = {}): PauseLogInput => ({
  title: "Jump to a moment",
  note: "",
  empty: "Nothing has happened yet.",
  hint: "Tap a ↶ moment to undo back to it",
  lines: [
    { id: "b", ref: "R1.2", words: "Spider-Man thwarts", stop: "moment:b" },
    { id: "a", ref: "R1.1", words: "Round begins", stop: null },
  ],
  ...over,
});

async function log(i: PauseLogInput) {
  const el = document.createElement("mc-pause-log");
  el.input = i;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-log", () => {
  it("draws every line, the undoable ones as pressable moments, and the hint under the box", async () => {
    const el = await log(input());
    const root = el.shadowRoot!;
    expect(root.querySelectorAll("mc-pause-log-line").length).toBe(1);
    expect(root.querySelectorAll(".line").length).toBe(1);
    expect(root.querySelector(".hint")!.textContent).toContain("undo");
    expect(root.querySelector(".note")).toBeNull();
  });

  it("says nothing has happened with no lines, shows the note when there is one, and relays a moment", async () => {
    const empty = await log(input({ lines: [], note: "Every retained beat." }));
    expect(empty.shadowRoot!.querySelector(".empty")!.textContent).toContain("Nothing");
    expect(empty.shadowRoot!.querySelector(".note")!.textContent).toBe("Every retained beat.");
    const el = await log(input());
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="moment:b"]')!.click();
    expect(seen).toEqual([{ type: "moment", id: "b" }]);
  });
});
