import {
  applyCommand,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { heroAction, reduceNextCardCost, query, you } from "../../dsl/index.js";
import { trait } from "@mc/content";
import { defineAbilities, validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { PSYLOCKE_EVENTS } from "../psylocke/events.js";
import { ANGEL_EVENTS } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Angel's events: Adaptive Plumage 42003, Aerial Agility 42004, Metamorphosis 42005, Natural Flight 42006, Razor Dive
 * 42007, Aerial Intervention 42014, Ever Vigilant 42015, Taunt 42016 and Soaring Hearts 42021
 * (docs/phase7-wave7.md §7.2, §3.62, §3.67; §4.2 Q37, Q41, Q42). His precon (`angel-protection`) against Stryfe through
 * `wave7Scenario` with the real registry. Faces: Warren (`alterEgo`), Angel (`heroForm: 0`: THW 2, ATK 1, DEF 2),
 * Archangel (`heroForm: 1`: THW 0, ATK 2, DEF 3). Stryfe's starting tough status card is removed (`game`) so an attack
 * is not absorbed. Angel of Life draws 1 and Angel of Death deals the AERIAL event's printed cost: both are exercised
 * here against each event.
 *
 * One fixture: Techno-Organic Wings' own ref is replaced by its Archangel reduction alone (no exhaust cost, no
 * form branch), so the printed-cost reading of Angel of Death has a reduced cost to be tested against.
 */
const LIFE = "42001a.angel-of-life";
const DEATH = "42001c.angel-of-death";
const PLUMAGE_THWART = "42003.adaptive-plumage-action";
const PLUMAGE_ATTACK = "42003.adaptive-plumage-hero-action";
const AGILITY = "42004.aerial-agility-interrupt";
const METAMORPHOSIS = "42005.metamorphosis-action";
const FLIGHT = "42006.natural-flight-action";
const DIVE = "42007.razor-dive-action";
const INTERVENTION = "42014.aerial-intervention-interrupt";
const VIGILANT = "42015.ever-vigilant-action";
const TAUNT = "42016.taunt-action";
const HEARTS = "42021.soaring-hearts-action";
const ALL = [
  PLUMAGE_THWART,
  PLUMAGE_ATTACK,
  AGILITY,
  METAMORPHOSIS,
  FLIGHT,
  DIVE,
  INTERVENTION,
  VIGILANT,
  TAUNT,
  HEARTS,
];

const ANGEL_SEAT = { starterDeckId: "angel-protection" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof ANGEL_SEAT | typeof SPIDER_MAN;

const WINGS = "42010";
const FIXTURES = defineAbilities({
  "42010.techno-organic-wings-action": heroAction(
    reduceNextCardCost(you, 2, "phase", query("event", { trait: trait("AERIAL") })),
  ),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

const WARREN = "alterEgo" as const;
const ANGEL = { heroForm: 0 } as const;
const ARCHANGEL = { heroForm: 1 } as const;
type Face = typeof WARREN | typeof ANGEL | typeof ARCHANGEL;

/** The player at `seat` in `face` (another seat in Angel's hero form, so Stryfe's alter-ego game over is not reached), Stryfe without a tough status card. */
function game(face: Face, players: readonly Seat[] = [ANGEL_SEAT], seed = 1, seat: PlayerId = P1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  state = face === WARREN ? state : withForm(state, face, seat);
  if (seat !== P1) state = withForm(state, ANGEL, P1);
  const villain = state.activeVillainId!;
  return patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, tough: 0 } });
}
/** No side scheme in play (Stryfe's crisis side scheme would forbid thwarting the main scheme), main scheme at `threat`. */
const withoutSideSchemes = (s: GameState, threat = 6): GameState =>
  patchInstance({ ...s, villainArea: [] }, s.mainScheme.instanceId, { threat });

const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const mainId = (s: GameState): InstanceId => s.mainScheme.instanceId;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const threatOn = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const status = (s: GameState, id: InstanceId, name: "confused" | "stunned" | "tough"): number =>
  inst(s, id).statuses[name] ?? 0;
const hand = (s: GameState, p: PlayerId = P1): number => playerOf(s, p).hand.length;
const deckSize = (s: GameState, p: PlayerId = P1): number => playerOf(s, p).deck.length;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((i) => codeOf(s, i));
const heroFace = (s: GameState, p: PlayerId = P1) => playerOf(s, p).identity;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Picks the queued ids in order, one per prompt that offers the next one; anything else as `firstLegal`. */
function queue(...ids: readonly InstanceId[]): Picker {
  const left = [...ids];
  return (s) => {
    const offered = s.pendingChoice?.options.map((o) => o.optionId) ?? [];
    if (left.length > 0 && offered.includes(left[0]!)) return [left.shift()!];
    return firstLegal(s);
  };
}
/** Accepts the response or interrupt of this ability when offered (any other trigger declined); other prompts as `inner`. */
const accepting =
  (ability: string | readonly string[], inner: Picker = firstLegal): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "payForCard")
      return choice.options
        .filter((o) => o.optionId.startsWith("hand:"))
        .slice(0, choice.prompt.cost)
        .map((o) => o.optionId);
    if (choice?.prompt.kind === "chooseTriggers") {
      const wanted = typeof ability === "string" ? [ability] : ability;
      const hit = choice.options.find((o) => wanted.some((w) => o.optionId.includes(w)));
      return hit ? [hit.optionId] : [];
    }
    return inner(s);
  };

