/**
 * A set-aside villain card put into play as a minion by the attachment that treats it as one. Synthetic cards shaped
 * like Whisper in the Dark (Shadowland 65040): "Treat attached villain as an Elite minion with 6 printed hit points.
 * It gains: 'Guard. Villainous. When Defeated: Set this minion aside.' When Revealed: ... put the set-aside chosen
 * villain into play engaged with you, side A faceup, with this card attached".
 *
 * Sources: RRG 1.8 "Card Types" (p. 12: a card whose type changes "loses all other card types" and "functions as would
 * any card of the new card type"; the card says nothing of a blank text box), "Printed" (p. 35),
 * "'Gains'" (p. 21), "Guard" (p. 21), "Villainous" (p. 47), "Set Aside" (p. 39), "Find" (p. 19). When nothing treats
 * it as a minion any more it stays in play as one of the game's villains, a status change (rules expert, 2026-10-22;
 * ruling Dec 17, 2025 (1) #3; owner confirmation pending). Discarded as a minion it goes to the encounter discard pile:
 * treated as a minion it is not a villain card (p. 12; ruling Nov 2, 2023 #108), so p. 46's "Villain cards cannot be
 * discarded from play" does not apply. `hostOnlyReleaseZone` is only for a refused put-into-play.
 */

import { perPlayerOnly, trait, type CardId, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import {
  characterProfile,
  currentName,
  isLooseVillainCard,
  isMinion,
  isVillain,
  locateCard,
  minionsEngagedWith,
  mustInstance,
  mustPlayer,
  printedHpNumeral,
} from "./query.js";
import { getsBoostCard } from "./resolve/enemy-activation.js";
import { activeAbilityRefs, cardsInPlay, cardTypeOf, categoriesOf, controllerOf, traitsOf } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1 } from "./testing/wave3.js";

const ELITE = trait("ELITE");
const ASSASSIN = trait("ASSASSIN");
const self: TargetRef = { kind: "self" };
const one = { kind: "const", value: 1 } as const;
const mainScheme: TargetRef = { kind: "each", query: { categories: ["mainScheme"] } };

/** Side A's own printed text: an action that marks the main scheme, and steady. */
const PROTEGE_ACTION = stubAbility("protege.a-action", {
  trigger: { kind: "action" },
  effects: [{ kind: "addCounters", target: mainScheme, counterType: "own-text", amount: one }],
});
const PROTEGE_B_ACTION = stubAbility("protege.b-action", PROTEGE_ACTION.definition);
const PROTEGE_REVEALED = stubAbility("protege.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "addCounters", target: mainScheme, counterType: "revealed", amount: one }],
});
/** A two-sided, one-stage villain: side A ATK 2 SCH 1, 15 per player; side B ATK 3 SCH 2, 18 per player. */
const PROTEGE: VillainCard = stubVillain({
  id: "protege",
  name: "Protege",
  stages: [
    {
      hp: perPlayerOnly(15),
      atk: 2,
      sch: 1,
      traits: [ASSASSIN],
      keywords: [{ name: "steady" }],
      abilities: [PROTEGE_ACTION.ref, PROTEGE_REVEALED.ref],
    },
  ],
  back: {
    name: "Protege Unleashed",
    stages: [
      { hp: perPlayerOnly(18), atk: 3, sch: 2, keywords: [{ name: "toughness" }], abilities: [PROTEGE_B_ACTION.ref] },
    ],
  },
});
const protegeRef: TargetRef = { kind: "find", query: { printedId: PROTEGE.id as CardId } };

/** The gained When Defeated: `self` is the villain card. */
const WHISPER_DEFEATED = stubAbility("whisper.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "encounterSetAside" }],
});
const WHISPER_CONSTANT = stubAbility("whisper.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "treatHostAsMinion", traits: [ELITE], keepPrintedTraits: true, keepsText: true, printedHp: 6 },
      { kind: "gainsAbility", abilityId: WHISPER_DEFEATED.ref.id, to: { hostOfSelf: true } },
    ],
    keywordGrants: [
      { target: { hostOfSelf: true }, keyword: { name: "guard" } },
      { target: { hostOfSelf: true }, keyword: { name: "villainous" } },
    ],
  },
  effects: [],
});
const revealedWith = (id: string, side?: "A" | "B") =>
  stubAbility(id, {
    trigger: { kind: "whenRevealed" },
    effects: [
      {
        kind: "putIntoPlayAsHost",
        card: protegeRef,
        attachment: self,
        engagedWith: { kind: "controller" },
        ...(side ? { villainSide: side } : {}),
      },
    ],
  });
