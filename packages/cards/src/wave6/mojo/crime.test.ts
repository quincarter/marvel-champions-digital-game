import {
  activeEncounterDeck,
  activeVillain,
  applyCommand,
  cardsInPlay,
  characterProfile,
  hasKeyword,
  legalActions,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { CRIME_ABILITIES } from "./crime.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  P1,
  P2,
  play,
  payWith,
  patchInstance,
  picking,
  runWith,
  settle,
  stackEncounterDeck,
  threatOn,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand } from "../../testing/staging.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { crimeGame } from "./crime-testing.js";

const deps: EngineDeps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const DIAL_M = "39035";
const BUILD_THE_CASE = "39036";
const CRIME_SCENE = "39037";
const LAW_AND_ORDER = "39038";
const DRAGNET = "39039";
const ELEMENTARY = "39040";
/** Mojo Runner, a SETTING SHOW environment of the Sci-Fi set. */
const RUNNER = "39053";
const MINION = "39055";
/** Treacheries with no boost icons and no surge (Assault, Advance), to fill the boost and reveal slots of a villain phase. */
const FILLER = "01187";
const FILLER_2 = "01186";
const FILLER_3 = "01187";
const ENERGY = "01088";
const GENIUS = "01089";
const STRENGTH = "01090";
const FURY = "01084";
const HEROIC_STRIKE = "03004";

const SHE_HULK = "core-she-hulk-aggression";
const hero = (state: GameState) => identityOf(state, P1);
const heroForm = (options: Parameters<typeof crimeGame>[0] = {}) =>
  settle(run(crimeGame(options), toHero(P1)), firstLegal, undefined, deps);
/** Every instance of `code` in play or in the villain area (where a revealed side scheme sits). */
const inPlay = (state: GameState, code: string): InstanceId[] =>
  [...new Set([...cardsInPlay(state), ...state.villainArea])].filter((id) => inst(state, id).cardId === cardId(code));
/** Every player ends their turn: `boostCards` are dealt first (villain, then minions), then `reveal` is the card step 3 reveals. */
const villainPhase = (
  state: GameState,
  boostCards: readonly string[],
  reveal: string,
  after: readonly string[] = [FILLER_2, FILLER_3],
  pick = firstLegal,
) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...boostCards, reveal, ...after),
    pick,
    ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })),
  );
const revealedIds = (events: readonly GameEvent[]) => of(events, "encounterCardRevealed").map((e) => e.instanceId);
/** The threat a card placed on a scheme through its own reveal (incite), by source. */
const threatFrom = (events: readonly GameEvent[], source: InstanceId) =>
  of(events, "threatPlaced")
    .filter((e) => e.sourceInstanceId === source)
    .map((e) => e.amount);
const pickingAt =
  (kind: string, ...wanted: readonly string[]) =>
  (state: GameState) =>
    state.pendingChoice?.prompt.kind === kind ? picking(...wanted)(state) : firstLegal(state);
const handOf = (state: GameState) => state.players.find((p) => p.playerId === P1)!.hand;
const atk = (state: GameState, id: InstanceId) => characterProfile(state, id, deps)!.atk;
const thw = (state: GameState, id: InstanceId) => characterProfile(state, id, deps)!.thw;
const withCrimeCard = (state: GameState, code: string, threat = 0) => encounterCardInVillainArea(state, code, threat);

describe("registry", () => {
  it("scripts every ability ref of the Crime set", () => {
    expect(Object.keys(CRIME_ABILITIES).sort()).toEqual(
      [
        "39035.dial-m-for-mojo-constant",
        "39035.dial-m-for-mojo-constant-2",
        "39035.when-revealed",
        "39036.obligation",
        "39037.crime-scene-investigation-constant",
        "39037.crime-scene-investigation-action",
        "39038.law-and-order-constant",
        "39038.law-and-order-action",
        "39039.dragnet-constant",
        "39039.dragnet-action",
        "39040.when-revealed",
      ].sort(),
    );
  });
});

