import { cardId } from "@mc/content";
import type { PoolFixture } from "./types.js";

const line = (id: string, quantity: number) => ({ cardId: cardId(id), quantity });

/**
 * Cable, Leadership, with one 'Pool card: Live Dangerously (44024), a 'Pool player side scheme. Cable's identity text
 * allows player side schemes from any aspect. This is the legal deck the Crisis of Infinite Deadpools FAQ (RRG p. 64)
 * describes: 'Pool cards in a deck whose chosen aspect is not 'Pool. 15 hero cards + 25 = 40.
 */
export const CABLE_LEADERSHIP_LIVE_DANGEROUSLY: PoolFixture = {
  id: "cable-leadership-live-dangerously",
  name: "Cable Leadership with Live Dangerously",
  idea: "A Leadership Cable that borrows one 'Pool player side scheme; no Dreadpool set joins the game.",
  identityCardId: cardId("40001a"),
  aspects: ["leadership"],
  cards: [
    line("40002", 1),
    line("40003", 3),
    line("40004", 1),
    line("40005", 2),
    line("40006", 1),
    line("40007", 1),
    line("40008", 1),
    line("40009", 1),
    line("40010", 1),
    line("40011", 1),
    line("40012", 1),
    line("40013", 1),
    line("01066", 1), // Hawkeye
    line("01067", 1), // Maria Hill
    line("01069", 3), // Get Ready
    line("01070", 3), // Lead from the Front
    line("01071", 3), // Make the Call
    line("01072", 2), // The Power of Leadership
    line("01073", 1), // The Triskelion
    line("01074", 3), // Inspired
    line("44024", 1), // Live Dangerously ('Pool, player side scheme)
    line("01088", 1), // Energy (basic)
    line("01089", 1), // Genius (basic)
    line("01090", 1), // Strength (basic)
    line("01085", 2), // Emergency (basic)
    line("01086", 1), // First Aid (basic)
    line("44031", 1), // Frenemies (basic Team-Up for Cable and Deadpool)
  ],
};
