import { activeEncounterDeck, activeVillain, applyCommand } from "@mc/engine";
import { moveToDiscard } from "../../testing/staging.js";
import { characterProfile, type Command, type GameState, type InstanceId } from "@mc/engine";
import { CORE_DEPS } from "../index.js";
import { coreScenario } from "../setup.js";
import {
  answer,
  endTurn,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  P2,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  run,
  settle,
  stackEncounterDeck,
  startCoreGame,
  toHero,
} from "../../testing/harness.js";

const vsRhino = (...decks: readonly string[]) =>
  startCoreGame(coreScenario("rhino", { players: decks.map((starterDeckId) => ({ starterDeckId })), seed: 21 }));
const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const stats = (state: GameState, id: InstanceId) => {
  const profile = characterProfile(state, id, CORE_DEPS);
  return [profile?.thw, profile?.atk];
};

describe("Captain Marvel", () => {
  it("Crisis Interdiction with the Aerial trait: the second 2 threat comes off a *different* scheme", () => {
    const round2 = settle(
      run(stackEncounterDeck(vsRhino("core-captain-marvel-leadership"), "01186", "01107"), endTurn()),
    );
    const breakin = instancesOf(round2, "01107")[0] as InstanceId;
    const given = moveToHand(round2, P1, "01017", "01012"); // Cosmic Flight (gains Aerial), Crisis Interdiction
    const [flight, interdiction] = given.ids as [InstanceId, InstanceId];
    const flying = run(given.state, toHero(), play(P1, flight, payWith(given.state, P1, 2, given.ids)));
    const [mainBefore, sideBefore] = [mainThreat(flying), inst(flying, breakin).threat];
    const first = run(flying, play(P1, interdiction, payWith(flying, P1, 2, given.ids)));
    expect(first.pendingChoice?.options.map((o) => o.optionId)).toEqual([flying.mainScheme.instanceId, breakin]);
    const second = answer(first, [first.mainScheme.instanceId]);
    expect(second.pendingChoice?.options.map((o) => o.optionId)).toEqual([breakin]);
    const after = settle(answer(second, [breakin]));
    expect(mainThreat(after)).toBe(mainBefore - 2);
    expect(inst(after, breakin).threat).toBe(sideBefore - 2);
  });

  it("Lead from the Front: +1 THW/+1 ATK for each character the chosen player controls, until the end of the phase", () => {
    const start = vsRhino("core-captain-marvel-leadership", "core-spider-man-justice");
    const given = moveToHand(start, P1, "01070");
    const [lead] = given.ids as [InstanceId];
    const hero = run(given.state, toHero());
    const p2Before = stats(hero, identityOf(hero, P2));
    const choosing = run(hero, play(P1, lead, payWith(hero, P1, 2, given.ids)));
    expect(choosing.pendingChoice?.prompt.kind).toBe("choosePlayer");
    const after = settle(answer(choosing, [P1]));
    expect(stats(after, identityOf(after, P1))).toEqual([3, 3]);
    expect(stats(after, identityOf(after, P2))).toEqual(p2Before);
    const nextRound = settle(run(after, endTurn(P1), endTurn(P2)));
    expect(nextRound.round).toBe(2);
    expect(stats(nextRound, identityOf(nextRound, P1))).toEqual([2, 2]);
  });
});

