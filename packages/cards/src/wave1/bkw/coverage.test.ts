/**
 * Local coverage for the `bkw` pack (docs/phase7-wave1-scripting.md "What to deliver" §5) — never touches the
 * shared `../coverage.test.ts` (its `PACK_STATUS`/registration line are the main session's to update once this
 * pack is merged into `WAVE1_ABILITIES`). Every `bkw` card's ability reference must resolve — through this pack's
 * own `BKW_ABILITIES`, or aliased as a Core reprint by `../reprints.ts` — except the two recorded, cited gaps (see
 * the doc comments on `BKW_NEMESIS` in `./nemesis.ts` and `BKW_OBLIGATION` in `./obligation.ts`).
 */
import { BKW_CARDS, type AnyCard } from "@mc/content";
import { WAVE1_REPRINT_ABILITIES } from "../reprints.js";
import { BKW_ABILITIES, BKW_NEMESIS_SKIPPED, BKW_OBLIGATION_SKIPPED } from "./index.js";

function abilityRefIds(card: AnyCard): string[] {
  switch (card.type) {
    case "hero_identity":
      return [...card.hero.abilities, ...card.alterEgo.abilities].map((ref) => ref.id);
    default:
      return "abilities" in card ? card.abilities.map((ref) => ref.id) : [];
  }
}

/** Ability ids intentionally left unscripted (see the doc comments on `BKW_NEMESIS`/`BKW_OBLIGATION` for the full citation). */
const SKIPPED = new Set<string>([...BKW_NEMESIS_SKIPPED, ...BKW_OBLIGATION_SKIPPED]);

describe("bkw pack ability coverage", () => {
  const allRefs = BKW_CARDS.flatMap(abilityRefIds);

  it("has 33 cards and 36 ability references (several print more than one), each id unique", () => {
    expect(BKW_CARDS).toHaveLength(33);
    // Dance of Death (08004, 4 refs — an ingestion artifact splitting 3 bulleted attacks, see `kit.ts`'s `partOf`
    // doc comment), Synth-Suit (08009, 2: constant + response), Taskmaster (08026, 2: constant + boost) and Deadly
    // Shot (08029, 2: alter-ego + hero) each print more than one ability reference.
    expect(allRefs).toHaveLength(36);
    expect(new Set(allRefs).size).toBe(allRefs.length);
  });

  it("every ability reference resolves — scripted directly, aliased as a Core reprint, or a recorded skip", () => {
    const registry: Record<string, unknown> = { ...WAVE1_REPRINT_ABILITIES, ...BKW_ABILITIES };
    const unresolved = allRefs.filter((id) => !(id in registry) && !SKIPPED.has(id));
    expect(unresolved, `unresolved bkw ability refs (not scripted, not a Core reprint, not a recorded skip):\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("every recorded skip is real (still absent from the registry) and still printed on a real card", () => {
    const registry: Record<string, unknown> = { ...WAVE1_REPRINT_ABILITIES, ...BKW_ABILITIES };
    for (const id of SKIPPED) {
      expect(registry, id).not.toHaveProperty(id);
      expect(allRefs, id).toContain(id);
    }
  });

  it("9 of the 33 references are Core reprints (Power of Justice, Interrogation Room, Surveillance Team, Nick Fury, Hydra Mercenary)", () => {
    const reprintIds = [
      "08014.the-power-of-justice-constant",
      "08015.interrogation-room-response",
      "08016.surveillance-team-action",
      "08019.nick-fury-forced-response",
    ];
    for (const id of reprintIds) expect(allRefs, id).toContain(id);
    // Energy (08020), Genius (08021) and Strength (08022) print no ability at all (basic resource cards); Hydra
    // Mercenary (08028, nemesis set) prints no ability of its own either (just the Guard keyword).
    const noAbilityCards = ["08020", "08021", "08022", "08028"];
    for (const code of noAbilityCards) {
      const card = BKW_CARDS.find((c) => (c.id as unknown as string) === code);
      expect(card && "abilities" in card ? card.abilities : [], code).toEqual([]);
    }
  });
});
