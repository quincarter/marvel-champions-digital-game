import { describe, expect, it } from "vitest";
import { CORE_CARDS, CORE_STARTER_DECKS, deckFromStarterDeck } from "@mc/content";
import { PackLeases } from "../art/pack-art.js";
import type { DeckOption } from "../view/deck-list-model.js";
import { deckDetailsOf } from "../view/room-deck-details-model.js";
import { pickerRows } from "../view/room-deck-picker-model.js";
import { deckDetailsModelOf, deckGridModelOf } from "./room-deck-panels.js";

const optionOf = (over: Partial<DeckOption> = {}, kind: "precon" | "userBuilt" = "precon"): DeckOption => {
  const deck = deckFromStarterDeck(CORE_STARTER_DECKS[0]!, "poolv1");
  return {
    deck: kind === "precon" ? deck : { ...deck, source: { kind: "userBuilt" } },
    identityName: "Hero",
    legal: true,
    problems: [],
    unscripted: [],
    poolChanged: false,
    seatable: true,
    blockedReason: null,
    warning: null,
    ...over,
  } as unknown as DeckOption;
};

const leases = new PackLeases();
const grid = (rows: ReturnType<typeof pickerRows>, over: Partial<Parameters<typeof deckGridModelOf>[0]> = {}) =>
  deckGridModelOf({
    rows,
    loading: false,
    none: false,
    mode: "grid",
    selected: null,
    contentWidth: 320,
    formFactor: "phone",
    leases,
    ...over,
  });

describe("deckGridModelOf", () => {
  it("says it is loading, that there are no decks, or that none match, in place of the decks", () => {
    expect(grid([], { loading: true })).toMatchObject({ loading: true, items: [] });
    expect(grid([], { loading: true }).emptyText).toBeTruthy();
    expect(grid([], { none: true }).emptyText).toMatch(/no decks on this device/i);
    expect(grid([]).emptyText).toBe("No deck matches that.");
  });

  it("makes a tile with a stripe, a status line and no Pick; a row with Pick", () => {
    const rows = pickerRows([optionOf()], "");
    const tile = grid(rows).items[0]!;
    expect(tile.pick).toBeUndefined();
    expect(tile.stripe.length).toBeGreaterThan(0);
    expect(tile.lines.at(-1)!.text).toMatch(/cards$/);
    const row = grid(rows, { mode: "list" }).items[0]!;
    expect(row.pick).toMatchObject({ look: "primary" });
    expect(row.pick?.disabled).toBeUndefined();
  });

  it("words why a deck cannot be picked, and dims Pick with that reason", () => {
    const rows = pickerRows([optionOf({ seatable: false, blockedReason: "Needs 40 cards." })], "");
    const row = grid(rows, { mode: "list" }).items[0]!;
    expect(row.pick).toMatchObject({ look: "secondary", disabled: "Needs 40 cards." });
    expect(row.lines.at(-1)).toMatchObject({ text: "Not usable: Needs 40 cards.", weight: 700 });
  });

  it("frames the selected deck heavier", () => {
    const rows = pickerRows([optionOf()], "");
    expect(grid(rows, { selected: rows[0]!.id }).items[0]!.heavy).toBe(true);
    expect(grid(rows).items[0]!.heavy).toBe(false);
  });
});

describe("deckDetailsModelOf", () => {
  const modelOf = (option: DeckOption) =>
    deckDetailsModelOf(deckDetailsOf(pickerRows([option], "")[0]!, CORE_CARDS), 300, leases);

  it("marks the two most common costs and no empty bar", () => {
    const model = modelOf(optionOf());
    const counts = [...new Set(model.bars.map((bar) => bar.count))].filter((c) => c > 0).sort((a, b) => b - a);
    const top = new Set(counts.slice(0, 2));
    for (const bar of model.bars) expect(bar.highlight).toBe(bar.count > 0 && top.has(bar.count));
  });

  it("offers Edit a copy for a precon and Edit deck for the player's own", () => {
    expect(modelOf(optionOf()).edit?.label).toBe("Edit a copy");
    expect(modelOf(optionOf({}, "userBuilt")).edit?.label).toBe("Edit deck");
  });

  it("dims Use with the reason when the deck cannot be seated, and says the standing in words", () => {
    const blocked = modelOf(optionOf({ seatable: false, blockedReason: "Needs 40 cards." }));
    expect(blocked.use).toMatchObject({ look: "secondary", disabled: "Needs 40 cards." });
    expect(blocked.status).toBe("Not usable: Needs 40 cards.");
    const fine = modelOf(optionOf());
    expect(fine.use).toMatchObject({ look: "primary" });
    expect(fine.use.disabled).toBeUndefined();
    expect(fine.status).toBeNull();
    const checking = modelOf(optionOf({ seatable: false, checking: true } as Partial<DeckOption>));
    expect(checking.status).toBe("Checking this deck…");
  });

  it("lists the cards by group with the card each line stands for", () => {
    const model = modelOf(optionOf());
    expect(model.groups[0]!.label).toMatch(/· \d+$/);
    expect(model.groups[0]!.entries[0]!.hover).toBeTruthy();
    expect(model.tileRows.flat().length).toBeGreaterThan(0);
  });
});
