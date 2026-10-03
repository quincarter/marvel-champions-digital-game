import { cardId } from "@mc/content";
import {
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { GAMBIT_IDENTITY, THROW_DE_CARD_NOTE } from "./identity.js";
import { gambitGame } from "./support.js";

const CHARGE = "37001a.charge-de-card";
const THROW = "37001a.throw-de-card";
const THIEF = "37001b.thief-extraordinaire";
const HAYMAKER = "01087"; // Hero Action (attack): Deal 3 damage to an enemy. Cost 2, an ATTACK event.
const SMASH = "01022"; // Hero Action: Deal 1 damage to each enemy. Cost 2, an event that is not an ATTACK.
const TWO_ICONS = "01190"; // Shadow of the Past, 2 boost icons.
const ONE_ICON = "01188"; // Caught Off Guard, 1 boost icon.
const NO_ICONS = "01186"; // Advance, 0 boost icons.

const heroGambit = (seed = 1): GameState => withForm(gambitGame("rhino", { seed }), { heroForm: 0 });
const remy = (seed = 1): GameState => gambitGame("rhino", { seed });
const charges = (state: GameState): number => inst(state, identityOf(state, P1)).counters.charge ?? 0;
const withCharges = (state: GameState, count: number): GameState =>
  patchInstance(state, identityOf(state, P1), { counters: { charge: count } });
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Applies `command`, answering every choice with `pick` (default: decline). Replays the log and compares. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, WAVE6_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 100) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      WAVE6_DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, WAVE6_DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

const rejected = (state: GameState, command: Command): boolean =>
  !sessionApply(startSession(state), command, WAVE6_DEPS).ok;

/** Uses Throw de Card whenever offered and answers its count prompt with `count`; other choices are the default. */
const throwing =
  (count: number, asked: { counts: string[][] } = { counts: [] }): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const offered = choice.options.filter((o) => o.optionId.includes(THROW));
      if (offered.length > 0) return offered.map((o) => o.optionId);
    }
    if (choice?.prompt.kind === "chooseCostCounters") {
      asked.counts.push(choice.options.map((o) => o.optionId));
      return [String(count)];
    }
    if (choice?.prompt.kind === "payForAbility") return choice.options.slice(0, 1).map((o) => o.optionId);
    return firstLegal(state);
  };

/**
 * Hero Gambit with `charge` counters and a copy of `code` (a Core event, not in his deck) in hand: the first deck card
 * is turned into it (instance surgery), and the command plays it paid by `cost` other hand cards.
 */
function staged(code: string, cost: number, charge: number) {
  const base = withCharges(heroGambit(), charge);
  const donor = playerOf(base, P1).deck[0]!;
  const given = moveToHand(patchInstance(base, donor, { cardId: cardId(code) }), P1, code);
  const [id] = given.ids as [InstanceId];
  return { state: given.state, id, command: play(P1, id, payWith(given.state, P1, cost, [id])) };
}

