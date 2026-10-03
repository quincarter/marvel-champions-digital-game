import { applyCommand, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  inst,
  instancesOf,
  mainThreat,
  P1,
  patchInstance,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { WAVE6_DEPS } from "../../index.js";
import { REAVERS_ABILITIES } from "./index.js";
import {
  ADVANCE,
  BONEBREAKER,
  CYBERNETICS,
  MURRAY,
  PIERCE,
  REAVERS_SCHEME,
  SKULLBUSTER,
  WADE,
  inPlay,
  piles,
  reaversGame,
  resolved,
  reveal,
} from "./testing.js";

const heroForm = (state: GameState) => withForm(state, { heroForm: 0 });
const identity = (state: GameState) => state.players[0]!.identity.instanceId;
const attacksBy = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === id);
const cyberneticsOn = (state: GameState, host: InstanceId) =>
  inst(state, host).attachments.filter((id) => state.instances[id]!.cardId === CYBERNETICS);
const inDiscard = (state: GameState, code: string) =>
  piles(state).discard.filter((i) => state.instances[i]!.cardId === code);
/** Test-only surgery: every `code` card from the encounter deck into its discard pile. */
const deckToDiscard = (state: GameState, code: string): GameState => {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = piles(state);
  const moving = pile.deck.filter((i) => state.instances[i]!.cardId === code);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => !moving.includes(i)), discard: [...pile.discard, ...moving] },
    },
  };
};
/** Test-only surgery: the encounter discard pile becomes exactly `codes`, first = topmost (newest-first). */
const discardOf = (state: GameState, ...codes: string[]): GameState => {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  let deck = [...piles(state).deck];
  const discard: InstanceId[] = [];
  for (const code of codes) {
    const id = deck.find((i) => state.instances[i]!.cardId === code)!;
    deck = deck.filter((i) => i !== id);
    discard.push(id);
  }
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { deck, discard } } };
};
/** Zero-boost-icon fillers (the deck holds two of each) dealt after the card under test; `NEUTRAL` reveals nothing. */
const REST = [ADVANCE, ADVANCE] as const;
const NEUTRAL = "01187";
/** A REAVER already engaged with P1 by surgery (no reveal, so no teamwork), hero form. */
const withReaver = (code: string) => {
  const engaged = engageMinion(heroForm(reaversGame()), code, P1);
  return { state: engaged.state, id: engaged.id };
};

