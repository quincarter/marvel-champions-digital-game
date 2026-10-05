import {
  applyCommand,
  cardOf,
  createGame,
  printedResources,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, stackSetAside, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { PSYLOCKE_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Psylocke's obligation and nemesis set (41025-41029), docs/phase7-wave7.md §7.2, §3.64-§3.66, §3.70. Her real precon
 * (`psylocke-justice`) against Stryfe through `wave7Scenario` with the real registry. Nemesis cards sit in the
 * set-aside area until revealed; the obligation sits in the encounter deck. Owner rulings: Q39 = C ([mental] resources
 * on cards you control count cards in play, hand, deck and discard pile), Q40 = B (a printed wild icon matches any
 * named resource type), Q43 = A (Body Swapped exhausts every PSI-ENERGY upgrade). Printed [mental] icons of the
 * precon's cards used as fixtures: Mental Detection 41005, Psionic Redirect 41006, Captain Britain 41012 and Upside
 * the Head 41015 print one each; Flurry of Blades 41004 and Telepathic Suggestion 41007 print [energy], Concussive
 * Blow 41014 [physical], Angel 41003 one [wild]. A Psi-Knife shows [mental], a Psi-Katana [physical].
 */
const BODY_SWAPPED = "41025";
const CHIMERA = "41026";
const PLUNDER = "41027";
const ILLUSION = "41028";
const DRAGON = "41029";
const SWAPPED_CONSTANT = "41025.obligation";
const SWAPPED_ACTION = "41025.body-swapped-action";
const CONTROL = "41001a.star-psi-energy-control";
const BLADE = "41002a";
const MENTAL_DETECTION = "41005";
const PSIONIC_REDIRECT = "41006";
const BRITAIN = "41012";
const UPSIDE = "41015";
const FLURRY = "41004";
const SUGGESTION = "41007";
const BLOW = "41014";
const ANGEL = "41003";
const TRAINING = "41008"; // Training Regimen: a support, not PSIONIC, [physical]
const MARTIAL_ARTS = "41009"; // Martial Arts Training: an upgrade, [physical]
const HIGH_KICK = "41019"; // Directed Force: [physical]; padding with Float Like a Butterfly 41017, [energy]
const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof PSYLOCKE | typeof SPIDER_MAN;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const bladesOf = (s: GameState, p = P1): InstanceId[] =>
  inst(s, identityOf(s, p)).attachments.filter((id) => codeOf(s, id) === BLADE);
const faces = (s: GameState, p = P1): boolean[] => bladesOf(s, p).map((id) => inst(s, id).flipped);
const exhaustedBlades = (s: GameState, p = P1): boolean[] => bladesOf(s, p).map((id) => inst(s, id).exhausted);
const damageOf = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
const isIn = (list: readonly InstanceId[], id: InstanceId): boolean => list.includes(id);
const encounterDiscard = (s: GameState): InstanceId[] => Object.values(s.encounterDecks).flatMap((d) => d.discard);
const handCodes = (s: GameState, p = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const statusOf = (s: GameState, id: InstanceId, status: "confused" | "stunned" | "tough"): number =>
  inst(s, id).statuses[status] ?? 0;

/** Psylocke (seat 1, alter-ego) in a fresh Stryfe game, Stryfe's starting tough card removed. */
function baseGame(players: readonly Seat[] = [PSYLOCKE], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  // Headroom on the main scheme (a negative count, surgery): Stryfe's Forced Response places threat per card of the most
  // common type in her hand, and the tests' hands would complete a 9-threat scheme and end the game before the nemesis
  // card is revealed.
  const lowered = patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
  return patchInstance(lowered, stryfe(lowered), {
    statuses: { ...inst(lowered, stryfe(lowered)).statuses, tough: 0 },
  });
}
const heroGame = (players?: readonly Seat[], seed = 1): GameState => {
  const base = withForm(baseGame(players, seed), { heroForm: 0 });
  return players && players.length > 1 ? withForm(base, { heroForm: 0 }, P2) : base;
};

/** The blades' faces by play order: `true` is Psi-Katana, `false` Psi-Knife. */
function blades(state: GameState, shown: readonly [boolean, boolean], player: PlayerId = P1): GameState {
  return bladesOf(state, player).reduce((s, id, i) => patchInstance(s, id, { flipped: shown[i]! }), state);
}
const KNIVES = [false, false] as const;
const MIXED = [false, true] as const;
const KATANAS = [true, true] as const;

const PAD = [HIGH_KICK, HIGH_KICK, HIGH_KICK, "41017", "41017", "41017"];

/**
 * Test-only surgery: `player`'s hand, deck (top first) and discard pile become exactly these cards, taken from their
 * hand, deck and discard pile; every other card leaves those zones (so none of them is counted or drawn).
 */
function arrange(
  state: GameState,
  zones: { hand?: readonly string[]; deck?: readonly string[]; discard?: readonly string[] },
  player: PlayerId = P1,
  pad = true,
): GameState {
  const owner = playerOf(state, player);
  const pool = [...owner.hand, ...owner.deck, ...owner.discard];
  const taken = new Set<InstanceId>();
  const take = (code: string): InstanceId => {
    const id = pool.find((i) => !taken.has(i) && codeOf(state, i) === code);
    if (!id) throw new Error(`no ${code} left for ${player}`);
    taken.add(id);
    return id;
  };
  const hand = (zones.hand ?? []).map(take);
  // Padding at the bottom of the deck (no [mental] icon) so the end-of-turn draw never empties it: an empty deck is a
  // deck reset that deals an encounter card. Draws move cards between hand and deck, which both count.
  const deck = [...(zones.deck ?? []), ...(pad ? PAD : [])].map(take);
  const discard = (zones.discard ?? []).map(take);
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, hand, deck, discard } : p)),
  };
}

