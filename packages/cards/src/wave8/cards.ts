/**
 * The wave 8 (cycle 8, Age of Apocalypse) card pool: every earlier playable card plus the five wave 8 packs (`aoa`,
 * `iceman`, `jubilee`, `ncrawler`, `magneto`). `@mc/content`'s `PLAYABLE_CARDS` lists them, so this is the playable
 * pool itself (like `../wave7/cards.ts`): a modular set of any earlier box is a card the wave 8 scenario builder can
 * deal, and a wave 8 scenario seats a deck of any wave.
 */
import { PLAYABLE_CARDS, type AnyCard } from "@mc/content";

/** Every card the wave 8 scenarios and decks can name, each exactly once. */
export const WAVE8_CARDS: readonly AnyCard[] = PLAYABLE_CARDS;