/** End-of-turn discard down to hand size that never discards this card (by printed number). */
const keeping =
  (inner: Picker, code: string): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "discardDownToHandSize") return inner(s);
    return choice.options
      .filter((o) => codeOf(s, o.optionId as InstanceId) !== code)
      .slice(0, choice.minSelections)
      .map((o) => o.optionId);
  };
/** Picks the face of `to` ("0", "1" or "alterEgo") when Metamorphosis asks; other prompts as `inner`. */
const changingTo =
  (to: string, inner: Picker = firstLegal): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseOption" && choice.options.some((o) => o.optionId === to)) return [to];
    return inner(s);
  };

/** Plays `code` from hand (moved there if need be), paying `cost` with other hand cards or the given `pay` ids. */
function playEvent(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  player: PlayerId = P1,
  pay?: readonly InstanceId[],
) {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const payment = pay ?? payWith(given.state, player, cost, [id]);
  const offered: string[] = [];
  const logging: Picker = (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") for (const o of choice.options) offered.push(o.optionId);
    return pick(s);
  };
  const run = driveEventsPicking(DEPS, given.state, logging, play(player, id, payment));
  return { ...run, id, offered, before: given.state };
}
const refused = (state: GameState, code: string, cost: number, player: PlayerId = P1): boolean => {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  return !applyCommand(given.state, play(player, id, payWith(given.state, player, cost, [id])), DEPS).ok;
};
const offeredLife = (offered: readonly string[]) => offered.some((o) => o.includes(LIFE));
const offeredDeath = (offered: readonly string[]) => offered.some((o) => o.includes(DEATH));

describe("Angel events registry", () => {
  it.each(ALL)("%s validates", (id) => {
    expect(validateDefinition(ANGEL_EVENTS[id]!)).toEqual([]);
  });
  it("holds exactly the ten event refs", () => {
    expect(Object.keys(ANGEL_EVENTS).sort()).toEqual([...ALL].sort());
  });
  it("Soaring Hearts 42021 is the same definition object as its 41020 printing", () => {
    expect(ANGEL_EVENTS[HEARTS]).toBe(PSYLOCKE_EVENTS["41020.soaring-hearts-action"]);
  });
});

describe("Adaptive Plumage (42003)", () => {
  it("as Angel, thwart: removes 3 threat from the chosen scheme and confuses the chosen enemy", () => {
    const base = withoutSideSchemes(game(ANGEL));
    const run = playEvent(base, "42003", 3, queue(mainId(base), stryfe(base)));
    expect(threatOn(run.state, mainId(base))).toBe(3);
    expect(status(run.state, stryfe(base), "confused")).toBe(1);
    expect(damageOn(run.state, stryfe(base))).toBe(0);
    expect(discardCodes(run.state)).toContain("42003");
  });
  it("as Angel, the thwart is a thwart: the crisis icon of Stryfe's side scheme keeps the main scheme at 6", () => {
    const base = patchInstance(game(ANGEL), mainId(game(ANGEL)), { threat: 6 });
    const run = playEvent(base, "42003", 3, queue(mainId(base), stryfe(base)));
    expect(threatOn(run.state, mainId(base))).toBe(6);
  });
  it("as Archangel, attack: 4 damage to the chosen enemy and it is stunned; no threat is removed", () => {
    const base = withoutSideSchemes(game(ARCHANGEL));
    const run = playEvent(base, "42003", 3);
    expect(damageOn(run.state, stryfe(base))).toBe(4);
    expect(status(run.state, stryfe(base), "stunned")).toBe(1);
    expect(status(run.state, stryfe(base), "confused")).toBe(0);
    expect(threatOn(run.state, mainId(base))).toBe(6);
  });
  it("is a Hero Action: refused as Warren", () => {
    expect(refused(game(WARREN), "42003", 3)).toBe(true);
  });
  it("Angel of Life draws 1 after the thwart; Angel of Death deals 3 (the printed cost) after the attack", () => {
    const angel = withoutSideSchemes(game(ANGEL));
    const life = playEvent(angel, "42003", 3, accepting(LIFE, queue(mainId(angel), stryfe(angel))));
    expect(offeredLife(life.offered)).toBe(true);
    expect(hand(life.state)).toBe(hand(life.before) - 4 + 1);
    const archangel = withoutSideSchemes(game(ARCHANGEL));
    const death = playEvent(archangel, "42003", 3, accepting(DEATH));
    expect(offeredDeath(death.offered)).toBe(true);
    expect(damageOn(death.state, stryfe(archangel))).toBe(4 + 3);
  });
});

