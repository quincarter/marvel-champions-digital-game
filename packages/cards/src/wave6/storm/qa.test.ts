import { cardId } from "@mc/content";
import {
  activeVillain,
  cardsInPlay,
  createGame,
  replay,
  separateDeckOf,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, playFromHand, withForm } from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { WEATHER_DECK } from "./storm/identity.js";
import { stormGame } from "./storm/support.js";

/**
 * Wave 6 rules QA, Storm pack (`docs/phase7-wave6-qa-wolverine-storm.md`). Two parts.
 *
 * 1. Rulings and errata that touch a card of the pack (Storm, her Weather deck, her nemesis set and The Shadow King
 *    modular set). Already pinned exactly by a module test, so not copied here:
 *    - Erratum RRG 1.8 p. 68, Claustrophobia (#30), "You cannot change to hero form": `storm/obligation-nemesis.test.ts`
 *      "36030.claustrophobia-constant" (blocks the change to hero form, not the change out of it, and lifts without it).
 *    - Erratum RRG 1.8 p. 68, Possessed (#38), "Attached ally engages its controller. If you cannot, this card gains
 *      surge": `shadow-king/index.test.ts` "Possessed (36038)" (lowest THW, engaged with its controller, a second copy
 *      skips a possessed ally, no ally means surge).
 *    - Ruling Dec 17, 2025 (3), the positive half (Flash Freeze is offered when the villain attacks Storm): `storm/
 *      events.test.ts` "is offered when the villain attacks Storm and takes 3 off". The negative halves are below.
 *    - Ruling Mar 19, 2026 (2) (a target that cannot take damage cannot be chosen for a basic attack), on The Shadow
 *      King: `shadow-king/index.test.ts` "36036.the-shadow-king-constant". Events and abilities are below.
 *    No other erratum or FAQ entry names a Storm card except the Magik FAQ on Pixie (p. 64), which needs a Magik hero:
 *    none is scripted yet, so it is not testable here (the report lists it).
 *    New below: Flash Freeze's two negative halves, RRG "Permanent" (p. 32) against Caught Off Guard for a Weather
 *    support, RRG "'Swap'" (p. 42) when nothing is in play, RRG "Target" (p. 43) for Lightning Bolt and Blast of Wind
 *    against The Shadow King, and ruling Aug 3, 2026 (4) #1 for Possessed.
 * 2. Whole games with Storm's precon, 2 players standard (with Cyclops, another wave 6 hero) and 1 hero expert,
 *    played by the greedy driver and replayed deep-equal: one asserting a Weather support put into play and a Weather
 *    swap, one with The Shadow King modular set. No game is staged: the driver reaches Weather Control.
 */

const DEPS = WAVE6_DEPS;
const ADVANCE = "01186";
const WEATHER_CODES = ["36002", "36003", "36004", "36005"];
const me = (state: GameState): InstanceId => identityOf(state, P1);
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const heroStorm = (options: Parameters<typeof stormGame>[1] = {}): GameState =>
  withForm(stormGame("rhino", { seed: 1, ...options }), { heroForm: 0 });
const weatherInPlay = (state: GameState): readonly string[] =>
  playerOf(state, P1)
    .playArea.map((id) => state.instances[id]!.cardId as string)
    .filter((code) => WEATHER_CODES.includes(code));
const offeredHas = (state: GameState, text: string): boolean =>
  state.pendingChoice?.options.some((o) => `${o.optionId} ${o.label}`.includes(text)) ?? false;
const resolvedIds = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));

