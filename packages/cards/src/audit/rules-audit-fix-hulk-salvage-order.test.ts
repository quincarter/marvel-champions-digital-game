/**
 * Hulk ally (01050) discarding a [wild] card (Salvage-like), RRG 1.8 p. 61 FAQ "Salvage (#33)": the check is of all the
 * printed resources at once, so "the player who controls Hulk chooses the order in which the effects resolve". With
 * Hulk one damage from defeat, [energy] first defeats him, while [mental] first discards him without a defeat.
 */
import { activeVillain, type Command, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { coreScenario } from "../core/setup.js";
import {
  P1,
  firstLegal,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  settle,
  startCoreGame,
  type Picker,
  toHero,
} from "../testing/harness.js";

const WILD_CARD = "01030"; // a Core card whose only printed resource is [wild], as Salvage's [wild] resource
const game = () =>
  startCoreGame(coreScenario("rhino", { players: [{ starterDeckId: "core-she-hulk-aggression" }], seed: 21 }));

describe("Hulk milling a [wild] card: the controller orders the results", () => {
  it("offers physical, energy and mental, and resolves them in the chosen order", () => {
    const given = moveToHand(game(), P1, "01050");
    const [hulk] = given.ids as [InstanceId];
    const hero = settle(run(given.state, toHero()));
    const withHulk = run(hero, play(P1, hulk, payWith(hero, P1, 2, given.ids)));
    // The top card of the deck becomes a [wild] card; Hulk is one damage from defeat (5 HP).
    const top = playerOf(withHulk, P1).deck[0]!;
    const staged = patchInstance(patchInstance(withHulk, top, { cardId: cardId(WILD_CARD) }), hulk, { damage: 4 });
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hulk,
      targetInstanceId: activeVillain(staged).instanceId,
    };
    const offered: string[] = [];
    const pick: Picker = (s) => {
      const options = s.pendingChoice!.options.map((o) => o.optionId as string);
      if (options.length === 3) {
        offered.push(...options);
        return [...options].reverse(); // the player puts the last-offered line ([mental]) first
      }
      return firstLegal(s);
    };
    const current = settle(run(staged, attack), pick);
    expect(offered).toHaveLength(3);
    // Mental first: Hulk is discarded alive, so the [energy] damage never reaches him (no defeat).
    expect(playerOf(current, P1).discard).toContain(hulk);
    expect(inst(current, hulk).damage).toBe(0);
  });
});
