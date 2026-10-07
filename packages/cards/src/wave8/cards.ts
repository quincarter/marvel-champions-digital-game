/**
 * The wave 8 (cycle 8, Age of Apocalypse) card pool: Core plus the five wave 8 packs (`aoa`, `iceman`, `jubilee`,
 * `ncrawler`, `magneto`), exactly `@mc/content`'s `WAVE8_CARDS`. It is not part of `PLAYABLE_CARDS` yet (the wave is
 * unscripted), so this is a re-export, not an alias of the playable pool.
 */
import { WAVE8_CARDS as CONTENT_WAVE8_CARDS, type AnyCard } from "@mc/content";

/** Every card the wave 8 scenarios and decks can name, each exactly once. */
export const WAVE8_CARDS: readonly AnyCard[] = CONTENT_WAVE8_CARDS;
