/**
 * Peril keeps the other players out (RRG v1.8 p.32 "Peril"; ruling 2026-07-09 R3, item 5).
 *
 * RRG v1.8 p.32: "While a player is resolving a card with the peril keyword, that player cannot consult other players,
 * and other players cannot play cards or trigger abilities." Ruling 2026-07-09 R3 (5), Hull Breach: "Peril prohibits
 * other players from acting or playing cards." Forced abilities are "triggered by the game at the ability's
 * appropriate timing point" (RRG v1.8 p.4 "Ability"), not by a player, so they still resolve.
 *
 * Synthetic cards, two players: P1 plays Reveal (reveal the top encounter card). The treachery's When Revealed deals 1
 * damage to the villain. Each player has a Watch in play: an optional interrupt to that damage and an optional response
 * to it. P2 also has an Alarm: a forced response to it, which places an alarm counter on the main scheme.
 */

import { flat, type CardId, type KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import {
  copiesOf,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const theVillain = { kind: "named", name: "villain" } as const;
const mainScheme = { kind: "each", query: { categories: ["mainScheme"] } } as const;
const damageToVillain = { on: "dealDamage", targetIs: { categories: ["villain"] } } as const;
const mark = (counterType: string) => ({ kind: "addCounters", target: mainScheme, counterType, amount: one }) as const;

/** "When Revealed: Deal 1 damage to the villain." */
const ZAP = stubAbility("zap.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "dealDamage", target: theVillain, amount: one }],
});
/** "Interrupt: When damage would be dealt to the villain, place 1 watch counter on the main scheme." */
const WATCH_INTERRUPT = stubAbility("watch.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: damageToVillain },
  effects: [mark("watch")],
});
/** "Response: After damage is dealt to the villain, place 1 watch counter on the main scheme." */
const WATCH_RESPONSE = stubAbility("watch.response", {
  trigger: { kind: "response", forced: false, on: damageToVillain },
  effects: [mark("watch")],
});
/** "Forced Response: After damage is dealt to the villain, place 1 alarm counter on the main scheme." */
const ALARM_RESPONSE = stubAbility("alarm.forced-response", {
  trigger: { kind: "response", forced: true, on: damageToVillain },
  effects: [mark("alarm")],
});
/** "Action: Reveal the top card of the encounter deck." */
const REVEAL_ACTION = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});

const PERILOUS = stubTreachery({ id: "perilous", boostIcons: 0, keywords: [{ name: "peril" }], abilities: [ZAP.ref] });
const PLAIN = stubTreachery({ id: "plain", boostIcons: 0, abilities: [ZAP.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_INTERRUPT.ref, WATCH_RESPONSE.ref] });
const ALARM = stubSupport({ id: "alarm", cost: 0, abilities: [ALARM_RESPONSE.ref] });
const REVEAL = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL_ACTION.ref] });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

/** "When Revealed: The villain attacks you." */
const ASSAULT = stubAbility("assault.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "controller" } }],
});
const PERILOUS_ASSAULT = stubTreachery({
  id: "perilous-assault",
  boostIcons: 0,
  keywords: [{ name: "peril" }],
  abilities: [ASSAULT.ref],
});
const PLAIN_ASSAULT = stubTreachery({ id: "plain-assault", boostIcons: 0, abilities: [ASSAULT.ref] });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 5 });

const deps: EngineDeps = depsOf(ZAP, WATCH_INTERRUPT, WATCH_RESPONSE, ALARM_RESPONSE, REVEAL_ACTION, ASSAULT);

function table(): GameState {
  let state = gameAtFirstTurn({
    cards: [PERILOUS, PLAIN, FILLER, WATCH, ALARM, REVEAL, PERILOUS_ASSAULT, PLAIN_ASSAULT, BUDDY],
    deps,
    players: 2,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deck: [WATCH.id, ALARM.id, REVEAL.id, REVEAL.id, BUDDY.id],
    encounter: [PERILOUS.id, PLAIN.id, PERILOUS_ASSAULT.id, PLAIN_ASSAULT.id, ...copiesOf(FILLER.id, 20)],
  });
  state = playerCardIntoPlay(state, WATCH.id, P1).state;
  state = playerCardIntoPlay(state, WATCH.id, P2).state;
  state = playerCardIntoPlay(state, ALARM.id, P2).state;
  return state;
}

interface Offer {
  readonly playerId: PlayerId;
  readonly abilityIds: readonly string[];
}

/** P1 reveals `card` from the top of the encounter deck; every optional-trigger prompt is recorded and declined. */
function p1Reveals(state: GameState, card: CardId): { readonly state: GameState; readonly offers: readonly Offer[] } {
  const offers: Offer[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      offers.push({
        playerId: choice.playerId,
        abilityIds: choice.options.map((option) => option.optionId.split(":").slice(1).join(":")),
      });
    }
    return defaultPick(current);
  };
  return { state: playRevealPicking(onTopOfEncounterDeck(state, card), pick), offers };
}

