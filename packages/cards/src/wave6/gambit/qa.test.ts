import { cardId } from "@mc/content";
import {
  activeVillain,
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
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
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, stackSetAside, withForm } from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { SHIELD, exodusGame, inPlay, reveal as revealExodus } from "./exodus/testing.js";
import { gambitGame } from "./gambit/support.js";

/**
 * Wave 6 rules QA, Gambit pack (`docs/phase7-wave6-qa-gambit-rogue.md`). Two parts.
 *
 * 1. Errata, FAQ entries and rulings that touch a card of the pack (Gambit, his nemesis set, the Exodus modular set).
 *    Already pinned exactly by a module test, so not copied here:
 *    - Erratum RRG 1.8 p. 68, Psionic Shield (#34): "When attached minion would leave play, instead heal all damage from
 *      that minion. Then, discard this attachment.": `exodus/index.test.ts` "37034.psionic-shield-forced-interrupt" (two
 *      tests: the defeat heals him and discards the Shield, the next defeat removes him). New below: the "put it back
 *      into play" half of the erratum (nothing re-enters, so no second When Revealed, no second engagement, statuses stay).
 *    - Ruling Dec 17, 2025 (3), "after [enemy] attacks you" is the player (Bishop 37011): `gambit/support-upgrades-
 *      allies.test.ts` "Bishop: an attack on your ally still counts (the player is attacked)".
 *    - Ruling Dec 17, 2025 (3) on "when ... attacks" cards (Flash Freeze) names Storm's card; Gambit's Staff is the same
 *      "when an enemy attacks" shape with no "you": `support-upgrades-allies.test.ts` "Gambit's Staff: also answers a
 *      minion's attack".
 *    - Charged Card's thresholds (RRG-less, card text only) and Q27 (Throw de Card adds to each Royal Flush instance):
 *      `gambit/events.test.ts` "Charged Card (37006)" and "Royal Flush (37007)".
 *    No other erratum, FAQ entry or post-1.7 ruling names a card of this pack (the p. 69 "Exodus (#28)" erratum is the
 *    Magneto Hero Pack's own Exodus, not 37032).
 *    New below: the single-turn Throw de Card / Royal Flush / Charged Card chain (nothing leaks between plays), Natural
 *    Agility's +DEF against a tough status card (FAQ p. 56, RRG p. 44), Toughness against Charged Card's overkill (RRG
 *    pp. 31, 44), Team-Up (RRG p. 43) satisfied by the other hero, and Assassination Attempt's attacks one at a time
 *    (ruling Feb 28, 2026 (1) #2).
 * 2. Whole games with Gambit's precon: 2 players standard (with Cyclops) and 1 hero expert, played by the greedy driver
 *    and replayed deep-equal, asserting Charge de Card and Throw de Card resolved; one more game with the Exodus
 *    modular set.
 */

const DEPS = WAVE6_DEPS;
const CHARGED_CARD = "37006";
const ROYAL_FLUSH = "37007";
const NATURAL_AGILITY = "37008";
const BEAUTY = "37019";
const ROGUE_ALLY = "37002";
const THROW = "37001a.throw-de-card";
const NA_ABILITY = "37008.natural-agility-interrupt";
const MODOK = "01184"; // 8 HP, retaliate 2, a minion.
const MERCENARY = "01101"; // Hydra Mercenary: 3 HP, guard.
const ADVANCE = "01186";
const DAZZLER = "37012";

const hero = (seed = 1): GameState => withForm(gambitGame("rhino", { seed }), { heroForm: 0 });
const villainOf = (state: GameState): InstanceId => activeVillain(state)!.instanceId;
const me = (state: GameState): InstanceId => identityOf(state, P1);
const charges = (state: GameState): number => inst(state, me(state)).counters.charge ?? 0;
const withCharges = (state: GameState, count: number): GameState =>
  patchInstance(state, me(state), { counters: { charge: count } });
const withTough = (state: GameState, id: InstanceId, count = 1): GameState =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: count } });
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Applies `command`, answering each choice with `pick`; the log replays to the same state. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const rejected = (state: GameState, command: Command): boolean => !sessionApply(startSession(state), command, DEPS).ok;

