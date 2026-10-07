import { cardId } from "@mc/content";
import type { PoolFixture } from "./types.js";

const line = (id: string, quantity: number) => ({ cardId: cardId(id), quantity });

/**
 * Adam Warlock: four aspects, equal cards per aspect, one copy of any card outside his set. 'Pool takes Aggression's
 * place (Deadpool insert FAQ, RRG p. 64): his 15 + 6 'Pool + 6 Justice + 6 Leadership + 6 Protection + Martinex = 40.
 */
export const ADAM_WARLOCK_POOL: PoolFixture = {
  id: "adam-warlock-pool",
  name: "Adam Warlock 'Pool, Justice, Leadership, Protection",
  idea: "The four-aspect starter with 'Pool where Aggression was.",
  identityCardId: cardId("21031a"),
  aspects: ["pool", "justice", "leadership", "protection"],
  cards: [
    line("21032", 1),
    line("21033", 1),
    line("21034", 1),
    line("21035", 1),
    line("21036", 2),
    line("21037", 2),
    line("21038", 3),
    line("21039", 2),
    line("21040", 2),
    // 'Pool, 6.
    line("44043", 1), // Bob, Agent of Hydra
    line("44045", 1), // Pandapool
    line("44017", 1), // Barely a Scratch
    line("44021", 1), // "I Got This"
    line("44029", 1), // Healing Factor
    line("44025", 1), // Self Confidence
    // Justice, 6 (as the starter deck).
    line("21047", 1),
    line("21048", 1),
    line("21049", 1),
    line("21050", 1),
    line("21051", 1),
    line("21052", 1),
    // Leadership, 6.
    line("21053", 1),
    line("21054", 1),
    line("21055", 1),
    line("21056", 1),
    line("21057", 1),
    line("21058", 1),
    // Protection, 6.
    line("21059", 1),
    line("21060", 1),
    line("21061", 1),
    line("21062", 1),
    line("21063", 1),
    line("21064", 1),
    line("21065", 1), // Martinex (basic)
  ],
};
