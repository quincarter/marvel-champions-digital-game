import { encounterSetId, type DifficultySetChoice } from "@mc/content";
import { applyCommand, hasKeyword, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, firstLegal, identityOf, instancesOf, patchInstance, playerOf } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { startWave4Game, WAVE4_DEPS } from "../testing.js";
import { wave4Scenario } from "../setup.js";
import { deckId, heroified, minionEngagedWith, stackTop, villainId, withoutDealtCards } from "./testing.js";

/**
 * Real-game tests for Standard II / Expert II (`standard-expert-ii.ts`; docs/phase7-wave4.md §4 Q5), each card staged as
 * P1's villain-phase encounter card in a game built with the alternative sets. Assertions read the events the card
 * itself caused (`sourceInstanceId`, `encounterCardRevealed`, `attackResolved`, `schemeResolved`), so the villain's own
 * activation and the main scheme's step-one threat do not blur the numbers.
 *
 * Ref -> covering test:
 *  24029.when-revealed / 24029.boost                      -> "Cruel Intentions ..."
 *  24030.when-revealed                                    -> "Ruination ..."
 *  24031.when-revealed                                    -> "Seek and Destroy ..."
 *  24032.when-revealed / 24032.boost                      -> "Slug It Out ..."
 *  24049a.formidable-foe-constant / 24049b.formidable-foe-constant -> "Formidable Foe ..."
 *  24050.when-revealed / 24050.boost                      -> "Dark Dealings ..."
 *  24051.when-revealed-alter-ego / 24051.when-revealed-hero -> "Mob Mentality ..."
 *  24052.when-revealed / 24052.boost                      -> "Overwhelming Force ..."
 *  24054.when-revealed-hero / 24054.boost                 -> "Total Annihilation ..."
 */

const STANDARD_II: DifficultySetChoice = { standard: encounterSetId("standard_ii") };
const BOTH_II: DifficultySetChoice = { standard: encounterSetId("standard_ii"), expert: encounterSetId("expert_ii") };

/** A Hood game on the alternative sets with no dealt cards and an empty main scheme (so no villain phase advances it). */
const hoodGame = (opts: { expert?: boolean; seed?: number; players?: number; sets?: DifficultySetChoice } = {}) =>
  emptyMainScheme(
    withoutDealtCards(
      startWave4Game(
        wave4Scenario("the-hood", {
          seed: opts.seed ?? 1,
          difficulty: opts.expert ? "expert" : "standard",
          difficultySets: opts.sets ?? (opts.expert ? BOTH_II : STANDARD_II),
          players: Array.from({ length: opts.players ?? 1 }, () => ({ starterDeckId: "core-spider-man-justice" })),
        }),
      ),
    ),
  );
const emptyMainScheme = (state: GameState): GameState =>
  patchInstance(state, state.mainScheme.instanceId, { threat: 0 });

/** A card with no boost star and one boost icon (Upper Hand) on top absorbs the villain's own boost draw. */
const BOOST_FILLER = "24013";
/** Quiet cards to reveal after a surge: each only attaches (Established Dominance to P1, The Hood's Mantle to The Hood). */
const QUIET = ["24007", "24008"] as const;