/** Puts the encounter card `id` behind the `n` cards now on top of the active encounter deck. */
function behind(state: GameState, id: InstanceId, n: number): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const rest = pile.deck.filter((x) => x !== id);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...rest.slice(0, n), id, ...rest.slice(n)] },
    },
  };
}
const endPhase = (state: GameState): Command[] => state.players.map((p) => endTurn(p.playerId));

type Revealed = { state: GameState; events: readonly GameEvent[]; id: InstanceId };
/** Reveals set-aside nemesis `code` to `player` in the villain phase, `fillers` cards ahead of it (boosts, earlier deals). */
function reveal(
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  fillers = state.players.length,
  player: PlayerId = P1,
): Revealed {
  const id = playerOf(state, player).setAside.find((i) => codeOf(state, i) === code)!;
  const set = stackSetAside(state, code, player);
  const driven = driveEventsPicking(WAVE7_DEPS, behind(set, id, fillers), pick, ...endPhase(set));
  return { ...driven, id };
}
/** Reveals the obligation, which sits in the encounter deck. */
function revealObligation(state: GameState, pick: Picker = firstLegal, fillers = state.players.length): Revealed {
  const id = instancesOf(state, BODY_SWAPPED)[0]!;
  const driven = driveEventsPicking(WAVE7_DEPS, behind(state, id, fillers), pick, ...endPhase(state));
  return { ...driven, id };
}

/** Puts nemesis minion `code` (from `owner`'s set-aside area) into play engaged with `player`, in their play area. */
function minionEngaged(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  owner: PlayerId = P1,
): { state: GameState; id: InstanceId } {
  const id = playerOf(state, owner).setAside.find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((i) => i !== id),
        playArea: p.playerId === player ? [...p.playArea, id] : p.playArea,
      })),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: player, exhausted: false },
      },
    },
  };
}

/** Printed [mental] icons on the cards of `player` that Chimera and the Dragon count (Q39 = C), by the engine's data. */
function mentalOf(state: GameState, player: PlayerId): number {
  const owner = playerOf(state, player);
  // In play: her identity, her play area and what is attached to those, under her control.
  const roots = [identityOf(state, player), ...owner.playArea];
  const inPlay = [...new Set([...roots, ...roots.flatMap((id) => inst(state, id).attachments)])].filter(
    (id) => state.instances[id]!.controllerId === player,
  );
  return [...owner.hand, ...owner.deck, ...owner.discard, ...inPlay].reduce(
    (sum, id) => sum + (cardOf(state, id) ? printedResources(cardOf(state, id)!).mental : 0),
    0,
  );
}
/** Ends the turns of the players ahead of `player` (the first player passes in the villain phase). */
function asActive(state: GameState, player: PlayerId): GameState {
  let current = state;
  for (;;) {
    const step = current.step;
    if (step.phase !== "player" || step.kind !== "turn" || step.activePlayerId === player) break;
    const result = applyCommand(current, endTurn(step.activePlayerId), WAVE7_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    current = settle(result.state, firstLegal, undefined, WAVE7_DEPS);
  }
  return current;
}

const run = (state: GameState, pick: Picker, ...commands: Command[]) =>
  driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);
const refused = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;
const attackCommand = (s: GameState, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: identityOf(s, player),
  targetInstanceId: target,
});
const attacksOf = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.flatMap((e) => (e.type === "attackResolved" && e.enemyInstanceId === enemy ? [e] : []));
const schemesOf = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.flatMap((e) => (e.type === "schemeResolved" && e.enemyInstanceId === enemy ? [e] : []));
const damageFrom = (events: readonly GameEvent[], source: InstanceId | null, target: InstanceId): number[] =>
  events.flatMap((e) =>
    e.type === "damageDealt" && e.sourceInstanceId === source && e.targetInstanceId === target ? [e.amount] : [],
  );

/** Answers a "choose one" with the option whose label starts with `label`; anything else by default. */
const choosing =
  (label: string, inner: Picker = firstLegal): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const hit = choice.options.find((o) => o.label.startsWith(label));
      if (hit) return [hit.optionId];
    }
    return inner(state);
  };
/** Picks `id` when a prompt offers it (a chosen target), else `inner`. */
const picking =
  (id: InstanceId, inner: Picker = firstLegal): Picker =>
  (state) => {
    const offered = state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    return offered.includes(id) ? [id] : inner(state);
  };

describe("Psylocke obligation and nemesis registry", () => {
  const REFS = [
    SWAPPED_CONSTANT,
    "41025.when-revealed",
    SWAPPED_ACTION,
    "41026.chimera-forced-interrupt",
    "41027.when-revealed",
    "41028.psionic-illusion-forced-interrupt",
    "41029.when-revealed",
    "41029.boost",
  ];
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(PSYLOCKE_OBLIGATION_NEMESIS[id]!)).toEqual([]);
  });
  it("holds exactly the eight refs of 41025-41029", () => {
    expect(Object.keys(PSYLOCKE_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
  });
});

