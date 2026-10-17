/**
 * Rules audit chunk 38 (FFG rulings post-RRG 1.5, Aug-Oct 2023). Audit proofs only: each `it.fails` marks a place the
 * engine does something an official source forbids, and flips to a failure when it is fixed.
 *
 * FFG ruling, Oct 26, 2023 (post-RRG 1.5 #102, Old Rivals): "Yes, players can defend against the attack from Old
 * Rivals. ... the rules do not restrict an attacking character and a defending character from being the same
 * character." RRG 1.8 "Defend, Defense" (p. 15) says "During an enemy attack, a player may defend" and is silent on a
 * friendly character's attack, so the ruling is not contradicted. The Old Rivals errata (RRG 1.8 p. 62/67) keeps the
 * attack ("she attacks you ... resolve her ATK against you").
 */
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import { mustInstance, mustPlayer } from "../query.js";
import type { TargetRef } from "../spec.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { stubAlly, stubEvent, stubTreachery } from "../testing/fixtures.js";
import { TREACHERY } from "../testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay, playFree } from "../testing/wave3.js";

const gamora: TargetRef = { kind: "each", query: { categories: ["hero", "ally"], name: "Gamora" } };
const RIVALS_REVEALED = stubAbility("rivals.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "friendlyCharacterAttacks", attacker: gamora, player: { kind: "controller" }, bind: "rival" }],
});
const RIVALS = stubTreachery({ id: "old-rivals", boostIcons: 0, abilities: [RIVALS_REVEALED.ref] });
const GAMORA = {
  ...stubAlly({ id: "gamora", cost: 3, atk: 3, thw: 1, hp: 5, consequentialAttack: 1 }),
  name: "Gamora",
};
const REVEAL_ABILITY = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});
const REVEAL = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL_ABILITY.ref] });
const deps: EngineDeps = depsOf(RIVALS_REVEALED, REVEAL_ABILITY);

describe("chunk 38, ruling 102 (Oct 26, 2023): defending against Old Rivals", () => {
  it.fails("the attacked player is offered a defender declaration before Gamora's ATK is dealt", () => {
    const base = gameAtFirstTurn({
      cards: [RIVALS, GAMORA, REVEAL],
      deps,
      encounter: [RIVALS.id, ...copiesOf(TREACHERY.id, 10)],
      deck: [GAMORA.id, REVEAL.id, REVEAL.id, REVEAL.id],
    });
    const placed = playerCardIntoPlay(base, GAMORA.id);
    const state = onTopOfEncounterDeck(placed.state, RIVALS.id);
    const after = playFree(state, deps, REVEAL.id).state;
    const damage = mustInstance(after, mustPlayer(after, P1).identity.instanceId).damage;
    // Fixed behavior: the engine stops on a defender prompt and no damage has been dealt yet.
    expect(after.pendingChoice?.prompt.kind).toBe("declareDefender");
    expect(damage).toBe(0);
  });
});