function playRevealPicking(state: GameState, pick: (state: GameState) => readonly string[]): GameState {
  const given = giveCard(state, P1, REVEAL.id);
  return runCommandsPicking(given.state, deps, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
}

const counters = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters?.[counterType] ?? 0;

describe("peril: other players cannot trigger abilities (RRG v1.8 p.32; ruling 2026-07-09 R3)", () => {
  it("without peril, both players are offered their optional interrupt and response (control)", () => {
    const { offers } = p1Reveals(table(), PLAIN.id);
    expect(offers.filter((offer) => offer.playerId === P2).flatMap((offer) => offer.abilityIds)).toEqual([
      "watch.interrupt",
      "watch.response",
    ]);
    expect(offers.some((offer) => offer.playerId === P1)).toBe(true);
  });

  it("while P1 resolves a peril card, P2 is offered nothing, P1 still is, and P2's forced response resolves", () => {
    const { state, offers } = p1Reveals(table(), PERILOUS.id);
    expect(offers.filter((offer) => offer.playerId === P2)).toEqual([]);
    expect(offers.filter((offer) => offer.playerId === P1).flatMap((offer) => offer.abilityIds)).toEqual([
      "watch.interrupt",
      "watch.response",
    ]);
    // Forced abilities are triggered by the game (RRG v1.8 p.4), not by P2: peril does not stop them.
    expect(counters(state, "alarm")).toBe(1);
  });

  it("once the peril card is done, P2's optional abilities are offered again", () => {
    const afterPeril = p1Reveals(table(), PERILOUS.id).state;
    expect(afterPeril.stack).toEqual([]);
    const { state, offers } = p1Reveals(afterPeril, PLAIN.id);
    expect(offers.filter((offer) => offer.playerId === P2).flatMap((offer) => offer.abilityIds)).toEqual([
      "watch.interrupt",
      "watch.response",
    ]);
    expect(counters(state, "alarm")).toBe(2);
  });

  // Ruling 2026-07-09 R3 (5), Hull Breach: "Can other players defend?" "No."
  describe("defending an attack the peril card makes", () => {
    /** Each player has an ally in play; P1 reveals `card` and the defenders offered to them are recorded. */
    const defendersOffered = (card: CardId): readonly string[] => {
      let state = table();
      const p1Ally = playerCardIntoPlay(state, BUDDY.id, P1);
      const p2Ally = playerCardIntoPlay(p1Ally.state, BUDDY.id, P2);
      state = p2Ally.state;
      const offered: string[] = [];
      playRevealPicking(onTopOfEncounterDeck(state, card), (current) => {
        const choice = current.pendingChoice;
        if (choice?.prompt.kind === "declareDefender") {
          offered.push(
            ...choice.options.map((option) =>
              option.optionId === p1Ally.id ? "p1-ally" : option.optionId === p2Ally.id ? "p2-ally" : option.optionId,
            ),
          );
        }
        return defaultPick(current);
      });
      return offered;
    };

    it("without peril, P2's ally may defend P1 (control)", () => {
      expect(defendersOffered(PLAIN_ASSAULT.id)).toEqual(["decline", "p1-ally", "p2-ally"]);
    });

    it("while P1 resolves a peril card, only P1's characters may defend", () => {
      expect(defendersOffered(PERILOUS_ASSAULT.id)).toEqual(["decline", "p1-ally"]);
    });
  });
});

/**
 * RRG 1.8 "Peril" (p. 32), its constant-ability form: "While this card is in a player's play area, other players cannot
 * trigger abilities on this card." Synthetic minion engaged with P1, with an Action any player could otherwise use (an
 * encounter card's Action, FFG ruling December 17, 2025, Ruling 1).
 */
describe("peril: a peril card in a player's play area (RRG v1.8 p.32)", () => {
  const PERIL: readonly KeywordInstance[] = [{ name: "peril" }];
  const POKE = stubAbility("lurker.action", {
    trigger: { kind: "action" },
    effects: [{ kind: "dealDamage", target: { kind: "self" }, amount: one }],
  } as AbilityDefinition);
  const lurker = (keywords: readonly KeywordInstance[]) =>
    stubMinion({
      id: keywords.length > 0 ? "peril-lurker" : "plain-lurker",
      atk: 0,
      sch: 0,
      hp: 9,
      boostIcons: 0,
      keywords,
      abilities: [POKE.ref],
    });
  const lurkerDeps = depsOf(POKE);

  /** P1 passes with the lurker engaged; returns P2's turn. */
  const lurkerGame = (keywords: readonly KeywordInstance[]) => {
    const card = lurker(keywords);
    const start = gameAtFirstTurn({
      cards: [card, FILLER],
      deps: lurkerDeps,
      players: 2,
      encounter: [card.id, ...copiesOf(FILLER.id, 20)],
    });
    const engaged = minionEngagedWith(start, card.id, P1);
    const { state } = runCommandsPicking(engaged.state, lurkerDeps, defaultPick, { type: "endTurn", playerId: P1 });
    return { state, id: engaged.id };
  };
  const use = (id: InstanceId): Command => ({
    type: "useAbility",
    playerId: P2,
    cardInstanceId: id,
    abilityId: POKE.ref.id,
    payment: [],
  });
  const offered = (state: GameState, id: InstanceId): boolean => {
    const legal = legalActions(state, P2, lurkerDeps);
    return "legal" in legal && JSON.stringify(legal.legal).includes(id);
  };

  it("control: another player may trigger an encounter card's action in a player's play area", () => {
    const { state, id } = lurkerGame([]);
    expect(offered(state, id)).toBe(true);
    expect(applyCommand(state, use(id), lurkerDeps).ok).toBe(true);
  });

  it("a peril card in a player's play area: other players cannot trigger its abilities", () => {
    const { state, id } = lurkerGame(PERIL);
    expect(offered(state, id)).toBe(false);
    expect(applyCommand(state, use(id), lurkerDeps).ok).toBe(false);
  });
});
