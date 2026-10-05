/**
 * docs/phase7-wave4.md §3.8: an encounter ally attached to the main scheme (Odin). Synthetic cards shaped like Hela's
 * Odin (`mts` 21139a/b, double-sided: Captive / King): Odin's Torment 1A "Attach Odin to the main scheme, captive side
 * faceup"; Odin (Captive), "While Odin is not attached to the main scheme, he gains: 'The first player gains control of
 * Odin. Odin cannot have cards attached and does not count against ally limit.' If Odin leaves play, the players lose the
 * game."; Hall of Nastrond, "When Defeated: The first player detaches Odin from the main scheme and takes control of him."
 * The same shapes as Robert Kelly (`mut_gen` 32063, 32065a) and Hope Summers (`next_evol` 40130).
 *
 * Sources: MC21 p. 20; rulings Jun 25, 2026 (4) #5 ("Characters not under player control are not friendly characters")
 * and Aug 3, 2026 (4) #1 ("Odin cannot have attachments while attached to the main scheme"); RRG 1.8 "Double-Sided Card"
 * (p. 17).
 */

import { flat, type AllyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance } from "./query.js";
import { cardsInPlay, explainQuery, selectTargets } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubAttachment, stubEvent, stubMainScheme } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, TREACHERY } from "./testing/scenario.js";
import { copiesOf, P1, playFree } from "./testing/wave3.js";
import { createGame } from "./setup.js";
import { driveSession } from "./testing/drive.js";

const self: TargetRef = { kind: "self" };
const odinRef: TargetRef = { kind: "named", name: "Odin" };
const notAttached = { kind: "not", of: { kind: "isAttached", of: self } } as const;
const CAPTIVE = stubAbility("odin.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "controlledByFirstPlayer", target: { self: true }, while: notAttached },
      { kind: "excludedFromAllyLimit", target: { self: true }, while: notAttached },
      { kind: "cannotHaveAttachments", target: { self: true } },
      { kind: "leavingPlayLoses", target: { self: true } },
    ],
  },
  effects: [],
});
const ODIN: AllyCard = {
  ...stubAlly({ id: "odin", cost: 0, atk: 3, thw: 2, hp: 6, abilities: [CAPTIVE.ref] }),
  name: "Odin",
  unique: true,
  flipSide: {
    name: "Odin",
    traits: [],
    keywords: [],
    text: { printed: "King.", current: "King." },
    abilities: [],
  },
};
const TORMENT_SETUP = stubAbility("torment.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "odin", cards: { kind: "encounterSetAside", filter: { name: "Odin" } } },
    { kind: "attach", card: { kind: "slot", slot: "odin" }, to: self },
  ],
});
const TORMENT = stubMainScheme({
  id: "odins-torment",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [TORMENT_SETUP.ref] },
  ],
});

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const NASTROND = event("nastrond", [{ kind: "detach", card: odinRef, controller: { kind: "firstPlayer" } }]);
const SMITE = event("smite", [{ kind: "dealDamage", target: odinRef, amount: { kind: "const", value: 6 } }]);
const POSSESSED = stubAttachment({ id: "possessed", name: "Possessed", attachesTo: { kind: "ally" } });
/** An encounter attachment put on Odin by effect: refused, it stays set aside. */
const POSSESS = event("possess", [
  { kind: "selectCards", slot: "p", cards: { kind: "encounterSetAside", filter: { name: "Possessed" } } },
  { kind: "attach", card: { kind: "slot", slot: "p" }, to: odinRef },
]);
/** Player cards that choose "an ally": heal 2 from it, or deal it 6 damage. */
const chooseAlly: EffectSpec = {
  kind: "chooseTarget",
  slot: "ally",
  chooser: { kind: "controller" },
  query: { categories: ["ally"] },
};
const allySlot: TargetRef = { kind: "slot", slot: "ally" };
const MEND = event("mend", [chooseAlly, { kind: "heal", target: allySlot, amount: { kind: "const", value: 2 } }]);
const SNIPE = event("snipe", [
  chooseAlly,
  { kind: "dealDamage", target: allySlot, amount: { kind: "const", value: 6 } },
]);
const EVENTS = [NASTROND, SMITE, POSSESS, MEND, SNIPE];
const deps: EngineDeps = depsOf(CAPTIVE, TORMENT_SETUP, ...EVENTS.map((e) => e.ability));
/** Odin with Find the Senator's "cannot be healed by player card effects" (§3.12) on top. */
const SEALED: EngineDeps = depsOf(
  stubAbility("odin.constant", {
    ...CAPTIVE.definition,
    trigger: {
      kind: "constant",
      rules: [
        ...(CAPTIVE.definition.trigger as { rules: readonly RuleSpec[] }).rules,
        { kind: "cannotBeHealed", target: { self: true }, bySource: "playerCard" },
      ],
    },
  }),
  TORMENT_SETUP,
  ...EVENTS.map((e) => e.ability),
);