describe("Aerial Agility (42004)", () => {
  /** Ends the turn with the boost cards stacked (the villain's attack). `accept`: play the event from `seat`'s hand. */
  function defend(
    face: Face,
    accept: boolean,
    boost: string,
    players: readonly Seat[] = [ANGEL_SEAT],
    seat: PlayerId = P1,
  ) {
    const given = moveToHand(game(face, players, 1, seat), seat, "42004");
    const base = stackEncounterDeck(given.state, boost);
    const turns = players.length === 2 ? [endTurn(P1), endTurn(P2)] : [endTurn(P1)];
    const run = driveEventsPicking(
      DEPS,
      base,
      keeping(accept ? accepting(AGILITY) : accepting("none"), "42004"),
      ...turns,
    );
    return { ...run, base, id: given.ids[0]! };
  }
  const hurt = (r: { state: GameState }, p: PlayerId = P1) => damageOn(r.state, identityOf(r.state, p));

  it("baseline: Stryfe's attack deals 3 ATK + the 3 boost icons of Telepathic Camouflage = 6", () => {
    expect(hurt(defend(ANGEL, false, "40176"))).toBe(6);
  });
  it("as Angel: the 3 boost icons are ignored (the boost card is still turned up, and adds 0)", () => {
    // Stryfe's ATK follows the cards of the attacked player's hand, which the event leaves, so it is read off the event.
    const declined = events(defend(ANGEL, false, "40176").events, "attackResolved")[0]!;
    expect(declined.boostIcons).toBe(3);
    expect(declined.damageDealt).toBe(declined.baseAtk + 3);
    const run = defend(ANGEL, true, "40176");
    const attack = events(run.events, "attackResolved")[0]!;
    expect(events(run.events, "boostIgnored")).toHaveLength(1);
    expect(attack.boostIcons).toBe(0);
    expect(attack.damageDealt).toBe(attack.baseAtk);
    expect(hurt(run)).toBe(attack.baseAtk);
    expect(discardCodes(run.state)).toContain("42004");
    expect(heroFace(run.state).heroFormIndex).toBe(0);
  });
  it("as Angel: a Boost ability does not resolve either (Psychic Override's discard-and-draw)", () => {
    // 1 boost icon counts when the event is declined, and none when it is ignored.
    const declined = defend(ANGEL, false, "40178");
    const ignored = defend(ANGEL, true, "40178");
    expect(hurt(declined)).toBe(4);
    expect(events(ignored.events, "attackResolved")[0]!.boostIcons).toBe(0);
    // The Boost ability discarded one card and drew one; ignoring it leaves the deck one card deeper than declining.
    expect(deckSize(ignored.state)).toBeGreaterThan(deckSize(declined.state));
  });
  it("as Archangel: gives a tough status card and retaliate 1 for this attack; the boost still counts", () => {
    const run = defend(ARCHANGEL, true, "40176");
    // The tough status card is given in the interrupt, so it absorbs the attack's damage and is discarded.
    expect(hurt(run)).toBe(0);
    expect(status(run.state, identityOf(run.state), "tough")).toBe(0);
    // Retaliate 1 answered the attack: Stryfe took 1 damage.
    expect(damageOn(run.state, stryfe(run.base))).toBe(1);
  });
  it("retaliate 1 lasts only for that attack: a second attack's damage is not retaliated", () => {
    const run = defend(ARCHANGEL, true, "40176");
    const next = settle(run.state, firstLegal, (s) => s.step.phase === "player" && s.round > run.base.round, DEPS);
    const after = driveEventsPicking(DEPS, stackEncounterDeck(next, "40176"), firstLegal, endTurn(P1)).state;
    expect(damageOn(after, stryfe(after))).toBe(1);
  });
  it("is an AERIAL event: Angel of Life then draws 1; as Archangel Angel of Death deals its printed cost 1 on top of retaliate 1", () => {
    const given = (face: Face) => stackEncounterDeck(moveToHand(game(face), P1, "42004").state, "40176");
    const run = (face: Face, ability: string) =>
      driveEventsPicking(DEPS, given(face), keeping(accepting([AGILITY, ability]), "42004"), endTurn(P1));
    const angelPlain = defend(ANGEL, true, "40176");
    expect(deckSize(run(ANGEL, LIFE).state)).toBe(deckSize(angelPlain.state) - 1);
    const death = run(ARCHANGEL, DEATH);
    expect(damageOn(death.state, stryfe(death.state))).toBe(1 + 1);
  });
  it("answers any enemy attack (Q41): the attack on another player is answered, Angel becoming its defender", () => {
    // Stryfe attacks the first seat (Spider-Man); Angel (seat 2) plays the event: the 3 boost icons are ignored and, with
    // no defender yet, the "(defense)" label makes Angel the one the attack is against (RRG "Defense", p. 15).
    const run = defend(ANGEL, true, "40176", [SPIDER_MAN, ANGEL_SEAT], P2);
    expect(discardCodes(run.state, P2)).toContain("42004");
    const first = events(run.events, "attackResolved")[0]!;
    expect(first.targetInstanceId).toBe(identityOf(run.state, P2));
    expect(first.boostIcons).toBe(0);
  });
});