describe("Body Swapped (41025)", () => {
  it("is Betsy's own obligation: revealed, it stays in her play area (not discarded)", () => {
    const base = baseGame();
    expect(instancesOf(base, BODY_SWAPPED)).toHaveLength(1);
    const { state, id } = revealObligation(base);
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(true);
    expect(isIn(encounterDiscard(state), id)).toBe(false);
  });

  it.each([
    ["both on Psi-Knife", KNIVES],
    ["one already Psi-Katana", MIXED],
    ["both already Psi-Katana", KATANAS],
  ] as const)("When Revealed, %s: both end on Psi-Katana and exhausted (Q43)", (_label, shown) => {
    const base = blades(baseGame(), shown);
    const { state } = revealObligation(base);
    expect(faces(state)).toEqual([true, true]);
    expect(exhaustedBlades(state)).toEqual([true, true]);
  });

  it("When Revealed leaves a blade that was already exhausted exhausted, and exhausts the unexhausted one", () => {
    const base = patchInstance(blades(baseGame(), KNIVES), bladesOf(baseGame())[0]!, { exhausted: true });
    expect(exhaustedBlades(base)).toEqual([true, false]);
    const { state } = revealObligation(base);
    expect(faces(state)).toEqual([true, true]);
    expect(exhaustedBlades(state)).toEqual([true, true]);
  });

  it("two players: only the Betsy Braddock seat's blades are flipped and exhausted", () => {
    const base = baseGame([PSYLOCKE, SPIDER_MAN]);
    const { state, id } = revealObligation(base);
    expect(isIn(playerOf(state, P1).playArea, id)).toBe(true);
    expect(faces(state, P1)).toEqual([true, true]);
    expect(bladesOf(state, P2)).toEqual([]);
  });

  describe("You cannot flip your Psi-Katana upgrades", () => {
    /** The obligation in play (revealed), then the blades set to `shown` and made ready, hero form. */
    function swapped(shown: readonly [boolean, boolean], players: readonly Seat[] = [PSYLOCKE]) {
      const revealed = revealObligation(baseGame(players));
      const ready = bladesOf(revealed.state).reduce(
        (s, id) => patchInstance(s, id, { exhausted: false }),
        blades(revealed.state, shown),
      );
      const hero = withForm(ready, { heroForm: 0 });
      return { state: hero, id: revealed.id };
    }
    const flippingBlade = (index: number, log = { offered: false }): Picker => {
      return (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseTriggers") {
          const hit = choice.options.find((o) => o.optionId.includes(CONTROL));
          if (hit) log.offered = true;
          return hit ? [hit.optionId] : [];
        }
        if (choice?.prompt.kind === "chooseCards") {
          const hit = choice.options.find((o) => o.optionId === bladesOf(s)[index]);
          if (hit) return [hit.optionId];
        }
        return firstLegal(s);
      };
    };

    it("control: without the obligation Psi-Energy Control flips a Psi-Katana back to Psi-Knife", () => {
      const base = blades(heroGame(), KATANAS);
      const log = { offered: false };
      const { state } = run(base, flippingBlade(0, log), attackCommand(base, stryfe(base)));
      expect(log.offered).toBe(true);
      expect(faces(state)).toEqual([false, true]);
    });

    it("with both blades on Psi-Katana nothing flips, whichever she asks for", () => {
      const { state: base } = swapped(KATANAS);
      const { state } = run(base, flippingBlade(0), attackCommand(base, stryfe(base)));
      expect(faces(state)).toEqual([true, true]);
    });

    // Spec §3.64: "read by the offer of any optional flip": a Psi-Katana is no candidate of Psi-Energy Control's
    // choice. Today the choice still offers it (the flip is then refused), so the trigger is offered with nothing flippable.
    it.fails("with both blades on Psi-Katana, Psi-Energy Control is not offered", () => {
      const { state: base } = swapped(KATANAS);
      const log = { offered: false };
      run(base, flippingBlade(0, log), attackCommand(base, stryfe(base)));
      expect(log.offered).toBe(false);
    });

    it("with one blade on each side asked for the Psi-Katana, it stays on Psi-Katana (the flip is refused)", () => {
      const { state: base } = swapped(MIXED);
      const { state } = run(base, flippingBlade(1), attackCommand(base, stryfe(base)));
      expect(faces(state)).toEqual([false, true]);
    });

    it("with one blade on each side asked for the Psi-Knife, it flips to Psi-Katana", () => {
      const { state: base } = swapped(MIXED);
      const { state } = run(base, flippingBlade(0), attackCommand(base, stryfe(base)));
      expect(faces(state)).toEqual([true, true]);
    });

    it("the Psi-Knife she flips becomes a Psi-Katana that cannot be flipped back", () => {
      const { state: base } = swapped(KNIVES);
      const first = run(base, flippingBlade(0), attackCommand(base, stryfe(base)));
      expect(faces(first.state)).toEqual([true, false]);
      // Ready her and attack again, asking for the Katana: it stays.
      const ready = patchInstance(first.state, identityOf(first.state), { exhausted: false });
      const second = run(ready, flippingBlade(0), attackCommand(ready, stryfe(ready)));
      expect(faces(second.state)).toEqual([true, false]);
    });

    it("once Body Swapped is discarded the Psi-Katana can be flipped again", () => {
      const { state, id } = swapped(KATANAS);
      const gone = {
        ...state,
        players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== id) })),
      };
      const log = { offered: false };
      const { state: after } = run(gone, flippingBlade(0, log), attackCommand(gone, stryfe(gone)));
      expect(log.offered).toBe(true);
      expect(faces(after)).toEqual([false, true]);
    });
  });

  describe("Alter-Ego Action: discard 1 PSIONIC card from your hand to discard this obligation", () => {
    function inPlay(players: readonly Seat[] = [PSYLOCKE]) {
      const revealed = revealObligation(baseGame(players));
      return { state: revealed.state, id: revealed.id };
    }
    it("discarding a PSIONIC card from hand discards the obligation to the encounter discard pile", () => {
      const { state, id } = inPlay();
      const staged = arrange(state, { hand: [MENTAL_DETECTION, TRAINING], deck: [FLURRY] });
      const card = playerOf(staged, P1).hand.find((i) => codeOf(staged, i) === MENTAL_DETECTION)!;
      expect(playerOf(staged, P1).identity.form).toBe("alterEgo");
      const { state: after } = run(staged, firstLegal, use(P1, id, SWAPPED_ACTION, [], { discard: [card] }));
      expect(isIn(playerOf(after, P1).playArea, id)).toBe(false);
      expect(isIn(encounterDiscard(after), id)).toBe(true);
      expect(isIn(playerOf(after, P1).discard, card)).toBe(true);
      expect(handCodes(after)).toEqual([TRAINING]);
    });

    it("a card without the PSIONIC trait cannot pay it; neither can an empty hand", () => {
      const { state, id } = inPlay();
      const staged = arrange(state, { hand: [TRAINING, BLOW], deck: [FLURRY] });
      const nonPsionic = playerOf(staged, P1).hand[0]!;
      expect(refused(staged, use(P1, id, SWAPPED_ACTION, [], { discard: [nonPsionic] }))).toBe(true);
      const empty = arrange(state, { deck: [FLURRY] });
      expect(refused(empty, use(P1, id, SWAPPED_ACTION))).toBe(true);
      expect(isIn(playerOf(staged, P1).playArea, id)).toBe(true);
    });

    it("is an Alter-Ego Action: refused in hero form", () => {
      const { state, id } = inPlay();
      const hero = withForm(arrange(state, { hand: [MENTAL_DETECTION], deck: [FLURRY] }), { heroForm: 0 });
      const card = playerOf(hero, P1).hand[0]!;
      expect(refused(hero, use(P1, id, SWAPPED_ACTION, [], { discard: [card] }))).toBe(true);
    });

    it("two players: only the Betsy Braddock player may use it", () => {
      const { state, id } = inPlay([PSYLOCKE, SPIDER_MAN]);
      const staged = asActive(arrange(state, { hand: [MENTAL_DETECTION], deck: [FLURRY] }), P1);
      const card = playerOf(staged, P1).hand.find((i) => codeOf(staged, i) === MENTAL_DETECTION)!;
      expect(staged.step).toMatchObject({ activePlayerId: P1 });
      expect(refused(staged, use(P2, id, SWAPPED_ACTION, [], { discard: [card] }))).toBe(true);
      expect(refused(staged, use(P1, id, SWAPPED_ACTION, [], { discard: [card] }))).toBe(false);
    });
  });
});