/**
 * A picker: uses Throw de Card whenever offered with `throwCount` counters (none: declines it), takes each of
 * `targets` in order when a choice offers it, and answers anything else as `firstLegal`.
 */
const picks = (opts: { throwCount?: number | undefined; targets?: readonly InstanceId[] } = {}): Picker => {
  const targets = [...(opts.targets ?? [])];
  return (state) => {
    const choice = state.pendingChoice;
    if (opts.throwCount !== undefined && choice?.prompt.kind === "chooseTriggers") {
      const offered = choice.options.filter((o) => o.optionId.includes(THROW));
      if (offered.length > 0) return offered.map((o) => o.optionId);
    }
    if (opts.throwCount !== undefined && choice?.prompt.kind === "chooseCostCounters") return [String(opts.throwCount)];
    if (choice?.prompt.kind === "payForAbility") return choice.options.slice(0, 1).map((o) => o.optionId);
    const hit =
      choice && choice.prompt.kind !== "chooseTriggers"
        ? choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === targets[0])
        : undefined;
    if (hit) {
      targets.shift();
      return [hit.optionId];
    }
    return firstLegal(state);
  };
};
/** True when Throw de Card is among the options of a trigger prompt the pick sees. */
const offersThrow = (seen: { value: boolean }, inner: Picker): Picker => {
  return (state) => {
    if (state.pendingChoice?.options.some((o) => o.optionId.includes(THROW))) seen.value = true;
    return inner(state);
  };
};

/** `code` in P1's hand and the command that plays it, paying `cost` with other hand cards that are not in `keep`. */
function staged(state: GameState, code: string, cost: number, keep: readonly InstanceId[] = []) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  return { state: given.state, id, command: play(P1, id, payWith(given.state, P1, cost, [id, ...keep])) };
}
/** Moves `n` more deck cards into P1's hand to pay with (surgery: the draw is not under test). */
function padHand(state: GameState, n: number): GameState {
  const owner = playerOf(state, P1);
  const moving = owner.deck.slice(0, n);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => !moving.includes(i)), hand: [...p.hand, ...moving] } : p,
    ),
  };
}
/** An encounter card turned into `code` and put into play engaged with P1 (surgery). */
function engaged(state: GameState, code: string, player = P1): { state: GameState; id: InstanceId } {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const donor = state.encounterDecks[deckId]!.deck.find((i) => state.instances[i]!.cardId !== cardId(code))!;
  return engageMinion(patchInstance(state, donor, { cardId: cardId(code) }), code, player);
}

