import { WONDER_MAN_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  locateCard,
  minimumChosenX,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE10_DEPS, engageMinion, stagedInPlay, wonderManHeroGame } from "../testing.js";
import { WONDER_MAN_JUSTICE as REGISTRY, WONDER_MAN_JUSTICE_SKIPPED as SKIPPED } from "./justice.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 10 `wonder_man/justice` (docs/phase7-wave10-hero-packs.md H8.4, HS5): Firebird 58012, Hawkeye 58013, Scarlet
 * Witch 58014, Sentry 58015, Battlefield Benevolence 58016, Everywhere All at Once 58018 and Heroic Conditioning
 * 58021, played from real Wonder Man games against Core's Rhino. No ruling in marvel-champions-rulings-post-rrg-1-7.md
 * names these cards.
 */
const FIREBIRD_CONSTANT = "58012.firebird-constant";
const FIREBIRD_INTERRUPT = "58012.firebird-interrupt";
const HAWKEYE_CONSTANT = "58013.hawkeye-constant";
const HAWKEYE_RESPONSE = "58013.hawkeye-response";
const WITCH = "58014.scarlet-witch-forced-response";
const SENTRY = "58015.sentry-forced-response";
const BENEVOLENCE = "58016.battlefield-benevolence-action";
const EVERYWHERE = "58018.everywhere-all-at-once-action";
const CONDITIONING = "58021.heroic-conditioning-constant";
const ALL = [
  FIREBIRD_CONSTANT,
  FIREBIRD_INTERRUPT,
  HAWKEYE_CONSTANT,
  HAWKEYE_RESPONSE,
  WITCH,
  SENTRY,
  BENEVOLENCE,
  EVERYWHERE,
  CONDITIONING,
];

const ENERGY = "58023"; // 2 [energy]
const SIPHON = "58006"; // 1 [energy]
const FIREBIRD = "58012"; // cost 2, 1 [energy], ATK 2, 2 hp, consequential damage 2 on an attack
const HAWKEYE = "58013"; // cost 3, 1 [energy], 3 hp, THW 1
const SCARLET_WITCH = "58014"; // cost 2
const SENTRY_CARD = "58015"; // cost 3
const BENEVOLENCE_CARD = "58016";
const EVERYWHERE_CARD = "58018";
const CONDITIONING_CARD = "58021"; // cost 3
const RADIOACTIVE_MAN = "01129"; // Core minion, 7 hit points
const MERCENARY = "01101"; // Hydra Mercenary
const ADVANCE = "01186"; // treachery: When Revealed: The villain schemes.
const BOMB_SCARE = "01109"; // side scheme
const BREAKIN = "01107"; // side scheme
const MINION = "minion" as InstanceId;
const OTHER = "other" as InstanceId;

const dataOf = (code: string) =>
  WONDER_MAN_CARDS.find((c) => c.id === cardId(code)) as unknown as { abilities: { id: string }[] };
const run = (state: GameState, pick: Picker, ...commands: Command[]) =>
  driveEventsPicking(WAVE10_DEPS, state, pick, ...commands);
const offeredRefs = (s: GameState): string[] =>
  s.pendingChoice?.prompt.kind === "chooseTriggers"
    ? s.pendingChoice.options.flatMap((o) => (o.ref.kind === "ability" ? [o.ref.abilityId as string] : []))
    : [];
/** Takes the listed refs when offered, recording every ref on offer; any other choice as it comes. */
const taking =
  (refs: readonly string[], offered: string[] = []): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      offered.push(...offeredRefs(s));
      const wanted = choice.options.filter((o) => o.ref.kind === "ability" && refs.includes(o.ref.abilityId as string));
      if (wanted.length > 0) return wanted.map((o) => o.optionId);
      return choice.minSelections > 0 ? [choice.options[0]!.optionId] : [];
    }
    return firstLegal(s);
  };
/** Picks the offered card `target` when a prompt offers it, else as `taking([])` does. */
const targeting =
  (targets: readonly InstanceId[], refs: readonly string[] = []): Picker =>
  (s) => {
    const hit = s.pendingChoice?.options.find((o) => o.ref.kind === "card" && targets.includes(o.ref.instanceId));
    return hit ? [hit.optionId] : taking(refs)(s);
  };
const basicThwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
/** Plays `id` paying with `payers` (and `x` for a printed X). */
const playing = (
  id: InstanceId,
  payers: readonly InstanceId[],
  x?: number,
  costChoices?: Record<string, readonly InstanceId[]>,
): Command =>
  ({
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: payers.map((fromHand) => ({ fromHand })),
    attachToInstanceId: null,
    ...(x === undefined ? {} : { x }),
    ...(costChoices ? { costChoices } : {}),
  }) as Command;
/** Exactly `code` and the cards that pay for it in P1's hand. */
function staged(base: GameState, code: string, payers: readonly string[]) {
  const given = moveToHand(base, P1, code, ...payers);
  const [id, ...paying] = given.ids as [InstanceId, ...InstanceId[]];
  const state: GameState = {
    ...given.state,
    players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [id, ...paying] } : p)),
  };
  return { state, id, paying };
}
const hero = () => wonderManHeroGame({ deps: WAVE10_DEPS });
const withMainThreat = (s: GameState, threat: number): GameState =>
  patchInstance(s, s.mainScheme.instanceId, { threat });
const inPlay = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).playArea.includes(id);
/** The top cards of the encounter deck turned into copies of `codes` (in order), by surgery: Rhino's deck holds no side scheme. */
function turnedInto(state: GameState, ...codes: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const ids = encounterOf(state).deck.slice(0, codes.length);
  const next = ids.reduce((acc, id, i) => patchInstance(acc, id, { cardId: cardId(codes[i]!) }), state);
  return { state: next, ids };
}
/** Every side scheme of the encounter deck (Rhino's own Breakin' & Takin' among them) moved to its discard pile. */
function clearOfSideSchemes(base: GameState): GameState {
  const key = encounterKey(base);
  const pile = base.encounterDecks[key]!;
  const isSide = (i: InstanceId) => base.cardPool[inst(base, i).cardId]?.type === "side_scheme";
  return {
    ...base,
    encounterDecks: {
      ...base.encounterDecks,
      [key]: { deck: pile.deck.filter((i) => !isSide(i)), discard: [...pile.discard, ...pile.deck.filter(isSide)] },
    },
  };
}
const encounterKey = (s: GameState): string => activeEncounterDeckId(s);
const encounterOf = (s: GameState) => activeEncounterDeck(s);

describe("registry", () => {
  it("scripts all nine refs, each validating, and skips nothing", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([...ALL].sort());
    for (const id of ALL) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
  });

  it("the seven cards print exactly these refs", () => {
    const printed = ["58012", "58013", "58014", "58015", "58016", "58018", "58021"].flatMap((c) =>
      dataOf(c).abilities.map((a) => a.id),
    );
    expect(printed.sort()).toEqual([...ALL].sort());
  });

  it("prints the timings: Firebird's optional Interrupt, forced Responses, Hero Actions, a constant", () => {
    expect(REGISTRY[FIREBIRD_CONSTANT]!.trigger).toMatchObject({ kind: "interrupt", forced: true });
    expect(REGISTRY[FIREBIRD_INTERRUPT]!.trigger).toMatchObject({ kind: "interrupt" });
    expect(REGISTRY[FIREBIRD_INTERRUPT]!.trigger).not.toMatchObject({ forced: true });
    expect(REGISTRY[HAWKEYE_CONSTANT]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[HAWKEYE_RESPONSE]!.trigger).toMatchObject({ kind: "response" });
    expect(REGISTRY[HAWKEYE_RESPONSE]!.trigger).not.toMatchObject({ forced: true });
    expect(REGISTRY[WITCH]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[SENTRY]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[BENEVOLENCE]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[EVERYWHERE]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[CONDITIONING]!.trigger).toMatchObject({ kind: "constant" });
  });
});

