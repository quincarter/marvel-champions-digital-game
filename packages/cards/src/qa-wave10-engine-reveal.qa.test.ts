/**
 * Wave 10 engine-rules QA, change 2 (commits 77e58bfa and 5fc79976, owner answers 30B, 32B, 35B, 36B, 37A, 38A): a
 * revealed minion's When Revealed resolves before Quickstrike; the Responses to its entering play wait until the reveal
 * has finished; a minion put into play without a reveal is unchanged. Proved on OLDER real cards (Core to wave 9) whose
 * behavior the change moves: the survey is docs/phase7-wave10-q30-impact.md.
 *
 * Sources:
 * - RRG 1.8 "Quickstrike" (p. 36): "the quickstrike keyword resolves after any 'When Revealed' abilities on that minion
 *   are resolved".
 * - RRG 1.8 "Reveal" (p. 38): Responses to any step of the revealing "are not resolved until after all steps of the
 *   reveal process have been completed"; FAQ "Widow's Bite (#10)", p. 60: "Keywords have timing priority over 'Response'
 *   abilities, so Quickstrike resolves first."
 * - owner answer 38A (docs/phase7-wave10.md §4.0): a minion put into play without a reveal opens its enters-play response
 *   window before Quickstrike, as before. The RRG's FAQ #10 sentence is general ("Keywords have timing priority over
 *   Response abilities"); see the report's question Q-A.
 */
import { describe, expect, it } from "vitest";
import { cardsInPlay, type InstanceId } from "@mc/engine";
import { endTurn, inst, identityOf, patchInstance, payWith, play, P1 } from "./testing/harness.js";
import { conjure, intoPlay, rhino } from "./testing/qa-bench.js";
import { encounterCardInVillainArea } from "./testing/staging.js";
import {
  answering,
  damageTo,
  driveWith,
  encounterAt,
  encounterTop,
  minionEngaged,
} from "./testing/wave10-engine-qa-bench.js";

const FILLER = "01186"; // the villain's boost card: a Core treachery with no boost icons
const VULTURE = "01167"; // Core minion: Quickstrike, ATK 3, HP 4, no When Revealed
const ICEMAN = "38010"; // "Response: After a minion enters play, remove 1 freeze counter from Iceman → stun that minion."
const calm = () => {
  const table = rhino();
  return patchInstance(table, table.mainScheme.instanceId, { threat: 0 });
};

describe("a revealed Quickstrike minion attacks before the Responses to its entering play (RRG 1.8 'Reveal' p. 38; FAQ #10 p. 60)", () => {
  it("Vulture 01167 revealed, Iceman 38010's stun taken after: the hero is hit first, then Vulture is stunned", () => {
    const iceman = intoPlay(calm(), ICEMAN, { freeze: 3 });
    const staged = encounterTop(iceman.state, FILLER, VULTURE);
    const vulture = staged.ids[1]!;
    const done = driveWith(staged.state, endTurn(P1), answering([iceman.id]));
    expect(done.accepted).toBe(true);
    expect(damageTo(done.events, identityOf(done.state), vulture)).toEqual([3]);
    expect(inst(done.state, vulture).statuses.stunned).toBe(1);
    expect(inst(done.state, iceman.id).counters.freeze).toBe(2);
  });
});

