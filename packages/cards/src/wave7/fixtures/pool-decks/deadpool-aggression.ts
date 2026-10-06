import { cardId } from "@mc/content";
import type { PoolFixture } from "./types.js";

const line = (id: string, quantity: number) => ({ cardId: cardId(id), quantity });

/** Deadpool, Aggression: 15 hero cards + 16 Aggression + 9 basic = 40. No 'Pool card: the aspect is not 'Pool. */
export const DEADPOOL_AGGRESSION: PoolFixture = {
  id: "deadpool-aggression",
  name: "Deadpool Aggression",
  idea: "Core Aggression attacks and basic Haymakers around Deadpool's own kit; legally holds no 'Pool card.",
  identityCardId: cardId("44001a"),
  aspects: ["aggression"],
  cards: [
    line("44002", 1),
    line("44003", 1),
    line("44004", 2),
    line("44005", 1),
    line("44006", 2),
    line("44007", 1),
    line("44008", 1),
    line("44009", 1),
    line("44010", 2),
    line("44011", 1),
    line("44012", 2),
    line("01050", 1), // Hulk
    line("01051", 1), // Tigra
    line("01052", 3), // Chase Them Down
    line("01053", 3), // Relentless Assault
    line("01054", 2), // Uppercut
    line("01055", 2), // The Power of Aggression
    line("01056", 2), // Tac Team
    line("01057", 2), // Combat Training
    line("01087", 3), // Haymaker (basic)
    line("01085", 2), // Emergency (basic)
    line("01086", 1), // First Aid (basic)
    line("01088", 1), // Energy (basic)
    line("01089", 1), // Genius (basic)
    line("01090", 1), // Strength (basic)
  ],
};