describe("58012 Firebird", () => {
  it("played with 1 resource overpaid (Energy + Siphon for cost 2): 1 rebirth counter", () => {
    const t = staged(hero(), FIREBIRD, [ENERGY, SIPHON]);
    const { state } = run(t.state, taking([]), playing(t.id, t.paying));
    expect(inPlay(state, t.id)).toBe(true);
    expect(inst(state, t.id).counters.rebirth).toBe(1);
  });

  it("played for exactly her cost: no counter", () => {
    const t = staged(hero(), FIREBIRD, [ENERGY]);
    const { state } = run(t.state, taking([]), playing(t.id, t.paying));
    expect(inPlay(state, t.id)).toBe(true);
    expect(inst(state, t.id).counters.rebirth ?? 0).toBe(0);
  });

  it("put into play, not played (staged): she has no counter", () => {
    const { state, id } = stagedInPlay(hero(), FIREBIRD);
    expect(inst(state, id).counters.rebirth ?? 0).toBe(0);
  });

  /** Firebird (1 damage, 1 rebirth counter) in play, a 7 hit point minion engaged: her attack's consequential damage defeats her. */
  function dying(counters: number) {
    const ally = stagedInPlay(hero(), FIREBIRD, { counters: { rebirth: counters } });
    const state = patchInstance(engageMinion(ally.state, RADIOACTIVE_MAN, MINION, P1), ally.id, { damage: 1 });
    return { state, id: ally.id };
  }

  it("a defeat by her own consequential damage: remove the counter, heal all her damage instead, she stays", () => {
    const { state, id } = dying(1);
    const offered: string[] = [];
    const out = run(state, taking([FIREBIRD_INTERRUPT], offered), basicAttack(id, MINION));
    expect(offered).toContain(FIREBIRD_INTERRUPT);
    expect(inPlay(out.state, id)).toBe(true);
    expect(inst(out.state, id).damage).toBe(0);
    expect(inst(out.state, id).counters.rebirth ?? 0).toBe(0);
    expect(inst(out.state, MINION).damage).toBe(2);
  });

  it("declined, she is defeated and the counter is not spent", () => {
    const { state, id } = dying(1);
    const out = run(state, taking([]), basicAttack(id, MINION));
    expect(inPlay(out.state, id)).toBe(false);
    expect(playerOf(out.state, P1).discard).toContain(id);
  });

  it("with no rebirth counter the cost cannot be paid: it is not offered and she is defeated", () => {
    const { state, id } = dying(0);
    const offered: string[] = [];
    const out = run(state, taking([FIREBIRD_INTERRUPT], offered), basicAttack(id, MINION));
    expect(offered).not.toContain(FIREBIRD_INTERRUPT);
    expect(inPlay(out.state, id)).toBe(false);
  });

  it("is not offered when the consequential damage does not defeat her (a thwart costs her 1 of 2 hit points)", () => {
    const ally = stagedInPlay(withMainThreat(hero(), 4), FIREBIRD, { counters: { rebirth: 1 } });
    const offered: string[] = [];
    const out = run(
      ally.state,
      taking([FIREBIRD_INTERRUPT], offered),
      basicThwart(ally.id, ally.state.mainScheme.instanceId),
    );
    expect(offered).not.toContain(FIREBIRD_INTERRUPT);
    expect(inst(out.state, ally.id)).toMatchObject({ damage: 1, counters: { rebirth: 1 } });
  });

  it("also for the consequential damage of a thwart: 1 damage already, the thwart's 1 would defeat her", () => {
    const ally = stagedInPlay(withMainThreat(hero(), 4), FIREBIRD, { counters: { rebirth: 1 } });
    const hurt = patchInstance(ally.state, ally.id, { damage: 1 });
    const out = run(hurt, taking([FIREBIRD_INTERRUPT]), basicThwart(ally.id, hurt.mainScheme.instanceId));
    expect(inPlay(out.state, ally.id)).toBe(true);
    expect(inst(out.state, ally.id)).toMatchObject({ damage: 0 });
    expect(inst(out.state, ally.id).counters.rebirth ?? 0).toBe(0);
  });
});