describe("a minion put into play without a reveal keeps its order (owner answer 38A; RRG 1.8 'Quickstrike' p. 36)", () => {
  const lookingForTrouble = (iceman: boolean) => {
    const table = patchInstance(rhino(), rhino().mainScheme.instanceId, { threat: 5 });
    const base = iceman ? intoPlay(table, ICEMAN, { freeze: 3 }) : { state: table, id: "" as InstanceId };
    const staged = encounterTop(base.state, VULTURE);
    return { staged, iceman: base.id, vulture: staged.ids[0]! };
  };

  it("Looking for Trouble 16043 puts Vulture into play: Iceman's response is heard BEFORE the Quickstrike attack (38A, as built)", () => {
    const { staged, iceman, vulture } = lookingForTrouble(true);
    const given = conjure(staged.state, "16043");
    const done = driveWith(
      given.state,
      play(P1, given.id, payWith(given.state, P1, 0, [given.id])),
      answering([iceman as InstanceId]),
    );
    expect(done.accepted, done.refusal).toBe(true);
    expect(cardsInPlay(done.state)).toContain(vulture);
    // The response fired first (it spent a counter and gave the stun) and the attack still resolved: see the BUG below.
    expect(inst(done.state, iceman as InstanceId).counters.freeze).toBe(2);
  });

  // RRG 1.8 "Stun" (p. 41): "When this character would attack, remove each stunned status card from it instead." The
  // Quickstrike attack is an enemy attack. `quickstrikeAttack` (resolve/enter-play.ts) pushes the attack event straight
  // away and never reads the minion's status, so a stunned Quickstrike minion attacks in full and keeps its stun card
  // (an ordinary activation, villain/phase.ts, does discard it). Under the answer-38A order any response that stuns the
  // minion as it enters play (Iceman, Hawkeye-like cards, Prism Dust) lands before the attack and should cancel it.
  it.fails("a stunned minion put into play with Quickstrike does not attack: the stunned card is discarded instead", () => {
    const { staged, vulture } = lookingForTrouble(false);
    const stunnedFirst = patchInstance(staged.state, vulture, {
      statuses: { ...inst(staged.state, vulture).statuses, stunned: 1 },
    });
    const given = conjure(stunnedFirst, "16043");
    const done = driveWith(given.state, play(P1, given.id, payWith(given.state, P1, 0, [given.id])), answering());
    expect(done.accepted, done.refusal).toBe(true);
    expect(damageTo(done.events, identityOf(done.state), vulture)).toEqual([]);
    expect(inst(done.state, vulture).statuses.stunned).toBe(0);
  });
});

describe("a granted Quickstrike resolves after the When Revealed (the survey's section 3.2)", () => {
  it("The Mojo Files 39047 + Werewolf Pack 39052: the ally is defeated by the When Revealed, so it cannot defend the Quickstrike attack", () => {
    const ally = intoPlay(calm(), ICEMAN, { freeze: 3 });
    const mojo = encounterCardInVillainArea(encounterTop(ally.state, "39047").state, "39047", 0);
    const staged = encounterTop(mojo.state, FILLER, "39052");
    const wolf = staged.ids[1]!;
    const defenders: string[][] = [];
    const done = driveWith(staged.state, endTurn(P1), (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") defenders.push(choice.options.map((o) => o.optionId));
      return answering([], ally.id)(s);
    });
    expect(done.accepted).toBe(true);
    // The first declaration is Rhino's own attack (Iceman may defend it); the last is the wolf's Quickstrike.
    const last = defenders[defenders.length - 1]!;
    expect(last).not.toContain(ally.id);
    expect(damageTo(done.events, identityOf(done.state), wolf)).toEqual([3]);
  });
});

describe("Teamwork follows the When Revealed (RRG 1.8 'Teamwork (Trait)' p. 43; owner answer 30B)", () => {
  it("Wade Cole 38032 (Teamwork REAVER; When Revealed: attach Cybernetic Enhancements) with Murray Reese 38033 in play: the attachment is on him for the Teamwork attack, and is discarded after it", () => {
    let state = calm();
    const murray = minionEngaged(state, "38033");
    state = murray.state;
    const enhancements = encounterAt(state, 8, "38035");
    state = enhancements.state;
    // The villain's boost card, then the card dealt to the player (Wade Cole), then Murray Reese's boost card.
    const staged = encounterTop(state, FILLER, "38032", FILLER);
    const wade = staged.ids[1]!;
    const done = driveWith(staged.state, endTurn(P1), answering());
    expect(done.accepted).toBe(true);
    // ATK 2, +1 from Cybernetic Enhancements: the attack was made with the attachment on him (the old order made it with ATK 2).
    expect(damageTo(done.events, identityOf(done.state), wade)).toEqual([3]);
    expect(inst(done.state, enhancements.id).attachedTo).toBeNull();
    expect(inst(done.state, enhancements.id).home).toEqual({ kind: "encounterDeck", deckId: expect.anything() });
  });
});