describe("errata and rulings", () => {
  describe("Erratum RRG 1.8 p. 68, Psionic Shield (#34): the printed 'and put it back into play' is gone", () => {
    // "Forced Interrupt: When attached minion would leave play, instead heal all damage from that minion. Then, discard
    // this attachment." The defeat and discard are pinned in exodus/index.test.ts; what the erratum removed is the
    // re-entry, so Exodus must never be a new copy: nothing resolves as if he entered play, his statuses stay (RRG
    // "Leaves Play", p. 27: tokens and status cards return to the supply only when a card leaves play).
    const heroAt = (state: GameState) =>
      patchInstance(withForm(state, { heroForm: 0 }), me(state), { exhausted: false });

    it("Exodus is not engaged or revealed a second time, and a status card on him is still there", () => {
      const { state: revealed } = revealExodus(exodusGame({ players: [{ starterDeckId: "gambit-justice" }] }), "37032");
      const [exodus] = inPlay(revealed, "37032");
      const confusedExodus = patchInstance(revealed, exodus!, {
        statuses: { ...inst(revealed, exodus!).statuses, confused: 1 },
      });
      const engagedWith = inst(confusedExodus, exodus!).engagedWith;
      const near = patchInstance(heroAt(confusedExodus), exodus!, { damage: 999 });
      const after = settle(
        runWith(DEPS, near, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: me(near),
          targetInstanceId: exodus!,
        }),
        firstLegal,
        undefined,
        DEPS,
      );
      expect(inPlay(after, "37032")).toEqual([exodus]);
      expect(inst(after, exodus!).damage).toBe(0);
      expect(inst(after, exodus!).engagedWith).toBe(engagedWith);
      expect(inst(after, exodus!).statuses.confused ?? 0).toBe(1);
      expect(inst(after, exodus!).attachments.filter((a) => after.instances[a]!.cardId === cardId(SHIELD))).toEqual([]);
    });

    it("no When Revealed and no engagement event follows the save", () => {
      const { state: revealed } = revealExodus(exodusGame({ players: [{ starterDeckId: "gambit-justice" }] }), "37032");
      const [exodus] = inPlay(revealed, "37032");
      const near = patchInstance(heroAt(revealed), exodus!, { damage: 999 });
      const { events } = driveEventsPicking(DEPS, near, firstLegal, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: me(near),
        targetInstanceId: exodus!,
      });
      expect(
        events.filter((e) => e.type === "abilityResolved" && e.abilityId === ("37032.when-revealed" as never)),
      ).toEqual([]);
      expect(events.filter((e) => e.type === "encounterCardRevealed" && e.instanceId === exodus)).toEqual([]);
    });
  });

  describe("FAQ p. 56 (General) and RRG 'Tough' (p. 44): a basic defense's DEF is applied before a tough status card", () => {
    // FAQ: a hero keeps a tough status card if "the hero makes a basic defense and their DEF reduces the damage dealt by
    // the attacking enemy's ATK to zero", but not when an interrupt reduces the damage after the card has priority.
    // Natural Agility (37008) is an interrupt to "when you defend", so its +DEF is part of the DEF applied by the defense
    // (RRG "Defend", p. 15: the defender's DEF reduces the damage dealt), not a damage-reducing interrupt: with enough DEF Gambit
    // keeps the card; with too little, the card absorbs the rest and is discarded. By analogy: no ruling names Natural
    // Agility.
    const boostCardIn = (state: GameState): GameState => {
      const deckId = Object.keys(state.encounterDecks)[0]!;
      return patchInstance(state, state.encounterDecks[deckId]!.deck[0]!, { cardId: cardId("01118") });
    };
    /** Rhino attacks Gambit (ATK 2 + 3 boost icons = 5 vs DEF 3); `held` counters on him; tough card on him. */
    function defending(held: number, accept: boolean) {
      const given = moveToHand(withTough(withCharges(hero(), held), me(hero())), P1, NATURAL_AGILITY);
      const reached = settle(
        runWith(DEPS, stackEncounterDeck(boostCardIn(given.state), "01118"), endTurn()),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        DEPS,
      );
      const choice = reached.pendingChoice!;
      const pick: Picker = (s) => {
        const open = s.pendingChoice;
        if (!open) return [];
        if (open.prompt.kind === "payForCard") return [open.options[0]!.optionId];
        const mine = open.options.filter((o) => o.optionId.includes(NA_ABILITY));
        return accept && mine.length > 0 ? [mine[0]!.optionId] : firstLegal(s);
      };
      const { state, events } = drive(
        reached,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: [me(reached)],
        },
        pick,
      );
      const resolvedAt = events.flatMap((e, index) => (e.type === "attackResolved" ? [index] : []));
      const dealt = events.findIndex((e) => e.type === "encounterCardRevealed");
      const own = events.slice(0, Math.min(resolvedAt[1] ?? events.length, dealt < 0 ? events.length : dealt));
      return {
        dealt: ofType(own, "damageDealt").filter((e) => e.targetInstanceId === me(state)),
        absorbed: ofType(own, "damagePrevented").filter(
          (e) => e.targetInstanceId === me(state) && e.reason === "tough",
        ),
        discarded: ofType(own, "statusRemoved").filter((e) => e.instanceId === me(state) && e.status === "tough"),
      };
    }

    it("declined: 5 - 3 DEF = 2 damage, the tough card absorbs it and is discarded", () => {
      const r = defending(0, false);
      expect(r.absorbed.map((e) => e.amount)).toEqual([2]);
      expect(r.discarded).toHaveLength(1);
    });

    it("with 1 counter held: Natural Agility makes DEF 3 + 2 = 5, no damage is dealt and the tough card stays", () => {
      const r = defending(1, true);
      expect(r.dealt).toEqual([]);
      expect(r.absorbed).toEqual([]);
      expect(r.discarded).toEqual([]);
    });
  });

  describe("RRG 'Overkill' (p. 31) and 'Tough' (p. 44): Charged Card's overkill against a minion with Toughness", () => {
    // 3 counters thrown: ranged, piercing and overkill. Piercing discards the tough status card first (p. 32), then the
    // damage lands and the excess is overkill; with 1 thrown (ranged only) the tough card absorbs the whole attack, so
    // nothing is taken and nothing is defeated (FAQ p. 56 for an ally; the same wording for a minion).
    const strike = (thrown: number) => {
      const base = engaged(withCharges(hero(), 3), MERCENARY);
      const tough = withTough(base.state, base.id);
      const { state, command } = staged(tough, CHARGED_CARD, 2);
      const run = drive(state, command, picks({ throwCount: thrown, targets: [base.id] }));
      return { ...run, minion: base.id };
    };

    it("3 thrown: the tough card is discarded, the 3 HP minion is defeated and 7 - 3 = 4 goes to the villain", () => {
      const { state, minion } = strike(3);
      expect(cardsInPlay(state)).not.toContain(minion);
      expect(inst(state, villainOf(state)).damage).toBe(4);
    });

    it("2 thrown: piercing but no overkill: the minion is defeated and the villain takes nothing", () => {
      const { state, minion } = strike(2);
      expect(cardsInPlay(state)).not.toContain(minion);
      expect(inst(state, villainOf(state)).damage).toBe(0);
    });

    it("1 thrown: the tough card absorbs the attack, the minion lives undamaged and the villain takes nothing", () => {
      const { state, minion } = strike(1);
      expect(cardsInPlay(state)).toContain(minion);
      expect(inst(state, minion).damage).toBe(0);
      expect(inst(state, minion).statuses.tough ?? 0).toBe(0);
      expect(inst(state, villainOf(state)).damage).toBe(0);
    });
  });

  describe("RRG 'Team-Up' (p. 43): both named friendly characters in play, identity or ally", () => {
    const duo = (secondForm: "hero" | "alterEgo") => {
      const base = gambitGame("rhino", { seed: 1, extraPlayers: [{ starterDeckId: "rogue-protection" }] });
      const heroForm = withForm(base, { heroForm: 0 });
      return secondForm === "hero" ? withForm(heroForm, { heroForm: 0 }, P2) : heroForm;
    };

    it("Rogue as the second player's hero satisfies 'Rogue': Beauty and the Thief (37019) is playable without the ally", () => {
      const { state, command } = staged(duo("hero"), BEAUTY, 2);
      expect(inst(state, identityOf(state, P2)).cardId).toBe(cardId("38001a"));
      const run = drive(state, command, picks({ targets: [villainOf(state)] }));
      expect(inst(run.state, villainOf(run.state)).damage).toBe(4);
    });

    it("control: with Rogue's player in alter-ego form (title Anna Marie) and no Rogue ally, it is refused", () => {
      const { state, command } = staged(duo("alterEgo"), BEAUTY, 2);
      expect(rejected(state, command)).toBe(true);
    });
  });

  describe("Ruling Feb 28, 2026 (1) #2: abilities triggered by an ongoing attack resolve before a new attack begins", () => {
    // "All abilities triggered by an ongoing attack (including Responses and Retaliate) resolve before a newly
    // initiated attack begins." Assassination Attempt (37029) makes two Guild Assassins attack in turn: the first one's
    // Forced Response (an ally it defeats, 1 threat on the main scheme) must come before the second attack resolves.
    it("the first Guild Assassin's threat is placed before the second Guild Assassin's attack resolves", () => {
      // Alter-ego form: the confused Assassins lose their ordinary scheme, so only the treachery's attacks are seen.
      const hero0 = gambitGame("rhino", { seed: 1 });
      const dazzlerId = playerOf(hero0, P1).deck.find((i) => hero0.instances[i]!.cardId === DAZZLER)!;
      const withAlly = patchInstance(
        {
          ...hero0,
          players: hero0.players.map((p) =>
            p.playerId === P1
              ? { ...p, deck: p.deck.filter((i) => i !== dazzlerId), playArea: [...p.playArea, dazzlerId] }
              : p,
          ),
        },
        dazzlerId,
        { faceup: true, controllerId: P1, damage: 2 },
      );
      const engageSetAside = (state: GameState, code: string) => {
        const id = playerOf(state, P1).setAside.find((i) => state.instances[i]!.cardId === cardId(code))!;
        return {
          id,
          state: {
            ...state,
            players: state.players.map((p) =>
              p.playerId === P1
                ? { ...p, setAside: p.setAside.filter((i) => i !== id), playArea: [...p.playArea, id] }
                : p,
            ),
            instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, engagedWith: P1 } },
          },
        };
      };
      const first = engageSetAside(withAlly, "37028");
      const second = engageSetAside(first.state, "37028");
      const stunned = patchInstance(second.state, villainOf(second.state), {
        statuses: { ...inst(second.state, villainOf(second.state)).statuses, stunned: 1 },
      });
      const confused = [first.id, second.id].reduce(
        (s, id) => patchInstance(s, id, { statuses: { ...inst(s, id).statuses, confused: 1 } }),
        stunned,
      );
      const staged0 = stackEncounterDeck(stackSetAside(confused, "37029"), ADVANCE, "37029");
      const defendWithAlly: Picker = (s) => {
        const hit = s.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === dazzlerId);
        return hit ? [hit.optionId] : firstLegal(s);
      };
      const { events } = drive(staged0, endTurn(P1), defendWithAlly);
      const attacks = events.flatMap((e, index) =>
        e.type === "attackResolved" ? [{ index, enemy: e.enemyInstanceId }] : [],
      );
      const assassinAttacks = attacks.filter((a) => a.enemy === first.id || a.enemy === second.id);
      expect(assassinAttacks).toHaveLength(2);
      const [one, two] = assassinAttacks as [(typeof attacks)[number], (typeof attacks)[number]];
      const placed = events.flatMap((e, index) =>
        e.type === "threatPlaced" && e.sourceInstanceId === one.enemy ? [index] : [],
      );
      expect(events.some((e) => e.type === "characterDefeated" && e.instanceId === dazzlerId)).toBe(true);
      expect(placed).toHaveLength(1);
      expect(placed[0]!).toBeLessThan(two.index);
    });
  });
});