describe("The Reavers modular set (38029-38035)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(REAVERS_ABILITIES).sort()).toEqual([
      "38029.donald-pierce-forced-response",
      "38030.skullbuster-forced-response",
      "38031.bonebreaker-forced-response",
      "38032.when-revealed",
      "38033.when-revealed",
      "38034.when-defeated",
      "38035.cybernetic-enhancements-constant",
      "38035.cybernetic-enhancements-constant-2",
      "38035.cybernetic-enhancements-forced-response",
    ]);
    for (const definition of Object.values(REAVERS_ABILITIES)) expect(validateDefinition(definition)).toEqual([]);
  });

  it("scenario: with the set as the modular, its cards are in the encounter deck", () => {
    const state = reaversGame();
    for (const code of [PIERCE, SKULLBUSTER, BONEBREAKER, WADE, MURRAY, REAVERS_SCHEME])
      expect(instancesOf(state, code)).toHaveLength(1);
    expect(instancesOf(state, CYBERNETICS)).toHaveLength(2);
  });

  describe("Teamwork (REAVER)", () => {
    it("a revealed REAVER with another REAVER in play activates alone, once, before its When Revealed (Q2)", () => {
      const { state: staged, id: skullbuster } = withReaver(SKULLBUSTER);
      const { state, events } = reveal(staged, WADE, ...REST);
      const [wade] = inPlay(state, WADE);
      expect(inst(state, wade!).engagedWith).toBe(P1);
      // Wade's own attack: printed ATK 2, made before Cybernetic Enhancements (+1 ATK) was attached to him.
      const attacks = attacksBy(events, wade!);
      expect(attacks).toHaveLength(1);
      expect(attacks[0]).toMatchObject({ baseAtk: 2 });
      expect(resolved(events)).toContain("38032.when-revealed");
      expect(cyberneticsOn(state, wade!)).toHaveLength(1);
      // The minion already in play only took its ordinary villain-phase activation.
      expect(attacksBy(events, skullbuster)).toHaveLength(1);
      expect(
        events.some((e) => e.type === "keywordResolved" && (e as { keyword?: string }).keyword === "teamwork"),
      ).toBe(true);
    });

    it("with no other REAVER in play, the new one does not activate", () => {
      const { state, events } = reveal(heroForm(reaversGame()), WADE, ...REST);
      const [wade] = inPlay(state, WADE);
      expect(wade).toBeDefined();
      expect(attacksBy(events, wade!)).toHaveLength(0);
      expect(events.some((e) => e.type === "keywordResolved")).toBe(false);
    });

    it("with two REAVERs already in play, only the entering one activates by teamwork", () => {
      const first = engageMinion(heroForm(reaversGame()), SKULLBUSTER, P1);
      const second = engageMinion(first.state, BONEBREAKER, P1);
      const { state, events } = reveal(second.state, WADE, ...REST);
      const [wade] = inPlay(state, WADE);
      expect(attacksBy(events, wade!)).toHaveLength(1);
      expect(attacksBy(events, first.id)).toHaveLength(1);
      expect(attacksBy(events, second.id)).toHaveLength(1);
    });
  });

  describe("Donald Pierce (38029)", () => {
    it("38029.donald-pierce-forced-response: after he engages you, reveals the topmost REAVER minion in the discard pile", () => {
      const staged = discardOf(reaversGame(), BONEBREAKER, SKULLBUSTER);
      const { state, events } = reveal(staged, PIERCE, ...REST);
      expect(resolved(events)).toContain("38029.donald-pierce-forced-response");
      const [bonebreaker] = inPlay(state, BONEBREAKER);
      expect(bonebreaker).toBeDefined();
      expect(inst(state, bonebreaker!).engagedWith).toBe(P1);
      // Only the topmost one: the second REAVER stays in the discard pile.
      expect(inPlay(state, SKULLBUSTER)).toHaveLength(0);
      expect(inDiscard(state, SKULLBUSTER)).toHaveLength(1);
    });

    it("38029.donald-pierce-forced-response: a non-REAVER card above the REAVER is skipped, not revealed", () => {
      const staged = discardOf(reaversGame(), CYBERNETICS, WADE);
      const { state } = reveal(staged, PIERCE, ...REST);
      expect(inPlay(state, WADE)).toHaveLength(1);
      expect(inDiscard(state, CYBERNETICS)).toHaveLength(1);
    });

    it("38029.donald-pierce-forced-response: with no REAVER minion in the discard pile nothing is revealed", () => {
      const staged = discardOf(reaversGame());
      const { state, events } = reveal(staged, PIERCE, ...REST);
      expect(inPlay(state, PIERCE)).toHaveLength(1);
      for (const code of [SKULLBUSTER, BONEBREAKER, WADE, MURRAY]) expect(inPlay(state, code)).toHaveLength(0);
      expect(resolved(events)).toContain("38029.donald-pierce-forced-response");
    });
  });

  describe("Skullbuster (38030)", () => {
    it("38030.skullbuster-forced-response: places 1 threat on the main scheme per REAVER engaged with you (himself included)", () => {
      const { state: alone } = reveal(heroForm(reaversGame()), SKULLBUSTER, ...REST);
      const base = reveal(heroForm(reaversGame()), NEUTRAL, ...REST).state;
      expect(mainThreat(alone) - mainThreat(base)).toBe(1);
      const { state: staged } = withReaver(WADE);
      const { state, events } = reveal(staged, SKULLBUSTER, ...REST);
      expect(resolved(events)).toContain("38030.skullbuster-forced-response");
      const baseTwo = reveal(staged, NEUTRAL, ...REST).state;
      expect(mainThreat(state) - mainThreat(baseTwo)).toBe(2);
    });
  });

  describe("Bonebreaker (38031)", () => {
    it("38031.bonebreaker-forced-response: Forced Response (erratum p. 69), 1 indirect damage per REAVER engaged with you", () => {
      const alone = reveal(reaversGame(), BONEBREAKER, ...REST);
      expect(resolved(alone.events)).toContain("38031.bonebreaker-forced-response");
      const base = reveal(reaversGame(), NEUTRAL, ...REST).state;
      expect(inst(alone.state, identity(alone.state)).damage - inst(base, identity(base)).damage).toBe(1);

      // Alter-ego form: the teamwork activation is a scheme, so only the indirect damage reaches the identity.
      const engaged = engageMinion(reaversGame(), SKULLBUSTER, P1).state;
      const two = reveal(engaged, BONEBREAKER, ...REST);
      const baseTwo = reveal(engaged, NEUTRAL, ...REST).state;
      expect(inst(two.state, identity(two.state)).damage - inst(baseTwo, identity(baseTwo)).damage).toBe(2);
    });
  });

  describe("Wade Cole (38032) and Murray Reese (38033)", () => {
    it.each([
      ["38032.when-revealed", WADE],
      ["38033.when-revealed", MURRAY],
    ])("%s: finds Cybernetic Enhancements in the deck and attaches it to him", (ref, code) => {
      const { state, events } = reveal(reaversGame(), code, ...REST);
      expect(resolved(events)).toContain(ref);
      const [minion] = inPlay(state, code);
      expect(cyberneticsOn(state, minion!)).toHaveLength(1);
      // Exactly one copy: the other stays in the (shuffled) deck.
      expect(piles(state).deck.filter((i) => state.instances[i]!.cardId === CYBERNETICS)).toHaveLength(1);
    });

    it.each([
      ["38032.when-revealed", WADE],
      ["38033.when-revealed", MURRAY],
    ])("%s: finds it in the discard pile when the deck has none", (_ref, code) => {
      const moved = deckToDiscard(reaversGame(), CYBERNETICS);
      expect(inDiscard(moved, CYBERNETICS)).toHaveLength(2);
      const { state } = reveal(moved, code, ...REST);
      expect(cyberneticsOn(state, inPlay(state, code)[0]!)).toHaveLength(1);
      expect(inDiscard(state, CYBERNETICS)).toHaveLength(1);
    });
  });

  describe("The Reavers (38034)", () => {
    it("38034.when-defeated: the defeating player discards until a REAVER minion and reveals it", () => {
      const scheme = encounterCardInVillainArea(reaversGame(), REAVERS_SCHEME, 1);
      const stacked = stackEncounterDeck(heroForm(scheme.state), ADVANCE, CYBERNETICS, MURRAY);
      const { state, events } = driveEventsPicking(WAVE6_DEPS, stacked, firstLegal, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity(stacked),
        schemeInstanceId: scheme.id,
      } as never);
      expect(resolved(events)).toContain("38034.when-defeated");
      const [murray] = inPlay(state, MURRAY);
      expect(murray).toBeDefined();
      expect(inst(state, murray!).engagedWith).toBe(P1);
      // The cards discarded on the way are in the discard pile.
      expect(inDiscard(state, ADVANCE)).toHaveLength(1);
      expect(inDiscard(state, CYBERNETICS)).toHaveLength(1);
    });
  });

  describe("Cybernetic Enhancements (38035)", () => {
    const wadeWithCybernetics = () => reveal(heroForm(reaversGame()), WADE, ...REST);

    it("38035.cybernetic-enhancements-constant: with no minion in play it gains surge", () => {
      const { state, events } = reveal(reaversGame(), CYBERNETICS, ...REST);
      expect(inPlay(state, CYBERNETICS)).toHaveLength(0);
      expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    });

    it("38035.cybernetic-enhancements-constant-2: the attached minion cannot take damage", () => {
      const { state } = wadeWithCybernetics();
      const [wade] = inPlay(state, WADE);
      const ready = patchInstance(heroForm(state), identity(state), { exhausted: false });
      const attack = {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity(state),
        targetInstanceId: wade!,
      } as const;
      const blocked = applyCommand(ready, attack, WAVE6_DEPS);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.error.code).toBe("no_valid_target");
      // Control: the same attack lands once the attachment is gone (the rule comes from Cybernetic Enhancements).
      const [cyber] = cyberneticsOn(ready, wade!);
      const stripped = {
        ...ready,
        instances: { ...ready.instances, [wade!]: { ...inst(ready, wade!), attachments: [] } },
      };
      expect(cyber).toBeDefined();
      const open = applyCommand(stripped, attack, WAVE6_DEPS);
      expect(open.ok).toBe(true);
    });

    it("38035.cybernetic-enhancements-forced-response: after the attached minion attacks, discards it", () => {
      const { state } = wadeWithCybernetics();
      const [wade] = inPlay(state, WADE);
      const [cyber] = cyberneticsOn(state, wade!);
      const second = reveal(heroForm(state), NEUTRAL, ...REST);
      const attacks = attacksBy(second.events, wade!);
      expect(attacks).toHaveLength(1);
      // ATK 2 printed +1 from Cybernetic Enhancements.
      expect(attacks[0]).toMatchObject({ baseAtk: 3 });
      expect(resolved(second.events)).toContain("38035.cybernetic-enhancements-forced-response");
      expect(cyberneticsOn(second.state, wade!)).toHaveLength(0);
      expect(piles(second.state).discard).toContain(cyber);
    });
  });
});
