/**
 * Every response to something that happens while an encounter card is being revealed waits for the end of the reveal
 * (RRG v1.8 p. 38; owner decision 2026-10-16, audit finding 18).
 *
 * RRG v1.8 p. 38 "Reveal": "Responses (both forced and non-forced) to any step of the revealing of an encounter card are
 * not resolved until after all steps of the reveal process have been completed." Before this decision the engine held
 * only the responses to the revealed card entering play (answers 32B, 35B); now the responses to threat its incite or
 * When Revealed places, to damage its When Revealed deals, and so on, wait as well, and open in the end-of-reveal
 * window with "after this card is revealed" (answer 39A). Interrupts are not held. Peril still bars the other players'
 * optional responses in that window (RRG v1.8 p. 32 "Peril"). A card that is not being revealed keeps its order
 * (answer 38A; `reveal-order.test.ts` covers a minion put into play).
 *
 * Synthetic cards: each When Revealed ends with a "revealed" mark on the main scheme, and each response leaves its own
 * mark, so the event log orders them.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { PlayerId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const mainScheme = { kind: "each", query: { categories: ["mainScheme"] } } as const;
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: mainScheme,
  counterType,
  amount: one,
});
const threatOnMainScheme = { on: "placeThreat", targetIs: { categories: ["mainScheme"] } } as const;
const damageToVillain = { on: "dealDamage", targetIs: { categories: ["villain"] } } as const;

const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition) => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub.ref;
};
const whenRevealed = (id: string, ...effects: EffectSpec[]) =>
  ability(`${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects: [...effects, mark("revealed")] });

/** "When Revealed: Place 1 threat on the main scheme." */
const SCHEMER = stubTreachery({
  id: "schemer",
  boostIcons: 0,
  abilities: [whenRevealed("schemer", { kind: "placeThreat", target: { kind: "mainScheme" }, amount: one })],
});
/** Incite 1, and a When Revealed that only leaves its mark. */
const INCITER = stubTreachery({
  id: "inciter",
  boostIcons: 0,
  keywords: [{ name: "incite", value: 1 }],
  abilities: [whenRevealed("inciter")],
});
/** "When Revealed: Deal 1 damage to the villain." */
const STRIKER = stubTreachery({
  id: "striker",
  boostIcons: 0,
  abilities: [whenRevealed("striker", { kind: "dealDamage", target: { kind: "named", name: "villain" }, amount: one })],
});
/** Peril. "When Revealed: Place 1 threat on the main scheme." */
const PERILOUS_SCHEMER = stubTreachery({
  id: "perilous-schemer",
  boostIcons: 0,
  keywords: [{ name: "peril" }],
  abilities: [whenRevealed("perilous-schemer", { kind: "placeThreat", target: { kind: "mainScheme" }, amount: one })],
});
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

