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

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { PlayerId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

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

const deps: EngineDeps = depsOf(ZAP, WATCH_INTERRUPT, WATCH_RESPONSE, ALARM_RESPONSE, REVEAL_ACTION);

function table(): GameState {
  let state = gameAtFirstTurn({
    cards: [PERILOUS, PLAIN, FILLER, WATCH, ALARM, REVEAL],
    deps,
    players: 2,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deck: [WATCH.id, ALARM.id, REVEAL.id, REVEAL.id],
    encounter: [PERILOUS.id, PLAIN.id, ...copiesOf(FILLER.id, 20)],
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
});
