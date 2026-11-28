// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-quick";
import type { PauseLinkInput, PauseQuickInput } from "../../pause.types";
import type { PauseEventDetail } from "../../shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

const link = (id: string, variant: PauseLinkInput["variant"]): PauseLinkInput => ({
  stop: `quick:${id}`,
  title: id,
  detail: "",
  variant,
  action: { type: "quick", id },
});

const input = (open: boolean): PauseQuickInput => ({
  toggle: { label: "Reference", open },
  rows: [link("music", "compact"), link("report", "compact"), link("glossary", "panel")],
});

async function quick(i: PauseQuickInput) {
  const el = document.createElement("mc-pause-quick");
  el.input = i;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-quick", () => {
  it("puts the toggle and the compact cells on one line and the other rows under it", async () => {
    const el = await quick(input(true));
    const root = el.shadowRoot!;
    expect(root.querySelectorAll(".line mc-pause-link-row").length).toBe(2);
    expect(root.querySelectorAll(".rows mc-pause-link-row").length).toBe(1);
    expect(root.querySelector<HTMLElement & { label: string }>("mc-button")!.label).toBe("Reference ▾");
  });

  it("says quick-toggle when the toggle is pressed and relays a row's press", async () => {
    const el = await quick(input(false));
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="quick-toggle"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="quick:music"]')!.click();
    expect(seen).toEqual([{ type: "quick-toggle" }, { type: "quick", id: "music" }]);
  });
});