/** Stacks `boost filler, code, ...after` and ends P1's turn, collecting every event of the villain phase. */
function villainPhaseRevealing(state: GameState, code: string, after: readonly string[] = []) {
  const staged = stackTop(state, BOOST_FILLER, code, ...after);
  const top = staged.encounterDecks[deckId(staged)]!.deck[1]!;
  const { state: next, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
  return { state: next, events, id: top };
}

/**
 * Stacks exactly `codes` on the encounter deck and ends P1's turn, answering each defender prompt in turn from
 * `defenders` (an instance id to defend with, or "decline"; declined once the list runs out) and everything else with
 * `firstLegal`. Returns every event of the villain phase.
 */
function villainPhaseWith(state: GameState, codes: readonly string[], defenders: readonly string[] = []) {
  const staged = stackTop(state, ...codes);
  let asked = 0;
  const pick = (s: GameState): readonly string[] => {
    if (s.pendingChoice?.prompt.kind === "declareDefender") return [defenders[asked++] ?? "decline"];
    return firstLegal(s);
  };
  const events: GameEvent[] = [];
  let current = staged;
  const first = applyCommand(current, { type: "endTurn", playerId: P1 }, WAVE4_DEPS);
  if (!first.ok) throw new Error(first.error.message);
  current = first.state;
  events.push(...first.events);
  while (current.pendingChoice && !current.outcome) {
    const choice = current.pendingChoice;
    const next = applyCommand(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(current) },
      WAVE4_DEPS,
    );
    if (!next.ok) throw new Error(next.error.message);
    current = next.state;
    events.push(...next.events);
  }
  return { state: current, events, staged };
}

const from = (events: readonly GameEvent[], source: InstanceId) =>
  events.filter((e) => "sourceInstanceId" in e && e.sourceInstanceId === source);
const revealed = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.cardId as string] : []));
const attacks = (events: readonly GameEvent[]) => events.flatMap((e) => (e.type === "attackResolved" ? [e] : []));

describe("Standard II / Expert II setup (The Hood insert p. 2, 'Alternative Sets')", () => {
  it("Standard II replaces Standard; Expert II replaces Expert; the printed sets are the default", () => {
    const setOf = (config: ReturnType<typeof wave4Scenario>) => new Set(config.encounterDeck.map(String));
    const printed = setOf(
      wave4Scenario("the-hood", { seed: 1, players: [{ starterDeckId: "core-spider-man-justice" }] }),
    );
    expect(printed.has("01186")).toBe(true); // Advance (Standard).
    expect(printed.has("24050")).toBe(false);
    const alt = setOf(
      wave4Scenario("the-hood", {
        seed: 1,
        difficulty: "expert",
        difficultySets: BOTH_II,
        players: [{ starterDeckId: "core-spider-man-justice" }],
      }),
    );
    expect(alt.has("01186")).toBe(false);
    expect(alt.has("01191")).toBe(false); // Exhaustion (Expert).
    expect(alt.has("24050")).toBe(true);
    expect(alt.has("24029")).toBe(true);
    // A Core scenario played from the wave 4 pool takes the same choice (the insert: "when a scenario requires").
    const rhino = setOf(
      wave4Scenario("rhino", {
        seed: 1,
        difficultySets: STANDARD_II,
        players: [{ starterDeckId: "core-spider-man-justice" }],
      }),
    );
    expect(rhino.has("24050")).toBe(true);
    expect(rhino.has("01186")).toBe(false);
  });

  it("a choice that names a set of the wrong classification is refused", () => {
    expect(() =>
      wave4Scenario("the-hood", {
        seed: 1,
        difficultySets: { standard: encounterSetId("expert_ii") },
        players: [{ starterDeckId: "core-spider-man-justice" }],
      }),
    ).toThrow(/not in the standard classification/);
  });
});