describe("Metamorphosis (42005)", () => {
  // "Change form. Then, if you are ..." reads the face reached: Warren draws, Angel thwarts 2, Archangel hits for 3.
  it("Warren to Angel (asked among the hero faces): removes 2 threat from a scheme", () => {
    const base = withoutSideSchemes(game(WARREN));
    const run = playEvent(base, "42005", 2, changingTo("0", queue(mainId(base))));
    expect(heroFace(run.state)).toMatchObject({ form: "hero", heroFormIndex: 0 });
    expect(threatOn(run.state, mainId(base))).toBe(4);
    expect(hand(run.state)).toBe(hand(run.before) - 3);
  });
  it("Warren to Archangel: deals 3 damage to an enemy", () => {
    const base = game(WARREN);
    const run = playEvent(base, "42005", 2, changingTo("1"));
    expect(heroFace(run.state)).toMatchObject({ form: "hero", heroFormIndex: 1 });
    expect(damageOn(run.state, stryfe(base))).toBe(3);
  });
  it("Angel to Warren (the alter-ego is one of the faces offered): draws 1 card", () => {
    const run = playEvent(game(ANGEL), "42005", 2, changingTo("alterEgo"));
    expect(heroFace(run.state).form).toBe("alterEgo");
    // The event and the 2 cards that paid for it leave the hand, the draw brings 1 back.
    expect(hand(run.state)).toBe(hand(run.before) - 3 + 1);
  });
  it("Archangel to Angel: removes 2 threat from a scheme", () => {
    const base = withoutSideSchemes(game(ARCHANGEL));
    const run = playEvent(base, "42005", 2, changingTo("0", queue(mainId(base))));
    expect(heroFace(run.state).heroFormIndex).toBe(0);
    expect(threatOn(run.state, mainId(base))).toBe(4);
  });
  it("the faces offered are every face but the one showing", () => {
    for (const [face, expected] of [
      [WARREN, ["0", "1"]],
      [ANGEL, ["alterEgo", "1"]],
      [ARCHANGEL, ["alterEgo", "0"]],
    ] as const) {
      const offered: string[][] = [];
      playEvent(withoutSideSchemes(game(face)), "42005", 2, (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseOption")
          offered.push(s.pendingChoice.options.map((o) => o.optionId));
        return firstLegal(s);
      });
      expect(offered[0]?.slice().sort()).toEqual([...expected].sort());
    }
  });
  it("Angel to Archangel: Angel of Death then answers for the printed cost 2, Angel of Life is not offered (Q42)", () => {
    const base = game(ANGEL);
    const run = playEvent(base, "42005", 2, accepting(DEATH, changingTo("1")));
    expect(heroFace(run.state).heroFormIndex).toBe(1);
    expect(offeredLife(run.offered)).toBe(false);
    expect(offeredDeath(run.offered)).toBe(true);
    // 3 from the event's own Archangel branch, plus 2 from Angel of Death.
    expect(damageOn(run.state, stryfe(base))).toBe(3 + 2);
    // The change was the event's, not the round's voluntary one.
    expect(heroFace(run.state).changedFormThisRound).toBe(false);
  });
  it("Archangel to Angel: Angel of Life draws 1", () => {
    const base = withoutSideSchemes(game(ARCHANGEL));
    const run = playEvent(base, "42005", 2, accepting(LIFE, changingTo("0", queue(mainId(base)))));
    expect(offeredLife(run.offered)).toBe(true);
    expect(hand(run.state)).toBe(hand(run.before) - 3 + 1);
  });
  it("is an Action, not a Hero Action: playable as Warren; a form-change effect is not the once-per-round change", () => {
    expect(refused(game(WARREN), "42005", 2)).toBe(false);
  });
});