describe("Interdimensional Plunder (41027)", () => {
  /** Upgrades in play: the two blades, plus any staged by surgery as `extra` instances of an encounter attachment. */
  it("enters with its 2 starting threat plus 1 per upgrade in play (her 2 blades): 4", () => {
    const { state, id } = reveal(baseGame(), PLUNDER);
    expect(isIn(state.villainArea, id)).toBe(true);
    expect(inst(state, id).threat).toBe(4);
  });

  it("counts every upgrade in play: a third upgrade (Martial Arts Training) makes 5", () => {
    // The extra upgrade is Martial Arts Training (41009), put onto her identity by surgery.
    const base = baseGame();
    const owner = playerOf(base, P1);
    const training = [...owner.hand, ...owner.deck].find((i) => codeOf(base, i) === MARTIAL_ARTS)!;
    const withUpgrade: GameState = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        hand: p.hand.filter((i) => i !== training),
        deck: p.deck.filter((i) => i !== training),
      })),
      instances: {
        ...base.instances,
        [training]: { ...base.instances[training]!, attachedTo: identityOf(base), controllerId: P1, faceup: true },
      },
    };
    const identity = inst(withUpgrade, identityOf(withUpgrade));
    const staged = patchInstance(withUpgrade, identityOf(withUpgrade), {
      attachments: [...identity.attachments, training],
    });
    const { state, id } = reveal(staged, PLUNDER);
    expect(inst(state, id).threat).toBe(5);
  });

  it("two players: upgrades of both seats count (Psylocke's 2 blades and nothing else: 4)", () => {
    const { state, id } = reveal(baseGame([PSYLOCKE, SPIDER_MAN]), PLUNDER);
    expect(inst(state, id).threat).toBe(4);
  });

  it("Boost: its 3 boost icons add 3 to the villain's attack", () => {
    const base = heroGame();
    const id = playerOf(base, P1).setAside.find((i) => codeOf(base, i) === PLUNDER)!;
    const staged = stackSetAside(base, PLUNDER);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(driven.events.find((e) => e.type === "attackResolved")).toMatchObject({ boostIcons: 3 });
    expect(id).toBeTruthy();
  });
});