describe("58013 Hawkeye", () => {
  it("enters play with 4 arrow counters", () => {
    const t = staged(hero(), HAWKEYE, [ENERGY, SIPHON]);
    const { state } = run(t.state, taking([]), playing(t.id, t.paying));
    expect(inst(state, t.id).counters.arrow).toBe(4);
  });

  /** Hawkeye (4 arrows) and Firebird in play, a 7 hit point minion engaged, 4 threat on the main scheme. */
  function armed() {
    const a = stagedInPlay(hero(), HAWKEYE, { counters: { arrow: 4 } });
    const b = stagedInPlay(a.state, FIREBIRD);
    const engaged = engageMinion(b.state, RADIOACTIVE_MAN, MINION, P1);
    return { state: withMainThreat(engaged, 4), hawkeye: a.id, firebird: b.id };
  }

  it("after another ally's basic thwart: remove 1 arrow, 2 damage to a minion", () => {
    const { state, hawkeye, firebird } = armed();
    const scheme = state.mainScheme.instanceId;
    const offered: string[] = [];
    const out = run(state, taking([HAWKEYE_RESPONSE], offered), basicThwart(firebird, scheme));
    expect(offered).toContain(HAWKEYE_RESPONSE);
    expect(inst(out.state, hawkeye).counters.arrow).toBe(3);
    expect(inst(out.state, MINION).damage).toBe(2);
  });

  it("after Hawkeye's own basic thwart as well", () => {
    const { state, hawkeye } = armed();
    const out = run(state, taking([HAWKEYE_RESPONSE]), basicThwart(hawkeye, state.mainScheme.instanceId));
    expect(inst(out.state, hawkeye).counters.arrow).toBe(3);
    expect(inst(out.state, MINION).damage).toBe(2);
  });

  it("the minion is chosen: either of two, whoever it is engaged with", () => {
    const { state, firebird } = armed();
    const two = engageMinion(state, MERCENARY, OTHER, P1);
    const out = run(two, targeting([OTHER], [HAWKEYE_RESPONSE]), basicThwart(firebird, state.mainScheme.instanceId));
    expect(inst(out.state, OTHER).damage).toBe(2);
    expect(inst(out.state, MINION).damage).toBe(0);
  });

  it("declined, no arrow is spent and no damage is dealt", () => {
    const { state, hawkeye, firebird } = armed();
    const out = run(state, taking([]), basicThwart(firebird, state.mainScheme.instanceId));
    expect(inst(out.state, hawkeye).counters.arrow).toBe(4);
    expect(inst(out.state, MINION).damage).toBe(0);
  });

  it("an ally's basic attack does not trigger it", () => {
    const { state, firebird } = armed();
    const offered: string[] = [];
    run(state, taking([HAWKEYE_RESPONSE], offered), basicAttack(firebird, MINION));
    expect(offered).not.toContain(HAWKEYE_RESPONSE);
  });

  it("not offered with no arrow counter left, nor with no minion in play", () => {
    const { state, hawkeye, firebird } = armed();
    const scheme = state.mainScheme.instanceId;
    const empty = patchInstance(state, hawkeye, { counters: { arrow: 0 } });
    const none: string[] = [];
    run(empty, taking([HAWKEYE_RESPONSE], none), basicThwart(firebird, scheme));
    expect(none).not.toContain(HAWKEYE_RESPONSE);

    const a = stagedInPlay(hero(), HAWKEYE, { counters: { arrow: 4 } });
    const b = stagedInPlay(withMainThreat(a.state, 4), FIREBIRD);
    const noMinion: string[] = [];
    run(b.state, taking([HAWKEYE_RESPONSE], noMinion), basicThwart(b.id, b.state.mainScheme.instanceId));
    expect(noMinion).not.toContain(HAWKEYE_RESPONSE);
  });

  it("the hero's own basic thwart is not an ally's: not offered", () => {
    const { state } = armed();
    const offered: string[] = [];
    run(state, taking([HAWKEYE_RESPONSE], offered), basicThwart(identityOf(state), state.mainScheme.instanceId));
    expect(offered).not.toContain(HAWKEYE_RESPONSE);
  });
});