describe("Dial M for Mojo (39035)", () => {
  it("Each other encounter card gains incite 1: the villain, the main scheme and a minion do, Dial M itself does not", () => {
    const base = heroForm();
    const { state, id: dial } = withCrimeCard(base, DIAL_M);
    const minion = engageMinion(state, MINION);
    const villain = activeVillain(minion.state).instanceId;
    expect(hasKeyword(base, villain, "incite", deps)).toBe(false);
    expect(hasKeyword(minion.state, villain, "incite", deps)).toBe(true);
    expect(hasKeyword(minion.state, minion.state.mainScheme.instanceId, "incite", deps)).toBe(true);
    expect(hasKeyword(minion.state, minion.id, "incite", deps)).toBe(true);
    expect(hasKeyword(minion.state, dial, "incite", deps)).toBe(false);
    expect(hasKeyword(minion.state, hero(minion.state), "incite", deps)).toBe(false);
  });

  it("an encounter card revealed while it is in play resolves incite 1: 1 threat on the main scheme from that card", () => {
    const { state: staged } = withCrimeCard(heroForm(), DIAL_M);
    const { state, events } = villainPhase(staged, [FILLER], FILLER_2);
    const [revealed] = revealedIds(events);
    expect(revealed).toBeDefined();
    expect(threatFrom(events, revealed!)).toEqual([1]);
    expect(mainThreat(state)).toBeGreaterThanOrEqual(1);
  });

  it("control: without Dial M the same reveal places no threat from the card", () => {
    const { events } = villainPhase(heroForm(), [FILLER], FILLER_2);
    const [revealed] = revealedIds(events);
    expect(threatFrom(events, revealed!)).toEqual([]);
  });

  it("incite reaches every encounter card type: a revealed obligation and a side scheme place 1 threat too", () => {
    const base = withCrimeCard(heroForm(), DIAL_M).state;
    const obligation = villainPhase(base, [FILLER], BUILD_THE_CASE);
    expect(threatFrom(obligation.events, revealedIds(obligation.events)[0]!)).toEqual([1]);
    const scheme = villainPhase(base, [FILLER], CRIME_SCENE);
    expect(threatFrom(scheme.events, revealedIds(scheme.events)[0]!)).toEqual([1]);
  });

  it("Each friendly character gets +1 THW: the hero, an ally and another player's hero, not an enemy", () => {
    const base = heroForm({
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    });
    const { state: ally, id: cat } = playFromHand(deps, base, "01002", 2);
    const before = {
      hero: thw(ally, hero(ally)),
      cat: thw(ally, cat),
      other: thw(ally, identityOf(ally, P2)),
    };
    const { state } = withCrimeCard(ally, DIAL_M);
    expect(thw(state, hero(state))).toBe(before.hero + 1);
    expect(thw(state, cat)).toBe(before.cat + 1);
    expect(thw(state, identityOf(state, P2))).toBe(before.other + 1);
  });

  it("When Revealed: discards each other Setting environment in play and, revealed from the encounter deck, gains surge", () => {
    const base = heroForm({ modularSetIds: ["crime", "sci-fi"] });
    const { state: staged, id: runner } = encounterCardInVillainArea(base, RUNNER);
    expect(cardsInPlay(staged)).toContain(runner);
    const { state, events } = villainPhase(staged, [FILLER], DIAL_M, [FILLER_2, FILLER_3]);
    expect(cardsInPlay(state)).not.toContain(runner);
    expect(activeEncounterDeck(state).discard).toContain(runner);
    expect(inPlay(state, DIAL_M)).toHaveLength(1);
    expect(of(events, "surgeTriggered")).toHaveLength(1);
    // The surge reveals the next card; Dial M's own incite 1 does not apply to itself.
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId as string)).toEqual([DIAL_M, FILLER_2]);
    expect(threatFrom(events, revealedIds(events)[0]!)).toEqual([]);
  });
});

/** A thwart by P1's hero of `scheme`, answering prompts with `pick`. */
const thwart = (state: GameState, scheme: InstanceId, pick = firstLegal) =>
  driveEventsPicking(deps, state, pick, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: hero(state),
    schemeInstanceId: scheme,
  });
/**
 * Retypes the first `codes.length` cards of P1's hand into `codes` (test surgery: the starter decks hold no resource
 * cards), returning their ids.
 */