/**
 * Her cards in play that print [mental] in the Stryfe scenario: the two blades showing Psi-Knife and Hope Summers
 * (40130, the scenario's setup ally under her control). Everything else a test arranges comes on top of it.
 */
const IN_PLAY_MENTAL = 3;

describe("Chimera (41026)", () => {
  /** Hero form, Chimera engaged with `against`, `shown` blades, P1's hand/deck/discard as given (padded deck). */
  function chimeraGame(
    zones: Parameters<typeof arrange>[1],
    shown: readonly [boolean, boolean] = KNIVES,
    against: PlayerId = P1,
    players: readonly Seat[] = [PSYLOCKE],
  ) {
    const staged = blades(arrange(heroGame(players), zones), shown);
    return minionEngaged(staged, CHIMERA, against);
  }
  const chimeraAttack = (state: GameState, id: InstanceId) => {
    const driven = run(state, firstLegal, ...endPhase(state));
    return { ...driven, attack: attacksOf(driven.events, id)[0]! };
  };

  it.each([
    ["only what is in play (2 Psi-Knives and Hope Summers)", { hand: [FLURRY], deck: [SUGGESTION] }, 0],
    ["cards in hand", { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT], deck: [FLURRY] }, 2],
    ["cards in her deck", { hand: [FLURRY], deck: [UPSIDE, BRITAIN, FLURRY] }, 2],
    ["cards in her discard pile", { hand: [FLURRY], deck: [FLURRY], discard: [UPSIDE] }, 1],
    [
      "every place: 2 hand + 1 deck + 1 discard",
      { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT], deck: [UPSIDE], discard: [BRITAIN] },
      4,
    ],
    ["a wild icon is not a [mental] resource", { hand: [ANGEL, FLURRY], deck: [FLURRY] }, 0],
    ["an [energy] and a [physical] icon are not either", { hand: [SUGGESTION, BLOW], deck: [FLURRY] }, 0],
  ] as const)("X counts %s", (_label, zones, extra) => {
    const { state, id } = chimeraGame(zones);
    const { attack } = chimeraAttack(state, id);
    expect(attack).toMatchObject({ baseAtk: 1 + IN_PLAY_MENTAL + extra });
  });

  // Spec §3.65 / Q39: "a flipped upgrade reports its showing face's icons". The data has them (`flipSide.resourceIcons`
  // physical for Psi-Katana), but `printedResourcesOf` reads the front face whatever `flipped` says.
  it.fails("a blade showing Psi-Katana prints [physical], not [mental]: with both flipped X is Hope Summers alone", () => {
    const { state, id } = chimeraGame({ hand: [FLURRY], deck: [SUGGESTION] }, KATANAS);
    expect(chimeraAttack(state, id).attack).toMatchObject({ baseAtk: 1 + 1 });
  });

  it("the scheme side gets +X SCH too: in alter-ego form she schemes for 1 + X", () => {
    const base = arrange(baseGame(), { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT], deck: [FLURRY] });
    const staged = minionEngaged(blades(base, KNIVES), CHIMERA, P1);
    expect(playerOf(staged.state, P1).identity.form).toBe("alterEgo");
    const driven = run(staged.state, firstLegal, ...endPhase(staged.state));
    const schemes = schemesOf(driven.events, staged.id);
    expect(schemes).toHaveLength(1);
    expect(schemes[0]).toMatchObject({ baseSch: 1, threatBonus: IN_PLAY_MENTAL + 2 });
    expect(schemes[0]!.threatPlaced).toBe(1 + IN_PLAY_MENTAL + 2 + schemes[0]!.boostIcons);
  });

  it("two players: engaged with Psylocke's seat she counts Psylocke's cards (hand 2 + in play 3), not the other seat's", () => {
    const base = arrange(heroGame([PSYLOCKE, SPIDER_MAN]), { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT] });
    const staged = minionEngaged(blades(base, KNIVES), CHIMERA, P1);
    const driven = run(staged.state, firstLegal, ...endPhase(staged.state));
    expect(attacksOf(driven.events, staged.id)[0]).toMatchObject({
      baseAtk: 1 + IN_PLAY_MENTAL + 2,
      targetInstanceId: identityOf(staged.state, P1),
    });
  });

  it("two players: engaged with the other seat she counts that player's cards, not Psylocke's", () => {
    const base = arrange(heroGame([PSYLOCKE, SPIDER_MAN]), { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT] });
    const staged = minionEngaged(blades(base, KNIVES), CHIMERA, P2);
    // The oracle reads the Spider-Man seat's own printed icons, which are not Psylocke's 5.
    const theirs = mentalOf(staged.state, P2);
    expect(theirs).not.toBe(mentalOf(staged.state, P1));
    const driven = run(staged.state, firstLegal, ...endPhase(staged.state));
    expect(attacksOf(driven.events, staged.id)[0]).toMatchObject({
      baseAtk: 1 + theirs,
      targetInstanceId: identityOf(staged.state, P2),
    });
  });

  it("Boost: her 3 boost icons add to the villain's attack", () => {
    const base = heroGame();
    const staged = stackSetAside(base, CHIMERA);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(driven.events.find((e) => e.type === "attackResolved")).toMatchObject({ boostIcons: 3 });
  });
});