/** `code` moved from the deck or hand straight into P1's play area (surgery: no play, no cost), ready. */
function inPlayBySurgery(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  return {
    id,
    state: {
      ...patchInstance(given.state, id, { faceup: true, exhausted: false, controllerId: P1 }),
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}

/** The villain stunned and confused (no attack, no scheme boost), so the stacked cards are what the villain phase deals. */
const reveal = (state: GameState, ...top: string[]) => {
  const villain = villainOf(state);
  const stalled = patchInstance(state, villain, {
    statuses: { ...inst(state, villain).statuses, confused: 1, stunned: 1 },
  });
  return driveEventsPicking(DEPS, stackEncounterDeck(stalled, ...top), firstLegal, endTurn(P1));
};

describe("rulings", () => {
  describe("Ruling Dec 17, 2025 (3): Flash Freeze triggers 'when' the villain attacks, so it is playable only when Storm is attacked", () => {
    // "Nick Fury's Stealth Suit triggers 'when' an enemy would attack, and Storm's Flash Freeze triggers 'when' the
    // villain attacks, neither of which fall into the 'you' exception ... Flash Freeze is only playable when Storm is
    // attacked." Two negatives: another player's attack (the villain attacks the second hero too), and a minion's.
    const offers = (start: GameState, ...ends: ReturnType<typeof endTurn>[]) => {
      const given = moveToHand(start, P1, "36012");
      let count = 0;
      const pick: Picker = (s) => {
        // Counted over the enemy activations step only: a card dealt afterwards can make the villain attack again.
        if (s.step.kind === "enemyActivations" && offeredHas(s, "36012.flash-freeze-interrupt")) {
          count++;
          return [];
        }
        return firstLegal(s);
      };
      driveEventsPicking(DEPS, given.state, pick, ...ends);
      return count;
    };

    it("alone, the villain's attack on Storm offers it once (control)", () => {
      expect(offers(heroStorm(), endTurn(P1))).toBe(1);
    });

    it("with a second hero the villain also attacks, Storm's Flash Freeze is offered only for the attack on Storm", () => {
      const two = heroStorm({ extraPlayers: [{ starterDeckId: "core-spider-man-justice" }] });
      expect(offers(two, endTurn(P1), endTurn(P2))).toBe(1);
    });

    it("an engaged minion's attack on Storm does not offer it (the villain attack alone does)", () => {
      const { state } = engageMinion(heroStorm(), "01101", P1);
      expect(offers(state, endTurn(P1))).toBe(1);
    });
  });

  describe("RRG 1.8 'Permanent' (p. 32): a Weather support is not discarded by a card of another set", () => {
    // Caught Off Guard (01188, Core): "When Revealed: Discard an upgrade or support you control. If no cards were
    // discarded this way, this card gains surge." A permanent card "is not a valid target for card effects that would
    // cause the permanent card to leave play ... that effect instead targets the non-permanent card that fits".
    it("with the Weather support the only support, nothing is discarded and Caught Off Guard gains surge", () => {
      const base = heroStorm();
      const [support] = weatherInPlay(base);
      expect(support).toBeDefined();
      const { state, events } = reveal(base, "01188", ADVANCE);
      expect(weatherInPlay(state)).toEqual([support]);
      expect(playerOf(state, P1).playArea).toContain(instancesOf(state, support!)[0]);
      expect(events.some((e) => e.type === "leavePlayBlocked")).toBe(false);
      expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
    });

    it("with Ororo's Garden also in play, that one is discarded instead and there is no surge", () => {
      const base = heroStorm();
      const { state: armed, id: garden } = inPlayBySurgery(base, "36008");
      const { state, events } = reveal(armed, "01188", ADVANCE);
      expect(weatherInPlay(state)).toEqual(weatherInPlay(base));
      expect(cardsInPlay(state)).not.toContain(garden);
      expect(playerOf(state, P1).discard).toContain(garden);
      expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
    });
  });

  describe("RRG 1.8 'Swap' (p. 42): a swap cannot be completed if there is not a component in both locations", () => {
    // Weather Control (36001a): "Swap your WEATHER support in play with a support of your choice from the WEATHER deck".
    // With no Weather support in play there is nothing to swap with.
    const noneInPlay = (): GameState => {
      const base = heroStorm();
      const id = playerOf(base, P1).playArea.find((i) => WEATHER_CODES.includes(base.instances[i]!.cardId as string))!;
      const deck = separateDeckOf(base, P1, WEATHER_DECK);
      return {
        ...patchInstance(base, id, { faceup: false, home: { kind: "separateDeck", name: WEATHER_DECK } } as never),
        players: base.players.map((p) =>
          p.playerId === P1
            ? {
                ...p,
                playArea: p.playArea.filter((i) => i !== id),
                separateDecks: { ...p.separateDecks, [WEATHER_DECK]: { ...deck, deck: [...deck.deck, id] } },
              }
            : p,
        ),
      };
    };

    it("Weather Control with none in play puts nothing into play and moves no card", () => {
      const start = noneInPlay();
      expect(weatherInPlay(start)).toEqual([]);
      expect(separateDeckOf(start, P1, WEATHER_DECK).deck).toHaveLength(4);
      const { state, events } = driveEventsPicking(
        DEPS,
        start,
        firstLegal,
        use(P1, me(start), "36001a.weather-control"),
      );
      expect(weatherInPlay(state)).toEqual([]);
      expect(separateDeckOf(state, P1, WEATHER_DECK).deck).toHaveLength(4);
      expect(events.some((e) => e.type === "cardsSwapped")).toBe(false);
    });
  });

  describe("RRG 1.8 'Target' (p. 43): a target that cannot take damage is not valid for an effect that only deals it damage", () => {
    // The Shadow King (36036) cannot take damage while a CONTROLLED minion is in play. Lightning Bolt (36011) deals 8
    // damage to the chosen enemy, which is its only effect on that target; Blast of Wind (36013) deals 3 to each minion.
    const withKing = () => {
      const fill = (s: GameState): GameState => ({
        ...s,
        players: s.players.map((p) => {
          if (p.playerId !== P1) return p;
          const take = p.deck.slice(0, 12 - p.hand.length);
          return { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(take.length) };
        }),
      });
      const filled = fill(stormGame("rhino", { seed: 1, modularSetIds: ["shadow_king"] }));
      const havok = playFromHand(DEPS, filled, "36014", 4);
      const { state } = reveal(havok.state, "36036");
      const king = instancesOf(state, "36036").find((id) => cardsInPlay(state).includes(id))!;
      const hero = patchInstance(withForm(state, { heroForm: 0 }), me(state), { exhausted: false });
      return { state: hero, king, havok: havok.id };
    };

    it("Lightning Bolt does not offer him as the enemy to hit, and does offer the villain and the possessed minion", () => {
      const { state, king, havok } = withKing();
      expect(inst(state, havok).attachments.length).toBeGreaterThan(0);
      const given = moveToHand(state, P1, "36011");
      const bolt = given.ids[0]!;
      let seen: readonly string[] = [];
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseTarget" || choice?.options.some((o) => o.optionId === villainOf(s))) {
          seen = choice!.options.map((o) => o.optionId);
          return [villainOf(s)];
        }
        return firstLegal(s);
      };
      const after = settle(
        runWith(DEPS, given.state, play(P1, bolt, payWith(given.state, P1, 3, [bolt]))),
        pick,
        undefined,
        DEPS,
      );
      expect(seen).toContain(villainOf(state));
      expect(seen).toContain(havok);
      expect(seen).not.toContain(king);
      expect(inst(after, king).damage).toBe(0);
    });

    it("Blast of Wind deals him nothing while the villain and a minion engaged with the player still take 3", () => {
      const { state, king } = withKing();
      const { state: foe, id: minion } = engageMinion(state, "01101", P1);
      const whiplash = patchInstance(foe, minion, { cardId: cardId("01172") });
      const given = moveToHand(whiplash, P1, "36013");
      const blast = given.ids[0]!;
      const after = settle(
        runWith(DEPS, given.state, play(P1, blast, payWith(given.state, P1, 3, [blast]))),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(inst(after, king).damage).toBe(0);
      expect(inst(after, minion).damage).toBe(3);
      expect(inst(after, villainOf(state)).damage).toBe(3);
    });
  });

  describe("Ruling Aug 3, 2026 (4) #1: Odin attached to the main scheme is not a valid target for Possessed", () => {
    // "Odin attached to main scheme + Possessed revealed: Is Odin a valid target? No. Odin cannot have attachments while
    // attached to the main scheme." Odin (21139a, Hela, THW 2) seated by surgery as Hela's setup leaves him, beside
    // Mirage (THW 2, a tie for lowest): Possessed (erratum p. 68, "the ally with the lowest THW") must go to Mirage,
    // and Odin is never offered as a choice.
    it("Possessed attaches to Mirage, Odin keeps no attachment and is never offered", () => {
      const filled = stormGame("rhino", { seed: 1, modularSetIds: ["shadow_king"] });
      const mirage = playFromHand(DEPS, withForm(filled, { heroForm: 0 }), "36015", 3);
      const base = mirage.state;
      const scheme = base.mainScheme.instanceId;
      const odin = playerOf(base, P1).deck[0]!;
      const seated: GameState = {
        ...patchInstance(base, odin, { cardId: cardId("21139a"), faceup: true, attachedTo: scheme }),
        players: base.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== odin) } : p)),
      };
      const staged = patchInstance(seated, scheme, { attachments: [...inst(seated, scheme).attachments, odin] });
      let odinOffered = false;
      const pick: Picker = (s) => {
        if (s.pendingChoice?.options.some((o) => o.optionId === odin)) odinOffered = true;
        return firstLegal(s);
      };
      const villain = villainOf(staged);
      const stalled = patchInstance(staged, villain, {
        statuses: { ...inst(staged, villain).statuses, confused: 1, stunned: 1 },
      });
      const { state } = driveEventsPicking(DEPS, stackEncounterDeck(stalled, "36038"), pick, endTurn(P1));
      expect(inst(state, mirage.id).attachments.map((i) => state.instances[i]!.cardId)).toContain(cardId("36038"));
      expect(inst(state, odin).attachments).toEqual([]);
      expect(odinOffered).toBe(false);
    });
  });
});