describe("Natural Flight (42006)", () => {
  const sideScheme = (s: GameState): InstanceId => s.villainArea.find((i) => s.instances[i]!.threat > 0 || true)!;
  /** The schemes the thwart offers when it asks. */
  function offeredSchemes(state: GameState): InstanceId[] {
    const seen: InstanceId[] = [];
    playEvent(state, "42006", 2, (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseTarget" && seen.length === 0)
        seen.push(...(s.pendingChoice.options.map((o) => o.optionId) as InstanceId[]));
      return firstLegal(s);
    });
    return seen;
  }
  it("as Angel: ignores the crisis icon of Stryfe's side scheme, removing 4 of the main scheme's 6", () => {
    const base = patchInstance(game(ANGEL), mainId(game(ANGEL)), { threat: 6 });
    expect(offeredSchemes(base)).toContain(mainId(base));
    const run = playEvent(base, "42006", 2, queue(mainId(base)));
    expect(threatOn(run.state, mainId(base))).toBe(2);
  });
  it("as Archangel: the crisis icon holds: the main scheme is not offered, so the side scheme is thwarted instead", () => {
    const base = patchInstance(game(ARCHANGEL), mainId(game(ARCHANGEL)), { threat: 6 });
    const offered = offeredSchemes(base);
    expect(offered).not.toContain(mainId(base));
    expect(offered).toContain(sideScheme(base));
    const run = playEvent(base, "42006", 2);
    expect(threatOn(run.state, mainId(base))).toBe(6);
  });
  it("as Archangel with no crisis in play: removes 4 threat", () => {
    const base = withoutSideSchemes(game(ARCHANGEL));
    const run = playEvent(base, "42006", 2, queue(mainId(base)));
    expect(threatOn(run.state, mainId(base))).toBe(2);
  });
  it("as Angel: ignores the patrol keyword (Zero engaged); as Archangel the main scheme is not offered", () => {
    const angel = engageMinion(withoutSideSchemes(game(ANGEL)), "40174");
    expect(offeredSchemes(angel.state)).toContain(mainId(angel.state));
    const runA = playEvent(angel.state, "42006", 2, queue(mainId(angel.state)));
    expect(threatOn(runA.state, mainId(angel.state))).toBe(2);
    const arch = engageMinion(withoutSideSchemes(game(ARCHANGEL)), "40174");
    expect(offeredSchemes(arch.state)).not.toContain(mainId(arch.state));
  });
  it("is refused as Warren", () => {
    expect(refused(game(WARREN), "42006", 2)).toBe(true);
  });
  it("Angel of Life draws 1 after it; Angel of Death deals 2, its printed cost", () => {
    const a = withoutSideSchemes(game(ANGEL));
    const life = playEvent(a, "42006", 2, accepting(LIFE, queue(mainId(a))));
    expect(offeredLife(life.offered)).toBe(true);
    expect(hand(life.state)).toBe(hand(life.before) - 3 + 1);
    const b = withoutSideSchemes(game(ARCHANGEL));
    const death = playEvent(b, "42006", 2, accepting(DEATH, queue(mainId(b))));
    expect(damageOn(death.state, stryfe(b))).toBe(2);
  });
});