const WHISPER_REVEALED = revealedWith("whisper.when-revealed", "A");
const WHISPER = stubAttachment({
  id: "whisper",
  name: "whisper",
  abilities: [WHISPER_CONSTANT.ref, WHISPER_REVEALED.ref],
});
/** The same, side B faceup. */
const SHADE_REVEALED = revealedWith("shade.when-revealed", "B");
const SHADE = stubAttachment({ id: "shade", name: "shade", abilities: [WHISPER_CONSTANT.ref, SHADE_REVEALED.ref] });
/** The same When Revealed with nothing that makes the card a minion. */
const INERT_REVEALED = revealedWith("inert.when-revealed");
const INERT = stubAttachment({ id: "inert", name: "inert", abilities: [INERT_REVEALED.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const minions: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const SMITE = event("smite", [{ kind: "dealDamage", target: minions, amount: { kind: "const", value: 6 } }]);
const JAB = event("jab", [{ kind: "dealDamage", target: minions, amount: { kind: "const", value: 5 } }]);
const FREE = event("free", [{ kind: "discardFromPlay", target: { kind: "each", query: { name: "whisper" } } }]);
const FREE_SHADE = event("free-shade", [
  { kind: "discardFromPlay", target: { kind: "each", query: { name: "shade" } } },
]);
const BANISH = event("banish", [{ kind: "discardFromPlay", target: minions }]);
const ADD = event("add", [{ kind: "addVillain", villain: protegeRef, reveal: true }]);
const REVEAL_IN_PLACE = event("reveal-in-place", [
  { kind: "addVillain", villain: protegeRef, reveal: true, inPlay: "reveal" },
]);
const SMITE_VILLAINS = event("smite-villains", [
  {
    kind: "dealDamage",
    target: { kind: "each", query: { categories: ["villain"], printedId: PROTEGE.id as CardId } },
    amount: { kind: "const", value: 1 },
  },
]);
const EVENTS = [REVEAL, SMITE, JAB, FREE, FREE_SHADE, BANISH, ADD, REVEAL_IN_PLACE, SMITE_VILLAINS];

const deps: EngineDeps = depsOf(
  PROTEGE_ACTION,
  PROTEGE_B_ACTION,
  PROTEGE_REVEALED,
  WHISPER_DEFEATED,
  WHISPER_CONSTANT,
  WHISPER_REVEALED,
  SHADE_REVEALED,
  INERT_REVEALED,
  ...EVENTS.map((e) => e.ability),
);

/** A game with the villain card set aside (test surgery standing in for `GameSetupConfig.setAsideVillainCardIds`). */
function table(players: 1 | 2 = 1): GameState {
  const state = gameAtFirstTurn({
    players,
    cards: [PROTEGE, WHISPER, SHADE, INERT, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [WHISPER.id, SHADE.id, INERT.id, ...copiesOf(TREACHERY.id, 20)],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
  const players_ = state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } }));
  const template = mustInstance(state, state.mainScheme.instanceId);
  const id = "set-aside-protege" as InstanceId;
  return {
    ...state,
    players: players_,
    instances: {
      ...state.instances,
      [id]: {
        ...template,
        instanceId: id,
        cardId: PROTEGE.id,
        faceup: false,
        threat: 0,
        counters: {},
        attachments: [],
        home: { kind: "encounterDeck", deckId: state.encounterDeckOrder[0]! },
      },
    },
    encounterSetAside: [...state.encounterSetAside, id],
  };
}
const PROTEGE_ID = "set-aside-protege" as InstanceId;

function play(state: GameState, card: { card: { id: string } }) {
  const given = giveCard(state, P1, card.card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return runCommandsPicking(given.state, deps, defaultPick, command);
}
/** P1 reveals `attachment` from the top of the encounter deck. */
const reveal = (state: GameState, attachment: { id: string } = WHISPER) =>
  play(onTopOfEncounterDeck(state, attachment.id as CardId), REVEAL);
const instanceOf = (state: GameState, cardId: string): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === cardId)!.instanceId;
const countersOn = (state: GameState, type: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters[type] ?? 0;
const attack = (s: GameState, target: InstanceId): boolean =>
  applyCommand(
    s,
    {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: mustPlayer(s, P1).identity.instanceId,
      targetInstanceId: target,
    },
    deps,
  ).ok;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const defeated = (events: readonly GameEvent[], id: InstanceId): boolean =>
  events.some((e) => e.type === "characterDefeated" && e.instanceId === id);

describe("a set-aside villain card put into play as an Elite minion", () => {
  it("is a minion engaged with the revealing player, never a villain, with Whisper attached", () => {
    const before = table();
    const { state, events } = reveal(before);
    const whisper = instanceOf(state, WHISPER.id);
    expect(events.some((e) => e.type === "putIntoPlayRefused")).toBe(false);
    expect(mustInstance(state, whisper).attachedTo).toBe(PROTEGE_ID);
    expect(isLooseVillainCard(state, PROTEGE_ID)).toBe(true);
    expect(isVillain(state, PROTEGE_ID)).toBe(false);
    expect(state.villains.map((v) => v.instanceId)).toEqual(before.villains.map((v) => v.instanceId));
    expect(state.activeVillainId).toBe(before.activeVillainId);
    expect(isMinion(state, PROTEGE_ID)).toBe(true);
    expect(cardTypeOf(state, PROTEGE_ID)).toBe("minion");
    expect(categoriesOf(state, PROTEGE_ID)).toEqual(["minion", "enemy", "character"]);
    expect(minionsEngagedWith(state, P1)).toEqual([PROTEGE_ID]);
    expect(mustPlayer(state, P1).playArea).toContain(PROTEGE_ID);
    expect(state.encounterSetAside).not.toContain(PROTEGE_ID);
    expect(controllerOf(state, PROTEGE_ID)).toBeNull();
    expect(mustInstance(state, PROTEGE_ID).faceup).toBe(true);
  });

  it("uses side A's ATK and SCH, and 6 printed hit points, flat, whatever the player count", () => {
    for (const players of [1, 2] as const) {
      const { state } = reveal(table(players));
      expect(characterProfile(state, PROTEGE_ID, deps)).toEqual({
        kind: "minion",
        missing: [],
        atk: 2,
        thw: 0,
        def: 0,
        rec: 0,
        sch: 1,
        maxHp: 6,
      });
      expect(printedHpNumeral(state, PROTEGE_ID)).toBe(6);
    }
    expect(currentName(reveal(table()).state, PROTEGE_ID)).toBe("Protege");
  });

  it("keeps its own text box: side A's traits, keywords and abilities, with Elite, Guard, Villainous and the When Defeated", () => {
    const { state } = reveal(table());
    expect([...traitsOf(state, PROTEGE_ID, deps)].sort()).toEqual([ASSASSIN, ELITE].sort());
    for (const keyword of ["steady", "guard", "villainous"] as const)
      expect(hasKeyword(state, PROTEGE_ID, keyword, deps)).toBe(true);
    expect(hasKeyword(state, PROTEGE_ID, "toughness", deps)).toBe(false);
    expect(
      activeAbilityRefs(state, PROTEGE_ID, deps)
        .map((ref) => ref.id)
        .sort(),
    ).toEqual([PROTEGE_ACTION.ref.id, PROTEGE_REVEALED.ref.id, WHISPER_DEFEATED.ref.id].sort());
    expect(getsBoostCard(state, deps, PROTEGE_ID)).toBe(true);
  });

  it("side B faceup when the text says so: side B's name, stats and text", () => {
    const { state } = reveal(table(), SHADE);
    expect(currentName(state, PROTEGE_ID)).toBe("Protege Unleashed");
    expect(characterProfile(state, PROTEGE_ID, deps)).toMatchObject({ atk: 3, sch: 2, maxHp: 6 });
    expect(hasKeyword(state, PROTEGE_ID, "toughness", deps)).toBe(true);
    expect(activeAbilityRefs(state, PROTEGE_ID, deps).map((ref) => ref.id)).toContain(PROTEGE_B_ACTION.ref.id);
  });

  it("Guard: the engaged player cannot attack the villain; the minion they can", () => {
    const { state } = reveal(table());
    expect(attack(table(), state.activeVillainId)).toBe(true);
    expect(attack(state, state.activeVillainId)).toBe(false);
    expect(attack(state, PROTEGE_ID)).toBe(true);
  });

  it("activates in the villain phase as a villainous minion and attacks for side A's ATK", () => {
    const { state } = reveal(table());
    const phase = runCommandsPicking(state, deps, defaultPick, { type: "endTurn", playerId: P1 });
    const activations = phase.events.flatMap((e) =>
      e.type === "enemyActivated" && e.enemyInstanceId === PROTEGE_ID ? [e.activation] : [],
    );
    expect(activations).toEqual(["attack"]);
    expect(phase.events.some((e) => e.type === "boostCardDealt" && e.enemyInstanceId === PROTEGE_ID)).toBe(true);
  });

  it("is not defeated short of 6 damage", () => {
    const { state, events } = play(reveal(table()).state, JAB);
    expect(mustInstance(state, PROTEGE_ID).damage).toBe(5);
    expect(defeated(events, PROTEGE_ID)).toBe(false);
  });
});

describe("leaving play", () => {
  it("defeated: the gained When Defeated sets it aside, and Whisper is discarded with it", () => {
    const { state, events } = play(reveal(table()).state, SMITE);
    expect(defeated(events, PROTEGE_ID)).toBe(true);
    expect(state.encounterSetAside).toContain(PROTEGE_ID);
    expect(locateCard(state, instanceOf(state, WHISPER.id))?.kind).toBe("encounterDiscard");
    const card = mustInstance(state, PROTEGE_ID);
    expect(card).toMatchObject({ damage: 0, treatedAs: null, engagedWith: null, attachments: [], flipped: false });
    expect(isVillain(state, PROTEGE_ID)).toBe(false);
  });

  it("set aside, it can be added as the villain later, clean, on its own printed hit points", () => {
    const aside = play(reveal(table()).state, SMITE).state;
    const { state } = play(aside, ADD);
    expect(isVillain(state, PROTEGE_ID)).toBe(true);
    expect(isMinion(state, PROTEGE_ID)).toBe(false);
    expect(state.encounterSetAside).not.toContain(PROTEGE_ID);
    expect(characterProfile(state, PROTEGE_ID, deps)).toMatchObject({ kind: "villain", atk: 2, sch: 1, maxHp: 15 });
  });

  it("Whisper discarded while the minion stays: it stays in play as a second villain, as it was (status change)", () => {
    const hurt = play(reveal(table()).state, JAB).state;
    const before = hurt.activeVillainId;
    const { state, events } = play(hurt, FREE);
    expect(defeated(events, PROTEGE_ID)).toBe(false);
    expect(events.some((e) => e.type === "cardMoved" && e.instanceId === PROTEGE_ID)).toBe(false);
    expect(types(events, "villainAdded")).toEqual([
      { type: "villainAdded", instanceId: PROTEGE_ID, cardId: PROTEGE.id, areaId: null, asStatusChange: true },
    ]);
    expect(isVillain(state, PROTEGE_ID)).toBe(true);
    expect(isMinion(state, PROTEGE_ID)).toBe(false);
    expect(state.villains.find((v) => v.instanceId === PROTEGE_ID)).toMatchObject({ side: "A", defeated: false });
    // A second villain: the active counter stays where it was.
    expect(state.activeVillainId).toBe(before);
    expect(state.encounterSetAside).not.toContain(PROTEGE_ID);
    expect(mustPlayer(state, P1).playArea).not.toContain(PROTEGE_ID);
    expect(minionsEngagedWith(state, P1)).toEqual([]);
    // Its damage stays; its hit points are its stage's again.
    expect(mustInstance(state, PROTEGE_ID)).toMatchObject({ damage: 5, treatedAs: null, engagedWith: null });
    expect(characterProfile(state, PROTEGE_ID, deps)).toMatchObject({ kind: "villain", atk: 2, sch: 1, maxHp: 15 });
    // Attackable as any villain.
    expect(attack(state, PROTEGE_ID)).toBe(true);
  });

  it("Whisper discarded from a side B minion: the villain shows side B", () => {
    const shaded = reveal(table(), SHADE).state;
    const freed = play(shaded, FREE_SHADE).state;
    expect(freed.villains.find((v) => v.instanceId === PROTEGE_ID)).toMatchObject({ side: "B" });
    expect(currentName(freed, PROTEGE_ID)).toBe("Protege Unleashed");
  });

  it("discarded as a minion: a two-sided card, it is removed from the game (RRG 1.8 Double-Sided Card, p. 17)", () => {
    const { state } = play(reveal(table()).state, BANISH);
    expect(locateCard(state, PROTEGE_ID)?.kind).toBe("removedFromGame");
    expect(isVillain(state, PROTEGE_ID)).toBe(false);
    expect(locateCard(state, instanceOf(state, WHISPER.id))?.kind).toBe("encounterDiscard");
  });

  it("set aside by its When Defeated it is facedown again", () => {
    const { state } = play(reveal(table()).state, SMITE);
    expect(mustInstance(state, PROTEGE_ID).faceup).toBe(false);
  });
});

describe("addVillain finds a villain card wherever it waits", () => {
  /** Test surgery: the set-aside villain card moved, out of play, to the bottom of an encounter pile. */
  const inEncounter = (pile: "deck" | "discard"): GameState => {
    const s = table();
    const deckId = s.encounterDeckOrder[0]!;
    const piles = s.encounterDecks[deckId]!;
    return {
      ...s,
      encounterSetAside: s.encounterSetAside.filter((i) => i !== PROTEGE_ID),
      encounterDecks: { ...s.encounterDecks, [deckId]: { ...piles, [pile]: [...piles[pile], PROTEGE_ID] } },
    };
  };
  it("in the encounter discard pile: it enters play as the villain from there", () => {
    const discarded = inEncounter("discard");
    const { state } = play(discarded, ADD);
    expect(isVillain(state, PROTEGE_ID)).toBe(true);
    expect(locateCard(state, PROTEGE_ID)).toBeNull();
    expect(Object.values(state.encounterDecks).some((d) => d.discard.includes(PROTEGE_ID))).toBe(false);
  });

  it("in the encounter deck: it enters play and the deck is shuffled", () => {
    const inDeck = inEncounter("deck");
    const deckId = inDeck.encounterDeckOrder[0]!;
    const run = play(inDeck, ADD);
    const { state, events } = run;
    expect(isVillain(state, PROTEGE_ID)).toBe(true);
    expect(state.encounterDecks[deckId]!.deck).not.toContain(PROTEGE_ID);
    expect(events.some((e) => e.type === "deckShuffled" && e.zone.kind === "encounterDeck")).toBe(true);
    // The search and its shuffle replay to the same state from the recorded commands.
    const again = replay(run.session.log, deps);
    if (!again.ok) throw new Error(again.error.message);
    expect(again.state).toEqual(state);
  });

  it("already the villain in play: not added again; inPlay reveal resolves its When Revealed where it is", () => {
    const promoted = play(reveal(table()).state, FREE).state;
    const again = play(promoted, ADD);
    expect(types(again.events, "villainAdded")).toEqual([]);
    expect(again.state.villains.filter((v) => v.instanceId === PROTEGE_ID)).toHaveLength(1);
    const revealed = play(promoted, REVEAL_IN_PLACE);
    expect(types(revealed.events, "villainAdded")).toEqual([]);
    expect(countersOn(revealed.state, "revealed")).toBe(1);
  });
});

describe("removed from the game", () => {
  it("a promoted second villain defeated is out of play for good: no win while the first villain stands", () => {
    const promoted = play(reveal(table()).state, FREE).state;
    // 15 hit points on its side A in a one-player game: one more damage defeats it.
    const hit: GameState = {
      ...promoted,
      instances: { ...promoted.instances, [PROTEGE_ID]: { ...mustInstance(promoted, PROTEGE_ID), damage: 14 } },
    };
    const { state } = play(hit, SMITE_VILLAINS);
    expect(state.villains.find((v) => v.instanceId === PROTEGE_ID)?.defeated).toBe(true);
    expect(state.outcome).toBeNull();
    expect(cardsInPlay(state)).not.toContain(PROTEGE_ID);
    // "Find" does not search it: addVillain brings nothing in.
    const again = play(state, ADD);
    expect(types(again.events, "villainAdded")).toEqual([]);
    expect(again.state.villains.find((v) => v.instanceId === PROTEGE_ID)?.defeated).toBe(true);
  });
});

describe("refused", () => {
  it("an attachment that does not make it a minion: it stays set aside, and the attachment is discarded", () => {
    const { state, events } = reveal(table(), INERT);
    expect(events.some((e) => e.type === "putIntoPlayRefused" && e.instanceId === PROTEGE_ID)).toBe(true);
    expect(state.encounterSetAside).toContain(PROTEGE_ID);
    expect(locateCard(state, instanceOf(state, INERT.id))?.kind).toBe("encounterDiscard");
  });

  it("a villain card that is one of the game's villains, or one already in play, is not taken", () => {
    const added = play(table(), ADD).state;
    const { state, events } = reveal(added);
    expect(events.some((e) => e.type === "putIntoPlayRefused" && e.instanceId === PROTEGE_ID)).toBe(true);
    expect(isVillain(state, PROTEGE_ID)).toBe(true);
    expect(isMinion(state, PROTEGE_ID)).toBe(false);
    const twice = reveal(reveal(table()).state, SHADE);
    expect(twice.events.some((e) => e.type === "putIntoPlayRefused" && e.instanceId === PROTEGE_ID)).toBe(true);
    expect(countersOn(twice.state, "own-text")).toBe(0);
  });

  it("replays to the same state from the recorded commands", () => {
    const end = play(reveal(table()).state, SMITE);
    const again = replay(end.session.log, deps);
    if (!again.ok) throw new Error(again.error.message);
    expect(again.state).toEqual(end.state);
  });
});