// Whole games ---------------------------------------------------------------------------------------------------

const WITH_CYCLOPS = [{ starterDeckId: "storm-leadership" }, { starterDeckId: "cyclops-leadership" }] as const;
const SOLO = [{ starterDeckId: "storm-leadership" }] as const;
const VARIANTS: readonly { label: string; options: Omit<Wave6ScenarioOptions, "seed"> }[] = [
  { label: "2 players, standard (with Cyclops)", options: { players: WITH_CYCLOPS } },
  { label: "1 hero, expert", options: { players: SOLO, difficulty: "expert" } },
];

/** First seed of 1..60 whose game (played from setup, no surgery) reaches an outcome and whose events satisfy `wanted`. */
const findGame = (
  options: Omit<Wave6ScenarioOptions, "seed">,
  wanted: (events: readonly GameEvent[]) => boolean,
): { result: DriverResult; events: readonly GameEvent[] } => {
  for (let seed = 1; seed <= 60; seed++) {
    const created = createGame(wave6Scenario("rhino", { ...options, seed }), DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, DEPS);
    if (!result.outcome) continue;
    const played = replay(result.session.log, DEPS);
    if (!played.ok) throw new Error("replay failed");
    expect(played.state).toEqual(result.session.state);
    if (wanted(played.events)) return { result, events: played.events };
  }
  throw new Error("no seed of 1..60 ended as wanted");
};

describe.each(VARIANTS)("Storm vs Rhino ($label)", ({ options }) => {
  it("a Weather support is put into play by her Setup and swapped by Weather Control or Weather Goddess, no surgery", () => {
    const { result, events } = findGame(options, (evs) => {
      const ids = resolvedIds(evs);
      const swapped = evs.some((e) => e.type === "cardsSwapped" && e.how === "leftAndEntered");
      const control = ids.includes("36001a.weather-control") || ids.includes("36009.weather-goddess-action");
      return ids.includes("36001b.i-feel-a-storm-coming") && swapped && control;
    });
    expect(result.outcome).not.toBeNull();
    // A Special resolved after a swap: the Weather deck is working end to end.
    expect(resolvedIds(events).some((id) => /^3600[2-5]\..*-special$/.test(id))).toBe(true);
  }, 900_000);

  it("with The Shadow King modular set, a card of the set is dealt and the game replays deep-equal", () => {
    const { result } = findGame({ ...options, modularSetIds: ["shadow_king"] }, (evs) =>
      resolvedIds(evs).some((id) => /^3603[6-9]\./.test(id)),
    );
    expect(result.outcome).not.toBeNull();
  }, 900_000);
});
