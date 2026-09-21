/**
 * Step 2: identity separate decks from curation (docs/phase7-wave1.md §1.9 — Doctor Strange's Invocation deck).
 *
 * A card listed here is a member of an identity's separate deck rather than a player deck: it gets `deckLimit: 0` and
 * `separateDeck: <deckName>` regardless of MarvelCDB's own (typically absent) `deck_limit`.
 */
import type { AnyCard, IdentitySeparateDeck } from "../../../src/schema/index.ts";
import { brand } from "./brand.ts";
import type { NormalizeContext } from "./context.ts";

export interface SeparateDeckMembership {
  readonly identityCode: string;
  readonly deckName: string;
}

export interface SeparateDecks {
  /** Which separate deck a raw card code belongs to. */
  readonly ofCode: ReadonlyMap<string, SeparateDeckMembership>;
  /** Each identity's separate decks, by identity code. */
  readonly byIdentity: ReadonlyMap<string, IdentitySeparateDeck[]>;
}

export function collectSeparateDecks(ctx: NormalizeContext): SeparateDecks {
  const ofCode = new Map<string, SeparateDeckMembership>();
  const byIdentity = new Map<string, IdentitySeparateDeck[]>();
  for (const sd of ctx.curation.separateDecks ?? []) {
    const deckCards: { cardId: AnyCard["id"]; quantity: number }[] = [];
    for (const code of sd.cardCodes) {
      ofCode.set(code, { identityCode: sd.identityCode, deckName: sd.deckName });
      const raw = ctx.byCode.get(code);
      if (!raw) {
        ctx.errors.push(`separate deck ${sd.deckName}: unknown card ${code}`);
        continue;
      }
      deckCards.push({ cardId: brand("card", code), quantity: raw.quantity });
    }
    const list = byIdentity.get(sd.identityCode) ?? [];
    list.push({
      name: sd.deckName,
      cards: deckCards,
      topCardFaceup: true,
      discardPile: "own",
      whenEmpty: "reshuffleDiscardWithoutPenalty",
    });
    byIdentity.set(sd.identityCode, list);
  }
  return { ofCode, byIdentity };
}
