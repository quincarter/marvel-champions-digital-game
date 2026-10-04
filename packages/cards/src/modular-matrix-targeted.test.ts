/**
 * Rules-QA 2026-10-04: modular encounter set cards that assume their home scenario, played in a scenario where the named
 * villain, scheme, attachment or card is absent, and in scenarios whose "the villain" / "the encounter deck" is not a
 * single ordinary thing (Tower Defense's several villains, Kang's separate game areas, Mansion Attack's random villain).
 *
 * RRG 1.8 "Modular Encounter Set" (p. 29): modular sets "can be added to and/or removed from nearly any scenario"; Appendix VI
 * (p. 71): "A group may choose to play any scenario with any modular encounter sets". A card's text is therefore its own
 * fallback: "If X is not in play, search ... " must find nothing and carry on, "If you cannot, this card gains surge"
 * must surge, and a search that finds nothing still shuffles (RRG "Search", p. 39).
 *
 * Every test names the printed text it proves. Hosts: Rhino (Core, built through the staged workaround for a pool gap,
 * findings F1/F2 in `modular-matrix.test.ts`: only the cards are staged, not behavior), Sandman and Tower Defense.
 */
import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "./playable/index.js";
import { applyOk, firstLegal, inst, P1 } from "./testing/harness.js";
import { revealOnTurnEnd, startPairing } from "./testing/modular-matrix.js";

const inPlay = (state: GameState, code: string): InstanceId[] =>
  cardsInPlay(state).filter((id) => state.instances[id]!.cardId === cardId(code));
const inVillainArea = (state: GameState, code: string): InstanceId[] =>
  state.villainArea.filter((id) => state.instances[id]!.cardId === cardId(code));
const piles = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!;
const inPiles = (state: GameState, code: string): InstanceId[] =>
  [...piles(state).deck, ...piles(state).discard].filter((id) => state.instances[id]!.cardId === cardId(code));
const revealedCodes = (events: readonly GameEvent[]): string[] =>
  events.flatMap((event) => (event.type === "encounterCardRevealed" ? [event.cardId as string] : []));
/** Takes every instance of `code` out of the encounter deck and discard pile (and out of the game). */
function withoutCard(state: GameState, code: string): GameState {
  const gone = new Set(inPiles(state, code));
  const key = activeEncounterDeckId(state);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [key]: {
        deck: piles(state).deck.filter((id) => !gone.has(id)),
        discard: piles(state).discard.filter((id) => !gone.has(id)),
      },
    },
    removedFromGame: [...state.removedFromGame, ...gone],
  };
}
/** Reveals the first copy of `code` in the encounter piles on turn end. */
function reveal(state: GameState, code: string, form: "hero" | "alterEgo" = "hero") {
  const id = inPiles(state, code)[0];
  if (!id) throw new Error(`no ${code} in the encounter piles`);
  return { id, ...revealOnTurnEnd(state, id, { form }) };
}

