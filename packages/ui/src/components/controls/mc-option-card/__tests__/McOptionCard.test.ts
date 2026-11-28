import { afterEach, describe, expect, it } from "vitest";
import "../mc-option-card";
import type { McOptionChip, McOptionRow } from "../mc-option-card.types";

afterEach(() => document.body.replaceChildren());

const chip = (action: string, selected = false, enabled = true): McOptionChip => ({
  action,
  label: action.toUpperCase(),
  selected,
  enabled,
});

async function card(row: McOptionRow, compact = false) {
  const el = document.createElement("mc-option-card");
  el.row = row;
  el.compact = compact;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-option-card", () => {
  it("draws nothing without a row", async () => {
    const el = document.createElement("mc-option-card");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.children.length).toBe(0);
  });

  it("is one pressable card for a toggle, with its action's stop", async () => {
    const el = await card({ name: "Gene Pool", meta: "On", active: true, control: { kind: "toggle", action: "gene" } });
    const press = el.shadowRoot!.querySelector("mc-press-card")!;
    expect(press.getAttribute("data-stop")).toBe("option:gene");
    expect(press.hasAttribute("selected")).toBe(true);
    expect(press.textContent).toContain("Gene Pool");
  });

  it("draws a stepper's two buttons around its value, the disabled end with no stop", async () => {
    const el = await card({
      name: "Heroic",
      meta: "",
      active: false,
      control: { kind: "stepper", down: chip("down", false, false), up: chip("up"), valueLabel: "OFF" },
    });
    const chips = [...el.shadowRoot!.querySelectorAll("mc-chip")];
    expect(chips.map((c) => c.getAttribute("data-stop") !== "")).toEqual([false, true]);
    expect(chips[0]!.hasAttribute("disabled")).toBe(true);
    expect(el.shadowRoot!.querySelector(".value")!.textContent).toBe("OFF");
  });

  it("draws labeled groups of chips, two to a row when compact", async () => {
    const row: McOptionRow = {
      name: "Horsemen",
      meta: "",
      active: true,
      control: {
        kind: "groups",
        groups: [
          { label: "War", chips: [chip("w-a", true), chip("w-b")] },
          { label: "Famine", chips: [chip("f-a"), chip("f-b")] },
          { label: "Death", chips: [chip("d-a"), chip("d-b")] },
        ],
      },
    };
    const wide = await card(row);
    expect(wide.shadowRoot!.querySelectorAll(".group").length).toBe(3);
    expect(wide.shadowRoot!.querySelector(".groups")!.getAttribute("style")).toContain("--per-row:3");
    const narrow = await card(row, true);
    expect(narrow.shadowRoot!.querySelector(".groups")!.getAttribute("style")).toContain("--per-row:2");
  });

  it("raises the chip's action string when a chip is pressed", async () => {
    const el = await card({
      name: "Set",
      meta: "",
      active: false,
      control: { kind: "groups", groups: [{ label: null, chips: [chip("one"), chip("two", true)] }] },
    });
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelectorAll("mc-chip")[0]!.press();
    expect(seen).toEqual([{ action: "one", hold: false }]);
  });
});