const conjure = (state: GameState, ...codes: readonly string[]) => {
  const ids = handOf(state).slice(0, codes.length);
  const next = ids.reduce((s, id, i) => patchInstance(s, id, { cardId: cardId(codes[i]!) }), state);
  return { state: next, ids };
};
/** Pays the Hero Action `abilityId` of `scheme` with conjured `codes` from P1's hand. */
const payAbility = (state: GameState, scheme: InstanceId, abilityId: string, ...codes: readonly string[]) => {
  const given = conjure(state, ...codes);
  return applyCommand(
    given.state,
    use(
      P1,
      scheme,
      abilityId,
      given.ids.map((fromHand) => ({ fromHand })),
    ),
    deps,
  );
};

describe("Build the Case (39036)", () => {
  /** Build the Case in play with `clues` clue counters, and a side scheme with 1 threat. */
  const staged = (clues = 0) => {
    const base = heroForm();
    const { state: withCase, id: obligation } = withCrimeCard(base, BUILD_THE_CASE);
    const { state, id: scheme } = withCrimeCard(withCase, CRIME_SCENE, 1);
    return { state: patchInstance(state, obligation, { counters: clues ? { clue: clues } : {} }), obligation, scheme };
  };

  it("Forced Response: after a side scheme is defeated, places 1 clue counter on it", () => {
    const { state: start, obligation, scheme } = staged();
    const { state, events } = thwart(start, scheme);
    expect(of(events, "schemeDefeated").map((e) => e.instanceId)).toEqual([scheme]);
    expect(inst(state, obligation).counters.clue).toBe(1);
    expect(cardsInPlay(state)).toContain(obligation);
  });

  it("a third clue counter discards it: then, if there are at least 3 clue counters here, discard this card", () => {
    const { state: start, obligation, scheme } = staged(2);
    const { state } = thwart(start, scheme);
    expect(cardsInPlay(state)).not.toContain(obligation);
    expect(activeEncounterDeck(state).discard).toContain(obligation);
  });

  it("the second clue counter does not discard it", () => {
    const { state: start, obligation, scheme } = staged(1);
    const { state } = thwart(start, scheme);
    expect(inst(state, obligation).counters.clue).toBe(2);
    expect(cardsInPlay(state)).toContain(obligation);
  });

  it("a side scheme that is merely thwarted, not defeated, adds no clue", () => {
    const base = staged();
    const { state } = thwart(patchInstance(base.state, base.scheme, { threat: 3 }), base.scheme);
    expect(threatOn(state, base.scheme)).toBe(2);
    expect(inst(state, base.obligation).counters.clue ?? 0).toBe(0);
  });
});

describe("Crime Scene Investigation (39037)", () => {
  const ACTION = "39037.crime-scene-investigation-action";

  it("Hinder 1[per_hero]: revealed, it carries its printed 5 threat plus 1 per hero", () => {
    const solo = villainPhase(heroForm(), [FILLER], CRIME_SCENE);
    expect(threatOn(solo.state, inPlay(solo.state, CRIME_SCENE)[0]!)).toBe(6);
    const [scheme] = inPlay(solo.state, CRIME_SCENE);
    const duo = villainPhase(
      heroForm({ players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: SHE_HULK }] }),
      [FILLER, FILLER],
      CRIME_SCENE,
      [],
    );
    const [duoScheme] = inPlay(duo.state, CRIME_SCENE);
    expect(threatOn(duo.state, duoScheme!) - threatOn(solo.state, scheme!)).toBe(1);
  });

  it("Threat cannot be removed from other schemes: the main scheme and another side scheme keep their threat", () => {
    const { state: withCrime, id: crime } = withCrimeCard(heroForm(), CRIME_SCENE, 3);
    const { state: withOther, id: other } = withCrimeCard(withCrime, LAW_AND_ORDER, 3);
    const main = withOther.mainScheme.instanceId;
    const staged = patchInstance(withOther, main, { threat: 4 });
    for (const scheme of [main, other]) {
      const { state, events } = thwart(staged, scheme);
      expect(threatOn(state, scheme), scheme).toBe(threatOn(staged, scheme));
      expect(of(events, "threatRemovalBlocked").map((e) => e.reason)).toEqual(["rule"]);
    }
    // This scheme itself can still be thwarted.
    expect(threatOn(thwart(staged, crime).state, crime)).toBeLessThan(3);
  });

  it("control: without it the main scheme can be thwarted", () => {
    const base = heroForm();
    const main = base.mainScheme.instanceId;
    const staged = patchInstance(base, main, { threat: 4 });
    expect(threatOn(thwart(staged, main).state, main)).toBeLessThan(4);
  });

  it("Hero Action: spend X [mental] resources, remove X threat from this scheme", () => {
    const { state, id } = withCrimeCard(heroForm(), CRIME_SCENE, 5);
    const paid = payAbility(state, id, ACTION, GENIUS);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    // One Genius is two [mental] resources: X = 2.
    expect(threatOn(paid.state, id)).toBe(3);
    expect(of(paid.events, "threatRemoved").map((e) => e.amount)).toEqual([2]);
    const twice = payAbility(state, id, ACTION, GENIUS, GENIUS);
    expect(twice.ok && threatOn(twice.state, id)).toBe(1);
  });

  it("the resources must be [mental]: an [energy] resource does not pay for it", () => {
    const { state, id } = withCrimeCard(heroForm(), CRIME_SCENE, 5);
    const paid = payAbility(state, id, ACTION, ENERGY);
    expect(paid.ok).toBe(false);
  });
});

