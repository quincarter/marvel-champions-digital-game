import { afterEach, describe, expect, it } from "vitest";
import "../mc-tip-chip.js";
import type { McTipChip } from "../McTipChip.js";
import { stop, tap } from "../../../shared/test-tap.js";

afterEach(() => document.body.replaceChildren());

async function mount(set: Partial<McTipChip> = {}): Promise<McTipChip> {
  const chip = document.createElement("mc-tip-chip") as McTipChip;
  Object.assign(chip, {
    label: "Justice",
    value: "aspect:justice",
    stop: "hero-chip:aspect:justice",
    infoLabel: "About Justice",
    infoStop: "hero-chip-info:justice",
    ...set,
  });
  document.body.append(chip);
  await chip.updateComplete;
  await (chip.shadowRoot!.querySelector("mc-filter-chip") as HTMLElement & { updateComplete: Promise<unknown> })
    .updateComplete;
  return chip;
}

function record(chip: McTipChip): string[] {
  const seen: string[] = [];
  chip.addEventListener("mc-activate", (e) => seen.push(`activate:${(e as CustomEvent<{ key: string }>).detail.key}`));
  chip.addEventListener("mc-info", (e) => seen.push(`info:${(e as CustomEvent<{ key: string }>).detail.key}`));
  return seen;
}

describe("mc-tip-chip", () => {
  it("marks the body and the i segment as focus stops", async () => {
    const chip = await mount();
    expect(stop(chip, "hero-chip:aspect:justice").tagName).toBe("MC-FILTER-CHIP");
    expect(stop(chip, "hero-chip-info:justice").tagName).toBe("MC-BUTTON");
  });

  it("has no i segment (and no info stop) without an info label", async () => {
    const chip = await mount({ infoLabel: "" });
    expect(chip.infoElement).toBeNull();
    expect(() => stop(chip, "hero-chip-info:justice")).toThrow();
  });

  it("filters on a tap of the body and opens the tip on a tap of the i, never both", async () => {
    const chip = await mount();
    const seen = record(chip);
    const body = chip.shadowRoot!.querySelector("mc-filter-chip")!.shadowRoot!.querySelector("mc-button")!;
    tap(body);
    expect(seen).toEqual(["activate:aspect:justice"]);
    tap(chip.infoElement!);
    expect(seen).toEqual(["activate:aspect:justice", "info:aspect:justice"]);
  });

  it("presses from a keyboard click on either stop", async () => {
    const chip = await mount();
    const seen = record(chip);
    stop(chip, "hero-chip:aspect:justice").click();
    stop(chip, "hero-chip-info:justice").click();
    expect(seen).toEqual(["activate:aspect:justice", "info:aspect:justice"]);
  });

  it("does not filter from a keyboard click while disabled", async () => {
    const chip = await mount({ disabled: true, reason: "Nothing here" });
    const seen = record(chip);
    stop(chip, "hero-chip:aspect:justice").click();
    expect(seen).toEqual([]);
  });

  it("says chosen with a check and the count when it is not chosen, so colour is never the only cue", async () => {
    const off = await mount({ count: 3 });
    const label = (chip: McTipChip): string =>
      (chip.shadowRoot!.querySelector("mc-filter-chip") as unknown as { text: string }).text;
    expect(label(off)).toBe("Justice 3");
    const on = await mount({ selected: true, count: 3 });
    expect(label(on)).toBe("✓ Justice");
  });

  it("shows the i as chosen while its tip is open", async () => {
    const chip = await mount({ infoOpen: true });
    expect(chip.infoElement!.hasAttribute("selected")).toBe(true);
  });
});
