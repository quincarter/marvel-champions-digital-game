import { cardId } from "@mc/content";
import type { PoolFixture } from "./types.js";

const line = (id: string, quantity: number) => ({ cardId: cardId(id), quantity });

/** Spider-Man (Peter Parker, Core), 'Pool: 15 hero cards + 25 'Pool = 40. */
export const SPIDER_MAN_POOL: PoolFixture = {
  id: "spider-man-pool",
  name: "Spider-Man 'Pool",
  idea: "A Core hero choosing 'Pool: defense and cheap upgrades, a row of resources and four allies.",
  identityCardId: cardId("01001a"),
  aspects: ["pool"],
  cards: [
    line("01002", 1),
    line("01003", 2),
    line("01004", 2),
    line("01005", 3),
    line("01006", 1),
    line("01007", 2),
    line("01008", 2),
    line("01009", 2),
    line("44015", 1), // Kidpool
    line("44016", 1), // Lady Deadpool
    line("44043", 1), // Bob, Agent of Hydra
    line("44044", 1), // Negasonic Teenage Warhead
    line("44017", 3), // Barely a Scratch
    line("44021", 3), // "I Got This"
    line("44022", 1), // Not my Responsibility
    line("44025", 1), // Self Confidence
    line("44026", 1), // Self Control
    line("44027", 1), // Self Preservation
    line("44029", 3), // Healing Factor
    line("44054", 3), // Distraction
    line("44051", 3), // Ambush
    line("44030", 1), // Stick-To-Itiveness
    line("44050", 1), // Plot Convenience
  ],
};