describe("58014 Scarlet Witch", () => {
  const playWitch = (stack: readonly string[]) => {
    const t = staged(hero(), SCARLET_WITCH, [ENERGY]);
    const stacked = stackEncounterDeck(withMainThreat(t.state, 3), ...stack);
    const top = encounterOf(stacked).deck[0]!;
    const out = run(stacked, taking([]), playing(t.id, t.paying));
    return { ...out, id: t.id, top };
  };

  it("a treachery on top: it is discarded and its When Revealed resolves (Advance: the villain schemes)", () => {
    const { state, top, id } = playWitch([ADVANCE]);
    expect(inPlay(state, id)).toBe(true);
    expect(encounterOf(state).discard).toContain(top);
    expect(mainThreat(state)).toBeGreaterThan(3);
  });

  it("a minion on top: only discarded, it does not enter play", () => {
    const { state, top } = playWitch([MERCENARY]);
    expect(encounterOf(state).discard).toContain(top);
    expect(locateCard(state, top)).not.toMatchObject({ kind: "playArea" });
    expect(mainThreat(state)).toBe(3);
  });

  it("is not triggered by putting her into play: nothing is discarded", () => {
    const base = stackEncounterDeck(hero(), ADVANCE);
    const before = encounterOf(base).discard.length;
    const { state } = stagedInPlay(base, SCARLET_WITCH);
    expect(encounterOf(state).discard).toHaveLength(before);
  });
});

describe("58015 Sentry", () => {
  const sideSchemes = (s: GameState): InstanceId[] =>
    s.villainArea.filter((i) => s.cardPool[inst(s, i).cardId]?.type === "side_scheme");
  const playSentry = (state: GameState, pick: Picker = taking([])) => {
    const t = staged(state, SENTRY_CARD, [ENERGY, SIPHON]);
    return { ...run(t.state, pick, playing(t.id, t.paying)), id: t.id };
  };

  it("with a side scheme in the encounter deck: it is revealed (in play, with its threat) and no threat goes on the main scheme", () => {
    const turned = turnedInto(withMainThreat(hero(), 3), BOMB_SCARE);
    const base = turned.state;
    const found = turned.ids[0]!;
    const { state, id } = playSentry(base);
    expect(inPlay(state, id)).toBe(true);
    expect(sideSchemes(state)).toContain(found);
    expect(mainThreat(state)).toBe(3);
  });

  it("with several, the player picks which one is revealed", () => {
    const turned = turnedInto(withMainThreat(hero(), 3), BOMB_SCARE, BREAKIN);
    const base = turned.state;
    const second = turned.ids[1]!;
    const { state } = playSentry(base, (s) => {
      const hit = s.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === second);
      return hit ? [hit.optionId] : taking([])(s);
    });
    expect(sideSchemes(state)).toEqual([second]);
  });

  it("with no side scheme in the encounter deck: 6 threat on the main scheme", () => {
    const cleared = withMainThreat(clearOfSideSchemes(hero()), 3);
    const before = sideSchemes(cleared).length;
    const { state } = playSentry(cleared);
    expect(mainThreat(state)).toBe(9);
    expect(sideSchemes(state)).toHaveLength(before);
  });

  it("a side scheme only in the discard pile is not found (the deck is searched): 6 threat", () => {
    const { state: base, ids } = turnedInto(withMainThreat(clearOfSideSchemes(hero()), 3), BOMB_SCARE);
    const key = encounterKey(base);
    const pile = base.encounterDecks[key]!;
    const moved: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [key]: { deck: pile.deck.filter((i) => i !== ids[0]), discard: [...pile.discard, ids[0]!] },
      },
    };
    expect(mainThreat(playSentry(moved).state)).toBe(9);
  });
});

