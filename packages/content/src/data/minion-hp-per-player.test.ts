import { describe, expect, it } from "vitest";
import {
  CORE_CARDS,
  WAVE1_CARDS,
  WAVE2_CARDS,
  WAVE3_CARDS,
  WAVE4_CARDS,
  WAVE5_CARDS,
  WAVE6_CARDS,
  WAVE7_CARDS,
  WAVE8_CARDS,
} from "./index.js";

/**
 * Every shipped minion whose hit points are printed with the per player icon (MarvelCDB `health_per_hero`; RRG 1.8 "Per
 * Player Icon", p. 32), with the numeral printed before the icon. A minion missing from this list has a flat value.
 */
const PER_PLAYER: Readonly<Record<string, number>> = {
  // The Rise of Red Skull: The Sleeper.
  "04130": 5,
  // The Mad Titan's Shadow: Garm, Skurge, Nidhogg (Hela), Black Swan (the back of Save the Shawarma Place).
  "21143": 4,
  "21144": 5,
  "21145": 6,
  "21182b": 4,
  // MojoMania: Surprise Contender, Dragon, The Kraken.
  "39007": 7,
  "39042": 10,
  "39050": 6,
  // Age of Apocalypse: the five Overseers (a) and their Prelate faces (b).
  "45179a": 5,
  "45179b": 5,
  "45180a": 5,
  "45180b": 5,
  "45181a": 5,
  "45181b": 5,
  "45182a": 5,
  "45182b": 5,
  "45183a": 5,
  "45183b": 5,
  // Ronan modular set (print and play): Ronan the Accuser.
  "90001": 9,
};

describe("minions with hit points per player", () => {
  it("are exactly the cards MarvelCDB marks health_per_hero, each with its printed numeral", () => {
    const all = [
      ...CORE_CARDS,
      ...WAVE1_CARDS,
      ...WAVE2_CARDS,
      ...WAVE3_CARDS,
      ...WAVE4_CARDS,
      ...WAVE5_CARDS,
      ...WAVE6_CARDS,
      ...WAVE7_CARDS,
      ...WAVE8_CARDS,
    ];
    const found: Record<string, number> = {};
    for (const card of all) if (card.type === "minion" && card.hpPerPlayer) found[card.id] = card.hp;
    expect(found).toEqual(PER_PLAYER);
  });
});