describe("Razor Dive (42007)", () => {
  it("as Angel: 6 damage to the enemy, no keywords", () => {
    const base = game(ANGEL);
    const run = playEvent(base, "42007", 3);
    expect(damageOn(run.state, stryfe(base))).toBe(6);
  });
  it("as Archangel: 6 damage and the attack gains overkill and piercing (a tough status card is bypassed)", () => {
    const toughed = (s: GameState) => patchInstance(s, stryfe(s), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const angel = toughed(game(ANGEL));
    const a = playEvent(angel, "42007", 3);
    // Tough absorbs the attack's damage for Angel's plain attack.
    expect(damageOn(a.state, stryfe(angel))).toBe(0);
    expect(status(a.state, stryfe(angel), "tough")).toBe(0);
    const archangel = toughed(game(ARCHANGEL));
    const b = playEvent(archangel, "42007", 3);
    expect(damageOn(b.state, stryfe(archangel))).toBe(6);
    // Piercing discards the tough status card before the damage (RRG "Piercing", p. 32).
    expect(status(b.state, stryfe(archangel), "tough")).toBe(0);
  });
  it("as Archangel: overkill puts the excess damage of a defeated minion onto the villain; as Angel it does not", () => {
    const stage = (face: Face) => {
      const zero = engageMinion(game(face), "40174");
      return {
        zero,
        state: patchInstance(zero.state, zero.id, { statuses: { stunned: 0, confused: 0, tough: 0 }, damage: 0 }),
      };
    };
    const angel = stage(ANGEL);
    const a = playEvent(angel.state, "42007", 3, queue(angel.zero.id));
    expect(damageOn(a.state, stryfe(angel.state))).toBe(0);
    const archangel = stage(ARCHANGEL);
    const b = playEvent(archangel.state, "42007", 3, queue(archangel.zero.id));
    expect(damageOn(b.state, stryfe(archangel.state))).toBeGreaterThan(0);
  });
  it("is refused as Warren (a Hero Action)", () => {
    expect(refused(game(WARREN), "42007", 3)).toBe(true);
  });
  it("Angel of Life draws 1; Angel of Death deals 3, and still 3 when Techno-Organic Wings reduced the cost to 1", () => {
    const a = playEvent(game(ANGEL), "42007", 3, accepting(LIFE));
    expect(hand(a.state)).toBe(hand(a.before) - 4 + 1);
    const base = game(ARCHANGEL);
    const full = playEvent(base, "42007", 3, accepting(DEATH));
    expect(damageOn(full.state, stryfe(base))).toBe(6 + 3);
    // Wings in play (staged by playing it), its reduction used, then the cheaper event.
    const wings = moveToHand(base, P1, WINGS);
    const played = driveEventsPicking(
      DEPS,
      wings.state,
      firstLegal,
      play(P1, wings.ids[0]!, payWith(wings.state, P1, 3, [wings.ids[0]!])),
    ).state;
    const wingsId = instancesOf(played, WINGS)[0]!;
    const reduced = driveEventsPicking(
      DEPS,
      played,
      firstLegal,
      use(P1, wingsId, "42010.techno-organic-wings-action"),
    ).state;
    const cheap = playEvent(reduced, "42007", 1, accepting(DEATH));
    expect(damageOn(cheap.state, stryfe(base))).toBe(6 + 3);
    expect(hand(cheap.state)).toBe(hand(cheap.before) - 2);
  });
});

describe("Aerial Intervention (42014)", () => {
  /** Ends every turn with the event in `holder`'s hand and Telepathic Camouflage as the boost: Stryfe's attack is 3 + 3 = 6. */
  function intercept(face: Face, players: readonly Seat[] = [ANGEL_SEAT], holder: PlayerId = P1) {
    const given = moveToHand(game(face, players, 1, holder), holder, "42014");
    const base = stackEncounterDeck(given.state, "40176");
    const turns = players.length === 2 ? [endTurn(P1), endTurn(P2)] : [endTurn(P1)];
    const run = driveEventsPicking(DEPS, base, keeping(accepting(INTERVENTION), "42014"), ...turns);
    return { ...run, base };
  }
  it("Angel exhausts to prevent up to 3 of Stryfe's 6 damage: Angel takes 3", () => {
    const run = intercept(ANGEL);
    expect(events(run.events, "damagePrevented").map((e) => e.amount)).toEqual([3]);
    expect(damageOn(run.state, identityOf(run.state))).toBe(3);
    expect(discardCodes(run.state)).toContain("42014");
  });
  it("Archangel pays the same cost the same way (his own exhaust)", () => {
    const run = intercept(ARCHANGEL);
    expect(damageOn(run.state, identityOf(run.state))).toBe(3);
  });
  it("is optional: declined, the whole 6 damage lands and the event stays in hand", () => {
    const given = moveToHand(game(ANGEL), P1, "42014");
    const base = stackEncounterDeck(given.state, "40176");
    const run = driveEventsPicking(DEPS, base, keeping(accepting("none"), "42014"), endTurn(P1));
    expect(events(run.events, "damagePrevented")).toEqual([]);
    expect(playerOf(run.state, P1).hand.map((i) => codeOf(run.state, i))).toContain("42014");
  });
  it("Angel of Life draws 1 after it (an AERIAL event), and as Archangel Angel of Death deals its printed cost, 0", () => {
    const answered = (face: Face, ability: string) => {
      const given = moveToHand(game(face), P1, "42014");
      const base = stackEncounterDeck(given.state, "40176");
      return driveEventsPicking(DEPS, base, keeping(accepting([INTERVENTION, ability]), "42014"), endTurn(P1));
    };
    const plain = intercept(ANGEL);
    const life = answered(ANGEL, LIFE);
    expect(deckSize(life.state)).toBe(deckSize(plain.state) - 1);
    const death = answered(ARCHANGEL, DEATH);
    expect(damageOn(death.state, stryfe(death.state))).toBe(0);
    expect(events(death.events, "damagePrevented").map((e) => e.amount)).toEqual([3]);
  });
  it("cannot be played as Warren (not AERIAL: nothing to exhaust)", () => {
    const given = moveToHand(game(WARREN), P1, "42014");
    const legal = applyCommand(given.state, play(P1, given.ids[0]!, []), DEPS);
    expect(legal.ok).toBe(false);
  });
  it("Warren is not AERIAL, so his player cannot pay for it: not offered, the damage to Spider-Man is not prevented", () => {
    const given = moveToHand(game(WARREN, [SPIDER_MAN, ANGEL_SEAT], 1, P2), P2, "42014");
    const base = stackEncounterDeck(given.state, "40176");
    const run = driveEventsPicking(DEPS, base, keeping(accepting(INTERVENTION), "42014"), endTurn(P1), endTurn(P2));
    expect(events(run.events, "damagePrevented")).toEqual([]);
    expect(discardCodes(run.state, P2)).not.toContain("42014");
  });
  it("two players: Angel's player exhausts Angel to prevent up to 3 of the damage to the other player's hero", () => {
    const run = intercept(ANGEL, [SPIDER_MAN, ANGEL_SEAT], P2);
    const prevented = events(run.events, "damagePrevented");
    expect(prevented.map((e) => e.amount)).toEqual([3]);
    expect(prevented[0]!.targetInstanceId).toBe(identityOf(run.state, P1));
    expect(discardCodes(run.state, P2)).toContain("42014");
  });
});

describe("Ever Vigilant (42015)", () => {
  it("as Angel: readies the exhausted hero and removes 2 threat from the main scheme", () => {
    const base = patchInstance(withoutSideSchemes(game(ANGEL)), identityOf(game(ANGEL)), { exhausted: true });
    const run = playEvent(base, "42015", 2);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(threatOn(run.state, mainId(base))).toBe(4);
  });
  it("as Archangel it does the same (the AERIAL identity is the requirement, not the face)", () => {
    const base = patchInstance(withoutSideSchemes(game(ARCHANGEL)), identityOf(game(ARCHANGEL)), { exhausted: true });
    const run = playEvent(base, "42015", 2);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(threatOn(run.state, mainId(base))).toBe(4);
  });
  it("is refused as Warren, whose identity does not have the AERIAL trait", () => {
    expect(refused(game(WARREN), "42015", 2)).toBe(true);
  });
  it("it is player-card threat removal, so the crisis icon still stops it: the hero is readied, the main scheme stays at 6", () => {
    // RRG "Crisis Icon" (p. 14): threat cannot be removed from the main scheme by player cards, a thwart or not.
    const base = patchInstance(game(ANGEL), mainId(game(ANGEL)), { threat: 6 });
    const run = playEvent(base, "42015", 2);
    expect(threatOn(run.state, mainId(base))).toBe(6);
    expect(discardCodes(run.state)).toContain("42015");
  });
  it("Angel of Life draws 1; Angel of Death deals 2", () => {
    const a = playEvent(game(ANGEL), "42015", 2, accepting(LIFE));
    expect(hand(a.state)).toBe(hand(a.before) - 3 + 1);
    const base = game(ARCHANGEL);
    const b = playEvent(base, "42015", 2, accepting(DEATH));
    expect(damageOn(b.state, stryfe(base))).toBe(2);
  });
});

describe("Taunt (42016)", () => {
  /** Angel with Psylocke (42002) in play, ready: a character that could defend. */
  function withPsylocke(face: Face) {
    const base = game(face);
    const given = moveToHand(base, P1, "42002");
    const state = driveEventsPicking(
      DEPS,
      given.state,
      firstLegal,
      play(P1, given.ids[0]!, payWith(given.state, P1, 3, [given.ids[0]!])),
    ).state;
    return { state, ally: instancesOf(state, "42002")[0]! };
  }
  function taunt(state: GameState, pick: Picker = firstLegal) {
    const defenders: string[][] = [];
    const spying: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "declareDefender")
        defenders.push(s.pendingChoice.options.map((o) => o.optionId));
      return pick(s);
    };
    const given = moveToHand(stackEncounterDeck(state, "01186"), P1, "42016");
    const run = driveEventsPicking(
      DEPS,
      given.state,
      spying,
      play(P1, given.ids[0]!, payWith(given.state, P1, 1, [given.ids[0]!])),
    );
    return { ...run, defenders, before: given.state };
  }
  it("the villain attacks you and you draw 3 cards (no defender: Stryfe's 3 ATK + the blank boost)", () => {
    const run = taunt(game(ANGEL));
    expect(events(run.events, "attackResolved")).toHaveLength(1);
    expect(damageOn(run.state, identityOf(run.state))).toBe(3);
    expect(hand(run.state)).toBe(hand(run.before) - 2 + 3);
  });
  it("other characters cannot defend: a ready ally is not among the defenders offered, Angel himself may", () => {
    const { state, ally } = withPsylocke(ANGEL);
    const run = taunt(state);
    expect(run.defenders.length).toBeGreaterThan(0);
    expect(run.defenders.every((o) => !o.includes(ally))).toBe(true);
    expect(run.defenders[0]).toContain(identityOf(state));
  });
  it("without Taunt the same ally is offered as a defender", () => {
    const { state, ally } = withPsylocke(ANGEL);
    const defenders: string[][] = [];
    driveEventsPicking(
      DEPS,
      stackEncounterDeck(state, "01186"),
      (s) => {
        if (s.pendingChoice?.prompt.kind === "declareDefender")
          defenders.push(s.pendingChoice.options.map((o) => o.optionId));
        return firstLegal(s);
      },
      endTurn(P1),
    );
    expect(defenders[0]!.some((o) => o.includes(ally))).toBe(true);
  });
  it("the restriction ends with that attack: the villain's own attack in the villain phase may be defended by the ally", () => {
    const { state, ally } = withPsylocke(ANGEL);
    const after = taunt(state).state;
    const defenders: string[][] = [];
    driveEventsPicking(
      DEPS,
      stackEncounterDeck(after, "01186"),
      (s) => {
        if (s.pendingChoice?.prompt.kind === "declareDefender")
          defenders.push(s.pendingChoice.options.map((o) => o.optionId));
        return firstLegal(s);
      },
      endTurn(P1),
    );
    expect(defenders.some((o) => o.some((id) => id.includes(ally)))).toBe(true);
  });
  it("is refused as Warren (a Hero Action)", () => {
    expect(refused(game(WARREN), "42016", 1)).toBe(true);
  });
  it("is a TACTIC, not AERIAL: neither Angel of Life nor Angel of Death answers it", () => {
    for (const [face, ability] of [
      [ANGEL, LIFE],
      [ARCHANGEL, DEATH],
    ] as const) {
      const run = playEvent(stackEncounterDeck(game(face), "01186"), "42016", 1, accepting(ability));
      expect(run.offered.filter((o) => o.includes("42001"))).toEqual([]);
    }
  });
  it("two players: the other player's hero is untouched (the villain attacks only the player who played it)", () => {
    const base = game(ANGEL, [ANGEL_SEAT, SPIDER_MAN]);
    const run = taunt(base);
    expect(damageOn(run.state, identityOf(run.state, P2))).toBe(damageOn(base, identityOf(base, P2)));
    expect(damageOn(run.state, identityOf(run.state, P1))).toBe(3);
  });
});

