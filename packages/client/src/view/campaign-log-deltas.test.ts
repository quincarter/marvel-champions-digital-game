/**
 * `campaign-log-deltas.ts` against hand-built `CampaignHistoryEntry`s: `mode: "add"` writes must read as the
 * entry's own delta (baseline subtracted), never the cumulative running total `applyLogWrite` actually stores, and
 * every other write kind/mode must be untouched.
 */
import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import type { CampaignHistoryEntry, LogValue, LogWrite } from "@mc/engine";
import { baselineNumberOf, lastWriteGroupsOf, resolvedWritesOf } from "./campaign-log-deltas.js";

type Entry = Pick<CampaignHistoryEntry, "steps" | "logBefore">;

/** A minimal `logBefore` snapshot with each seat starting from its own `units` baseline (default 0). */
function logBeforeOf(unitsBySeat: Readonly<Record<number, number>> = {}): CampaignHistoryEntry["logBefore"] {
  return {
    definitionVersion: "test",
    shared: {},
    hidden: {},
    seats: Object.entries(unitsBySeat).map(([seatNumber, value]) => ({
      seatNumber: Number(seatNumber),
      identityCardId: "",
      deck: { cards: [] },
      grants: [],
      fields: { units: { kind: "number", value } as LogValue },
    })),
    removedFromCampaign: [],
    position: { nextNodeId: null, resolved: {}, progress: {} },
    rng: { seed: 0, index: 0 },
  } as unknown as CampaignHistoryEntry["logBefore"];
}

function stepOf(writes: readonly LogWrite[], text = "", citation = ""): CampaignHistoryEntry["steps"][number] {
  return {
    instructionId: "test",
    text,
    citation,
    kind: "record",
    writes,
    choices: [],
    removedFromCampaign: [],
    grants: [],
  };
}

function add(field: string, seatNumber: number | null, value: number): LogWrite {
  return { field, seatNumber, mode: "add", value: { kind: "number", value } };
}

function set(field: string, seatNumber: number | null, value: number): LogWrite {
  return { field, seatNumber, mode: "set", value: { kind: "number", value } };
}

describe("baselineNumberOf", () => {
  test("0 for a seat the baseline never held", () => {
    expect(baselineNumberOf(logBeforeOf(), "units", 1)).toBe(0);
  });
  test("the seat's own recorded value otherwise", () => {
    expect(baselineNumberOf(logBeforeOf({ 1: 5 }), "units", 1)).toBe(5);
  });
});

describe("resolvedWritesOf", () => {
  test("three chained `add` writes to the same field+seat collapse to one delta, not a running total", () => {
    // MC16's "units" written three times in one victory block: 0 -> 2 -> 5 -> 9 is a +9 delta from a 0 baseline,
    // never 2+5+9 = 16 (double/triple counting) and never 9 read as if it were the delta on its own by coincidence.
    const entry: Entry = {
      logBefore: logBeforeOf({ 1: 0 }),
      steps: [stepOf([add("units", 1, 2), add("units", 1, 5), add("units", 1, 9)])],
    };
    const resolved = resolvedWritesOf(entry);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ field: "units", seatNumber: 1, value: { kind: "number", value: 9 } });
  });

  test("a nonzero baseline is subtracted back out", () => {
    const entry: Entry = { logBefore: logBeforeOf({ 1: 4 }), steps: [stepOf([add("units", 1, 7)])] };
    expect(resolvedWritesOf(entry)[0]?.value).toEqual({ kind: "number", value: 3 });
  });

  test("per-seat deltas can differ", () => {
    const entry: Entry = {
      logBefore: logBeforeOf({ 1: 0, 2: 0 }),
      steps: [stepOf([add("units", 1, 3), add("units", 2, 6), add("units", 2, 8)])],
    };
    const resolved = resolvedWritesOf(entry);
    const seat1 = resolved.find((w) => w.seatNumber === 1);
    const seat2 = resolved.find((w) => w.seatNumber === 2);
    expect(seat1?.value).toEqual({ kind: "number", value: 3 });
    expect(seat2?.value).toEqual({ kind: "number", value: 8 });
  });

  test("a `set`-mode write is never collapsed: every occurrence still renders, verbatim", () => {
    const entry: Entry = {
      logBefore: logBeforeOf(),
      steps: [stepOf([set("delayCounters", null, 1)]), stepOf([set("delayCounters", null, 3)])],
    };
    const resolved = resolvedWritesOf(entry);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.value).toEqual({ kind: "number", value: 1 });
    expect(resolved[1]?.value).toEqual({ kind: "number", value: 3 });
  });

  test("a cardList append write passes through unchanged, at every occurrence", () => {
    const first: LogWrite = {
      field: "collection",
      seatNumber: null,
      mode: "append",
      value: { kind: "cardList", cardIds: ["a" as CardId] },
    };
    const second: LogWrite = {
      field: "collection",
      seatNumber: null,
      mode: "append",
      value: { kind: "cardList", cardIds: ["b" as CardId] },
    };
    const entry: Entry = { logBefore: logBeforeOf(), steps: [stepOf([first, second])] };
    const resolved = resolvedWritesOf(entry);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.value).toEqual({ kind: "cardList", cardIds: ["a" as CardId] });
    expect(resolved[1]?.value).toEqual({ kind: "cardList", cardIds: ["b" as CardId] });
  });

  test("a `fieldFilter` drops writes for fields it rejects", () => {
    const entry: Entry = {
      logBefore: logBeforeOf(),
      steps: [stepOf([add("units", 1, 3), set("delayCounters", null, 1)])],
    };
    const resolved = resolvedWritesOf(entry, (field) => field === "units");
    expect(resolved.map((w) => w.field)).toEqual(["units"]);
  });
});

describe("lastWriteGroupsOf", () => {
  test("collapses every mode to the group's last write, delta-adjusting only `add`", () => {
    const entry: Entry = {
      logBefore: logBeforeOf({ 1: 0 }),
      steps: [stepOf([add("units", 1, 2), set("delayCounters", null, 1), add("units", 1, 5)])],
    };
    const groups = lastWriteGroupsOf(entry);
    expect(groups).toHaveLength(2);
    const units = groups.find((g) => g.field === "units");
    const delay = groups.find((g) => g.field === "delayCounters");
    expect(units?.value).toEqual({ kind: "number", value: 5 });
    expect(delay?.value).toEqual({ kind: "number", value: 1 });
  });
});