/** "Forced Response: After threat is placed on the main scheme, …" */
const THREAT_ALARM = stubSupport({
  id: "threat-alarm",
  cost: 0,
  abilities: [
    ability("threat-alarm.response", {
      trigger: { kind: "response", forced: true, on: threatOnMainScheme },
      effects: [mark("threatAnswered")],
    }),
  ],
});
/** "Forced Response: After damage is dealt to the villain, …" */
const DAMAGE_ALARM = stubSupport({
  id: "damage-alarm",
  cost: 0,
  abilities: [
    ability("damage-alarm.response", {
      trigger: { kind: "response", forced: true, on: damageToVillain },
      effects: [mark("damageAnswered")],
    }),
  ],
});
/** "Interrupt: When damage would be dealt to the villain, …" (forced, so it always resolves). */
const DAMAGE_BRACE = stubSupport({
  id: "damage-brace",
  cost: 0,
  abilities: [
    ability("damage-brace.interrupt", {
      trigger: { kind: "interrupt", forced: true, on: damageToVillain },
      effects: [mark("damageBraced")],
    }),
  ],
});
/** "Response: After threat is placed on the main scheme, …" (optional: a player triggers it). */
const THREAT_WATCH = stubSupport({
  id: "threat-watch",
  cost: 0,
  abilities: [
    ability("threat-watch.response", {
      trigger: { kind: "response", forced: false, on: threatOnMainScheme },
      effects: [mark("watched")],
    }),
  ],
});
/** "Action: Reveal the top card of the encounter deck." */
const REVEAL = stubEvent({
  id: "reveal",
  cost: 0,
  abilities: [
    ability("reveal.action", {
      trigger: { kind: "action" },
      effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
    }),
  ],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const deps: EngineDeps = depsOf(...abilities);

/** A game at P1's first turn with `supports` in play for each listed player. */
function table(players: 1 | 2, supports: readonly (readonly [CardId, PlayerId])[]): GameState {
  let state = gameAtFirstTurn({
    cards: [
      SCHEMER,
      INCITER,
      STRIKER,
      PERILOUS_SCHEMER,
      FILLER,
      THREAT_ALARM,
      DAMAGE_ALARM,
      DAMAGE_BRACE,
      THREAT_WATCH,
      REVEAL,
    ],
    deps,
    players,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deck: [THREAT_ALARM.id, DAMAGE_ALARM.id, DAMAGE_BRACE.id, THREAT_WATCH.id, REVEAL.id],
    encounter: [SCHEMER.id, INCITER.id, STRIKER.id, PERILOUS_SCHEMER.id, ...copiesOf(FILLER.id, 20)],
  });
  for (const [card, player] of supports) state = playerCardIntoPlay(state, card, player).state;
  return state;
}

/** P1 plays Reveal with `card` on top of the encounter deck. */
function p1Reveals(state: GameState, card: CardId, pick: (state: GameState) => readonly string[] = defaultPick) {
  const given = giveCard(onTopOfEncounterDeck(state, card), P1, REVEAL.id);
  return runCommandsPicking(given.state, deps, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const counter = (state: GameState, counterType: string): number =>
  mustInstance(state, state.mainScheme.instanceId).counters?.[counterType] ?? 0;
const marked = (events: readonly GameEvent[], counterType: string): number =>
  events.findIndex((e) => e.type === "counterAdded" && e.counterType === counterType);
/** Where the reveal's "after this card is revealed" announcement resolved: the end-of-reveal window follows it. */
const announced = (events: readonly GameEvent[]): number =>
  events.findIndex((e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardRevealed");
const resolvedAt = (events: readonly GameEvent[], kind: string): number =>
  events.findIndex((e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === kind);

describe("responses to a step of a reveal wait until the reveal has finished (RRG v1.8 p.38; owner decision 2026-10-16, audit finding 18)", () => {
  it("(a) a response to threat a When Revealed placed resolves after the When Revealed and the reveal's end", () => {
    const { state, events } = p1Reveals(table(1, [[THREAT_ALARM.id, P1]]), SCHEMER.id);
    expect(counter(state, "threatAnswered")).toBe(1);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(1);
    // The threat itself was placed during step 3; only its response window waited.
    expect(resolvedAt(events, "placeThreat")).toBeLessThan(marked(events, "revealed"));
    expect(marked(events, "revealed")).toBeLessThan(announced(events));
    expect(announced(events)).toBeLessThan(marked(events, "threatAnswered"));
    expect(state.stack).toEqual([]);
  });

  it("(a) a response to incite's threat waits too (incite is a When Revealed ability, RRG v1.8 p.24)", () => {
    const { state, events } = p1Reveals(table(1, [[THREAT_ALARM.id, P1]]), INCITER.id);
    expect(counter(state, "threatAnswered")).toBe(1);
    expect(marked(events, "revealed")).toBeLessThan(marked(events, "threatAnswered"));
    expect(announced(events)).toBeLessThan(marked(events, "threatAnswered"));
  });

  it("(b) a response to damage a When Revealed dealt resolves after the reveal; its interrupt is not held", () => {
    const { state, events } = p1Reveals(
      table(1, [
        [DAMAGE_ALARM.id, P1],
        [DAMAGE_BRACE.id, P1],
      ]),
      STRIKER.id,
    );
    expect(mustInstance(state, state.villains[0]!.instanceId).damage).toBe(1);
    expect(counter(state, "damageAnswered")).toBe(1);
    // The interrupt resolves as the damage would be dealt, inside the When Revealed (RRG v1.8 p.25).
    expect(marked(events, "damageBraced")).toBeLessThan(resolvedAt(events, "dealDamage"));
    expect(resolvedAt(events, "dealDamage")).toBeLessThan(marked(events, "revealed"));
    expect(announced(events)).toBeLessThan(marked(events, "damageAnswered"));
  });

  describe("(d) peril still keeps the other players' optional responses out of the held window (RRG v1.8 p.32, p.38)", () => {
    interface Offer {
      readonly playerId: PlayerId;
      readonly abilityIds: readonly string[];
      /** The When Revealed had finished when the player was asked. */
      readonly afterWhenRevealed: boolean;
    }
    const offersOn = (card: CardId) => {
      const offers: Offer[] = [];
      const pick = (current: GameState): readonly string[] => {
        const choice = current.pendingChoice;
        if (choice?.prompt.kind === "chooseTriggers") {
          offers.push({
            playerId: choice.playerId,
            abilityIds: choice.options.map((option) => option.optionId.split(":").slice(1).join(":")),
            afterWhenRevealed: counter(current, "revealed") === 1,
          });
        }
        return defaultPick(current);
      };
      const start = table(2, [
        [THREAT_WATCH.id, P1],
        [THREAT_WATCH.id, P2],
      ]);
      return { offers, state: p1Reveals(start, card, pick).state };
    };

    it("without peril, both players are offered their response once the reveal is done (control)", () => {
      const { offers } = offersOn(SCHEMER.id);
      const asked = offers.filter((offer) => offer.abilityIds.includes("threat-watch.response"));
      expect(asked.map((offer) => offer.playerId).sort()).toEqual([P1, P2].sort());
      expect(asked.every((offer) => offer.afterWhenRevealed)).toBe(true);
    });

    it("with peril, the held window offers P1's response and not P2's", () => {
      const { offers, state } = offersOn(PERILOUS_SCHEMER.id);
      const asked = offers.filter((offer) => offer.abilityIds.includes("threat-watch.response"));
      expect(asked.map((offer) => offer.playerId)).toEqual([P1]);
      expect(asked.every((offer) => offer.afterWhenRevealed)).toBe(true);
      expect(state.stack).toEqual([]);
    });
  });
});
