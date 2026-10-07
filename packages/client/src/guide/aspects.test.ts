import { CORE_STARTER_DECKS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { CARDS_BY_ID, POOL_STARTER_DECKS } from "../content/pool.js";
import { termTextModelOf } from "../view/term-text-model.js";
import { ASPECT_GUIDES, aspectGuideOf, devAspectOf, type AspectGuide } from "./aspects.js";

function preconOf(guide: AspectGuide) {
  if (!guide.preconId) return undefined;
  const precon = POOL_STARTER_DECKS.find((deck) => deck.id === guide.preconId);
  if (!precon) throw new Error(`no precon ${guide.preconId} for aspect ${guide.aspect}`);
  return precon;
}

describe("ASPECT_GUIDES", () => {
  it("has one entry per aspect (the four Core ones, then 'pool) plus basic", () => {
    expect(ASPECT_GUIDES.map((guide) => guide.aspect)).toEqual([
      "justice",
      "aggression",
      "leadership",
      "protection",
      "pool",
      "basic",
    ]);
  });

  it("teaches the Dreadpool rule on the 'pool page: choosing it adds the set, other decks' 'Pool cards do not", () => {
    const pool = aspectGuideOf("pool")!;
    expect(pool.preconId).toBe("deadpool-pool");
    expect(pool.whatItsFor).toContain("[[poolAspect|");
    const copy = [pool.whatItsFor, ...pool.pickItWhen].join(" ");
    expect(copy).toMatch(/Dreadpool set/);
    expect(copy).toMatch(/another aspect's deck/);
  });

  it("keeps every Core aspect's precon in the Core list", () => {
    for (const guide of ASPECT_GUIDES) {
      if (guide.aspect === "basic" || guide.aspect === "pool") continue;
      expect(CORE_STARTER_DECKS.some((deck) => deck.id === guide.preconId)).toBe(true);
    }
  });

  it("gives every non-basic aspect a precon that is actually tagged with that aspect", () => {
    for (const guide of ASPECT_GUIDES) {
      if (guide.aspect === "basic") {
        expect(guide.preconId).toBeNull();
        continue;
      }
      const precon = preconOf(guide);
      expect(precon).toBeDefined();
      expect(precon!.aspects).toContain(guide.aspect);
    }
  });

  for (const guide of ASPECT_GUIDES) {
    describe(`${guide.aspect} signature cards`, () => {
      const precon = preconOf(guide);

      it("has two or three signature cards (basic has none)", () => {
        if (guide.aspect === "basic") {
          expect(guide.signatureCardCodes).toHaveLength(0);
        } else {
          expect(guide.signatureCardCodes.length).toBeGreaterThanOrEqual(2);
          expect(guide.signatureCardCodes.length).toBeLessThanOrEqual(3);
        }
      });

      for (const code of guide.signatureCardCodes) {
        it(`${code}: is a card in the app's pool with the ${guide.aspect} aspect, in the ${guide.aspect} precon`, () => {
          const card = CARDS_BY_ID.get(code as string);
          expect(card, `${code} is not in the pool`).toBeDefined();
          expect(card!.setCode, `${code} is not from the aspect's own box`).toBe(
            guide.aspect === "pool" ? "deadpool" : "core",
          );
          expect("aspect" in card!, `${code} is not a player card with an aspect`).toBe(true);
          expect((card as { aspect?: string }).aspect, `${code} is not printed with the ${guide.aspect} aspect`).toBe(
            guide.aspect,
          );
          expect(
            precon!.cards.some((entry) => entry.cardId === code),
            `${code} is not in the ${guide.aspect} Core precon (${guide.preconId})`,
          ).toBe(true);
        });
      }
    });
  }

  it("resolves every [[id]] glossary term used in the copy", () => {
    const unresolved: string[] = [];
    for (const guide of ASPECT_GUIDES) {
      for (const text of [guide.whatItsFor, ...guide.pickItWhen]) {
        const model = termTextModelOf(text, undefined, false);
        for (const id of model.unknownIds) unresolved.push(`${guide.aspect}: ${id}`);
      }
    }
    expect(unresolved).toEqual([]);
  });
});

describe("aspectGuideOf", () => {
  it("finds a guide by aspect", () => {
    expect(aspectGuideOf("justice")?.name).toBe("Justice");
  });

  it("returns undefined for an aspect with no guide (basic's is its own, so none here)", () => {
    expect(aspectGuideOf("pool")?.name).toBe("'Pool");
    expect(aspectGuideOf("basic")?.name).toBe("Basic");
  });
});

describe("devAspectOf", () => {
  it("accepts every aspect that has a guide", () => {
    for (const guide of ASPECT_GUIDES) expect(devAspectOf(guide.aspect)).toBe(guide.aspect);
  });

  it("falls back to Justice for a missing or unknown aspect", () => {
    expect(devAspectOf(null)).toBe("justice");
    expect(devAspectOf("nope")).toBe("justice");
  });
});