describe("Law & Order (38)", () => {
  const ACTION = "39038.law-and-order-action";
  const sheHulk = () => heroForm({ players: [{ starterDeckId: SHE_HULK }] });

  it("Hinder 1[per_hero]: revealed, it carries its printed 5 threat plus 1 per hero", () => {
    const duo = villainPhase(
      heroForm({ players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: SHE_HULK }] }),
      [FILLER, FILLER],
      LAW_AND_ORDER,
      [],
    );
    const solo = villainPhase(heroForm(), [FILLER], LAW_AND_ORDER);
    expect(threatOn(solo.state, inPlay(solo.state, LAW_AND_ORDER)[0]!)).toBe(6);
    expect(
      threatOn(duo.state, inPlay(duo.state, LAW_AND_ORDER)[0]!) -
        threatOn(solo.state, inPlay(solo.state, LAW_AND_ORDER)[0]!),
    ).toBe(1);
  });

  it("Each friendly character gets -2 ATK: the hero and an ally, not an enemy", () => {
    const conjured = conjure(sheHulk(), "01002");
    const cat = conjured.ids[0]!;
    const base = run(conjured.state, play(P1, cat, payWith(conjured.state, P1, 2, [cat])));
    const before = { hero: atk(base, hero(base)), cat: atk(base, cat) };
    const villain = activeVillain(base).instanceId;
    const villainAtk = atk(base, villain);
    expect(before.hero).toBeGreaterThanOrEqual(2);
    const { state } = withCrimeCard(base, LAW_AND_ORDER, 5);
    expect(atk(state, hero(state))).toBe(before.hero - 2);
    expect(atk(state, cat)).toBe(Math.max(0, before.cat - 2));
    expect(atk(state, villain)).toBe(villainAtk);
  });

  it("the -2 ATK shows in a real attack: She-Hulk's basic attack deals 2 less", () => {
    const base = engageMinion(sheHulk(), "39057");
    const hit = (state: GameState) =>
      driveEventsPicking(deps, state, firstLegal, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero(state),
        targetInstanceId: base.id,
      });
    const plain = inst(hit(base.state).state, base.id).damage;
    const { state: staged } = withCrimeCard(base.state, LAW_AND_ORDER, 5);
    expect(inst(hit(staged).state, base.id).damage).toBe(plain - 2);
  });

  it("Hero Action: spend X [energy] resources, remove X threat from this scheme", () => {
    const { state, id } = withCrimeCard(sheHulk(), LAW_AND_ORDER, 5);
    const paid = payAbility(state, id, ACTION, ENERGY);
    expect(paid.ok && threatOn(paid.state, id)).toBe(3);
    expect(payAbility(state, id, ACTION, GENIUS).ok).toBe(false);
  });
});