describe("Psionic Illusion (41028)", () => {
  /** Hero form, Psionic Illusion attached to her identity, deck/hand as given. */
  function illusionGame(
    zones: Parameters<typeof arrange>[1],
    players: readonly Seat[] = [PSYLOCKE],
    shown: readonly [boolean, boolean] = KNIVES,
    pad = true,
  ) {
    const revealed = reveal(baseGame(players), ILLUSION);
    const hero = withForm(revealed.state, { heroForm: 0 });
    const both = players.length > 1 ? withForm(hero, { heroForm: 0 }, P2) : hero;
    return { state: blades(arrange(both, zones, P1, pad), shown), id: revealed.id };
  }
  const attackStryfe = (state: GameState, pick: Picker, player: PlayerId = P1) =>
    run(state, pick, attackCommand(state, stryfe(state), player));

  it("is attached to her identity and stays there until it triggers", () => {
    const { state, id } = illusionGame({ deck: [FLURRY] });
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(playerOf(state, P1).identity.form).toBe("hero");
  });

  it("naming [mental] and discarding a card with a [mental] icon: the attack stands, the top card is discarded, the card stays", () => {
    const { state, id } = illusionGame({ deck: [MENTAL_DETECTION, FLURRY], hand: [TRAINING] });
    const { state: after } = attackStryfe(state, choosing("Name mental"));
    expect(discardCodes(after)).toEqual([MENTAL_DETECTION]);
    expect(inst(after, id).attachedTo).toBe(identityOf(after));
    expect(inst(after, stryfe(after)).damage).toBe(1);
    expect(damageOf(after)).toBe(0);
  });

  it("naming [mental] and discarding a card with no [mental] icon: the attack is redirected to a friendly character (her own identity) and the card is discarded", () => {
    const { state, id } = illusionGame({ deck: [FLURRY, MENTAL_DETECTION], hand: [TRAINING] });
    const { state: after, events } = attackStryfe(state, choosing("Name mental"));
    expect(discardCodes(after)).toEqual([FLURRY]);
    expect(isIn(encounterDiscard(after), id)).toBe(true);
    expect(inst(after, stryfe(after)).damage).toBe(0);
    // Same attacker, same damage: her basic attack's 1 ATK lands on her own identity.
    expect(damageOf(after)).toBe(1);
    expect(damageFrom(events, identityOf(after), identityOf(after))).toEqual([1]);
  });

  it.each([
    ["physical", BLOW, UPSIDE],
    ["energy", FLURRY, UPSIDE],
    ["mental", UPSIDE, BLOW],
  ] as const)(
    "naming [%s]: a card of that type (%s) keeps the attack, a card without it (%s) redirects it",
    (named, hit, miss) => {
      const kept = illusionGame({ deck: [hit, FLURRY], hand: [TRAINING] });
      const a = attackStryfe(kept.state, choosing(`Name ${named}`));
      expect(damageOf(a.state)).toBe(0);
      expect(inst(a.state, stryfe(a.state)).damage).toBe(1);
      expect(isIn(encounterDiscard(a.state), kept.id)).toBe(false);
      const redirected = illusionGame({ deck: [miss, FLURRY], hand: [TRAINING] });
      const b = attackStryfe(redirected.state, choosing(`Name ${named}`));
      expect(damageOf(b.state)).toBe(1);
      expect(inst(b.state, stryfe(b.state)).damage).toBe(0);
      expect(isIn(encounterDiscard(b.state), redirected.id)).toBe(true);
    },
  );

  it("a printed wild icon matches whatever type was named (Q40 = B): naming [mental], Angel [wild] keeps the attack", () => {
    const { state, id } = illusionGame({ deck: [ANGEL, FLURRY], hand: [TRAINING] });
    const { state: after } = attackStryfe(state, choosing("Name mental"));
    expect(discardCodes(after)).toEqual([ANGEL]);
    expect(damageOf(after)).toBe(0);
    expect(inst(after, stryfe(after)).damage).toBe(1);
    expect(inst(after, id).attachedTo).toBe(identityOf(after));
  });

  it("naming [wild] is allowed: a card with no wild icon redirects the attack, a wild card keeps it", () => {
    const miss = illusionGame({ deck: [MENTAL_DETECTION, FLURRY], hand: [TRAINING] });
    const a = attackStryfe(miss.state, choosing("Name wild"));
    expect(damageOf(a.state)).toBe(1);
    const hit = illusionGame({ deck: [ANGEL, FLURRY], hand: [TRAINING] });
    const b = attackStryfe(hit.state, choosing("Name wild"));
    expect(damageOf(b.state)).toBe(0);
    expect(inst(b.state, stryfe(b.state)).damage).toBe(1);
  });

  it("with an ally in play the new target is her choice: she picks the ally, who takes the damage", () => {
    const base = illusionGame({ deck: [FLURRY, FLURRY], hand: [BRITAIN, TRAINING] });
    const brit = playerOf(base.state, P1).hand.find((i) => codeOf(base.state, i) === BRITAIN)!;
    const withAlly: GameState = {
      ...base.state,
      players: base.state.players.map((p) => ({
        ...p,
        hand: p.hand.filter((i) => i !== brit),
        playArea: p.playerId === P1 ? [...p.playArea, brit] : p.playArea,
      })),
      instances: {
        ...base.state.instances,
        [brit]: { ...base.state.instances[brit]!, faceup: true, controllerId: P1 },
      },
    };
    const { state: after } = attackStryfe(withAlly, picking(brit, choosing("Name mental")));
    expect(inst(after, brit).damage).toBe(1);
    expect(damageOf(after)).toBe(0);
    expect(inst(after, stryfe(after)).damage).toBe(0);
  });

  it("two players: the new target may be the other player's character (the Spider-Man seat's identity takes it)", () => {
    const made = illusionGame({ deck: [FLURRY, FLURRY], hand: [TRAINING] }, [PSYLOCKE, SPIDER_MAN]);
    const state = asActive(made.state, P1);
    const spider = identityOf(state, P2);
    const { state: after } = attackStryfe(state, picking(spider, choosing("Name mental")));
    expect(damageOf(after, P2)).toBe(1);
    expect(damageOf(after, P1)).toBe(0);
    expect(inst(after, stryfe(after)).damage).toBe(0);
  });

  it("two players: another player's attack does not trigger it (her deck stays, the attack stands)", () => {
    const { state, id } = illusionGame({ deck: [FLURRY, FLURRY], hand: [TRAINING] }, [PSYLOCKE, SPIDER_MAN]);
    const { state: after } = attackStryfe(state, choosing("Name mental"), P2);
    expect(discardCodes(after)).toEqual([]);
    expect(playerOf(after, P1).deck).toEqual(playerOf(state, P1).deck);
    expect(inst(after, id).attachedTo).toBe(identityOf(after, P1));
    expect(inst(after, stryfe(after)).damage).toBeGreaterThan(0);
  });

  it("an empty deck discards nothing and so no card lacks the resource: the attack stands and the card stays", () => {
    const { state, id } = illusionGame({ hand: [TRAINING] }, [PSYLOCKE], KNIVES, false);
    expect(playerOf(state, P1).deck).toHaveLength(0);
    const { state: after } = attackStryfe(state, choosing("Name mental"));
    expect(inst(after, stryfe(after)).damage).toBe(1);
    expect(damageOf(after)).toBe(0);
    expect(inst(after, id).attachedTo).toBe(identityOf(after));
  });

  it("Boost: its 2 boost icons add 2 to the villain's attack", () => {
    const base = heroGame();
    const staged = stackSetAside(base, ILLUSION);
    const driven = run(staged, firstLegal, ...endPhase(staged));
    expect(driven.events.find((e) => e.type === "attackResolved")).toMatchObject({ boostIcons: 2 });
  });
});