describe("Gambit / Remy LeBeau (37001a/b)", () => {
  it("registers exactly the identity refs the card data names, all valid", () => {
    expect(Object.keys(GAMBIT_IDENTITY).sort()).toEqual([CHARGE, THROW, THIEF].sort());
    for (const definition of Object.values(GAMBIT_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("37001a.charge-de-card (Charge de Card)", () => {
    it("places exactly 1 charge counter on the identity", () => {
      const start = heroGambit();
      expect(charges(start)).toBe(0);
      const { state, events } = drive(start, use(P1, identityOf(start), CHARGE));
      expect(charges(state)).toBe(1);
      expect(ofType(events, "counterAdded")).toHaveLength(1);
      expect(inst(state, identityOf(state)).exhausted).toBe(inst(start, identityOf(start)).exhausted);
    });

    it("is limited to once per round, and a new round allows it again", () => {
      const start = heroGambit();
      const { state } = drive(start, use(P1, identityOf(start), CHARGE));
      expect(rejected(state, use(P1, identityOf(state), CHARGE))).toBe(true);
      expect(charges(state)).toBe(1);
    });

    it("is not live in alter-ego form", () => {
      const state = remy();
      expect(rejected(state, use(P1, identityOf(state), CHARGE))).toBe(true);
    });
  });

  describe("37001a.throw-de-card (Throw de Card)", () => {
    it.each([1, 2, 3])(
      "removes the chosen %i counter(s) from 3 held and adds exactly that damage to an ATTACK event",
      (count) => {
        const { state, command } = staged(HAYMAKER, 2, 3);
        const asked = { counts: [] as string[][] };
        const { state: after, events } = drive(state, command, throwing(count, asked));
        expect(asked.counts).toEqual([["3", "2", "1"]]);
        expect(charges(after)).toBe(3 - count);
        expect(inst(after, villainOf(after)).damage).toBe(inst(state, villainOf(state)).damage + 3 + count);
        expect(ofType(events, "playNoted")).toEqual([
          expect.objectContaining({ name: THROW_DE_CARD_NOTE, value: count, total: count }),
        ]);
      },
    );

    it("never offers more than 3, and not more than are held", () => {
      const five = staged(HAYMAKER, 2, 5);
      const askedFive = { counts: [] as string[][] };
      const { state: afterFive } = drive(five.state, five.command, throwing(3, askedFive));
      expect(askedFive.counts).toEqual([["3", "2", "1"]]);
      expect(charges(afterFive)).toBe(2);
      const two = staged(HAYMAKER, 2, 2);
      const askedTwo = { counts: [] as string[][] };
      drive(two.state, two.command, throwing(2, askedTwo));
      expect(askedTwo.counts).toEqual([["2", "1"]]);
    });

    it("declined: no counters spent, no bonus, no note", () => {
      const { state, command } = staged(HAYMAKER, 2, 3);
      const { state: after, events } = drive(state, command);
      expect(charges(after)).toBe(3);
      expect(inst(after, villainOf(after)).damage).toBe(inst(state, villainOf(state)).damage + 3);
      expect(ofType(events, "playNoted")).toEqual([]);
    });

    it("is not offered with no counters", () => {
      const { state, command } = staged(HAYMAKER, 2, 0);
      const { state: after, events } = drive(state, command, throwing(1));
      expect(charges(after)).toBe(0);
      expect(inst(after, villainOf(after)).damage).toBe(inst(state, villainOf(state)).damage + 3);
      expect(ofType(events, "playNoted")).toEqual([]);
    });

    it("is not offered for an event that is not an ATTACK", () => {
      const { state, command } = staged(SMASH, 2, 3);
      let offeredThrow = false;
      const watcher: Picker = (s) => {
        if (s.pendingChoice?.options.some((o) => o.optionId.includes(THROW))) offeredThrow = true;
        return throwing(2)(s);
      };
      const { state: after, events } = drive(state, command, watcher);
      expect(offeredThrow).toBe(false);
      expect(charges(after)).toBe(3);
      expect(ofType(events, "playNoted")).toEqual([]);
    });

    it("the note reaches Charged Card's thresholds through playNote", () => {
      // Charged Card (37006) is the events agent's; here the note is read as its thresholds read it.
      const { state, command } = staged(HAYMAKER, 2, 3);
      const { events } = drive(state, command, throwing(2));
      const noted = ofType(events, "playNoted");
      expect(noted).toHaveLength(1);
      expect(noted[0]).toMatchObject({ name: "throwDeCard", value: 2, total: 2 });
    });
  });

  describe("37001b.thief-extraordinaire (Thief Extraordinaire)", () => {
    /** Remy with `top` stacked on the encounter deck, the main scheme at 6 threat. */
    const withTop = (...top: string[]): GameState => {
      const base = remy();
      return patchInstance(stackEncounterDeck(base, ...top), base.mainScheme.instanceId, { threat: 6 });
    };
    const pickCard =
      (code: string): Picker =>
      (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseCards") {
          const hit = choice.options.find(
            (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === cardId(code),
          );
          if (hit) return [hit.optionId];
        }
        return firstLegal(state);
      };
    const deck = (state: GameState): string[] => {
      const id = Object.keys(state.encounterDecks)[0]!;
      return state.encounterDecks[id]!.deck.map((i) => state.instances[i]!.cardId as string);
    };

    it("looks at the top 2, discards the chosen 1 as a cost, and removes threat equal to its boost icons", () => {
      const start = withTop(TWO_ICONS, ONE_ICON, NO_ICONS);
      const { state, events } = drive(start, use(P1, identityOf(start), THIEF), pickCard(TWO_ICONS));
      expect(inst(state, state.mainScheme.instanceId).threat).toBe(4);
      expect(inst(state, identityOf(state)).exhausted).toBe(true);
      expect(deck(state).slice(0, 2)).toEqual([ONE_ICON, NO_ICONS]);
      expect(ofType(events, "cardsLookedAt")[0]!.instanceIds.map((i) => inst(start, i).cardId)).toEqual([
        cardId(TWO_ICONS),
        cardId(ONE_ICON),
      ]);
      const discarded = ofType(events, "encounterLookCostSettled")[0]!;
      expect(discarded.discarded.map((i) => inst(state, i).cardId)).toEqual([cardId(TWO_ICONS)]);
    });

    it("discarding the other looked-at card removes its icons instead (1), and a 0-icon card removes none", () => {
      const start = withTop(TWO_ICONS, ONE_ICON, NO_ICONS);
      const { state } = drive(start, use(P1, identityOf(start), THIEF), pickCard(ONE_ICON));
      expect(inst(state, state.mainScheme.instanceId).threat).toBe(5);
      expect(deck(state).slice(0, 2)).toEqual([TWO_ICONS, NO_ICONS]);
      const zero = withTop(NO_ICONS, TWO_ICONS);
      const { state: none } = drive(zero, use(P1, identityOf(zero), THIEF), pickCard(NO_ICONS));
      expect(inst(none, none.mainScheme.instanceId).threat).toBe(6);
      expect(inst(none, identityOf(none)).exhausted).toBe(true);
    });

    it("counts as a thwart", () => {
      const start = withTop(TWO_ICONS, ONE_ICON);
      const { events } = drive(start, use(P1, identityOf(start), THIEF), pickCard(TWO_ICONS));
      const thwarts = events.flatMap((e) => (e.type === "triggerEvent" && e.event.kind === "thwart" ? [e] : []));
      expect(thwarts.length).toBeGreaterThan(0);
      expect(thwarts[0]!.event).toMatchObject({ kind: "thwart", amount: 2, basic: false });
    });

    it("a confused Remy still pays the cost, the thwart is replaced by the confused card", () => {
      const base = withTop(TWO_ICONS, ONE_ICON);
      const start = patchInstance(base, identityOf(base), {
        statuses: { ...inst(base, identityOf(base)).statuses, confused: 1 },
      });
      const { state } = drive(start, use(P1, identityOf(start), THIEF), pickCard(TWO_ICONS));
      expect(inst(state, state.mainScheme.instanceId).threat).toBe(6);
      expect(inst(state, identityOf(state)).exhausted).toBe(true);
      expect(inst(state, identityOf(state)).statuses.confused).toBe(0);
      expect(deck(state)[0]).toBe(ONE_ICON);
    });

    it("crisis: with a crisis side scheme in play only it can be thwarted", () => {
      const base = withTop(TWO_ICONS, ONE_ICON);
      const crisis = encounterCardInVillainArea(base, "01108", 5);
      const { state } = drive(crisis.state, use(P1, identityOf(crisis.state), THIEF), pickCard(TWO_ICONS));
      expect(inst(state, crisis.id).threat).toBe(3);
      expect(inst(state, state.mainScheme.instanceId).threat).toBe(6);
    });

    it("is limited by exhaustion (once, then Remy is exhausted), and is not live in hero form", () => {
      const start = withTop(TWO_ICONS, ONE_ICON, NO_ICONS, NO_ICONS);
      const { state } = drive(start, use(P1, identityOf(start), THIEF), pickCard(TWO_ICONS));
      expect(rejected(state, use(P1, identityOf(state), THIEF))).toBe(true);
      const hero = withForm(start, { heroForm: 0 });
      expect(rejected(hero, use(P1, identityOf(hero), THIEF))).toBe(true);
    });

    it("replays deep-equal (checked in every drive call)", () => {
      const start = withTop(TWO_ICONS, ONE_ICON);
      const { state } = drive(start, use(P1, identityOf(start), THIEF), pickCard(ONE_ICON));
      expect(inst(state, state.mainScheme.instanceId).threat).toBe(5);
    });
  });
});