describe("Dragnet (39039)", () => {
  const ACTION = "39039.dragnet-action";

  it("Hinder 1[per_hero]: revealed, it carries its printed 5 threat plus 1 per hero", () => {
    const duo = villainPhase(
      heroForm({ players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: SHE_HULK }] }),
      [FILLER, FILLER],
      DRAGNET,
      [],
    );
    const solo = villainPhase(heroForm(), [FILLER], DRAGNET);
    expect(threatOn(solo.state, inPlay(solo.state, DRAGNET)[0]!)).toBe(6);
    expect(
      threatOn(duo.state, inPlay(duo.state, DRAGNET)[0]!) - threatOn(solo.state, inPlay(solo.state, DRAGNET)[0]!),
    ).toBe(1);
  });

  it("The villain cannot take damage, a minion still does: a basic attack lands on the minion", () => {
    const base = heroForm({ players: [{ starterDeckId: SHE_HULK }] });
    const villain = activeVillain(base).instanceId;
    const attack = (state: GameState, target: InstanceId) =>
      driveEventsPicking(deps, state, firstLegal, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero(state),
        targetInstanceId: target,
      });
    expect(inst(attack(base, villain).state, villain).damage).toBeGreaterThan(0);
    const { state } = withCrimeCard(base, DRAGNET, 5);
    const minion = engageMinion(state, MINION);
    expect(inst(attack(minion.state, minion.id).state, minion.id).damage).toBeGreaterThan(0);
  });

  // RRG 1.8 "Target" (p. 43): a target that "cannot take damage" is not valid for a game function whose only effect on
  // it is damage. Ruling Mar 19, 2026 (2): that "applies equally to basic powers".
  it("a basic attack cannot target the villain at all (ruling Mar 19, 2026 (2))", () => {
    const base = heroForm({ players: [{ starterDeckId: SHE_HULK }] });
    const villain = activeVillain(base).instanceId;
    const minion = engageMinion(withCrimeCard(base, DRAGNET, 5).state, MINION);
    const state = minion.state;
    const basicAttacks = (s: GameState) => {
      const actions = legalActions(s, P1, deps);
      if (actions.kind !== "turn") throw new Error("not P1's turn");
      return [...actions.legal, ...actions.illegal].filter(
        (entry) => entry.action.kind === "basicAttack" && entry.action.instanceId === hero(s),
      );
    };
    // Without Dragnet the villain is offered; with it, only the minion is, and the villain is listed as blocked.
    expect(basicAttacks(base).flatMap((entry) => ("targets" in entry ? entry.targets : []))).toContain(villain);
    const [offered] = basicAttacks(state);
    expect(offered && "targets" in offered ? offered.targets : null).toEqual([minion.id]);
    expect(offered?.blockedTargets.map((b) => [b.instanceId, b.reason])).toEqual([[villain, "no_valid_target"]]);
    // The command itself is refused, and nothing is paid: the hero stays ready and the villain undamaged.
    const refused = applyCommand(
      state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero(state), targetInstanceId: villain },
      deps,
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    expect(inst(state, hero(state)).exhausted).toBe(false);
  });

  /** P1 plays the conjured `code` (paid with other hand cards) and stops at its target prompt: the cards it offers. */
  const targetsOffered = (state: GameState, event: InstanceId, payment: readonly InstanceId[]) => {
    const played = applyCommand(state, play(P1, event, payment), deps);
    expect(played.ok).toBe(true);
    if (!played.ok) return [];
    return (played.state.pendingChoice?.options ?? []).flatMap((o) =>
      o.ref.kind === "card" ? [o.ref.instanceId] : [],
    );
  };

  it("an effect whose only effect is damage cannot target the villain (ruling Apr 30, 2026 (1)), a minion it can", () => {
    // Nick Fury's third option, "Deal 4 damage to an enemy", is a bare damage effect.
    const conjured = conjure(heroForm(), FURY, ENERGY, ENERGY);
    const [fury] = conjured.ids as [InstanceId];
    const villain = activeVillain(conjured.state).instanceId;
    const withMinion = engageMinion(conjured.state, MINION);
    const dealFour = (state: GameState) => {
      const played = applyCommand(state, play(P1, fury, payWith(state, P1, 2, [fury])), deps);
      expect(played.ok).toBe(true);
      if (!played.ok) return [];
      const picked = settle(played.state, picking("2"), (s) => s.pendingChoice?.prompt.kind !== "chooseOption", deps);
      return (picked.pendingChoice?.options ?? []).flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : []));
    };
    // Control: without Dragnet both enemies are offered.
    expect(dealFour(withMinion.state)).toEqual(expect.arrayContaining([villain, withMinion.id]));
    const { state } = withCrimeCard(withMinion.state, DRAGNET, 5);
    expect(dealFour(state)).toEqual([withMinion.id]);
  });

  it("an event with another effect can still target the villain: Heroic Strike deals no damage but stuns it", () => {
    const { state: staged } = withCrimeCard(heroForm(), DRAGNET, 5);
    const villain = activeVillain(staged).instanceId;
    const conjured = conjure(staged, HEROIC_STRIKE, STRENGTH);
    const [strike, strength] = conjured.ids as [InstanceId, InstanceId];
    const pay = [strength, ...payWith(conjured.state, P1, 1, [strike, strength])];
    expect(targetsOffered(conjured.state, strike, pay)).toContain(villain);
    // Paid with the [physical] resource (Strength), so the stun applies.
    const result = driveEventsPicking(deps, conjured.state, firstLegal, play(P1, strike, pay));
    expect(inst(result.state, villain).damage).toBe(0);
    expect(inst(result.state, villain).statuses.stunned).toBe(1);
  });

  it("Hero Action: spend X [physical] resources, remove X threat from this scheme", () => {
    const { state, id } = withCrimeCard(heroForm(), DRAGNET, 5);
    const paid = payAbility(state, id, ACTION, STRENGTH);
    expect(paid.ok && threatOn(paid.state, id)).toBe(3);
    expect(payAbility(state, id, ACTION, ENERGY).ok).toBe(false);
  });
});