describe("Telekinetic Dragon (41029)", () => {
  /** Alter-ego form (the villain schemes, so no attack damage mixes in), her cards as given, blades showing Psi-Knife. */
  function dragonGame(zones: Parameters<typeof arrange>[1], shown: readonly [boolean, boolean] = KNIVES) {
    return blades(arrange(baseGame(), zones), shown);
  }
  const dragonDamage = (state: GameState) => {
    const revealed = reveal(state, DRAGON);
    return { ...revealed, taken: damageOf(revealed.state) };
  };
  const surged = (events: readonly GameEvent[], id: InstanceId) =>
    events.some((e) => e.type === "surgeTriggered" && e.instanceId === id);

  it.each([
    ["only what is in play (2 Psi-Knives and Hope Summers)", { hand: [FLURRY], deck: [SUGGESTION] }, 0],
    ["cards in hand", { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT], deck: [FLURRY] }, 2],
    ["cards in her deck", { hand: [FLURRY], deck: [UPSIDE, BRITAIN, FLURRY] }, 2],
    ["cards in her discard pile", { hand: [FLURRY], deck: [FLURRY], discard: [UPSIDE, BRITAIN] }, 2],
    [
      "every place: 2 hand + 2 deck + 1 discard",
      { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT], deck: [UPSIDE, BRITAIN], discard: [UPSIDE] },
      5,
    ],
    ["a wild icon does not count", { hand: [ANGEL, MENTAL_DETECTION], deck: [FLURRY] }, 1],
  ] as const)("takes X indirect damage, X from %s", (_label, zones, extra) => {
    const { taken, events, id } = dragonDamage(dragonGame(zones));
    expect(taken).toBe(IN_PLAY_MENTAL + extra);
    expect(surged(events, id)).toBe(false);
  });

  it.fails("a blade showing Psi-Katana prints [physical]: with both flipped X is Hope Summers alone (1)", () => {
    const { taken } = dragonDamage(dragonGame({ hand: [FLURRY], deck: [SUGGESTION] }, KATANAS));
    expect(taken).toBe(1);
  });

  it("X is 0 (nothing in play or anywhere prints [mental]): no damage and the card gains surge", () => {
    // Her blades and Hope Summers leave play so that nothing she controls prints [mental].
    const base = dragonGame({ hand: [FLURRY], deck: [SUGGESTION], discard: [BLOW] });
    const hope = instancesOf(base, "40130")[0]!;
    const bare: GameState = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        playArea: p.playArea.filter((i) => i !== hope && !bladesOf(base).includes(i)),
      })),
    };
    const stripped = patchInstance(bare, identityOf(bare), { attachments: [] });
    const noHope = patchInstance(stripped, hope, { controllerId: null });
    const noBlades = bladesOf(base).reduce((acc, id) => patchInstance(acc, id, { controllerId: null }), noHope);
    expect(mentalOf(noBlades, P1)).toBe(0);
    const { taken, events, id } = dragonDamage(noBlades);
    expect(taken).toBe(0);
    expect(surged(events, id)).toBe(true);
    // Surge: the card after it is revealed as well.
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(2);
  });

  it("two players: dealt to the second seat (Psylocke), X is her cards and only she takes it", () => {
    const base = baseGame([SPIDER_MAN, PSYLOCKE]);
    const staged = blades(arrange(base, { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT] }, P2), KNIVES, P2);
    // Two boosts for the villain's activations, one filler dealt to the first seat, then the Dragon for the second.
    const { state } = reveal(staged, DRAGON, firstLegal, 3, P2);
    expect(damageOf(state, P1)).toBe(0);
    // Hope Summers is the first seat's: only her 2 Psi-Knives are in play for this seat.
    expect(damageOf(state, P2)).toBe(2 + 2);
  });

  it("two players: dealt to Psylocke's seat X counts her cards (in play 3 + hand 2) and only she takes it", () => {
    const base = arrange(baseGame([PSYLOCKE, SPIDER_MAN]), { hand: [MENTAL_DETECTION, PSIONIC_REDIRECT] });
    const { state } = reveal(blades(base, KNIVES), DRAGON, firstLegal, 2, P1);
    expect(damageOf(state, P1)).toBe(IN_PLAY_MENTAL + 2);
    expect(damageOf(state, P2)).toBe(0);
  });

  describe("Boost: choose to either spend a [mental] resource or confuse your identity", () => {
    /** Hero form; the Dragon is on top of the encounter deck, so the villain draws it as his boost card. */
    function boosting(zones: Parameters<typeof arrange>[1]) {
      return stackSetAside(blades(arrange(heroGame(), zones), KNIVES), DRAGON);
    }

    it("with no [mental] resource in hand the only option is to confuse: her identity is confused", () => {
      const state = boosting({ hand: [FLURRY, SUGGESTION], deck: [FLURRY] });
      const { state: after, events } = run(state, firstLegal, ...endPhase(state));
      expect(statusOf(after, identityOf(after), "confused")).toBe(1);
      expect(events.find((e) => e.type === "attackResolved")).toMatchObject({ boostIcons: 0 });
    });

    /** Pays the [mental] with the hand card `code` (a prompt for the payment lists the hand's resource cards). */
    const paying =
      (code: string): Picker =>
      (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind !== "spendResources") return firstLegal(s);
        const card = playerOf(s, P1).hand.find((i) => codeOf(s, i) === code)!;
        return choice.options.filter((o) => o.optionId.endsWith(card)).map((o) => o.optionId);
      };
    /** Pays nothing when asked for the payment. */
    const notPaying: Picker = (s) => (s.pendingChoice?.prompt.kind === "spendResources" ? [] : firstLegal(s));

    it("choosing to spend: a [mental] resource card from hand is spent and she is not confused", () => {
      const state = boosting({ hand: [MENTAL_DETECTION, FLURRY], deck: [FLURRY] });
      const { state: after } = run(state, paying(MENTAL_DETECTION), ...endPhase(state));
      expect(statusOf(after, identityOf(after), "confused")).toBe(0);
      expect(discardCodes(after)).toContain(MENTAL_DETECTION);
      expect(discardCodes(after)).not.toContain(FLURRY);
    });

    it("paying nothing with a [mental] resource available: confused, and the hand is untouched", () => {
      const state = boosting({ hand: [MENTAL_DETECTION, FLURRY], deck: [FLURRY] });
      const { state: after } = run(state, notPaying, ...endPhase(state));
      expect(statusOf(after, identityOf(after), "confused")).toBe(1);
      expect(discardCodes(after)).not.toContain(MENTAL_DETECTION);
    });

    it("a wild resource pays the [mental]: Angel is spent instead of confusing", () => {
      const state = boosting({ hand: [ANGEL], deck: [FLURRY] });
      const { state: after } = run(state, paying(ANGEL), ...endPhase(state));
      expect(statusOf(after, identityOf(after), "confused")).toBe(0);
      expect(discardCodes(after)).toContain(ANGEL);
    });

    it("two players: the player the villain attacks is the one who chooses and is confused", () => {
      const base = heroGame([PSYLOCKE, SPIDER_MAN]);
      const staged = stackSetAside(blades(arrange(base, { hand: [FLURRY], deck: [FLURRY] }), KNIVES), DRAGON);
      const { state: after } = run(staged, firstLegal, ...endPhase(staged));
      const confused = [P1, P2].filter((p) => statusOf(after, identityOf(after, p), "confused") === 1);
      expect(confused).toHaveLength(1);
    });
  });
});