describe("interactions between cards of the pack", () => {
  describe("one turn: Charged Card (3 thrown), Royal Flush, Charged Card (declined), Charged Card (1 thrown)", () => {
    // Each play's Throw de Card note dies with its frame (docs §3.52): nothing thrown in one play may leak into the next
    // Charged Card. Royal Flush places its counter after Throw de Card could pay (Q27), and that counter is there for the
    // next attack.
    const atModok = (state: GameState, modok: InstanceId): GameState =>
      withTough(patchInstance(state, modok, { damage: 0 }), modok);

    it("counters, keywords and damage follow each play's own count", () => {
      const base = engaged(withCharges(padHand(hero(), 8), 3), MODOK);
      const modok = base.id;
      const gambit = me(base.state);
      const damageToGambit = (s: GameState) => inst(s, gambit).damage;
      let state = withTough(base.state, modok);

      // A: 3 thrown. Ranged (no retaliate), piercing (the tough card goes first), 7 damage on MODOK's 8 HP.
      const a = staged(state, CHARGED_CARD, 2);
      const runA = drive(a.state, a.command, picks({ throwCount: 3, targets: [modok] }));
      expect(charges(runA.state)).toBe(0);
      expect(inst(runA.state, modok).damage).toBe(7);
      expect(inst(runA.state, modok).statuses.tough ?? 0).toBe(0);
      expect(damageToGambit(runA.state)).toBe(damageToGambit(state));
      state = runA.state;

      // B: Royal Flush with no counters: Throw de Card is not offered, 1 counter is placed, no damage.
      const seen = { value: false };
      const b = staged(state, ROYAL_FLUSH, 3);
      const runB = drive(b.state, b.command, offersThrow(seen, picks({ throwCount: 1 })));
      expect(seen.value).toBe(false);
      expect(charges(runB.state)).toBe(1);
      expect(ofType(runB.events, "damageDealt")).toEqual([]);
      state = atModok(runB.state, modok);

      // C: Charged Card, Throw de Card declined with 1 counter available: no ranged, no piercing, nothing from play A.
      const c = staged(state, CHARGED_CARD, 2);
      const runC = drive(c.state, c.command, picks({ targets: [modok] }));
      expect(charges(runC.state)).toBe(1);
      expect(inst(runC.state, modok).damage).toBe(0);
      expect(inst(runC.state, modok).statuses.tough ?? 0).toBe(0);
      expect(damageToGambit(runC.state)).toBe(damageToGambit(state) + 2);
      state = atModok(runC.state, modok);

      // D: Charged Card throwing Royal Flush's counter: ranged only, so the tough card absorbs and nothing retaliates.
      const d = staged(state, CHARGED_CARD, 2);
      const runD = drive(d.state, d.command, picks({ throwCount: 1, targets: [modok] }));
      expect(charges(runD.state)).toBe(0);
      expect(inst(runD.state, modok).damage).toBe(0);
      expect(inst(runD.state, modok).statuses.tough ?? 0).toBe(0);
      expect(damageToGambit(runD.state)).toBe(damageToGambit(state));
    });

    it("Rogue (37002) costs 1 less per counter, read after Throw de Card spent some and Royal Flush placed one", () => {
      const start = padHand(withCharges(hero(), 3), 6);
      const flush = staged(start, ROYAL_FLUSH, 3);
      const run = drive(flush.state, flush.command, picks({ throwCount: 2 }));
      expect(charges(run.state)).toBe(2);
      // 4 - 2 counters = 2 cards.
      const ally = moveToHand(run.state, P1, ROGUE_ALLY);
      const [allyId] = ally.ids as [InstanceId];
      expect(rejected(ally.state, play(P1, allyId, payWith(ally.state, P1, 1, [allyId])))).toBe(true);
      const played = drive(ally.state, play(P1, allyId, payWith(ally.state, P1, 2, [allyId])));
      expect(cardsInPlay(played.state)).toContain(allyId);
    });
  });
});

