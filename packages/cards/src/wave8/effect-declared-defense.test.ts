/**
 * docs/phase7-wave8.md §4.1 Q55 (owner ruling, B): a character made the defender by a card ability is making a basic
 * defense, so whatever answers a basic defense answers the defense Bamf! (48006) creates. RRG 1.8 "Defend, Defense"
 * (p. 15): "When a card ability says to 'declare [a hero] the defender' of an attack, that hero is considered to be
 * making a basic defense."
 *
 * Real cards, against Rhino (ATK 2; the stacked boost card has 2 icons, so his attack is 4), with the whole wave 8
 * registry. Iceman is seat 1 (hero DEF 2) and Nightcrawler seat 2 (hero DEF 3).
 *
 * What the cards allow: Bamf! prints "declare Nightcrawler as the defender", and "Freeze!" (46001a) is Iceman's own
 * "When Iceman makes a basic attack or defense". At a legal table the two never meet: Nightcrawler's Bamf! makes
 * Nightcrawler the defender, which is not Iceman's defense. The first two tests are that table. The last block puts a
 * copy of Bamf! under Iceman's control by seating it in his deck (no legal deck holds it), where the script's "the
 * Bamf! controller's hero" is Iceman: it is there to show "Freeze!" recognizing a defense that Bamf! declared, which
 * is what the ruling's wording names.
 */

import { WAVE8_CARDS, WAVE8_STARTER_DECKS, cardId, type AnyCard } from "@mc/content";
import { createGame, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../core/setup.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../testing/harness.js";
import { driveEvents, driveEventsPicking, withForm } from "../testing/staging.js";
import { WAVE8_DEPS } from "./index.js";

vi.setConfig({ testTimeout: 120_000 });

const DEPS = WAVE8_DEPS;
const POOL: readonly AnyCard[] = WAVE8_CARDS;
const BAMF = "48006";
const SYNCH = "47018";
const BAMF_REF = "48006.bamf-interrupt";
const FREEZE_REF = "46001a.freeze";
const SYNCH_REF = "47018.synch-interrupt";
const BREAKIN = "01107"; // Rhino: side scheme, 2 boost icons
const CROWD = "01108"; // Rhino: side scheme, 2 boost icons

const deckOf = (id: string) => {
  const precon = WAVE8_STARTER_DECKS.find((d) => d.id === id)!;
  return {
    identityCardId: precon.identityCardId,
    aspects: precon.aspects,
    deck: precon.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
  };
};
type Seat = { readonly precon: string; readonly extra?: readonly string[] };
const ICEMAN = "iceman-aggression";
const NIGHTCRAWLER = "nightcrawler-protection";

/** The seats against Rhino, through setup, every identity in hero form. Extra cards make a deck illegal on purpose. */
function heroGame(seats: readonly Seat[], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = seats.map((seat) => {
    const base = deckOf(seat.precon);
    return { ...base, deck: [...base.deck, ...(seat.extra ?? []).map((code) => cardId(code))] };
  });
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const setup = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return seats.reduce<GameState>((s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2), setup);
}
/** Plays the player's copy of Bamf! (cost 0) onto Rhino during their own turn. */
function bamfOnRhino(state: GameState, p: PlayerId): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, p, BAMF);
  const id = given.ids[0]!;
  const played = driveEvents(DEPS, given.state, play(p, id, [], { attachToInstanceId: state.activeVillainId! }));
  expect(inst(played.state, id).attachedTo).toBe(state.activeVillainId);
  return { state: played.state, id };
}
/** Surgery: the player's copy of an ally from the deck into their play area, ready. */
function allyInPlay(
  state: GameState,
  p: PlayerId,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, p, code);
  const id = given.ids[0]!;
  return {
    id,
    state: {
      ...given.state,
      players: given.state.players.map((pl) =>
        pl.playerId === p ? { ...pl, hand: pl.hand.filter((h) => h !== id), playArea: [...pl.playArea, id] } : pl,
      ),
    },
  };
}

interface Seen {
  readonly offered: Set<string>;
  readonly taken: string[];
  readonly askedToDefend: PlayerId[];
}
/** Accepts each of `refs` when it is offered, declines to defend at the Declare Defender step, else `firstLegal`. */
function accepting(...refs: readonly string[]): { readonly pick: Picker; readonly seen: Seen } {
  const seen: Seen = { offered: new Set(), taken: [], askedToDefend: [] };
  const pick: Picker = (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") {
      seen.askedToDefend.push(choice.playerId);
      return ["decline"];
    }
    if (choice.prompt.kind !== "chooseTriggers") return firstLegal(s);
    for (const option of choice.options) {
      for (const ref of [BAMF_REF, FREEZE_REF, SYNCH_REF]) if (option.optionId.includes(ref)) seen.offered.add(ref);
    }
    const hit = choice.options.find((o) => refs.some((ref) => o.optionId.includes(ref)));
    if (!hit) return firstLegal(s);
    seen.taken.push(refs.find((ref) => hit.optionId.includes(ref))!);
    return [hit.optionId];
  };
  return { pick, seen };
}
const moments = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => (e.type === "momentRaised" ? [e.name] : []));
/** The attacks Rhino resolved, as `[target, base ATK, DEF subtracted]`. */
const attacks = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "attackResolved" ? [[e.targetInstanceId, e.baseAtk, e.defenseReduction] as const] : [],
  );
/** The basic defenses the log announced, by defender. */
const basicDefenses = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" &&
    e.phase === "resolved" &&
    e.event.kind === "basicPowerUsing" &&
    e.event.power === "defense"
      ? [e.event.characterInstanceId]
      : [],
  );

