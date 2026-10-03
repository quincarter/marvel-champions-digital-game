import { type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  P1,
  patchInstance,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  withDamage,
  withForm,
} from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { EXODUS_ABILITIES } from "./index.js";
import { ADVANCE, EXODUS, FRENZY, HERALD, SHIELD, exodusGame, inPlay, piles, resolved, reveal } from "./testing.js";

const shieldsOn = (state: GameState, host: InstanceId) =>
  inst(state, host).attachments.filter((id) => state.instances[id]!.cardId === SHIELD);
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
const exodusIn = (base: GameState = exodusGame()) => {
  const { state } = reveal(base, EXODUS);
  return { state, exodus: inPlay(state, EXODUS)[0]! };
};
const hero = (state: GameState) => {
  const id = state.players[0]!.identity.instanceId;
  return patchInstance(withForm(state, { heroForm: 0 }), id, { exhausted: false });
};
const attacksBy = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === id);
const activations = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => (e.type === "attackResolved" || e.type === "schemeResolved") && e.enemyInstanceId === id).length;

describe("The Exodus modular set (37032-37035)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(EXODUS_ABILITIES).sort()).toEqual([
      "37032.when-revealed",
      "37033.when-defeated",
      "37034.psionic-shield-constant",
      "37034.psionic-shield-forced-interrupt",
      "37035.boost",
      "37035.when-revealed",
    ]);
    for (const definition of Object.values(EXODUS_ABILITIES)) expect(validateDefinition(definition)).toEqual([]);
  });

  it("scenario: with the set as the modular, its cards are in the encounter deck", () => {
    const state = exodusGame();
    for (const code of [EXODUS, HERALD, SHIELD, FRENZY]) expect(instancesOf(state, code).length).toBeGreaterThan(0);
    expect(instancesOf(state, SHIELD)).toHaveLength(2);
    expect(instancesOf(state, FRENZY)).toHaveLength(2);
  });

  describe("Exodus (37032)", () => {
    it("37032.when-revealed: finds Psionic Shield in the encounter deck and attaches it to him", () => {
      const { state, exodus } = exodusIn();
      expect(shieldsOn(state, exodus)).toHaveLength(1);
      expect(inPlay(state, SHIELD)).toHaveLength(1);
      // Exactly one copy: the other stays in the (shuffled) deck.
      expect(piles(state).deck.filter((i) => state.instances[i]!.cardId === SHIELD)).toHaveLength(1);
    });

    it("37032.when-revealed: finds it in the discard pile when the deck has none", () => {
      const moved = deckToDiscard(exodusGame(), SHIELD);
      expect(inDiscard(moved, SHIELD)).toHaveLength(2);
      const { state, exodus } = exodusIn(moved);
      expect(shieldsOn(state, exodus)).toHaveLength(1);
      expect(inDiscard(state, SHIELD)).toHaveLength(1);
    });

    it("37032.when-revealed: Exodus attacks for 2 with the Shield's +1 ATK (printed 1), and is engaged with you", () => {
      const { state, exodus } = exodusIn();
      expect(inst(state, exodus).engagedWith).toBe(P1);
      const { events } = driveEventsPicking(WAVE6_DEPS, withForm(state, { heroForm: 0 }), firstLegal, endTurn(P1));
      const attacks = attacksBy(events, exodus);
      expect(attacks).toHaveLength(1);
      expect(attacks[0]).toMatchObject({ baseAtk: 2 });
    });
  });

  describe("Psionic Shield (37034)", () => {
    it("37034.psionic-shield-forced-interrupt: a defeat heals all damage from Exodus, he does not leave play, then the Shield is discarded", () => {
      const { state, exodus } = exodusIn();
      const [shield] = shieldsOn(state, exodus);
      const after = defeatWithAttack(WAVE6_DEPS, hero(state), exodus);
      expect(inPlay(after, EXODUS)).toEqual([exodus]);
      expect(inst(after, exodus).damage).toBe(0);
      expect(inst(after, exodus).attachments).not.toContain(shield);
      expect(inDiscard(after, SHIELD)).toContain(shield);
      expect(inPlay(after, SHIELD)).toHaveLength(0);
    });

    it("37034.psionic-shield-forced-interrupt: with the Shield gone the next defeat removes him", () => {
      const { state, exodus } = exodusIn();
      const once = defeatWithAttack(WAVE6_DEPS, hero(state), exodus);
      const twice = defeatWithAttack(WAVE6_DEPS, hero(patchInstance(once, exodus, { exhausted: false })), exodus);
      expect(inPlay(twice, EXODUS)).toHaveLength(0);
    });

    it("37034.psionic-shield-constant: with no minion in play it gains surge", () => {
      const { state, events } = reveal(exodusGame(), SHIELD, ADVANCE);
      expect(inPlay(state, SHIELD)).toHaveLength(0);
      expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    });
  });

  describe("Herald of Avalon (37033)", () => {
    it("37033.when-defeated: the defeating player searches for Exodus and reveals him (Psionic Shield comes with him)", () => {
      const scheme = encounterCardInVillainArea(exodusGame(), HERALD, 1);
      const identity = scheme.state.players[0]!.identity.instanceId;
      const { state: after, events } = driveEventsPicking(WAVE6_DEPS, hero(scheme.state), firstLegal, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme.id,
      } as never);
      expect(resolved(events)).toContain("37033.when-defeated");
      const [exodus] = inPlay(after, EXODUS);
      expect(exodus).toBeDefined();
      expect(inst(after, exodus!).engagedWith).toBe(P1);
      expect(shieldsOn(after, exodus!)).toHaveLength(1);
    });

    it("37033.when-defeated: finds Exodus in the discard pile", () => {
      const moved = deckToDiscard(exodusGame(), EXODUS);
      expect(inDiscard(moved, EXODUS)).toHaveLength(1);
      const scheme = encounterCardInVillainArea(moved, HERALD, 1);
      const { state: after } = driveEventsPicking(WAVE6_DEPS, hero(scheme.state), firstLegal, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: scheme.state.players[0]!.identity.instanceId,
        schemeInstanceId: scheme.id,
      } as never);
      expect(inPlay(after, EXODUS)).toHaveLength(1);
    });
  });

  describe("Acolyte Frenzy (37035)", () => {
    it("37035.when-revealed: each ACOLYTE minion engaged with you activates against you (one extra activation)", () => {
      const { state, exodus } = exodusIn(withForm(exodusGame(), { heroForm: 0 }));
      // Exodus's own activation draws the first card as its boost; the second is the one revealed.
      const base = reveal(state, ADVANCE, ADVANCE).events;
      const { events } = reveal(state, ADVANCE, FRENZY);
      expect(resolved(events)).toContain("37035.when-revealed");
      expect(activations(events, exodus)).toBe(activations(base, exodus) + 1);
    });

    it("37035.when-revealed: with no ACOLYTE engaged it gains surge and nothing activates", () => {
      const { events } = reveal(exodusGame(), FRENZY, ADVANCE);
      expect(resolved(events)).toContain("37035.when-revealed");
      expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
      const base = reveal(exodusGame(), ADVANCE, ADVANCE).events;
      const count = (list: readonly GameEvent[]) => list.filter((e) => e.type === "enemyActivated").length;
      expect(count(events)).toBe(count(base));
    });

    it("37035.boost: as a boost card you are stunned and confused", () => {
      const state = stackEncounterDeck(exodusGame(), FRENZY);
      const villain = state.activeVillainId!;
      const { state: after } = driveEventsPicking(WAVE6_DEPS, withDamage(state, villain, 0), firstLegal, endTurn(P1));
      const me = after.players[0]!.identity.instanceId;
      expect(inst(after, me).statuses).toMatchObject({ stunned: 1, confused: 1 });
    });
  });
});