describe("Zero Tolerance and Sentinels away from Master Mold and Project Wideawake", () => {
  it("Sentinel Mark II (32101) with Operation Zero Tolerance (32104) in the deck: searches it out and reveals it", () => {
    // 32101: "If Operation Zero Tolerance is in play, [this] gains surge. Otherwise, search the encounter deck and discard
    // pile for the Operation Zero Tolerance side scheme and reveal it. (Shuffle.)"
    const run = reveal(startPairing("zero_tolerance", "rhino"), "32101");
    expect(run.revealed).toBe(true);
    expect(inVillainArea(run.state, "32104")).toHaveLength(1);
    expect(revealedCodes(run.events)).toContain("32104");
  });

  it("Sentinel Mark II with Operation Zero Tolerance already in play gains surge instead of searching", () => {
    const first = reveal(startPairing("zero_tolerance", "rhino"), "32101");
    const second = reveal(first.state, "32101");
    // Two copies of Mark II exist; the second is revealed with the scheme in play: it surges, so a further card follows it.
    expect(inVillainArea(second.state, "32104")).toHaveLength(1);
    const codes = revealedCodes(second.events);
    expect(codes.indexOf("32101")).toBeGreaterThanOrEqual(0);
    expect(codes.length).toBeGreaterThan(codes.indexOf("32101") + 1);
  });

  it("Sentinel Mark II with Operation Zero Tolerance nowhere to be found: the search finds nothing and the game goes on", () => {
    const base = withoutCard(startPairing("zero_tolerance", "rhino"), "32104");
    const run = reveal(base, "32101");
    expect(run.revealed).toBe(true);
    expect(inVillainArea(run.state, "32104")).toHaveLength(0);
    expect(inPlay(run.state, "32101")).toHaveLength(1);
    expect(run.state.pendingChoice).toBeNull();
  });

  it("Sentinel Mark V (32105) without Targeted for Elimination attached: searches it out, reveals it onto the identity", () => {
    // 32105: "If Targeted for Elimination is attached to your identity, [this] attacks you ... Otherwise, search the
    // encounter deck and discard pile for the Targeted for Elimination attachment and reveal it."
    const run = reveal(startPairing("sentinels", "rhino"), "32105");
    const [targeted] = inPlay(run.state, "32107");
    expect(targeted).toBeDefined();
    expect(inst(run.state, targeted!).attachedTo).not.toBeNull();
    expect(revealedCodes(run.events)).toContain("32107");
  });

  it("Sentinel Mark V with both Targeted for Elimination copies gone: nothing found, no throw", () => {
    const base = withoutCard(startPairing("sentinels", "rhino"), "32107");
    const run = reveal(base, "32105");
    expect(run.revealed).toBe(true);
    expect(inPlay(run.state, "32107")).toHaveLength(0);
    expect(run.state.pendingChoice).toBeNull();
  });
});

describe("Brotherhood, Acolytes and Exodus away from Mansion Attack, Magneto and Sabretooth", () => {
  it("Mutant Terrorists (32078): finds The Brotherhood side scheme (32079) and reveals it", () => {
    // 32078: "Search the encounter deck and discard pile for The Brotherhood side scheme and reveal it. (Shuffle.)"
    const run = reveal(startPairing("brotherhood", "rhino"), "32078");
    expect(inVillainArea(run.state, "32079")).toHaveLength(1);
  });

  it("Mutant Terrorists with The Brotherhood already in play: reveals a Brotherhood of Mutants minion instead", () => {
    // 32078: "If it did not enter play this way, discard cards from the top of the encounter deck until a Brotherhood of
    // Mutants minion is discarded and reveal it."
    const withScheme = reveal(startPairing("brotherhood", "rhino"), "32079");
    expect(inVillainArea(withScheme.state, "32079")).toHaveLength(1);
    const run = reveal(withScheme.state, "32078");
    const minions = ["32073", "32074", "32075", "32076"];
    expect(revealedCodes(run.events).some((code) => minions.includes(code))).toBe(true);
  });

  it("Zeal for the Cause (32164) engaged with no Acolyte: discards to the next minion and reveals it", () => {
    // 32164: "If you are not engaged with an Acolyte minion, discard cards from the encounter deck until a minion is
    // discarded, then reveal it."
    const run = reveal(startPairing("acolytes", "rhino"), "32164");
    const revealed = revealedCodes(run.events);
    expect(revealed.length).toBeGreaterThan(1);
  });

  it("Acolyte Frenzy (37035) in a game with no ACOLYTE minion at all: gains surge, as printed", () => {
    // 37035: "Each ACOLYTE minion engaged with you activates against you. If you are not engaged with an ACOLYTE minion,
    // this card gains surge." Exodus' set holds no ACOLYTE minion of its own.
    const run = reveal(startPairing("exodus", "rhino"), "37035");
    const codes = revealedCodes(run.events);
    expect(codes.indexOf("37035")).toBeGreaterThanOrEqual(0);
    expect(codes.length).toBeGreaterThan(codes.indexOf("37035") + 1);
  });
});