describe("Expert II (24029-24032)", () => {
  it("Cruel Intentions 24029.when-revealed: P1 is dealt 1 more card (revealed this phase) and The Hood gets 1 facedown boost card; surge reveals 1 more", () => {
    const base = hoodGame({ expert: true });
    const { state, events } = villainPhaseRevealing(base, "24029", QUIET);
    // Cruel Intentions, then its surge card and the card it dealt: three cards revealed by P1 this phase.
    expect(revealed(events)).toHaveLength(3);
    expect(revealed(events)[0]).toBe("24029");
    const outside = events.filter((e) => e.type === "boostCardDealt" && e.outsideActivation);
    expect(outside).toHaveLength(1);
    expect(state.instances[villainId(state)]!.boostCards).toHaveLength(1);
  });

  it("Cruel Intentions 24029.boost: as the villain's boost card it deals P1 exactly 1 facedown encounter card", () => {
    const base = heroified(hoodGame({ expert: true }), P1);
    const staged = stackTop(base, "24029", ...QUIET);
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    // The villain phase deals P1 one card (Established Dominance); the boost deals one more (The Hood's Mantle).
    expect(revealed(events)).toEqual(["24007", "24008"]);
  });

  it("Ruination 24030.when-revealed: incite 1, discards to a side scheme, reveals it, then 2 threat on each scheme", () => {
    // Hero form: The Hood attacks rather than schemes, so the main scheme stays short of its 5 target threat.
    const base = heroified(hoodGame({ expert: true }), P1);
    // Unbridled Ambition (24011) is the side scheme discarded to; a quiet card sits above it.
    const { state, events, id } = villainPhaseRevealing(base, "24030", ["24007", "24011"]);
    const main = state.mainScheme.instanceId;
    const side = instancesOf(state, "24011")[0]!;
    const placed = from(events, id).flatMap((e) => (e.type === "threatPlaced" ? [[e.schemeInstanceId, e.amount]] : []));
    expect(placed).toEqual([
      [main, 1], // Incite 1.
      [main, 2],
      [side, 2],
    ]);
    // Unbridled Ambition: its starting 2, hinder 2 (one player), and Ruination's 2.
    expect(state.instances[side]!.threat).toBe(6);
    expect(state.encounterDecks[deckId(state)]!.discard.some((i) => state.instances[i]!.cardId === "24007")).toBe(true);
  });

  it("Seek and Destroy 24031.when-revealed: P1's set-aside nemesis minion (Vulture) enters play engaged with P1; the rest stays set aside", () => {
    const base = heroified(hoodGame({ expert: true }), P1);
    const setAsideBefore = playerOf(base, P1).setAside.length;
    const { state } = villainPhaseRevealing(base, "24031", []);
    const vulture = instancesOf(state, "01167")[0]!; // Spider-Man's nemesis minion.
    expect(playerOf(state, P1).playArea).toContain(vulture);
    expect(state.instances[vulture]!.engagedWith).toBe(P1);
    expect(playerOf(state, P1).setAside).toHaveLength(setAsideBefore - 1);
  });

  it("Seek and Destroy 24031.when-revealed: with the nemesis minion already in play, nothing enters play", () => {
    const base = heroified(hoodGame({ expert: true }), P1);
    const vulture = playerOf(base, P1).setAside.find((i) => base.instances[i]!.cardId === "01167")!;
    const inPlay: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1
          ? { ...p, setAside: p.setAside.filter((i) => i !== vulture), playArea: [...p.playArea, vulture] }
          : p,
      ),
      instances: { ...base.instances, [vulture]: { ...base.instances[vulture]!, faceup: true, engagedWith: P1 } },
    };
    const setAsideBefore = playerOf(inPlay, P1).setAside.length;
    const { state } = villainPhaseRevealing(inPlay, "24031", []);
    expect(instancesOf(state, "01167")).toEqual([vulture]);
    expect(playerOf(state, P1).setAside).toHaveLength(setAsideBefore);
  });

  it("Slug It Out 24032.when-revealed: exhausts P1's hero and deals it exactly 2 damage", () => {
    const base = heroified(hoodGame({ expert: true }), P1);
    const hero = identityOf(base, P1);
    const { state, events, id } = villainPhaseRevealing(base, "24032", QUIET);
    expect(state.instances[hero]!.exhausted).toBe(true);
    const dealt = from(events, id).flatMap((e) => (e.type === "damageDealt" ? [[e.targetInstanceId, e.amount]] : []));
    expect(dealt).toEqual([[hero, 2]]);
  });

  it("Slug It Out 24032.boost: 1 damage to each character P1 controls, and The Hood flips one more boost card", () => {
    const base = heroified(hoodGame({ expert: true }), P1);
    const hero = identityOf(base, P1);
    const staged = stackTop(base, "24032", "24013", ...QUIET);
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    const slug = staged.encounterDecks[deckId(staged)]!.deck[0]!;
    expect(
      from(events, slug).flatMap((e) => (e.type === "damageDealt" ? [[e.targetInstanceId, e.amount]] : [])),
    ).toEqual([[hero, 1]]);
    const flipped = events.filter((e) => e.type === "boostCardFlipped");
    expect(flipped).toHaveLength(2); // Slug It Out, then the additional Upper Hand.
  });
});