describe("58016 Battlefield Benevolence", () => {
  /** Hero form, the event and a payer in hand, `damage` on Rhino. */
  function staged16(damage: number) {
    const t = staged(hero(), BENEVOLENCE_CARD, [ENERGY]);
    const villain = t.state.villains[0]!.instanceId;
    return { ...t, villain, state: patchInstance(t.state, villain, { damage }) };
  }

  it("is a Hero Action with no label, the heal its cost", () => {
    const def = REGISTRY[BENEVOLENCE]!;
    expect(def.trigger).toEqual({ kind: "action", form: "hero" });
    expect(def.label).toBeUndefined();
    expect(def.cost).toMatchObject({ healCharacter: { amount: 2 } });
  });

  it("Rhino with 5 damage: 3 are left and he is confused", () => {
    const t = staged16(5);
    const out = run(t.state, taking([]), playing(t.id, t.paying));
    expect(inst(out.state, t.villain)).toMatchObject({ damage: 3, statuses: { confused: 1 } });
    expect(playerOf(out.state, P1).discard).toContain(t.id);
  });

  it("exactly 2 damage: healed to 0 and confused", () => {
    const t = staged16(2);
    const out = run(t.state, taking([]), playing(t.id, t.paying));
    expect(inst(out.state, t.villain)).toMatchObject({ damage: 0, statuses: { confused: 1 } });
  });

  it("1 damage only: the event cannot be played and nothing is spent", () => {
    const t = staged16(1);
    expect(() => run(t.state, taking([]), playing(t.id, t.paying))).toThrow();
    expect(inst(t.state, t.villain).damage).toBe(1);
  });

  it("an enemy already confused is no candidate", () => {
    const t = staged16(5);
    const confused = patchInstance(t.state, t.villain, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    expect(() => run(confused, taking([]), playing(t.id, t.paying))).toThrow();
  });

  it("with a damaged minion beside Rhino, the player picks which enemy is healed and confused", () => {
    const t = staged16(5);
    const withMinion = patchInstance(engageMinion(t.state, RADIOACTIVE_MAN, MINION, P1), MINION, { damage: 4 });
    const out = run(withMinion, taking([]), playing(t.id, t.paying, undefined, { healed: [MINION] }));
    expect(inst(out.state, MINION)).toMatchObject({ damage: 2, statuses: { confused: 1 } });
    expect(inst(out.state, t.villain)).toMatchObject({ damage: 5, statuses: { confused: 0 } });
  });
});

describe("58018 Everywhere All at Once", () => {
  /** Hero form with 4 threat on the main scheme and on one side scheme in play, the event and `payers` in hand. */
  function schemes(payers: readonly string[]) {
    const t = staged(hero(), EVERYWHERE_CARD, payers);
    const turned = turnedInto(t.state, BOMB_SCARE);
    const base = turned.state;
    const side = turned.ids[0]!;
    const key = encounterKey(base);
    const pile = base.encounterDecks[key]!;
    const placed: GameState = {
      ...base,
      villainArea: [...base.villainArea, side],
      encounterDecks: { ...base.encounterDecks, [key]: { ...pile, deck: pile.deck.filter((i) => i !== side) } },
    };
    const state = withMainThreat(patchInstance(placed, side, { threat: 4, faceup: true }), 4);
    return { ...t, state, side, main: state.mainScheme.instanceId };
  }
  const pickBoth =
    (...ids: readonly InstanceId[]): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      if (
        choice?.prompt.kind === "chooseTarget" ||
        choice?.options.some((o) => o.ref.kind === "card" && ids.includes(o.ref.instanceId))
      ) {
        const hits = choice.options.filter((o) => o.ref.kind === "card" && ids.includes(o.ref.instanceId));
        if (hits.length > 0) return hits.slice(0, choice.maxSelections).map((o) => o.optionId);
      }
      return taking([])(s);
    };

  it("X = 2 paid with exactly 2 resources: 2 threat comes off each of the 2 chosen schemes", () => {
    const t = schemes([ENERGY]);
    const out = run(t.state, pickBoth(t.main, t.side), playing(t.id, t.paying, 2));
    expect(inst(out.state, t.main).threat).toBe(2);
    expect(inst(out.state, t.side).threat).toBe(2);
  });

  it("X = 2 with a resource overpaid (3 for a cost of 2): 3 threat from each", () => {
    const t = schemes([ENERGY, SIPHON]);
    const out = run(t.state, pickBoth(t.main, t.side), playing(t.id, t.paying, 2));
    expect(inst(out.state, t.main).threat).toBe(1);
    expect(inst(out.state, t.side).threat).toBe(1);
  });

  it("X = 1 chooses a single scheme: only that one is thwarted", () => {
    const t = schemes([SIPHON]);
    const out = run(t.state, pickBoth(t.side), playing(t.id, t.paying, 1));
    expect(inst(out.state, t.side).threat).toBe(2);
    expect(inst(out.state, t.main).threat).toBe(4);
  });

  it("is a Hero Action (thwart) played from the hand to the discard pile", () => {
    const t = schemes([SIPHON]);
    expect(REGISTRY[EVERYWHERE]!.trigger).toMatchObject({ kind: "action", form: "hero" });
    expect(REGISTRY[EVERYWHERE]!.label).toEqual(["thwart"]);
    const out = run(t.state, pickBoth(t.main), playing(t.id, t.paying, 1));
    expect(playerOf(out.state, P1).discard).toContain(t.id);
  });

  it("no scheme holds threat: not playable at any X (RRG 'Target', p. 42)", () => {
    const t = schemes([SIPHON]);
    const quiet = withMainThreat(patchInstance(t.state, t.side, { threat: 0 }), 0);
    for (const x of [0, 1, 2]) expect(() => run(quiet, pickBoth(t.main, t.side), playing(t.id, t.paying, x))).toThrow();
    // With threat on a scheme the same card plays (X = 1: 2 threat comes off the main scheme).
    const some = withMainThreat(patchInstance(t.state, t.side, { threat: 0 }), 2);
    const out = run(some, pickBoth(t.main), playing(t.id, t.paying, 1));
    expect(inst(out.state, t.main).threat).toBe(0);
  });

  it("52B: X = 0 is refused though schemes hold threat (it would choose no scheme and remove none); nothing is spent", () => {
    const t = schemes([SIPHON]);
    expect(REGISTRY[EVERYWHERE]).toMatchObject({ minX: 1 });
    // The validator: a least X is a whole number of at least 1, on the ability a play triggers.
    expect(validateDefinition({ ...REGISTRY[EVERYWHERE]!, minX: 0 }).join(" ")).toMatch(/minX is a whole number/);
    expect(validateDefinition({ ...REGISTRY["58021.heroic-conditioning-constant"]!, minX: 1 }).join(" ")).toMatch(
      /minX is read from the ability a played card triggers/,
    );
    expect(minimumChosenX(t.state, WAVE10_DEPS, t.id)).toBe(1);
    // With the payer on top (overpaying a cost of 0), with nothing paid, and with no X named at all (absent is 0).
    for (const command of [playing(t.id, t.paying, 0), playing(t.id, [], 0), playing(t.id, [])]) {
      const refused = applyCommand(t.state, command, WAVE10_DEPS);
      expect(refused.ok).toBe(false);
      if (!refused.ok) {
        expect(refused.error.code).toBe("invalid_choice");
        expect(refused.error.message).toMatch(/X must be at least 1 to play Everywhere All at Once/);
      }
    }
    expect(inst(t.state, t.main).threat).toBe(4);
    expect(playerOf(t.state, P1).hand).toContain(t.id);
    // X = 1 is the least that plays.
    const out = run(t.state, pickBoth(t.main), playing(t.id, t.paying, 1));
    expect(inst(out.state, t.main).threat).toBe(2);
  });

  it("alter-ego form: not playable (a Hero Action)", () => {
    const t = schemes([SIPHON]);
    const alter = withForm(t.state, "alterEgo");
    expect(() => run(alter, taking([]), playing(t.id, t.paying, 1))).toThrow();
  });
});