describe("Black Panther", () => {
  // docs/phase7-wave3.md §4 Q16, decided by the user on 2026-09-23: an effect's "up to N" chooses at least one when
  // possible, so "Choose up to 3 different cards in your discard pile" can no longer choose none.
  it("Ancestral Knowledge: chooses 1 to 3 different cards from the discard pile, never none while it holds any", () => {
    const start = vsRhino("core-black-panther-protection");
    const [first, second] = playerOf(start, P1).deck.map((id) => inst(start, id).cardId as string);
    const discarded = moveToDiscard(moveToDiscard(start, P1, first!).state, P1, second!).state;
    const given = moveToHand(discarded, P1, "01042");
    const [knowledge] = given.ids as [InstanceId];
    const choosing = run(given.state, play(P1, knowledge, payWith(given.state, P1, 1, given.ids)));
    const choice = choosing.pendingChoice!;
    expect(choice.prompt.kind).toBe("chooseCards");
    expect(choice.minSelections).toBe(1);
    const none = applyCommand(
      choosing,
      { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [] },
      CORE_DEPS,
    );
    expect(none.ok).toBe(false);
    const after = settle(answer(choosing, [choice.options[0]!.optionId]));
    expect(playerOf(after, P1).discard).not.toContain(choice.options[0]!.optionId);
  });

  it("Wakanda Forever!: Energy Daggers hits the villain and each enemy engaged with the chosen player; Panther Claws as the final step deals 4", () => {
    const round2 = settle(
      run(stackEncounterDeck(vsRhino("core-black-panther-protection"), "01186", "01101"), endTurn()),
    );
    const mercenary = playerOf(round2, P1).playArea.find((id) => inst(round2, id).cardId === "01101") as InstanceId;
    const given = moveToHand(round2, P1, "01046", "01047", "01043a");
    const [daggers, claws, wakanda] = given.ids as [InstanceId, InstanceId, InstanceId];
    const withDaggers = run(given.state, toHero(), play(P1, daggers, payWith(given.state, P1, 2, given.ids)));
    const withClaws = run(withDaggers, play(P1, claws, payWith(withDaggers, P1, 2, given.ids)));
    const ordering = run(withClaws, play(P1, wakanda, payWith(withClaws, P1, 1, given.ids)));
    expect(ordering.pendingChoice?.prompt.kind).toBe("orderSpecials");
    const choosingPlayer = answer(ordering, [
      `${daggers}:01046.energy-daggers-special`,
      `${claws}:01047.panther-claws-special`,
    ]);
    const afterDaggers = answer(choosingPlayer, [P1]);
    expect(inst(afterDaggers, activeVillain(afterDaggers).instanceId).damage).toBe(1);
    expect(inst(afterDaggers, mercenary).damage).toBe(1);
    // Panther Claws is an attack: guard leaves only the Mercenary.
    expect(afterDaggers.pendingChoice?.options.map((o) => o.optionId)).toEqual([mercenary]);
    const after = settle(answer(afterDaggers, [mercenary]));
    expect(activeEncounterDeck(after).discard).toContain(mercenary);
  });
});

describe("She-Hulk and Aggression", () => {
  it("Superhuman Strength: +2 ATK; after She-Hulk attacks it's discarded and the attacked enemy is stunned", () => {
    const given = moveToHand(vsRhino("core-she-hulk-aggression"), P1, "01028");
    const [strength] = given.ids as [InstanceId];
    const hero = settle(run(given.state, toHero())); // declines "Do You Even Lift?"
    const strong = run(hero, play(P1, strength, payWith(hero, P1, 2, given.ids)));
    expect(characterProfile(strong, identityOf(strong), CORE_DEPS)?.atk).toBe(5);
    const after = settle(run(strong, basicAttack(strong, identityOf(strong), activeVillain(strong).instanceId)));
    expect(inst(after, activeVillain(after).instanceId)).toMatchObject({ damage: 5, statuses: { stunned: 1 } });
    expect(playerOf(after, P1).discard).toContain(strength);
  });

  it("Hulk: after he attacks, a [physical] top card deals 2 damage to an enemy; a [mental] one discards him", () => {
    const given = moveToHand(vsRhino("core-she-hulk-aggression"), P1, "01050");
    const [hulk] = given.ids as [InstanceId];
    const hero = settle(run(given.state, toHero()));
    const withHulk = run(hero, play(P1, hulk, payWith(hero, P1, 2, given.ids)));
    const physical = settle(
      run(putOnTopOfDeck(withHulk, P1, "01090").state, basicAttack(withHulk, hulk, activeVillain(withHulk).instanceId)),
    );
    expect(inst(physical, activeVillain(physical).instanceId).damage).toBe(5); // 3 ATK + 2
    expect(playerOf(physical, P1).playArea).toContain(hulk);
    const mental = settle(
      run(putOnTopOfDeck(withHulk, P1, "01089").state, basicAttack(withHulk, hulk, activeVillain(withHulk).instanceId)),
    );
    expect(playerOf(mental, P1).discard).toContain(hulk);
  });
});