describe("Kang (Master of Time), Ronan the Accuser and Mystique outside their home scenarios", () => {
  it("Ancient Grudge (11051) with Kang (Master of Time) in the deck: puts him into play engaged with you", () => {
    // 11051: "Kang (Master of Time) activates against you. If Kang (Master of Time) is not in play, search the
    // encounter deck and discard pile for Kang (Master of Time) and put him into play engaged with you. Shuffle."
    const run = reveal(startPairing("mot", "rhino"), "11051");
    const [kang] = inPlay(run.state, "11047");
    expect(kang).toBeDefined();
    expect(inst(run.state, kang!).engagedWith).toBe(P1);
  });

  it("Bring the Hammer Down (90004) in Ronan the Accuser's own scenario: the villain counts as Ronan in play, so it does not surge (owner, Q-M1)", () => {
    // 90004: "If Ronan the Accuser is not in play, this card gains surge." The Ronan villain is in play; see
    // `modular-owner-answers.test.ts` for the minion that cannot enter beside him.
    const state = startPairing("kree_fanatic", "ronan-the-accuser");
    const run = reveal(state, "90004");
    const codes = revealedCodes(run.events);
    expect(codes.indexOf("90004")).toBeGreaterThanOrEqual(0);
    expect(codes.length).toBe(codes.indexOf("90004") + 1);
  });

  it("Mystique's treacheries stay in the hand in a scenario that is not a Mutant Genesis one (MC32 p. 7)", () => {
    // 32082: "After this card enters your hand, discard an ally or support you control." The set-wide `staysInHand` rule is
    // attached only by wave 6 builders, but the card's own hand-active Forced Response keeps it in the hand (`rules.ts`).
    const base = startPairing("mystique", "sandman", { heroForm: true });
    const id = inPiles(base, "32082")[0]!;
    const key = activeEncounterDeckId(base);
    const staged: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [key]: {
          deck: piles(base).deck.filter((other) => other !== id),
          discard: piles(base).discard.filter((other) => other !== id),
        },
      },
      players: base.players.map((p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand], deck: [id, ...p.deck] })),
      instances: { ...base.instances, [id]: { ...base.instances[id]!, faceup: false } },
    };
    let current = applyOk(staged, { type: "endTurn", playerId: P1 }, PLAYABLE_DEPS).state;
    const events: GameEvent[] = [];
    for (let guard = 0; current.pendingChoice && guard < 50; guard++) {
      const choice = current.pendingChoice;
      const result = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: firstLegal(current),
        },
        PLAYABLE_DEPS,
      );
      events.push(...result.events);
      current = result.state;
    }
    expect(current.players[0]!.hand).toContain(id);
    expect(current.players[0]!.dealtEncounter).toEqual([]);
  });

  it("Mystique (32080) in Rhino: players cannot attack the villain while she is in play", () => {
    // 32080: "Players cannot attack the villain."
    const run = reveal(startPairing("mystique", "rhino"), "32080");
    const state = run.state;
    expect(inPlay(state, "32080")).toHaveLength(1);
    const identity = state.players[0]!.identity.instanceId;
    const ready = {
      ...state,
      instances: { ...state.instances, [identity]: { ...state.instances[identity]!, exhausted: false } },
    };
    const attack = (target: InstanceId) =>
      applyCommand(
        ready,
        { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: target },
        PLAYABLE_DEPS,
      ).ok;
    expect(attack(state.activeVillainId!)).toBe(false);
    // She herself can still be attacked.
    expect(attack(inPlay(state, "32080")[0]!)).toBe(true);
  });
});

