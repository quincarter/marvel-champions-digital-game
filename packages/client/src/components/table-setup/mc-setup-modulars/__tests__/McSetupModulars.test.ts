// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-setup-modulars";
import type { ModularSetOption } from "../../../../view/modular-sets";
import type { SetupEventDetail } from "../../shared/setup-events.types";
import type { ModularsInput } from "../mc-setup-modulars.types";

afterEach(() => document.body.replaceChildren());

/** Presses a control a query found by its attribute (typed as a plain `Element`). */
const press = (el: Element | null | undefined): void => (el as unknown as { press(): void }).press();

const option = (id: string, over: Partial<ModularSetOption> = {}): ModularSetOption => ({
  kind: "set",
  id,
  name: id.toUpperCase(),
  selected: false,
  recommended: false,
  cardCount: 6,
  descriptor: null,
  groupId: "core",
  groupLabel: null,
  disabledReason: null,
  ...over,
});

const input = (over: Partial<ModularsInput> = {}): ModularsInput => ({
  cw: null,
  villainName: "Rhino",
  required: [{ id: "rhino", name: "Rhino", cardCount: 19, descriptor: null }],
  options: [
    option("bomb_scare", { selected: true, groupId: "recommended", groupLabel: "Recommended" }),
    option("legions", { groupId: "core", groupLabel: "Core Set" }),
    option("under_attack", { groupId: "core", disabledReason: "Barred" }),
  ],
  hood: [],
  randomSets: true,
  right: "1 required · 1 chosen",
  openGroups: new Map(),
  pictures: new Map(),
  ...over,
});

async function make(i: ModularsInput, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-setup-modulars");
  el.input = i;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  const seen: SetupEventDetail[] = [];
  el.addEventListener("mc-setup", (e) => seen.push(e.detail));
  return { el, seen };
}

const tiles = (el: HTMLElement) => [...el.shadowRoot!.querySelectorAll("mc-setup-set-tile")].map((tile) => tile.tile!);

describe("mc-setup-modulars", () => {
  it("lists the required set, then each group's label with its count over its tiles, barred sets faded", async () => {
    const { el } = await make(input());
    expect(el.shadowRoot!.querySelector(".required")!.textContent).toContain("Rhino");
    expect([...el.shadowRoot!.querySelectorAll(".group-label")].map((l) => l.textContent)).toEqual([
      "Recommended · 1",
      "Core Set · 2",
    ]);
    const shown = tiles(el);
    expect(shown.map((tile) => tile.id)).toEqual(["bomb_scare", "legions", "under_attack"]);
    expect(shown.map((tile) => tile.barred)).toEqual([false, false, true]);
    expect(shown[0]!.selected).toBe(true);
    expect(shown[2]!.dim).toBe(true);
  });

  it("raises modular-random from the header's Random chip, which is a focus stop", async () => {
    const { el, seen } = await make(input());
    const chip = el.shadowRoot!.querySelector("mc-chip")!;
    expect(chip.getAttribute("data-stop")).toBe("modular:random-draw");
    chip.press();
    expect(seen).toEqual([{ type: "modular-random" }]);
    const none = await make(input({ randomSets: false }));
    expect(none.el.shadowRoot!.querySelector("mc-chip")).toBeNull();
  });

  it("gives the phone a locked row for the required set and a Show / Hide row per group, keeping a chosen group open", async () => {
    const { el, seen } = await make(input(), "phone");
    expect(el.shadowRoot!.querySelector("mc-check-row[locked]")).not.toBeNull();
    const groups = [...el.shadowRoot!.querySelectorAll("mc-press-card")];
    expect(groups.map((g) => g.getAttribute("data-stop"))).toEqual(["modulargroup:recommended", "modulargroup:core"]);
    // Recommended holds a chosen set and starts open; Core starts folded.
    expect(tiles(el).map((tile) => tile.id)).toEqual(["bomb_scare"]);
    groups[1]!.press();
    expect(seen).toEqual([{ type: "group-toggle", id: "core", open: true }]);
  });

  it("shows a group's sets when the player opened it", async () => {
    const { el } = await make(input({ openGroups: new Map([["core", true]]) }), "phone");
    expect(tiles(el).map((tile) => tile.id)).toEqual(["bomb_scare", "legions", "under_attack"]);
  });

  it("offers The Hood's set-aside sets as toggles", async () => {
    const hood = [
      { id: "a", name: "Set A", included: true, cardCount: 5, descriptor: null },
      { id: "b", name: "Set B", included: false, cardCount: 4, descriptor: null },
    ];
    const { el, seen } = await make(input({ hood }));
    const cards = [...el.shadowRoot!.querySelectorAll(".hood mc-press-card")];
    expect(cards.map((c) => c.getAttribute("data-stop"))).toEqual(["hoodSet:a", "hoodSet:b"]);
    expect(cards.map((c) => c.hasAttribute("selected"))).toEqual([true, false]);
    press(cards[1]!);
    expect(seen).toEqual([{ type: "hood-toggle", id: "b" }]);
  });

  it("shows a Civil War build's summary and an Edit control in place of the picker", async () => {
    const cw = {
      build: "Ready-made",
      rows: [{ id: "x", label: "Heroes", value: "Two" }],
      editLabel: "Edit scenario",
      setCount: 2,
    };
    const { el, seen } = await make(input({ cw: cw as never }));
    expect(el.shadowRoot!.querySelectorAll("mc-setup-set-tile").length).toBe(0);
    expect(el.shadowRoot!.querySelector(".info")!.textContent).toContain("Two");
    press(el.shadowRoot!.querySelector('[data-stop="modular:civil-war-edit"]')!);
    expect(seen).toEqual([{ type: "edit-scenario" }]);
  });
});