describe("Standard II (24049-24054)", () => {
  it("Formidable Foe 24049a.formidable-foe-constant: in standard mode the villain gains steady, a minion does not", () => {
    const base = hoodGame();
    const minion = minionEngagedWith(base, "24010", P1); // Madame Masque.
    expect(hasKeyword(minion.state, villainId(minion.state), "steady", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(minion.state, minion.id, "steady", WAVE4_DEPS)).toBe(false);
  });

  it("Formidable Foe 24049b.formidable-foe-constant: in expert mode each enemy gains steady", () => {
    const base = hoodGame({ expert: true });
    const minion = minionEngagedWith(base, "24010", P1);
    expect(hasKeyword(minion.state, villainId(minion.state), "steady", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(minion.state, minion.id, "steady", WAVE4_DEPS)).toBe(true);
  });

  it("Dark Dealings 24050.when-revealed: The Hood schemes with +1 SCH", () => {
    const base = hoodGame();
    const { events } = villainPhaseRevealing(base, "24050", []);
    const schemes = events.flatMap((e) => (e.type === "schemeResolved" ? [e] : []));
    // The villain phase's own scheme (alter ego) at SCH 1, then Dark Dealings' at SCH 1 + 1.
    expect(schemes.map((s) => s.baseSch)).toEqual([1, 2]);
  });

  it("Dark Dealings 24050.boost: The Hood flips one more boost card", () => {
    const base = hoodGame();
    const staged = stackTop(base, "24050", "24013", ...QUIET);
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(events.filter((e) => e.type === "boostCardFlipped")).toHaveLength(2);
    const scheme = events.find((e) => e.type === "schemeResolved");
    expect(scheme?.type === "schemeResolved" && scheme.boostIcons).toBe(1 + 1); // Dark Dealings 1 + Upper Hand 1.
  });

  it("Mob Mentality 24051.when-revealed-alter-ego: discards 7 and puts the first minion discarded into play engaged with P1", () => {
    const base = hoodGame();
    // Top 7 after Mob Mentality: two quiet cards, then Madame Masque (24010) third.
    const { state } = villainPhaseRevealing(base, "24051", ["24007", "24008", "24010"]);
    const masque = instancesOf(state, "24010")[0]!;
    expect(playerOf(state, P1).playArea).toContain(masque);
    expect(state.instances[masque]!.engagedWith).toBe(P1);
    expect(state.encounterDecks[deckId(state)]!.discard.some((i) => state.instances[i]!.cardId === "24008")).toBe(true);
  });

  it("Mob Mentality 24051.when-revealed-hero: The Hood and each minion engaged with P1 attack; the card surges", () => {
    const base = heroified(hoodGame(), P1);
    const masque = minionEngagedWith(base, "24010", P1);
    // Only the villain takes boost cards (Upper Hand for each of its two attacks); Established Dominance is the surge
    // card.
    const { events } = villainPhaseWith(masque.state, ["24013", "24051", "24013", "24007"]);
    const attackers = attacks(events).map((a) => a.enemyInstanceId);
    // Activation phase: The Hood, then Madame Masque; Mob Mentality: The Hood, then Madame Masque again.
    expect(attackers).toEqual([villainId(base), masque.id, villainId(base), masque.id]);
    expect(revealed(events)).toEqual(["24051", "24007"]);
  });

  it("Overwhelming Force 24052.when-revealed: discards the highest-cost upgrade or support P1 controls", () => {
    const base = hoodGame();
    const withCards = playInPlay(playInPlay(base, "01091", "support"), "01006", "support"); // Avengers Mansion (4), Aunt May (1).
    const { state } = villainPhaseRevealing(withCards, "24052", []);
    expect(instancesOf(state, "01091").some((i) => playerOf(state, P1).playArea.includes(i))).toBe(false);
    expect(instancesOf(state, "01006").some((i) => playerOf(state, P1).playArea.includes(i))).toBe(true);
  });

  it("Overwhelming Force 24052.when-revealed: with no upgrade or support it gains surge", () => {
    const base = hoodGame();
    const { events } = villainPhaseRevealing(base, "24052", ["24007"]);
    expect(revealed(events)).toEqual(["24052", "24007"]);
  });

  it("Overwhelming Force 24052.boost: The Hood flips one more boost card", () => {
    const base = hoodGame();
    const staged = stackTop(base, "24052", "24013", ...QUIET);
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(events.filter((e) => e.type === "boostCardFlipped")).toHaveLength(2);
  });

  it("Total Annihilation 24054.when-revealed-hero: The Hood attacks P1 with overkill (excess past a defending ally spills to the hero)", () => {
    const { state: hurt, ally } = blackCatAtOneHitPoint();
    const hero = identityOf(hurt, P1);
    // The activation attack (Upper Hand boost) goes undefended; Total Annihilation's attack draws Unbridled Ambition
    // (2 boost icons): ATK 1 + 2 = 3 against Black Cat's 1 remaining hit point, 2 spilling onto Spider-Man. The surge
    // card is Established Dominance.
    const { events } = villainPhaseWith(hurt, ["24013", "24054", "24011", "24007"], ["decline", ally]);
    const spills = events.flatMap((e) => (e.type === "overkillSpilled" ? [e] : []));
    expect(spills).toHaveLength(1);
    expect(spills[0]).toMatchObject({ amount: 2 });
    const dealt = from(events, villainId(hurt)).flatMap((e) =>
      e.type === "damageDealt" ? [[e.targetInstanceId, e.amount]] : [],
    );
    // The activation attack, undefended: ATK 1 + 1 boost icon. Then Total Annihilation's attack of 3 against Black Cat
    // (1 remaining), the excess 2 dealt to Spider-Man by overkill.
    expect(dealt).toEqual([
      [hero, 2],
      [ally, 3],
      [hero, 2],
    ]);
  });

  it("Total Annihilation 24054.boost: while The Hood is attacking, that attack gains overkill", () => {
    const { state: hurt, ally } = blackCatAtOneHitPoint();
    // Total Annihilation is The Hood's boost card (1 icon): ATK 1 + 1 = 2 against Black Cat's 1 remaining, 1 spills.
    const { events } = villainPhaseWith(hurt, ["24054", "24007", "24008"], [ally]);
    const spills = events.flatMap((e) => (e.type === "overkillSpilled" ? [e] : []));
    expect(spills).toHaveLength(1);
    expect(spills[0]).toMatchObject({ amount: 1 });
  });
});

/** Hero-form P1 with Black Cat (01002, 2 hit points) in play at 1 remaining hit point. */
function blackCatAtOneHitPoint(): { readonly state: GameState; readonly ally: InstanceId } {
  const withAlly = playInPlay(heroified(hoodGame(), P1), "01002", "ally");
  const ally = instancesOf(withAlly, "01002").find((i) => playerOf(withAlly, P1).playArea.includes(i))!;
  return { state: patchInstance(withAlly, ally, { damage: 1 }), ally };
}

/** Puts a copy of `code` from P1's deck or hand into play under P1's control (test-only surgery). */
function playInPlay(state: GameState, code: string, _kind: "support" | "upgrade" | "ally"): GameState {
  const player = playerOf(state, P1);
  const id = [...player.hand, ...player.deck].find((i) => state.instances[i]!.cardId === code);
  if (!id) throw new Error(`no ${code} in P1's hand or deck`);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== id),
            deck: p.deck.filter((i) => i !== id),
            playArea: [...p.playArea, id],
          }
        : p,
    ),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: P1 } },
  };
}