describe("58021 Heroic Conditioning", () => {
  const stats = (s: GameState) => {
    const p = characterProfile(s, identityOf(s), WAVE10_DEPS)!;
    return { thw: p.thw, hp: p.maxHp };
  };

  it("hero form: +3 hit points and +1 THW", () => {
    const base = hero();
    const before = stats(base);
    const one = stagedInPlay(base, CONDITIONING_CARD, { attach: true });
    expect(stats(one.state)).toEqual({ thw: before.thw + 1, hp: before.hp + 3 });
  });

  it("alter-ego form: +3 hit points for the alter-ego, no THW bonus (it is for your hero)", () => {
    const base = withForm(hero(), "alterEgo");
    const before = characterProfile(base, identityOf(base), WAVE10_DEPS)!;
    const one = stagedInPlay(base, CONDITIONING_CARD, { attach: true });
    const after = characterProfile(one.state, identityOf(one.state), WAVE10_DEPS)!;
    expect(after.thw).toBe(before.thw);
    expect(after.maxHp).toBe(before.maxHp + 3);
  });

  it("is data-restricted to Max 1 per player under any player's control", () => {
    const data = WONDER_MAN_CARDS.find((c) => c.id === cardId(CONDITIONING_CARD)) as unknown as {
      playRestrictions: unknown;
    };
    expect(data.playRestrictions).toEqual({ anyPlayerControl: true, maxPerPlayer: 1 });
  });
});