describe("Setting environments and attach-to-the-villain cards across scenarios", () => {
  it("Dial M for Mojo (39035, MojoMania) discards Back-Alley Enclave (24060, The Hood), both Setting environments", () => {
    // 39035: "When Revealed: Discard each other Setting environment in play." Both sets carry the SETTING trait.
    const created = createGame(
      playableScenario("ebony-maw", {
        seed: 1,
        players: [{ starterDeckId: "core-she-hulk-aggression" }],
        modularSetIds: ["streets_of_mayhem", "crime"],
      }),
      PLAYABLE_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    let state = created.state;
    for (let guard = 0; state.step.phase !== "player" && guard < 50; guard++) {
      const choice = state.pendingChoice!;
      state = applyOk(
        state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: firstLegal(state),
        },
        PLAYABLE_DEPS,
      ).state;
    }
    const enclave = reveal(state, "24060");
    expect(inPlay(enclave.state, "24060")).toHaveLength(1);
    const dial = reveal(enclave.state, "39035");
    expect(inPlay(dial.state, "24060")).toHaveLength(0);
    expect(inPlay(dial.state, "39035")).toHaveLength(1);
  });

  it.each(["tower-defense", "kang", "mansion-attack", "ronan-the-accuser"])(
    "Pumpkin Bombs (02034, 'Attach to the villain') in %s attaches to a villain of the game",
    (host) => {
      const run = reveal(startPairing("goblin_gimmicks", host), "02034");
      const attached = Object.values(run.state.instances).filter((i) => i.cardId === cardId("02034") && i.attachedTo);
      expect(attached).toHaveLength(1);
      expect(run.state.villains.map((v) => v.instanceId)).toContain(attached[0]!.attachedTo);
    },
  );

  it("Power Stone (16149, 'Setup. Attach to the villain') starts attached to the villain of a Core scenario", () => {
    const state = startPairing("power_stone", "rhino");
    const [stone] = inPlay(state, "16149");
    expect(inst(state, stone!).attachedTo).toBe(state.activeVillainId);
  });

  it("Power Stone in Tower Defense (two villains): attaches to one of them at setup step 11 (OPEN: the owner's 'first player chooses' bucket)", () => {
    // The card says "the villain". Tower Defense has two and no active villain at step 11: Focused Defense, attached to a
    // main scheme in the scenario's own Setup (step 12), names the active one. Owner, Q-M2: "the villain" is the active
    // villain where there is an active counter; with several and none, the first player chooses. Not built (setup step
    // 11 has no choice point for an attachment's host): the engine takes the first villain, Proxima Midnight.
    const state = startPairing("power_stone", "tower-defense");
    const [stone] = inPlay(state, "16149");
    expect(state.villains.map((v) => v.instanceId)).toContain(inst(state, stone!).attachedTo);
    expect(inst(state, stone!).attachedTo).toBe(state.villains[0]!.instanceId);
  });
});

describe("Infinity Gauntlet (21129) and its Infinity Stone deck", () => {
  const STONES = ["21130", "21131", "21132", "21133", "21134", "21135"];
  const stoneDeckOf = (state: GameState) => state.scenarioDecks["Infinity Stone"]?.deck ?? [];

  it("in a Mad Titan's Shadow scenario (Ebony Maw): the six stones are the Infinity Stone deck, the Gauntlet is on the villain", () => {
    // MC21 p. 16: "shuffle the six Infinity Stone environment cards together and set them aside, facedown."
    const state = startPairing("infinity_gauntlet", "ebony-maw");
    expect(stoneDeckOf(state)).toHaveLength(6);
    const [gauntlet] = inPlay(state, "21129");
    expect(inst(state, gauntlet!).attachedTo).toBe(state.activeVillainId);
  });

  // F7 (fixed): the stone deck is built from the set, in every scenario.
  it.each(["sandman", "infiltrate-the-museum", "magneto", "rhino", "kang", "venom", "magog"])(
    "F7: in %s the stones are the Infinity Stone deck, not shuffled into the encounter deck (MC21 p. 16)",
    (host) => {
      const state = startPairing("infinity_gauntlet", host);
      expect(stoneDeckOf(state)).toHaveLength(6);
      for (const code of STONES) expect(inPiles(state, code), code).toEqual([]);
    },
  );
});

