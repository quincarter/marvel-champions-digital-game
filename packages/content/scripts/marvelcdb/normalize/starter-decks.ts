/** Step 10: starter decks (precons) from curation, checked against the cards just emitted. */
import type { CoreAspect, StarterDeck } from "../../../src/schema/index.ts";
import { brand } from "./brand.ts";
import type { NormalizeContext } from "./context.ts";

export function normalizeStarterDecks(ctx: NormalizeContext): StarterDeck[] {
  const { errors, cards } = ctx;
  const byId = new Map(cards.map((c) => [c.id as string, c]));
  return ctx.curation.starterDecks.map((d) => {
    const identity = byId.get(d.identityCode);
    if (!identity || identity.type !== "hero_identity")
      errors.push(`deck ${d.id}: ${d.identityCode} is not an identity`);
    let total = 0;
    for (const [code, qty] of Object.entries(d.cards)) {
      total += qty;
      const card = byId.get(code);
      if (!card) {
        errors.push(`deck ${d.id}: unknown card ${code}`);
        continue;
      }
      if (!("aspect" in card)) {
        errors.push(`deck ${d.id}: ${code} is not a player card`);
        continue;
      }
      if (qty > card.quantityInSet) errors.push(`deck ${d.id}: ${qty}× ${code} but one box has ${card.quantityInSet}`);
      if (qty > card.deckLimit) errors.push(`deck ${d.id}: ${qty}× ${code} exceeds deck limit ${card.deckLimit}`);
      const secondaryAspects: readonly CoreAspect[] = d.secondaryAspects ?? [];
      const offAspectAllowanceCodes = d.offAspectAllowanceCodes ?? [];
      const ok =
        card.aspect === `hero:${d.identityCode}` ||
        card.aspect === d.aspect ||
        secondaryAspects.includes(card.aspect as CoreAspect) ||
        offAspectAllowanceCodes.includes(code) ||
        card.aspect === "basic";
      if (!ok) errors.push(`deck ${d.id}: ${code} has aspect ${card.aspect}`);
    }
    // RRG 1.8 Appendix I, p. 50: "a minimum of 40 cards and a maximum of 50 cards" (identity/permanent cards
    // excluded — no wave 4 precon carries either). Most precons are printed at exactly 40, but not all are (the
    // Vision Hero Pack's own reference card prints a 41-card deck, cross-checked wave 4 against MarvelCDB's
    // community "Vision - Precon" decklist) — so this only enforces the legal range, not a fixed count.
    if (total < 40 || total > 50) errors.push(`deck ${d.id}: ${total} cards, expected 40-50`);
    // Deckbuilding rule (L2P p.22): every hero-kit card, at its exact kit quantity. Separate-deck cards (docs/
    // phase7-wave1.md §1.9 — Doctor Strange's Invocation deck) are exempt: they carry the identity's `hero:<id>`
    // aspect too, but `StarterDeck.cards` never lists them — the identity's own `separateDecks` defines them, and
    // setup builds that deck independently of the 40-card player deck.
    for (const card of cards) {
      if (
        "aspect" in card &&
        card.aspect === `hero:${d.identityCode}` &&
        !("separateDeck" in card && card.separateDeck !== undefined) &&
        d.cards[card.id] !== card.quantityInSet
      ) {
        errors.push(`deck ${d.id}: hero card ${card.id} must be included ×${card.quantityInSet}`);
      }
    }
    if (identity?.type === "hero_identity") {
      if (identity.obligationCardId !== d.obligationCode) {
        errors.push(
          `deck ${d.id}: source lists obligation ${d.obligationCode}, identity links ${identity.obligationCardId}`,
        );
      }
      const nemesis = cards
        .filter(
          (c) =>
            "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes(identity.nemesisEncounterSetId),
        )
        .map((c) => c.id as string)
        .sort();
      if (nemesis.join() !== [...d.nemesisCodes].sort().join()) {
        errors.push(`deck ${d.id}: source nemesis set [${d.nemesisCodes.join()}] != data [${nemesis.join()}]`);
      }
    }
    return {
      id: brand("deck", d.id),
      name: d.name,
      packCode: ctx.setCode,
      identityCardId: brand("card", d.identityCode),
      aspects: [d.aspect, ...(d.secondaryAspects ?? [])],
      cards: Object.entries(d.cards)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cardId, quantity]) => ({ cardId: brand("card", cardId), quantity })),
      provenance: { verified: d.verified, sources: [...d.sources], ...(d.note ? { note: d.note } : {}) },
    };
  });
}
