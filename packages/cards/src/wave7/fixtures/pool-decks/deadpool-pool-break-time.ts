import { cardId } from "@mc/content";
import type { PoolFixture } from "./types.js";

const line = (id: string, quantity: number) => ({ cardId: cardId(id), quantity });

/** Deadpool, 'Pool: 15 hero cards + 25 'Pool = 40. Break Time and Git Gud, chatty allies, no Restricted 'Pool weapon. */
export const DEADPOOL_POOL_BREAK_TIME: PoolFixture = {
  id: "deadpool-pool-break-time",
  name: "Deadpool 'Pool: Break Time",
  idea: "Four 'Pool allies, Break Time and Git Gud, cheap Healing Factor and Distraction; the Katanas are the only Restricted cards.",
  identityCardId: cardId("44001a"),
  aspects: ["pool"],
  cards: [
    // Deadpool's own 15.
    line("44002", 1), // Cable
    line("44003", 1), // Exhausting Personality
    line("44004", 2), // Maximum Effort
    line("44005", 1), // Metaknowledge
    line("44006", 2), // "Yoo-Hoo!"
    line("44007", 1), // Montage
    line("44008", 1), // Chimichanga Truck
    line("44009", 1), // Armed to the Teeth
    line("44010", 2), // Deadpool's Katana
    line("44011", 1), // It Ain't Over...
    line("44012", 2), // This Card is Fire
    // 'Pool, 25.
    line("44013", 1), // Dogpool
    line("44043", 1), // Bob, Agent of Hydra
    line("44044", 1), // Negasonic Teenage Warhead
    line("44045", 1), // Pandapool
    line("44017", 3), // Barely a Scratch
    line("44046", 1), // Break Time
    line("44048", 2), // Mulligan
    line("44021", 2), // "I Got This"
    line("44018", 1), // Cutupper
    line("44047", 1), // Get in Front of Me!
    line("44025", 1), // Self Confidence
    line("44026", 1), // Self Control
    line("44028", 1), // Git Gud
    line("44029", 3), // Healing Factor
    line("44054", 3), // Distraction
    line("44049", 1), // Deadpool Corps Ship
    line("44050", 1), // Plot Convenience
  ],
};