describe("Ship Command's Milano cannot be exhausted: the printed choices do not offer it (F4, fixed)", () => {
  // RRG 1.8 "Choose (Option)" (p. 12): "When an encounter card requires a player to choose an option, they cannot choose an
  // option that requires one or more targets if there are no valid targets for that option." The Milano is in play
  // since F3, so the game is staged without it. (The hero phase's ready step readies an exhausted Milano before the villain phase
  // deals the card, so "exhausted" cannot be staged here; Escape the Museum's Museum Ship covers that gate.)
  const withoutMilano = (state: GameState): GameState => {
    const milano = inPlay(state, "16142")[0]!;
    const { [milano]: _gone, ...instances } = state.instances;
    return {
      ...state,
      instances,
      players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== milano) })),
    };
  };
  const offeredAt = (state: GameState, code: string): string[] => {
    const offered: string[] = [];
    revealOnTurnEnd(state, inPiles(state, code)[0]!, {
      form: "hero",
      pick: (current) => {
        for (const option of current.pendingChoice!.options) offered.push(option.label);
        return firstLegal(current);
      },
    });
    return offered;
  };

  it.each(["16145", "16146", "16147", "16148"])("%s offers 'Exhaust the Milano' while the Milano is ready", (code) => {
    const state = startPairing("ship_command", "rhino");
    expect(inPlay(state, "16142")).toHaveLength(1);
    expect(offeredAt(state, code).filter((label) => label.includes("Milano"))).toHaveLength(1);
  });

  it.each(["16145", "16146", "16147", "16148"])("%s does not offer it with no Milano in play", (code) => {
    const state = withoutMilano(startPairing("ship_command", "rhino"));
    expect(inPlay(state, "16142")).toHaveLength(0);
    expect(offeredAt(state, code).filter((label) => label.includes("Milano"))).toEqual([]);
  });
});

describe("modular picks the builders check (F5, F6, fixed)", () => {
  const seat = [{ starterDeckId: "core-she-hulk-aggression" }] as const;
  const builds = (scenario: string, modularSetIds: readonly string[]): boolean => {
    try {
      return createGame(playableScenario(scenario, { seed: 1, players: [...seat], modularSetIds }), PLAYABLE_DEPS).ok;
    } catch {
      return false;
    }
  };

  it("a scenario with a modular pool does check (MaGog, Spiral): Standard, nemesis and repeated picks are refused (control for F5)", () => {
    expect(builds("magog", ["standard"])).toBe(false);
    expect(builds("magog", ["colossus_nemesis"])).toBe(false);
    expect(builds("spiral", ["crime", "crime", "horror"])).toBe(false);
  });

  // F5 (fixed): every builder checks its picks (`chosenModularSetIds`); before, a scenario without a pool shuffled in whatever it
  // was told. Each case is pinned on its own.
  it.each([
    ["sandman", ["sandman"], "its own villain set"],
    ["mansion-attack", ["mansion_attack"], "its own villain set"],
    ["sandman", ["standard"], "the Standard set (RRG p. 40: not a modular set)"],
    ["sandman", ["colossus_nemesis"], "a hero's nemesis set (RRG p. 30)"],
    ["ebony-maw", ["exodus", "exodus"], "the same set twice (RRG p. 29: an entire set)"],
    ["nebula", ["ship_command"], "a set the scenario already requires"],
  ] as const)("F5: %s refuses %j (%s)", (scenario, picks, _why) => {
    expect(builds(scenario, picks)).toBe(false);
  });

  // F6 (fixed): scenarios that take no modular set refuse a pick instead of dropping (Hood, Breakout) or adding it (Sinister Six).
  it.each(["the-hood", "breakout", "sinister-six"])(
    "F6: %s takes no modular set and refuses a pick instead of dropping or adding it",
    (scenario) => {
      expect(builds(scenario, ["bomb_scare"])).toBe(false);
    },
  );

  it("F6: Tower Defense refuses the Infinity Gauntlet set (MC21 p. 16: 'cannot be used' with more than one villain)", () => {
    expect(builds("tower-defense", ["infinity_gauntlet"])).toBe(false);
  });
});