// Whole games ---------------------------------------------------------------------------------------------------

const WITH_CYCLOPS = [{ starterDeckId: "gambit-justice" }, { starterDeckId: "cyclops-leadership" }] as const;
const SOLO = [{ starterDeckId: "gambit-justice" }] as const;
const VARIANTS: readonly { label: string; options: Omit<Wave6ScenarioOptions, "seed"> }[] = [
  { label: "2 players, standard (with Cyclops)", options: { players: WITH_CYCLOPS } },
  { label: "1 hero, expert", options: { players: SOLO, difficulty: "expert" } },
];
const resolvedIds = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));

/** First seed of 1..60 whose game (played from setup, no surgery) reaches an outcome and whose events satisfy `wanted`. */
const findGame = (
  options: Omit<Wave6ScenarioOptions, "seed">,
  wanted: (events: readonly GameEvent[]) => boolean,
): { result: DriverResult; events: readonly GameEvent[]; seed: number } => {
  for (let seed = 1; seed <= 60; seed++) {
    const created = createGame(wave6Scenario("rhino", { ...options, seed }), DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, DEPS);
    if (!result.outcome) continue;
    const played = replay(result.session.log, DEPS);
    if (!played.ok) throw new Error("replay failed");
    expect(played.state).toEqual(result.session.state);
    if (wanted(played.events)) return { result, events: played.events, seed };
  }
  throw new Error("no seed of 1..60 ended as wanted");
};

describe.each(VARIANTS)("Gambit vs Rhino ($label)", ({ options }) => {
  it("Charge de Card places a counter and Throw de Card is used, no surgery", () => {
    const { result, events } = findGame(options, (evs) => {
      const ids = resolvedIds(evs);
      return ids.includes("37001a.charge-de-card") && ids.includes(THROW);
    });
    expect(result.outcome).not.toBeNull();
    expect(events.some((e) => e.type === "counterAdded" && e.counterType === "charge")).toBe(true);
  }, 900_000);
});

describe("Gambit vs Rhino with the Exodus modular set (2 players, with Cyclops)", () => {
  it("a card of the set is dealt and played, and the game replays deep-equal", () => {
    const { result } = findGame({ players: WITH_CYCLOPS, modularSetIds: ["exodus"] }, (evs) =>
      resolvedIds(evs).some((id) => /^3703[2-5]\./.test(id)),
    );
    expect(result.outcome).not.toBeNull();
  }, 900_000);
});
