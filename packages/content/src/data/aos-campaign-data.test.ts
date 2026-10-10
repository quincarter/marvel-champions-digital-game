import { describe, expect, it } from "vitest";
import { validateCard } from "../schema/index.js";
import {
  AOS_CARDS,
  AOS_EVIDENCE_COMBINATIONS,
  AOS_SCENARIOS,
  AOS_THUNDERBOLT_MINIONS,
  AOS_THUNDERBOLT_POOL_SET_IDS,
  thunderboltMinions,
  WAVE9_CARDS,
} from "./index.js";

/**
 * docs/phase7-wave9.md section 8.1 items 29 to 32: the evidence icons, the 27-row grid of MC50 p. 24, the counter types
 * the campaign reads and the derived Thunderbolt minion map.
 */

const card = (id: string) => AOS_CARDS.find((c) => (c.id as string) === id);

describe("aos data: evidence icons and colors (each read on its scan)", () => {
  const expected: Record<string, [string, string, string]> = {
    "50185": ["means", "folder", "orange"],
    "50186": ["means", "phone", "blue"],
    "50187": ["means", "scanner", "pink"],
    "50188": ["motive", "dollar", "green"],
    "50189": ["motive", "handshake", "black"],
    "50190": ["motive", "flame", "yellow"],
    "50191": ["opportunity", "badge", "purple"],
    "50192": ["opportunity", "pin", "red"],
    "50193": ["opportunity", "shield", "blue"],
  };

  it("carries evidenceIcon and evidenceColor on all nine evidence cards", () => {
    const evidence = AOS_CARDS.filter((c) => c.type === "evidence");
    expect(evidence.map((c) => c.id as string)).toEqual(Object.keys(expected));
    for (const c of evidence) {
      if (c.type !== "evidence") throw new Error("not evidence");
      expect([c.evidence, c.evidenceIcon, c.evidenceColor]).toEqual(expected[c.id as string]);
      expect(validateCard(c).errors).toEqual([]);
    }
  });

  it("is told apart by icon: nine different icons, though two cards are blue", () => {
    const evidence = AOS_CARDS.flatMap((c) => (c.type === "evidence" ? [c] : []));
    expect(new Set(evidence.map((c) => c.evidenceIcon)).size).toBe(9);
    expect(evidence.filter((c) => c.evidenceColor === "blue").map((c) => c.id as string)).toEqual(["50186", "50193"]);
  });
});

describe("aos data: evidence combinations (MC50 p. 24)", () => {
  const MEANS = ["50185", "50186", "50187"];
  const MOTIVE = ["50188", "50189", "50190"];
  const OPPORTUNITY = ["50191", "50192", "50193"];
  const BOARD = ["50181a", "50182a", "50183a"];

  it("has 27 different triples covering every combination once", () => {
    expect(AOS_EVIDENCE_COMBINATIONS).toHaveLength(27);
    const triples = AOS_EVIDENCE_COMBINATIONS.map(
      (r) => `${r.means as string}-${r.motive as string}-${r.opportunity as string}`,
    );
    expect(new Set(triples).size).toBe(27);
    for (const r of AOS_EVIDENCE_COMBINATIONS) {
      expect(MEANS).toContain(r.means as string);
      expect(MOTIVE).toContain(r.motive as string);
      expect(OPPORTUNITY).toContain(r.opportunity as string);
    }
  });

  it("names each of the three board members nine times, all existing environments", () => {
    for (const b of BOARD) {
      expect(AOS_EVIDENCE_COMBINATIONS.filter((r) => (r.boardMember as string) === b)).toHaveLength(9);
      expect(card(b)?.type).toBe("environment");
    }
  });

  it("splits each evidence card's rows among (Medical, Surveillance, Tactical) as 5-1-3, 3-5-1 and 1-3-5", () => {
    const split = (field: "means" | "motive" | "opportunity", id: string) =>
      BOARD.map(
        (b) =>
          AOS_EVIDENCE_COMBINATIONS.filter((r) => (r[field] as string) === id && (r.boardMember as string) === b)
            .length,
      );
    const pattern: Record<string, number[]> = { a: [5, 1, 3], b: [3, 5, 1], c: [1, 3, 5] };
    [MEANS, MOTIVE, OPPORTUNITY].forEach((ids, field) => {
      const f = (["means", "motive", "opportunity"] as const)[field] as "means" | "motive" | "opportunity";
      expect(split(f, ids[0] as string)).toEqual(pattern.a);
      expect(split(f, ids[1] as string)).toEqual(pattern.b);
      expect(split(f, ids[2] as string)).toEqual(pattern.c);
    });
  });

  it("matches the page read cell by cell by icon (a second, independent reading of the 200 dpi render)", () => {
    // Columns of the log: Chief Medical Officer, Chief Surveillance Officer, Chief Tactical Officer; each row is
    // means / motive / opportunity icon. Slugs as `evidenceIcon`.
    const page: Record<string, string[]> = {
      "50181a": [
        "folder dollar badge",
        "folder dollar pin",
        "folder handshake badge",
        "folder handshake shield",
        "folder flame pin",
        "phone dollar badge",
        "phone dollar pin",
        "phone handshake badge",
        "scanner dollar badge",
      ],
      "50182a": [
        "folder handshake pin",
        "phone dollar shield",
        "phone handshake pin",
        "phone handshake shield",
        "phone flame badge",
        "phone flame pin",
        "scanner handshake pin",
        "scanner handshake shield",
        "scanner flame pin",
      ],
      "50183a": [
        "folder dollar shield",
        "folder flame badge",
        "folder flame shield",
        "phone flame shield",
        "scanner dollar pin",
        "scanner dollar shield",
        "scanner handshake badge",
        "scanner flame badge",
        "scanner flame shield",
      ],
    };
    const icon = (id: string) => (card(id) as { evidenceIcon?: string } | undefined)?.evidenceIcon;
    for (const [board, rows] of Object.entries(page)) {
      const fromData = AOS_EVIDENCE_COMBINATIONS.filter((r) => (r.boardMember as string) === board)
        .map((r) => `${icon(r.means as string)} ${icon(r.motive as string)} ${icon(r.opportunity as string)}`)
        .sort();
      expect(fromData).toEqual([...rows].sort());
    }
  });
});