function start(): GameState {
  const result = createGame(
    {
      seed: 4,
      cards: [...DEFAULT_CARDS, ODIN, TORMENT, POSSESSED, ...EVENTS.map((e) => e.card)],
      villainCardId: DEFAULT_CARDS.find((card) => card.type === "villain")!.id,
      mainSchemeCardId: TORMENT.id,
      encounterDeck: copiesOf(TREACHERY.id, 10),
      setAside: [ODIN.id, POSSESSED.id],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}
const odinId = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === ODIN.id)!.instanceId;
const context = (state: GameState) => ({
  selfInstanceId: state.players[0]!.identity.instanceId,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});

describe("§3.8 an encounter ally attached to the main scheme", () => {
  it("attached, Odin is an ally and a character in play but not a friendly one, and cannot take attachments", () => {
    const state = start();
    const odin = odinId(state);
    expect(mustInstance(state, odin).attachedTo).toBe(state.mainScheme.instanceId);
    expect(cardsInPlay(state)).toContain(odin);
    // docs/phase7-wave6.md §3.75: an ally and a character in play (RRG 1.8 "In Play and Out of Play", p. 23), not
    // friendly (ruling Jun 25, 2026 (4) #5). Before §3.75 he was reached by no category at all.
    expect(selectTargets(state, { categories: ["ally"] }, context(state))).toContain(odin);
    expect(selectTargets(state, { categories: ["character"] }, context(state))).toContain(odin);
    expect(selectTargets(state, { categories: ["identity", "ally"] }, context(state))).not.toContain(odin);
    expect(explainQuery(state, odin, { categories: ["identity", "ally"] }, context(state))).toBe("notFriendly");
    expect(selectTargets(state, { categories: ["ally"], controller: "you" }, context(state))).not.toContain(odin);
    const possessed = playFree(playFree(state, deps, NASTROND.card.id).state, deps, POSSESS.card.id).state;
    expect(mustInstance(possessed, odin).attachments).toEqual([]);
  });

  it("detached, the first player controls him, in play; defeated, he is removed from the game and the players lose", () => {
    const state = start();
    const odin = odinId(state);
    const detached = playFree(state, deps, NASTROND.card.id).state;
    expect(locateCard(detached, odin)).toEqual({ kind: "playArea", playerId: P1 });
    expect(mustInstance(detached, odin).controllerId).toBe(P1);
    expect(selectTargets(detached, { categories: ["ally"] }, context(detached))).toContain(odin);
    expect(selectTargets(detached, { categories: ["identity", "ally"] }, context(detached))).toContain(odin);
    const { state: slain, session } = playFree(detached, deps, SMITE.card.id);
    expect(slain.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: odin });
    expect(slain.removedFromGame).toContain(odin);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.75 an ally attached to a card is still a character in play", () => {
  // docs/phase7-wave6.md §3.75 (Robert Kelly on Find the Senator, `mut_gen` 32063-32066). RRG 1.8 "Ally" (p. 7): at
  // zero hit points an ally is defeated; "Attach To" (p. 8) and "In Play and Out of Play" (p. 23): attached, it is in
  // play. Not under player control, so not friendly (ruling Jun 25, 2026 (4) #5).
  const hurt = (state: GameState, damage: number) => {
    const odin = odinId(state);
    return { ...state, instances: { ...state.instances, [odin]: { ...mustInstance(state, odin), damage } } };
  };

  it("lethal damage while attached defeats him: he leaves the main scheme and the players lose", () => {
    const state = start();
    const odin = odinId(state);
    const { state: slain, session } = playFree(state, deps, SMITE.card.id);
    expect(slain.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: odin });
    expect(slain.removedFromGame).toContain(odin);
    expect(mustInstance(slain, state.mainScheme.instanceId).attachments).not.toContain(odin);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a player card can choose him as its ally: damage defeats him, a heal heals him", () => {
    const state = start();
    const odin = odinId(state);
    const sniped = playFree(state, deps, SNIPE.card.id).state;
    expect(sniped.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: odin });
    expect(sniped.removedFromGame).toContain(odin);
    const mended = playFree(hurt(state, 3), deps, MEND.card.id).state;
    expect(mustInstance(mended, odin).damage).toBe(1);
    expect(mustInstance(mended, odin).attachedTo).toBe(state.mainScheme.instanceId);
  });

  it("'cannot be healed by player card effects' still stops a player card's heal while he is attached", () => {
    const state = hurt(start(), 3);
    const mended = playFree(state, SEALED, MEND.card.id).state;
    expect(mustInstance(mended, odinId(state)).damage).toBe(3);
  });

  it("below lethal he stays attached; a controlled ally in a play area is defeated as before", () => {
    const state = hurt(start(), 5);
    const odin = odinId(state);
    const after = playFree(state, deps, NASTROND.card.id).state;
    expect(mustInstance(after, odin).attachedTo).toBeNull();
    expect(after.outcome).toBeNull();
    const kept = playFree(state, deps, MEND.card.id).state;
    expect(mustInstance(kept, odin).attachedTo).toBe(state.mainScheme.instanceId);
    const slain = playFree(after, deps, SNIPE.card.id).state;
    expect(slain.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: odin });
    expect(slain.removedFromGame).toContain(odin);
  });
});