describe("Elementary, My Dear Mojo (39040)", () => {
  const MOVE = "0";
  const DIG = "1";

  it("option 1: moves all threat from a side scheme to the main scheme, and that side scheme is defeated", () => {
    const { state: staged, id: scheme } = withCrimeCard(heroForm(), LAW_AND_ORDER, 4);
    const { state, events } = villainPhase(
      staged,
      [FILLER],
      ELEMENTARY,
      [FILLER_2, FILLER_3],
      pickingAt("chooseOption", MOVE),
    );
    expect(of(events, "schemeDefeated").map((e) => e.instanceId)).toEqual([scheme]);
    expect(cardsInPlay(state)).not.toContain(scheme);
    const placed = of(events, "threatPlaced").filter((e) => e.schemeInstanceId === state.mainScheme.instanceId);
    expect(placed.map((e) => e.amount)).toContain(4);
    expect(
      of(events, "threatRemoved")
        .filter((e) => e.schemeInstanceId === scheme)
        .map((e) => e.amount),
    ).toEqual([4]);
  });

  it("the side scheme is the player's choice when there are two", () => {
    const { state: one, id: first } = withCrimeCard(heroForm(), LAW_AND_ORDER, 4);
    const { state: staged, id: second } = withCrimeCard(one, DRAGNET, 2);
    const { state } = villainPhase(staged, [FILLER], ELEMENTARY, [FILLER_2, FILLER_3], (s) =>
      s.pendingChoice?.prompt.kind === "chooseOption" ? [MOVE] : picking(second)(s),
    );
    expect(cardsInPlay(state)).toContain(first);
    expect(cardsInPlay(state)).not.toContain(second);
    expect(threatOn(state, first)).toBe(4);
  });

  it("option 2: discards from the encounter deck until a side scheme is discarded, then reveals that card", () => {
    const { state, events } = villainPhase(
      heroForm(),
      [FILLER],
      ELEMENTARY,
      [FILLER_2, FILLER_3, DRAGNET, FILLER_2],
      pickingAt("chooseOption", DIG),
    );
    expect(inPlay(state, DRAGNET)).toHaveLength(1);
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toContain(DRAGNET);
    // The cards above it were discarded, not revealed.
    expect(revealed).not.toContain(FILLER_3);
    expect(threatOn(state, inPlay(state, DRAGNET)[0]!)).toBeGreaterThan(0);
  });

  it("option 1 is offered only while a side scheme is in play: with none, the deck is dug without a prompt", () => {
    const { state } = villainPhase(heroForm(), [FILLER], ELEMENTARY, [FILLER_2, DRAGNET, FILLER_2]);
    expect(inPlay(state, DRAGNET)).toHaveLength(1);
  });

  it("a greedy first-listed pick takes the scheme move when a side scheme is in play (the default)", () => {
    const { state: staged, id: scheme } = withCrimeCard(heroForm(), LAW_AND_ORDER, 3);
    const { state } = villainPhase(staged, [FILLER], ELEMENTARY);
    expect(cardsInPlay(state)).not.toContain(scheme);
  });
});