describe("Bamf! (48006) at a legal table: Iceman and Nightcrawler", () => {
  /** Iceman's turn passes, Nightcrawler plays Bamf! on Rhino (and has Synch in play if asked), then the villain phase. */
  function villainPhase(refs: readonly string[], synch = false) {
    const base = heroGame([{ precon: ICEMAN }, { precon: NIGHTCRAWLER, extra: synch ? [SYNCH] : [] }]);
    const turn2 = driveEvents(DEPS, base, endTurn(P1)).state;
    const withSynch = synch ? allyInPlay(turn2, P2, SYNCH) : { state: turn2, id: null };
    const bamf = bamfOnRhino(withSynch.state, P2);
    const staged = stackEncounterDeck(bamf.state, BREAKIN, CROWD);
    const spied = accepting(...refs);
    const run = driveEventsPicking(DEPS, staged, spied.pick, endTurn(P2));
    return { ...run, seen: spied.seen, bamf: bamf.id, synch: withSynch.id, rhino: base.activeVillainId! };
  }

  it("Rhino attacks Iceman and Nightcrawler uses Bamf!: Nightcrawler makes the basic defense (DEF 3 off 4), unexhausted; it is not Iceman's, so 'Freeze!' is not offered", () => {
    const run = villainPhase([BAMF_REF, FREEZE_REF]);
    const kurt = identityOf(run.state, P2);
    expect(run.seen.taken).toEqual([BAMF_REF]);
    expect(playerOf(run.state, P2).discard).toContain(run.bamf);
    // The first attack was aimed at Iceman; Bamf! made Nightcrawler its defender and target.
    const firstAttack = run.events.find((e) => e.type === "triggerEvent" && e.event.kind === "enemyAttack");
    expect(firstAttack).toMatchObject({ phase: "initiated", event: { attackedPlayerId: P1 } });
    expect(attacks(run.events)[0]).toEqual([kurt, 2, 3]);
    const [firstDamage] = run.events.filter((e) => e.type === "damageDealt");
    expect(firstDamage).toMatchObject({ targetInstanceId: kurt, amount: 1 });
    expect(inst(run.state, kurt).exhausted).toBe(false);
    expect(run.seen.offered.has(FREEZE_REF)).toBe(false);
    expect(moments(run.events)).toEqual(["bamf"]);
    // Nobody was asked to defend the attack Bamf! answered: the first Declare Defender prompt is for Rhino's next
    // attack, on Nightcrawler.
    expect(run.seen.askedToDefend[0]).toBe(P2);
  });

  it("Synch (47018, 'When you use a basic power … +1 to that power') answers Nightcrawler's Bamf! defense: DEF 3 + 1 stops the 4", () => {
    const run = villainPhase([BAMF_REF, SYNCH_REF], true);
    const kurt = identityOf(run.state, P2);
    expect(run.seen.taken).toEqual([BAMF_REF, SYNCH_REF]);
    expect(basicDefenses(run.events)).toEqual([kurt]);
    expect(attacks(run.events)[0]).toEqual([kurt, 2, 4]);
    expect(inst(run.state, run.synch!).exhausted).toBe(true);
  });

  it("without Bamf! being used, Synch has no basic defense to answer", () => {
    const run = villainPhase([SYNCH_REF], true);
    expect(run.seen.taken).toEqual([]);
    expect(basicDefenses(run.events)).toEqual([]);
  });
});

describe("'Freeze!' (46001a) answers a defense Bamf! declared (a copy under Iceman's control, by test seating)", () => {
  /** Iceman plays the copy on Rhino on his turn, then the villain phase. */
  function villainPhase(refs: readonly string[]) {
    const base = heroGame([{ precon: ICEMAN, extra: [BAMF] }, { precon: NIGHTCRAWLER }]);
    const bamf = bamfOnRhino(base, P1);
    const turn2 = driveEvents(DEPS, bamf.state, endTurn(P1)).state;
    const staged = stackEncounterDeck(turn2, BREAKIN, CROWD);
    const spied = accepting(...refs);
    const run = driveEventsPicking(DEPS, staged, spied.pick, endTurn(P2));
    return { ...run, seen: spied.seen, bamf: bamf.id, rhino: base.activeVillainId! };
  }

  it("Bamf! declares its controller's hero the defender without exhausting him; 'Freeze!' is offered and attaches a Frostbite before the damage: ATK 2 - 1, DEF 2 off", () => {
    const run = villainPhase([BAMF_REF, FREEZE_REF]);
    const bobby = identityOf(run.state, P1);
    expect(run.seen.taken).toEqual([BAMF_REF, FREEZE_REF]);
    expect(basicDefenses(run.events)).toEqual([bobby]);
    expect(moments(run.events)).toEqual(["freeze", "bamf"]);
    expect(attacks(run.events)[0]).toEqual([bobby, 1, 2]);
    expect(inst(run.state, bobby).exhausted).toBe(false);
  });

  it("'Freeze!' declined: the same defense at Rhino's full ATK 2", () => {
    const run = villainPhase([BAMF_REF]);
    expect(run.seen.offered.has(FREEZE_REF)).toBe(true);
    expect(attacks(run.events)[0]).toEqual([identityOf(run.state, P1), 2, 2]);
    expect(moments(run.events)).toEqual(["bamf"]);
  });

  it("Bamf! not used: no defender, no basic defense, and 'Freeze!' is not offered", () => {
    const run = villainPhase([FREEZE_REF]);
    expect(run.seen.offered.has(FREEZE_REF)).toBe(false);
    expect(basicDefenses(run.events)).toEqual([]);
  });
});
