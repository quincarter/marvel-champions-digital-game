import { cardId } from "@mc/content";
import type { PoolFixture } from "./types.js";

const line = (id: string, quantity: number) => ({ cardId: cardId(id), quantity });

/** Domino (NeXt Evolution), 'Pool: 15 hero cards + 25 'Pool = 40. Includes the 'Pool player side scheme Live Dangerously. */
export const DOMINO_POOL: PoolFixture = {
  id: "domino-pool",
  name: "Domino 'Pool",
  idea: "A wave 7 hero choosing 'Pool: Deadpool Corps allies, Mulligans and Live Dangerously.",
  identityCardId: cardId("40037a"),
  aspects: ["pool"],
  cards: [
    line("40038", 1),
    line("40039", 1),
    line("40040", 2),
    line("40041", 1),
    line("40042", 2),
    line("40043", 1),
    line("40044", 1),
    line("40045", 1),
    line("40046", 2),
    line("40047", 1),
    line("40048", 1),
    line("40049", 1),
    line("44013", 1), // Dogpool
    line("44014", 1), // Headpool
    line("44016", 1), // Lady Deadpool
    line("44045", 1), // Pandapool
    line("44017", 2), // Barely a Scratch
    line("44021", 3), // "I Got This"
    line("44048", 3), // Mulligan
    line("44023", 1), // 'Pool Inspection
    line("44022", 1), // Not my Responsibility
    line("44047", 1), // Get in Front of Me!
    line("44025", 1), // Self Confidence
    line("44026", 1), // Self Control
    line("44029", 3), // Healing Factor
    line("44051", 3), // Ambush
    line("44053", 1), // Blackout
    line("44024", 1), // Live Dangerously (player side scheme)
  ],
};
