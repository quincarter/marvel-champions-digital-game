import { describe, expect, it } from "vitest";
import type { Correction } from "../curation/types.ts";
import type { RawCard } from "../raw-types.ts";
import { applyTypeCorrections } from "./flatten.ts";

const raw = (code: string, type_code: RawCard["type_code"]) => ({ code, type_code }) as RawCard;
const correction = (code: string, cardType: NonNullable<Correction["cardType"]>): Correction => ({
  code,
  cardType,
  reason: "MarvelCDB types a treachery as an attachment",
  evidence: "scan",
});

describe("applyTypeCorrections (Correction.cardType)", () => {
  it("retypes only the corrected record and leaves the rest alone", () => {
    const errors: string[] = [];
    const out = applyTypeCorrections(
      [raw("40154", "attachment"), raw("40158", "treachery")],
      [correction("40154", "treachery")],
      errors,
    );
    expect(out.map((r) => r.type_code)).toEqual(["treachery", "treachery"]);
    expect(errors).toEqual([]);
  });

  it("retypes a linked face too, and returns the input untouched when nothing sets a type", () => {
    const front = { ...raw("1a", "attachment"), linked_card: raw("1b", "attachment") } as RawCard;
    const input = [front];
    expect(
      applyTypeCorrections(input, [correction("1b", "treachery")], []).map((r) => r.linked_card?.type_code),
    ).toEqual(["treachery"]);
    expect(applyTypeCorrections(input, [], [])).toBe(input);
  });

  it("reports a correction that matches MarvelCDB already", () => {
    const errors: string[] = [];
    applyTypeCorrections([raw("40154", "treachery")], [correction("40154", "treachery")], errors);
    expect(errors).toEqual(["40154: type correction to treachery matches MarvelCDB already"]);
  });
});
