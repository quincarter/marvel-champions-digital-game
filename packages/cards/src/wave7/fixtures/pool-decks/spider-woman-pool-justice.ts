import { cardId } from "@mc/content";
import type { PoolFixture } from "./types.js";

const line = (id: string, quantity: number) => ({ cardId: cardId(id), quantity });

/**
 * Spider-Woman: two aspects, equal cards per aspect. Her 15 + 13 'Pool + 11 Justice + 3 basic resources = 42. Her 2
 * Inconspicuous print Justice and count toward it (FFG ruling Mar 22, 2024, #153), so 13 'Pool match 11 + 2 Justice.
 */
export const SPIDER_WOMAN_POOL_JUSTICE: PoolFixture = {
  id: "spider-woman-pool-justice",
  name: "Spider-Woman 'Pool and Justice",
  idea: "The Aggression & Justice starter with 'Pool in place of Aggression: thirteen 'Pool to the starter's eleven Justice plus Inconspicuous.",
  identityCardId: cardId("04031a"),
  aspects: ["pool", "justice"],
  cards: [
    line("04032", 1),
    line("04033", 2),
    line("04034", 1),
    line("04035", 2),
    line("04036", 2),
    line("04037", 2),
    line("04038", 2),
    line("04039", 3),
    // 'Pool, 13.
    line("44015", 1), // Kidpool
    line("44017", 3), // Barely a Scratch
    line("44021", 3), // "I Got This"
    line("44029", 3), // Healing Factor
    line("44054", 3), // Distraction
    // Justice, 11 (as the starter deck).
    line("04045", 1),
    line("04046", 2),
    line("04047", 3),
    line("04048", 2),
    line("04049", 3),
    line("04050", 1), // Energy
    line("04051", 1), // Genius
    line("04052", 1), // Strength
  ],
};