describe("aos data: counter types the campaign reads (docs/phase7-wave9.md section 1.16 item 4)", () => {
  const typesOf = (id: string) =>
    (card(id) as { definedCounterTypes?: readonly string[] } | undefined)?.definedCounterTypes;

  it("lock on the four Holding Cell fronts, secret on both faces of the three Board Members", () => {
    for (const id of ["50105a", "50106a", "50107a", "50108a"]) expect(typesOf(id)).toEqual(["lock"]);
    for (const n of ["50181", "50182", "50183"])
      for (const f of ["a", "b"]) expect(typesOf(`${n}${f}`)).toEqual(["secret"]);
  });

  it("defines a type on no other aos card", () => {
    const withType = AOS_CARDS.filter((c) => c.definedCounterTypes !== undefined).map((c) => c.id as string);
    expect(withType.sort()).toEqual(
      ["50105a", "50106a", "50107a", "50108a", "50181a", "50181b", "50182a", "50182b", "50183a", "50183b"].sort(),
    );
  });
});

describe("aos data: the Thunderbolt minion to encounter set map (MC50 p. 15, p. 19)", () => {
  it("is derived from the trait: Jolt plus ten Elite minions, one per set", () => {
    const map = Object.fromEntries(
      AOS_THUNDERBOLT_MINIONS.map((m) => [m.minionId as string, m.encounterSetId as string]),
    );
    expect(map).toEqual({
      "50133": "thunderbolts",
      "50139": "gravitational_pull",
      "50143": "hard_sound",
      "50148": "pale_little_spider",
      "50152": "power_of_the_atom",
      "50156": "supersonic",
      "50161": "the_leaper",
      "51039": "extreme_risk",
      "52035": "growing_strong",
      "53038": "techno",
      "54034": "whiteout",
    });
    expect(AOS_THUNDERBOLT_MINIONS.filter((m) => !m.elite).map((m) => m.minionId as string)).toEqual(["50133"]);
  });

  it("agrees with a fresh derivation over the whole wave 9 pool (no Thunderbolt minion outside these five packs)", () => {
    expect(thunderboltMinions(WAVE9_CARDS).map((m) => m.minionId as string)).toEqual(
      AOS_THUNDERBOLT_MINIONS.map((m) => m.minionId as string).sort(),
    );
  });

  it("holds ten sets with an Elite, Thunderbolt minion, Jolt's Thunderbolts set not among them", () => {
    expect([...AOS_THUNDERBOLT_POOL_SET_IDS].map(String).sort()).toEqual(
      [
        "extreme_risk",
        "gravitational_pull",
        "growing_strong",
        "hard_sound",
        "pale_little_spider",
        "power_of_the_atom",
        "supersonic",
        "techno",
        "the_leaper",
        "whiteout",
      ].sort(),
    );
  });

  it("the Thunderbolts scenario record's pool is the box's six of those ten (the four hero-pack sets are not in it)", () => {
    const record =
      AOS_SCENARIOS.find((s) => (s.id as string) === "thunderbolts")?.modularSetPool?.setIds.map(String) ?? [];
    const derived = AOS_THUNDERBOLT_POOL_SET_IDS.map(String);
    expect(record.every((s) => derived.includes(s))).toBe(true);
    expect(derived.filter((s) => !record.includes(s)).sort()).toEqual([
      "extreme_risk",
      "growing_strong",
      "techno",
      "whiteout",
    ]);
  });
});
