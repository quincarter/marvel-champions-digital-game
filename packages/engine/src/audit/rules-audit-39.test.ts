/**
 * Audit chunk 39. Scaffolding copied from captive-ally.test.ts (Odin shaped like Hope Summers 40130).
 *
 * 39.10 FFG ruling November 29, 2023 - Ruling 115: if Hope Summers is defeated while her text box is blank (treated as a
 * minion by Manipulated Mind or 'Pool-ized), "the players would still lose the game once Hope Summers left play".
 * RRG 1.8 p. 48 "Winning the Game": "Alternate win or loss conditions cannot be blanked or canceled."
 */

import { flat, type AllyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import { startSession } from "../engine.js";
import type { InstanceId } from "../ids.js";
import { mustInstance } from "../query.js";
import { cardsInPlay } from "../select.js";
import type { EffectSpec, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { stubAlly, stubAttachment, stubEvent, stubMainScheme, stubSideScheme } from "../testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO, TREACHERY } from "../testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  playerCardIntoPlay,
  playFree,
} from "../testing/wave3.js";
import { createGame } from "../setup.js";
import { driveSession } from "../testing/drive.js";

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
const _context = (state: GameState) => ({
  selfInstanceId: state.players[0]!.identity.instanceId,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});

describe("audit 39.10 an alternate loss condition cannot be blanked", () => {
  it.fails("a blanked (treated-as-minion) Hope/Odin that is defeated still loses the game (RRG 1.8 p. 48; Ruling 115)", () => {
    const detached = playFree(start(), deps, NASTROND.card.id).state;
    const odin = odinId(detached);
    const blanked: GameState = {
      ...detached,
      instances: {
        ...detached.instances,
        [odin]: {
          ...mustInstance(detached, odin),
          treatedAs: {
            kind: "minion",
            traits: [],
            keepPrintedTraits: true,
            schFromThw: true,
            source: odin,
            controllerBefore: P1,
          },
        },
      },
    };
    const { state: slain } = playFree(blanked, deps, SMITE.card.id);
    expect(cardsInPlay(slain)).not.toContain(odin); // precondition: she was defeated and left play
    expect(slain.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: odin });
  });
});

/**
 * 39.20 FFG ruling December 8, 2023 - Ruling 125: moving damage off Robert Kelly is healing him, "so you cannot target
 * him with Tic-Tac-Toe while Protect the Senator is in play". RRG 1.8 p. 43 "Target": "A target is valid for an ability
 * or game function if any part of that ability can affect that target"; heal is an effect on a target. A character that
 * cannot be healed by the ability is therefore no valid target of a "choose a character ... heal" ability.
 * Shape: Protect the Senator (`cannotBeHealed`, player cards) plus a "choose a damaged ally, heal 2" event.
 */
describe("audit 39.20 a character that cannot be healed is not a valid target of a heal", () => {
  const n2 = { kind: "const", value: 2 } as const;
  const senatorAbility = stubAbility("a39.senator.constant", {
    trigger: {
      kind: "constant",
      rules: [{ kind: "cannotBeHealed", target: { name: "kelly" }, bySource: "playerCard" }],
    },
    effects: [],
  });
  const SENATOR39 = stubSideScheme({ id: "a39senator", startingThreat: 5, abilities: [senatorAbility.ref] });
  const choose: EffectSpec = {
    kind: "chooseTarget",
    slot: "pick",
    chooser: { kind: "controller" },
    query: { categories: ["ally"] },
  };
  const mendAbility = stubAbility("a39.mend.action", {
    trigger: { kind: "action" },
    effects: [choose, { kind: "heal", target: { kind: "slot", slot: "pick" }, amount: n2 }],
  });
  const MEND39 = stubEvent({ id: "a39mend", cost: 0, abilities: [mendAbility.ref] });
  const KELLY39 = { ...stubAlly({ id: "kelly", cost: 0, atk: 0, thw: 1, hp: 6 }), name: "kelly" } as AllyCard;
  const AIDE39 = { ...stubAlly({ id: "aide", cost: 0, atk: 1, thw: 1, hp: 6 }), name: "aide" } as AllyCard;
  const deps39 = depsOf(senatorAbility, mendAbility);

  it("Kelly under Protect the Senator is not offered as the target of a player card's heal (RRG p. 43; Ruling 125)", () => {
    let state = gameAtFirstTurn({
      cards: [SENATOR39, MEND39, KELLY39, AIDE39],
      deps: deps39,
      deck: [MEND39.id, KELLY39.id, AIDE39.id],
      encounter: [SENATOR39.id],
    });
    state = encounterCardInVillainArea(state, SENATOR39.id, 5).state;
    const k = playerCardIntoPlay(state, KELLY39.id);
    const a = playerCardIntoPlay(k.state, AIDE39.id);
    const hurt: GameState = {
      ...a.state,
      instances: {
        ...a.state.instances,
        [k.id]: { ...a.state.instances[k.id]!, damage: 3 },
        [a.id]: { ...a.state.instances[a.id]!, damage: 3 },
      },
    };
    const given = giveCard(hurt, P1, MEND39.id);
    const driven = driveSession(startSession(given.state), deps39, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    // The driver answers prompts itself; read what the target prompt offered from the event log.
    const prompt = driven.events.flatMap((e) =>
      e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTarget" ? [e.choice] : [],
    );
    expect(prompt.length, "a target choice was offered").toBeGreaterThan(0);
    const offered = prompt[0]!.options.map((o) => o.optionId);
    expect(offered).toContain(a.id);
    expect(offered).not.toContain(k.id);
  });
});
