import { CORE_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { termTextModelOf } from "../view/term-text-model.js";
import { ASPECT_GUIDES, aspectGuideOf, type AspectGuide } from "./aspects.js";

const CORE_CARDS_BY_ID = new Map(PLAYABLE_CARDS.map((card) => [card.id, card]));

function preconOf(guide: AspectGuide) {
  if (!guide.preconId) return undefined;
  const precon = CORE_STARTER_DECKS.find((deck) => deck.id === guide.preconId);
  if (!precon) throw new Error(`no Core precon ${guide.preconId} for aspect ${guide.aspect}`);
  return precon;
}

describe("ASPECT_GUIDES", () => {
  it("has one entry per playable aspect (justice, aggression, leadership, protection) plus basic", () => {
    expect(ASPECT_GUIDES.map((guide) => guide.aspect)).toEqual([
      "justice",
      "aggression",
      "leadership",
      "protection",
      "basic",
    ]);
  });

  it("has no 'pool' entry yet", () => {
    expect(ASPECT_GUIDES.some((guide) => guide.aspect === "pool")).toBe(false);
  });

  it("gives every non-basic aspect a Core precon that is actually tagged with that aspect", () => {
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
        it(`${code}: is a Core Set card in the playable pool with the ${guide.aspect} aspect, in the ${guide.aspect} precon`, () => {
          const card = CORE_CARDS_BY_ID.get(code);
          expect(card, `${code} is not in the playable pool`).toBeDefined();
          expect(card!.setCode, `${code} is not a Core Set card`).toBe("core");
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

  it("returns undefined for an aspect with no guide yet ('pool')", () => {
    expect(aspectGuideOf("pool")).toBeUndefined();
  });
});