describe("Soaring Hearts (42021)", () => {
  /** Angel with Psylocke (42002) in play, both exhausted, events in the discard pile. */
  function staged(face: Face) {
    const base = game(face);
    const given = moveToHand(base, P1, "42002");
    let state = driveEventsPicking(
      DEPS,
      given.state,
      firstLegal,
      play(P1, given.ids[0]!, payWith(given.state, P1, 3, [given.ids[0]!])),
    ).state;
    for (const code of ["42003", "42014"]) state = moveToDiscard(state, P1, code).state;
    const ally = instancesOf(state, "42002")[0]!;
    state = patchInstance(state, ally, { exhausted: true });
    state = patchInstance(state, identityOf(state), { exhausted: true });
    return { state, ally };
  }
  it("as Angel with Psylocke in play: fetches an identity-specific event from the discard pile, readies both", () => {
    const { state, ally } = staged(ANGEL);
    const offered: string[] = [];
    const run = playEvent(state, "42021", 2, (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseCards") {
        offered.push(...choice.options.map((o) => codeOf(s, o.optionId as InstanceId)));
        const hit = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === "42003");
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    });
    // Aerial Intervention is a protection event, not identity-specific.
    expect(offered).toContain("42003");
    expect(offered).not.toContain("42014");
    expect(playerOf(run.state, P1).hand.map((i) => codeOf(run.state, i))).toContain("42003");
    expect(inst(run.state, ally).exhausted).toBe(false);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
  });
  it("Q37: cannot be played while Archangel; or as Warren (a Hero Action)", () => {
    expect(refused(staged(ARCHANGEL).state, "42021", 2)).toBe(true);
    expect(refused(staged(ANGEL).state, "42021", 2)).toBe(false);
    expect(refused(withForm(staged(ANGEL).state, WARREN), "42021", 2)).toBe(true);
  });
  it("Team-Up: refused while Psylocke is not in play", () => {
    expect(refused(game(ANGEL), "42021", 2)).toBe(true);
  });
  it("Angel of Life draws 1 after it (an AERIAL event); the Team-Up needs Angel, so Death never answers", () => {
    const { state } = staged(ANGEL);
    const run = playEvent(state, "42021", 2, accepting(LIFE));
    expect(offeredLife(run.offered)).toBe(true);
    expect(offeredDeath(run.offered)).toBe(false);
  });
});
