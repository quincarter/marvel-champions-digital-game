import { CORE_CARDS, CW_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, driveStepwise, stackSetAside, withForm } from "../../../testing/staging.js";
import { WAVE10_DEPS, engageMinion, stagedInPlay, tigraHeroGame } from "../../testing.js";
import {
  TIGRA_OBLIGATION_NEMESIS as REGISTRY,
  TIGRA_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * Tigra's obligation and nemesis set (56023 In Too Deep; 56024 The Hood, 56025 Criminal Underworld, 56026 The Hood's
 * Mantle, 56027 Madame Masque, 56028 Jigsaw), docs/phase7-wave10-box-heroes.md B3.14 and B3.15. The printed precon
 * `tigra-aggression` against Core's Rhino (ATK 2, SCH 1). The obligation is in the encounter deck and is revealed in a
 * real villain phase; the nemesis set is set aside, so its cards are moved by surgery or staged for a real reveal.
 * Core cards stand in for the rest: Hydra Mercenary 01101 (ATK 1, SCH 0, not Criminal), Sandman 01102 (ATK 3, SCH 2,
 * Criminal), Shocker 01103 (ATK 2, SCH 1, Criminal), Advance 01186 (0 boost icons).
 */
const OBLIGATION = "56023";
const HOOD = "56024";
const UNDERWORLD = "56025";
const MANTLE = "56026";
const MASQUE = "56027";
const JIGSAW = "56028";
const REFS = [
  "56023.obligation",
  "56024.the-hood-forced-response",
  "56025.criminal-underworld-constant",
  "56026.the-hoods-mantle-response",
  "56026.boost",
  "56027.when-revealed",
  "56027.boost",
  "56028.jigsaw-forced-response",
];
const MERC = "01101";
const SANDMAN = "01102";
const SHOCKER = "01103";
const ADVANCE = "01186";
const MANTLE_RESPONSE = "56026.the-hoods-mantle-response";

const data = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as any;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const piles = (s: GameState) => activeEncounterDeck(s);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const damageOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).damage;
const inPlayArea = (s: GameState, id: InstanceId, player: PlayerId = P1): boolean =>
  playerOf(s, player).playArea.includes(id);
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE10_DEPS)!;

/** The first set-aside copy of `code` of P1's, removed from the set-aside cards. */
function fromSetAside(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no set-aside ${code}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
      ),
    },
  };
}
/** A set-aside minion of the set engaged with `player`, faceup, as if revealed earlier. */
function engagedNemesis(state: GameState, code: string, player: PlayerId = P1, damage = 0) {
  const found = fromSetAside(state, code);
  return {
    id: found.id,
    state: {
      ...found.state,
      players: found.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, found.id] } : p,
      ),
      instances: {
        ...found.state.instances,
        [found.id]: {
          ...found.state.instances[found.id]!,
          faceup: true,
          controllerId: null,
          engagedWith: player,
          damage,
        },
      },
    },
  };
}
/** The set-aside side scheme `code` in the villain area with `threat`. */
function sideSchemeIn(state: GameState, code: string, threat: number) {
  const found = fromSetAside(state, code);
  return {
    id: found.id,
    state: {
      ...found.state,
      villainArea: [...found.state.villainArea, found.id],
      instances: {
        ...found.state.instances,
        [found.id]: { ...found.state.instances[found.id]!, faceup: true, threat },
      },
    },
  };
}
/** The top `n` cards of the encounter deck made into Advance (0 boost icons): any activation's boost card is harmless. */
const fillers = (state: GameState, n = 14): GameState =>
  piles(state)
    .deck.slice(0, n)
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
/** Declines to defend; otherwise the first legal answer. */
const picker =
  (choose?: (s: GameState) => readonly string[] | undefined): Picker =>
  (s) => {
    if (s.pendingChoice!.prompt.kind === "declareDefender") return ["decline"];
    const picked = choose?.(s);
    if (picked) return picked;
    // "The player orders the activations" (RRG 1.8 "Activation", p. 6): every enemy, in the order offered.
    if (s.pendingChoice!.prompt.kind === "orderEnemies") return s.pendingChoice!.options.map((o) => o.optionId);
    return firstLegal(s);
  };
const pickLabels = (...labels: readonly string[]) =>
  picker((s) => {
    for (const label of labels) {
      const hit = s.pendingChoice!.options.find((o) => o.label.startsWith(label));
      if (hit) return [hit.optionId];
    }
    return undefined;
  });
/** The villain phase and the next player phase: every player ends the turn. */
const endRound = (s: GameState, pick: Picker = picker(), ...players: readonly PlayerId[]) =>
  driveEventsPicking(WAVE10_DEPS, s, pick, ...(players.length ? players : [P1]).map((p) => endTurn(p)));

describe("registry", () => {
  it("registers every printed ref; nothing is skipped", () => {
    const printed = [OBLIGATION, HOOD, UNDERWORLD, MANTLE, MASQUE, JIGSAW].flatMap((c) => abilityRefIds(data(c)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!)).toEqual([]);
  });
  it("timing: When Revealed, Forced Responses, a Hero Response, boosts and a constant", () => {
    expect(REGISTRY["56023.obligation"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(REGISTRY["56024.the-hood-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["56028.jigsaw-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["56025.criminal-underworld-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY[MANTLE_RESPONSE]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY["56027.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(REGISTRY["56026.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(REGISTRY["56027.boost"]!.trigger).toMatchObject({ kind: "boost" });
  });
});

describe("the printed cards", () => {
  it("In Too Deep: an obligation in no encounter set, 2 boost icons, given to the Greer Nelson player", () => {
    expect(data(OBLIGATION)).toMatchObject({ type: "obligation", boostIcons: 2, encounterSetIds: [] });
    expect(data(OBLIGATION).text.current).toContain("Each minion engaged with you activates against you.");
  });
  it("The Hood: Criminal minion, ATK 1, SCH 1, 4 hit points, steady and villainous, 2 boost icons, nemesis minion", () => {
    expect(data(HOOD)).toMatchObject({ type: "minion", atk: 1, sch: 1, hp: 4, boostIcons: 2, nemesisMinion: true });
    expect(data(HOOD).keywords).toEqual([{ name: "steady" }, { name: "villainous" }]);
    expect(data(HOOD).traits).toEqual(["CRIMINAL"]);
  });
  it("Criminal Underworld: 4 threat flat, an acceleration icon, 3 boost icons", () => {
    expect(data(UNDERWORLD)).toMatchObject({ type: "side_scheme", startingThreat: { base: 4, perPlayer: 0 } });
    expect(data(UNDERWORLD).icons).toEqual(["acceleration"]);
    expect(data(UNDERWORLD).boostIcons).toBe(3);
  });
  it("The Hood's Mantle: +1 ATK and +1 SCH, attaches to The Hood otherwise the villain, 0 boost icons and a star", () => {
    expect(data(MANTLE)).toMatchObject({ type: "attachment", statModifiers: { atk: 1, sch: 1 }, boostIcons: 0 });
    expect(data(MANTLE).attachesTo).toMatchObject({ preferred: { name: "The Hood" }, otherwise: { kind: "villain" } });
  });
  it("Madame Masque and Jigsaw: Criminal minions; Jigsaw has quickstrike; Masque's text carries the corrected spelling", () => {
    expect(data(MASQUE)).toMatchObject({ type: "minion", atk: 1, sch: 2, hp: 3, boostIcons: 0, starIcon: true });
    expect(data(MASQUE).text.current).toContain("Criminal Underworld side scheme");
    expect(data(MASQUE).text.current).not.toContain("Underwold");
    expect(data(JIGSAW)).toMatchObject({ type: "minion", atk: 2, sch: 1, hp: 3, boostIcons: 2 });
    expect(data(JIGSAW).keywords).toEqual([{ name: "quickstrike" }]);
  });
  it("setup: the obligation is in the encounter deck once, the five nemesis cards are set aside", () => {
    const s = tigraHeroGame();
    expect(piles(s).deck.filter((i) => codeOf(s, i) === OBLIGATION)).toHaveLength(1);
    expect(playerOf(s, P1).setAside.map((i) => codeOf(s, i))).toEqual([HOOD, UNDERWORLD, MANTLE, MASQUE, JIGSAW]);
  });
});

describe("56023.obligation: In Too Deep (docs B3.15)", () => {
  /**
   * In Too Deep revealed to P1 in the real villain phase, behind one boost card for each enemy that activates first
   * (Advance throughout). `ready` and `stunned` are Core minions engaged with P1 (a Sandman and a Shocker, say), added
   * before the phase. The minions are stunned (or confused) at the moment the obligation's first prompt appears, since
   * the villain phase would use the status up on their ordinary activation. Returns the state and events and the
   * snapshots taken at that first prompt.
   */
  function reveal(
    start: GameState,
    opts: {
      readonly ready?: readonly string[];
      readonly stunned?: readonly string[];
      readonly confused?: readonly string[];
      readonly choices: readonly string[];
      readonly players?: readonly PlayerId[];
      readonly otherSeat?: readonly string[];
    },
  ) {
    let s = start;
    const slot = (code: string, n: number, player: PlayerId = P1) => `${code}-${player}-${n}` as InstanceId;
    const make = (codes: readonly string[] | undefined, player: PlayerId = P1, offset = 0) =>
      (codes ?? []).map((code, n) => {
        const id = slot(code, n + offset, player);
        s = engageMinion(s, code, id, player);
        return id;
      });
    const ready = make(opts.ready);
    const stunned = make(opts.stunned, P1, 10);
    const confused = make(opts.confused, P1, 20);
    const other = make(opts.otherSeat, P2, 30);
    // The villain's boost cards (one for each player it activates against) are the top of the deck, then each player is
    // dealt a card, and only then do the minions activate and draw their boost cards.
    const filled = fillers(s);
    const deckId = activeEncounterDeckId(filled);
    const original = piles(s).deck.find((i) => codeOf(s, i) === OBLIGATION)!;
    const rest = piles(filled).deck.filter((i) => i !== original);
    const stacked: GameState = {
      ...filled,
      instances: { ...filled.instances, [original]: s.instances[original]! },
      encounterDecks: {
        ...filled.encounterDecks,
        [deckId]: {
          ...piles(filled),
          deck: [...rest.slice(0, s.players.length), original, ...rest.slice(s.players.length)],
        },
      },
    };
    const events: GameEvent[] = [];
    let atPrompt: GameState | null = null;
    const isFirstPrompt = (st: GameState) =>
      st.pendingChoice!.prompt.kind === "chooseOption" &&
      st.pendingChoice!.options.some((o) => o.label.startsWith("Stay in hero form") || o.label.startsWith("Exhaust"));
    const hook = (st: GameState): GameState => {
      if (atPrompt || !isFirstPrompt(st)) return st;
      let marked = st;
      for (const id of stunned)
        marked = patchInstance(marked, id, { statuses: { ...inst(marked, id).statuses, stunned: 1 } });
      for (const id of confused)
        marked = patchInstance(marked, id, { statuses: { ...inst(marked, id).statuses, confused: 1 } });
      atPrompt = marked;
      return marked;
    };
    let current = stacked;
    for (const player of opts.players ?? [P1]) {
      const result = applyCommand(current, endTurn(player), WAVE10_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      events.push(...result.events);
      const done = driveStepwise(WAVE10_DEPS, result.state, pickLabels(...opts.choices), hook);
      events.push(...done.events);
      current = done.state;
    }
    if (!atPrompt) throw new Error("the obligation never prompted");
    const done = { state: current };
    return {
      state: done.state,
      events,
      before: atPrompt as GameState,
      obligation: original,
      ready,
      stunned,
      confused,
      other,
    };
  }
  const surges = (events: readonly GameEvent[], obligation: InstanceId) =>
    ofType(events, "surgeTriggered").filter((e) => e.instanceId === obligation);

  it("revealed to the Greer Nelson player it asks first about flipping, then to choose; nothing else is asked", () => {
    const r = reveal(tigraHeroGame(), { ready: [SANDMAN], choices: ["Stay", "Each minion"] });
    expect(r.before.pendingChoice!.options.map((o) => o.label)).toEqual([
      "Flip to alter-ego form",
      "Stay in hero form",
    ]);
    expect(r.state.pendingChoice).toBeNull();
  });

  it("hero form, a ready Shocker and a stunned Sandman: only Shocker attacks (2), the stun card is used up, no surge", () => {
    const r = reveal(tigraHeroGame(), { ready: [SHOCKER], stunned: [SANDMAN], choices: ["Stay", "Each minion"] });
    expect(damageOf(r.state) - damageOf(r.before)).toBe(2);
    expect(inst(r.state, r.stunned[0]!).statuses.stunned).toBe(0);
    expect(surges(r.events, r.obligation)).toEqual([]);
    expect(piles(r.state).discard).toContain(r.obligation);
    expect(r.state.removedFromGame).not.toContain(r.obligation);
  });

  it("hero form, two ready minions (Shocker 2, Hydra Mercenary 1): both attack you, 3 damage, no surge", () => {
    const r = reveal(tigraHeroGame(), { ready: [SHOCKER, MERC], choices: ["Stay", "Each minion"] });
    expect(damageOf(r.state) - damageOf(r.before)).toBe(3);
    expect(surges(r.events, r.obligation)).toEqual([]);
  });

  it("hero form, only a stunned minion: the stun card replaces its attack, nothing activates, so the obligation gains surge", () => {
    const r = reveal(tigraHeroGame(), { stunned: [SANDMAN], choices: ["Stay", "Each minion"] });
    expect(damageOf(r.state) - damageOf(r.before)).toBe(0);
    expect(inst(r.state, r.stunned[0]!).statuses.stunned).toBe(0);
    expect(surges(r.events, r.obligation)).toHaveLength(1);
    expect(piles(r.state).discard).toContain(r.obligation);
  });

  it("no minion engaged: nothing activates, the obligation is discarded and gains surge", () => {
    const r = reveal(tigraHeroGame(), { choices: ["Stay", "Each minion"] });
    expect(damageOf(r.state) - damageOf(r.before)).toBe(0);
    expect(surges(r.events, r.obligation)).toHaveLength(1);
    expect(piles(r.state).discard).toContain(r.obligation);
  });

  it("flipped to alter-ego form: a ready Sandman schemes against you (2 threat on the main scheme), no surge", () => {
    const r = reveal(tigraHeroGame(), { ready: [SANDMAN], choices: ["Flip", "Each minion"] });
    expect(playerOf(r.state, P1).identity.form).toBe("alterEgo");
    expect(mainThreat(r.state) - mainThreat(r.before)).toBe(2);
    expect(damageOf(r.state) - damageOf(r.before)).toBe(0);
    expect(surges(r.events, r.obligation)).toEqual([]);
  });

  it("flipped, only a confused minion: the confused card replaces its scheme, nothing activates, surge", () => {
    const r = reveal(tigraHeroGame(), { confused: [SANDMAN], choices: ["Flip", "Each minion"] });
    // Sandman's scheme (2) is not placed: the 1 threat is Rhino's, from the Advance the surge reveals.
    expect(mainThreat(r.state) - mainThreat(r.before)).toBe(1);
    expect(inst(r.state, r.confused[0]!).statuses.confused).toBe(0);
    expect(surges(r.events, r.obligation)).toHaveLength(1);
  });

  it("the exhaust option is offered only in alter-ego form: in hero form it is not among the choices", () => {
    const r = reveal(tigraHeroGame(), { ready: [SANDMAN], choices: ["Stay", "Each minion"] });
    expect(r.before.pendingChoice!.options.some((o) => o.label.startsWith("Exhaust"))).toBe(false);
  });

  it("flip, then exhaust Greer Nelson: the obligation is removed from the game and no minion activates", () => {
    const r = reveal(tigraHeroGame(), { ready: [SANDMAN], choices: ["Flip", "Exhaust"] });
    expect(r.state.removedFromGame).toContain(r.obligation);
    expect(piles(r.state).discard).not.toContain(r.obligation);
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(true);
    expect(mainThreat(r.state) - mainThreat(r.before)).toBe(0);
    expect(surges(r.events, r.obligation)).toEqual([]);
  });

  it("two players: only the minions engaged with you activate against you, the other seat's are left alone", () => {
    const r = reveal(tigraHeroGame({ twoPlayers: true }), {
      ready: [SHOCKER],
      otherSeat: [SANDMAN],
      choices: ["Stay", "Each minion"],
      players: [P1, P2],
    });
    expect(damageOf(r.state) - damageOf(r.before)).toBe(2);
    const otherIdentity = identityOf(r.state, P2);
    expect(damageOf(r.state, otherIdentity)).toBe(damageOf(r.before, otherIdentity));
    expect(surges(r.events, r.obligation)).toEqual([]);
  });

  it("two players, you have no minion but the other seat does: it gains surge all the same", () => {
    const r = reveal(tigraHeroGame({ twoPlayers: true }), {
      otherSeat: [SANDMAN],
      choices: ["Stay", "Each minion"],
      players: [P1, P2],
    });
    expect(surges(r.events, r.obligation)).toHaveLength(1);
    expect(damageOf(r.state, identityOf(r.state, P2))).toBe(damageOf(r.before, identityOf(r.before, P2)));
  });
});

describe("56025.criminal-underworld-constant: each Criminal minion cannot take damage", () => {
  const basicAttack = (s: GameState, target: InstanceId): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(s),
    targetInstanceId: target,
  });
  const attack = (s: GameState, target: InstanceId) =>
    driveEventsPicking(WAVE10_DEPS, s, picker(), basicAttack(s, target));
  /** Jigsaw (3 hit points, 1 damage on him), a Hydra Mercenary and a Shocker engaged; Criminal Underworld in play or not. */
  function table(underworldInPlay: boolean) {
    let s = tigraHeroGame();
    if (underworldInPlay) s = sideSchemeIn(s, UNDERWORLD, 4).state;
    const jigsaw = engagedNemesis(s, JIGSAW, P1, 1);
    s = jigsaw.state;
    s = engageMinion(s, MERC, "merc");
    s = engageMinion(s, SHOCKER, "shocker");
    return { s, jigsaw: jigsaw.id };
  }
  const refused = (s: GameState, target: InstanceId) => {
    const result = applyCommand(s, basicAttack(s, target), WAVE10_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
  };

  // Ruling March 19, 2026 - Ruling 2: a basic attack cannot target a character that cannot take damage (RRG 1.7+
  // "Target"), so Tigra cannot declare the attack at all. B3.14 read "an attack on such a minion is still an attack";
  // the ruling contradicts it, and the engine follows the ruling.
  it("Tigra's basic attack cannot target Jigsaw (a Criminal minion that cannot take damage); nothing is spent", () => {
    const t = table(true);
    refused(t.s, t.jigsaw);
    expect(inst(t.s, identityOf(t.s)).exhausted).toBe(false);
    expect(damageOf(t.s, t.jigsaw)).toBe(1);
  });

  it("every Criminal minion of any set is covered: a Core Shocker cannot be targeted either, and neither can The Hood", () => {
    const t = table(true);
    refused(t.s, "shocker" as InstanceId);
    const hood = engagedNemesis(t.s, HOOD);
    refused(hood.state, hood.id);
  });

  it("a minion that is not Criminal (Hydra Mercenary) takes the 2 damage", () => {
    const t = table(true);
    expect(damageOf(attack(t.s, "merc" as InstanceId).state, "merc" as InstanceId)).toBe(2);
  });

  it("the villain is not a minion: Rhino takes the 2 damage", () => {
    const lone = sideSchemeIn(tigraHeroGame(), UNDERWORLD, 4);
    expect(damageOf(attack(lone.state, villainOf(lone.state)).state, villainOf(lone.state))).toBe(2);
  });

  it("with the side scheme out of play the same attack deals 2 and defeats Jigsaw (3 hit points, 1 damage on him)", () => {
    const t = table(false);
    const { state } = attack(t.s, t.jigsaw);
    expect(inPlayArea(state, t.jigsaw)).toBe(false);
    expect(piles(state).discard).toContain(t.jigsaw);
  });

  it("once the side scheme leaves the villain area, the same minion can be attacked again", () => {
    const t = table(true);
    refused(t.s, t.jigsaw);
    const gone = { ...t.s, villainArea: t.s.villainArea.filter((i) => codeOf(t.s, i) !== UNDERWORLD) };
    expect(inPlayArea(attack(gone, t.jigsaw).state, t.jigsaw)).toBe(false);
  });
});

describe("56024.the-hood-forced-response: after The Hood attacks, 1 threat on Criminal Underworld", () => {
  function table(opts: { readonly underworld?: boolean; readonly stunned?: number; readonly seat?: PlayerId } = {}) {
    let s = withForm(fillers(tigraHeroGame({ twoPlayers: true })), { heroForm: 0 }, P2);
    const scheme = opts.underworld === false ? null : sideSchemeIn(s, UNDERWORLD, 4);
    if (scheme) s = scheme.state;
    const hood = engagedNemesis(s, HOOD, opts.seat ?? P1);
    s = hood.state;
    if (opts.stunned)
      s = patchInstance(s, hood.id, { statuses: { ...inst(s, hood.id).statuses, stunned: opts.stunned } });
    return { s, hood: hood.id, scheme: scheme?.id ?? null };
  }
  const round = (s: GameState) => endRound(s, picker(), P1, P2);

  it("Hood engaged with you attacks in the villain phase: Criminal Underworld goes from 4 to 5 threat", () => {
    const t = table();
    const { state, events } = round(t.s);
    expect(inst(state, t.scheme!).threat).toBe(5);
    expect(
      ofType(events, "abilityResolved").filter((e) => e.abilityId === "56024.the-hood-forced-response"),
    ).toHaveLength(1);
  });

  it("it is the Hood's attack that counts, not the one on you: engaged with the other seat's hero it still places the threat", () => {
    const t = table({ seat: P2 });
    const { state } = round(t.s);
    expect(inst(state, t.scheme!).threat).toBe(5);
  });

  // Steady (data): the Hood holds a second stunned card, and is not stunned until it has two.
  it("one stun card does not stop him (steady): he attacks, the threat is placed and the card stays", () => {
    const t = table({ stunned: 1 });
    const { state } = round(t.s);
    expect(inst(state, t.scheme!).threat).toBe(5);
    expect(inst(state, t.hood).statuses.stunned).toBe(1);
  });

  it("two stun cards stop the attack: no threat is placed and the attack is replaced", () => {
    const t = table({ stunned: 2 });
    const { state } = round(t.s);
    expect(inst(state, t.scheme!).threat).toBe(4);
  });

  it("with Criminal Underworld out of play there is nothing to place on and nothing else changes", () => {
    const t = table({ underworld: false });
    const control = round(withForm(fillers(tigraHeroGame({ twoPlayers: true })), { heroForm: 0 }, P2));
    const { state } = round(t.s);
    expect(mainThreat(state)).toBe(mainThreat(control.state));
    expect(playerOf(state, P1).setAside.map((i) => codeOf(state, i))).toContain(UNDERWORLD);
  });
});

describe("56028.jigsaw-forced-response: after Jigsaw attacks and damages a character, 2 threat on Criminal Underworld", () => {
  function table(
    opts: { readonly underworld?: boolean; readonly alterEgo?: boolean; readonly stunned?: boolean } = {},
  ) {
    let s = fillers(tigraHeroGame());
    if (opts.alterEgo) s = withForm(s, "alterEgo");
    const scheme = opts.underworld === false ? null : sideSchemeIn(s, UNDERWORLD, 4);
    if (scheme) s = scheme.state;
    const jigsaw = engagedNemesis(s, JIGSAW);
    s = jigsaw.state;
    if (opts.stunned) s = patchInstance(s, jigsaw.id, { statuses: { ...inst(s, jigsaw.id).statuses, stunned: 1 } });
    return { s, jigsaw: jigsaw.id, scheme: scheme?.id ?? null };
  }
  const defending: Picker = picker();
  const defendWithIdentity: Picker = (s) =>
    s.pendingChoice!.prompt.kind === "declareDefender" &&
    s.pendingChoice!.options.some((o) => o.optionId === identityOf(s))
      ? [identityOf(s)]
      : firstLegal(s);

  it("Jigsaw attacks Tigra in the villain phase and damages her (2): Criminal Underworld goes from 4 to 6", () => {
    const t = table();
    const { state, events } = endRound(t.s, defending);
    expect(inst(state, t.scheme!).threat).toBe(6);
    expect(damageOf(state)).toBe(4); // Rhino 2 and Jigsaw 2
    expect(
      ofType(events, "abilityResolved").filter((e) => e.abilityId === "56028.jigsaw-forced-response"),
    ).toHaveLength(1);
  });

  it("an attack that damages nobody (Tigra defends it with her 3 defense) places no threat", () => {
    const t = table();
    // Rhino stunned, so Jigsaw's attack is the one Tigra defends: 2 damage against 3 defense is none.
    const quiet = patchInstance(t.s, villainOf(t.s), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { state } = endRound(quiet, defendWithIdentity);
    expect(damageOf(state)).toBe(0);
    expect(inst(state, t.scheme!).threat).toBe(4);
    // Control: the same round with her not defending.
    const control = endRound(quiet, defending);
    expect(damageOf(control.state)).toBe(2);
    expect(inst(control.state, t.scheme!).threat).toBe(6);
  });

  it("a stunned Jigsaw does not attack: no threat", () => {
    const t = table({ stunned: true });
    const { state } = endRound(t.s, defending);
    expect(inst(state, t.scheme!).threat).toBe(4);
    expect(inst(state, t.jigsaw).statuses.stunned).toBe(0);
  });

  it("against an alter ego he schemes instead of attacking: no threat on Criminal Underworld", () => {
    const t = table({ alterEgo: true });
    const { state } = endRound(t.s, defending);
    expect(inst(state, t.scheme!).threat).toBe(4);
  });

  it("with Criminal Underworld out of play nothing is placed and the attack still hurts", () => {
    const t = table({ underworld: false });
    const { state } = endRound(t.s, defending);
    expect(damageOf(state)).toBe(4);
  });

  it("revealed from the encounter deck he quickstrikes at once, and that attack places the threat too", () => {
    let s = fillers(tigraHeroGame());
    const scheme = sideSchemeIn(s, UNDERWORLD, 4);
    s = stackSetAside(scheme.state, JIGSAW);
    // Rhino's boost card first, then Jigsaw is the player's own reveal.
    const deckId = activeEncounterDeckId(s);
    const [jigsaw, filler, ...rest] = piles(s).deck;
    s = { ...s, encounterDecks: { ...s.encounterDecks, [deckId]: { ...piles(s), deck: [filler!, jigsaw!, ...rest] } } };
    const { state } = endRound(s, defending);
    expect(codeOf(state, jigsaw!)).toBe(JIGSAW);
    expect(inst(state, jigsaw!).engagedWith).toBe(P1);
    expect(inst(state, scheme.id).threat).toBe(6);
    expect(damageOf(state)).toBe(4); // Rhino 2 and Jigsaw's quickstrike 2
  });
});

describe("Jigsaw (56028) with overkill: FFG ruling January 11, 2026 - Ruling 2 (3)", () => {
  // January 11, 2026 - Ruling 2 (3): "Yes, if Jigsaw attacks with overkill and damages both an ally and an identity,
  // his Forced Response triggers twice and places 4 total threat." Jigsaw's text: "After Jigsaw attacks and damages a
  // character, place 2 threat on the Criminal Underworld side scheme." RRG 1.8 "Overkill" p. 31 (excess damage is
  // damage from the attack) and p. 44 (one occurrence with several triggering conditions: one response window, "used
  // in any order"). Same root cause as bug-list `overkill-damaged-characters`: `56028.jigsaw-forced-response` is
  // `after.enemyAttacks("self", { damages: true })`, which fires once per attack.
  const SERUM = "56145"; // Super-Soldier Serum: "When he attacks, that attack gains overkill" (+2 ATK), here a source of overkill
  const MOON_KNIGHT = "56002"; // ally, 3 hit points
  function board() {
    let s = tigraHeroGame();
    // The Serum comes off the top of the encounter deck and onto Jigsaw (surgery), then every other top card is Advance.
    const [serum] = piles(s).deck;
    const deckId = Object.keys(s.encounterDecks)[0]!;
    s = { ...s, encounterDecks: { ...s.encounterDecks, [deckId]: { ...piles(s), deck: piles(s).deck.slice(1) } } };
    s = fillers(s);
    const scheme = fromSetAside(s, UNDERWORLD);
    s = {
      ...scheme.state,
      villainArea: [...scheme.state.villainArea, scheme.id],
      instances: {
        ...scheme.state.instances,
        [scheme.id]: { ...scheme.state.instances[scheme.id]!, faceup: true, threat: 4 },
      },
    };
    const jig = fromSetAside(s, JIGSAW);
    s = {
      ...jig.state,
      players: jig.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, jig.id] } : p)),
    };
    s = patchInstance(s, jig.id, { faceup: true, controllerId: null, engagedWith: P1 });
    s = patchInstance(s, serum!, { cardId: cardId(SERUM), faceup: true, attachedTo: jig.id });
    s = patchInstance(s, jig.id, { attachments: [serum!] });
    const ally = stagedInPlay(s, MOON_KNIGHT);
    s = patchInstance(ally.state, s.activeVillainId!, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    return { s, scheme: scheme.id, jig: jig.id, ally: ally.id };
  }
  const defendWith =
    (ally: InstanceId): Picker =>
    (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "declareDefender") return [ally];
      if (c.prompt.kind === "orderEnemies") return c.options.map((o) => o.optionId);
      return firstLegal(s);
    };

  it("places 2 threat for the ally it damages and 2 for the identity the overkill damages: 4 in all", () => {
    const t = board();
    const run = driveEventsPicking(WAVE10_DEPS, t.s, defendWith(t.ally), endTurn(P1));
    expect(playerOf(run.state, P1).discard).toContain(t.ally);
    // Staging check: the ally (3 hit points) is defeated by Jigsaw's 4 ATK and the 1 excess reaches Tigra.
    expect(inst(run.state, identityOf(run.state)).damage).toBe(1);
    expect(inst(run.state, t.scheme).threat).toBe(8);
  });
});

describe("56027 Madame Masque", () => {
  /** Masque revealed in a real villain phase as P1's own card (one filler first for Rhino's boost card). */
  function reveal(
    start: GameState,
    inPlay: { readonly threat: number } | null,
    where: "setAside" | "discard" = "setAside",
  ) {
    let s = fillers(start);
    let scheme: InstanceId | null = null;
    if (inPlay) {
      const placed = sideSchemeIn(s, UNDERWORLD, inPlay.threat);
      s = placed.state;
      scheme = placed.id;
    } else if (where === "discard") {
      const found = fromSetAside(s, UNDERWORLD);
      s = found.state;
      const deckId = activeEncounterDeckId(s);
      s = {
        ...s,
        encounterDecks: { ...s.encounterDecks, [deckId]: { ...piles(s), discard: [...piles(s).discard, found.id] } },
      };
    }
    s = stackSetAside(s, MASQUE);
    const deckId = activeEncounterDeckId(s);
    const [masque, ...others] = piles(s).deck;
    const boosts = s.players.length; // the villain activates against each player: one boost card each, then the deal
    s = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { ...piles(s), deck: [...others.slice(0, boosts), masque!, ...others.slice(boosts)] },
      },
    };
    const run = endRound(s, picker(), ...s.players.map((p) => p.playerId));
    return { ...run, masque: masque!, scheme };
  }
  const underworldIn = (s: GameState): InstanceId | undefined => s.villainArea.find((i) => codeOf(s, i) === UNDERWORLD);

  it("When Revealed with Criminal Underworld in play: 2 threat on it (4 to 6), and she engages you", () => {
    const r = reveal(tigraHeroGame(), { threat: 4 });
    expect(inst(r.state, r.scheme!).threat).toBe(6);
    expect(inst(r.state, r.masque).engagedWith).toBe(P1);
    expect(inPlayArea(r.state, r.masque)).toBe(true);
  });

  it("When Revealed with the side scheme set aside: it is found and revealed, with its 4 threat (not 6), in a two-player game", () => {
    const r = reveal(tigraHeroGame({ twoPlayers: true }), null);
    const found = underworldIn(r.state);
    expect(found).toBeDefined();
    expect(inst(r.state, found!).threat).toBe(4);
    expect(playerOf(r.state, P1).setAside.map((i) => codeOf(r.state, i))).not.toContain(UNDERWORLD);
  });

  it("When Revealed with the side scheme in the encounter discard pile: it is found there and revealed", () => {
    const r = reveal(tigraHeroGame(), null, "discard");
    const found = underworldIn(r.state);
    expect(found).toBeDefined();
    expect(inst(r.state, found!).threat).toBe(4);
    expect(piles(r.state).discard).not.toContain(found);
  });

  /** Masque as Rhino's boost card (the top of the deck) on his attack against Tigra, who does not defend. */
  function asBoost(start: GameState, withScheme: boolean) {
    let s = fillers(start);
    let scheme: InstanceId | null = null;
    if (withScheme) {
      const placed = sideSchemeIn(s, UNDERWORLD, 4);
      s = placed.state;
      scheme = placed.id;
    }
    s = stackSetAside(s, MASQUE);
    const masque = piles(s).deck[0]!;
    // Rhino stunned would not draw the card; he attacks (2) and the boost card is Masque.
    const run = endRound(s, picker());
    return { ...run, masque, scheme };
  }

  it("as a boost card with Criminal Underworld in play: 2 threat on it, no extra boost icons (Rhino deals just 2)", () => {
    const r = asBoost(tigraHeroGame(), true);
    expect(inst(r.state, r.scheme!).threat).toBe(6);
    expect(damageOf(r.state)).toBe(2);
  });

  it("as a boost card with Criminal Underworld out of play: she gains 2 boost icons, so Rhino deals 2 + 2", () => {
    const r = asBoost(tigraHeroGame(), false);
    expect(damageOf(r.state)).toBe(4);
    expect(underworldIn(r.state)).toBeUndefined();
  });

  it("as the control, a plain Advance as the boost card leaves Rhino's attack at 2", () => {
    const control = endRound(fillers(tigraHeroGame()), picker());
    expect(damageOf(control.state)).toBe(2);
  });
});

describe("56026 The Hood's Mantle", () => {
  /** A hand card of `player` re-labelled as a Core card (Core's resource cards), so its printed resource is known. */
  const resourceCode = (type: "energy" | "physical"): string =>
    (
      CORE_CARDS.find((c) => {
        const icons = (c as { resourceIcons?: Record<string, number> }).resourceIcons ?? {};
        return Object.values(icons).reduce((a, b) => a + b, 0) === 1 && icons[type] === 1;
      }) as { id: string }
    ).id as string;
  function withResourceCards(state: GameState, player: PlayerId, types: readonly ("energy" | "physical")[]) {
    const hand = playerOf(state, player).hand;
    let s = state;
    const ids = types.map((type, n) => {
      const id = hand[n]!;
      s = patchInstance(s, id, { cardId: cardId(resourceCode(type)) });
      return id;
    });
    return { state: s, ids };
  }
  /** The Mantle revealed in the villain phase as P1's own card, over a Hood in play (or not). */
  function revealed(opts: { readonly hood: boolean; readonly players?: 1 | 2 }) {
    let s = fillers(tigraHeroGame({ twoPlayers: opts.players === 2 }));
    let hood: InstanceId | null = null;
    if (opts.hood) {
      const h = engagedNemesis(s, HOOD);
      s = h.state;
      hood = h.id;
    }
    s = stackSetAside(s, MANTLE);
    const deckId = activeEncounterDeckId(s);
    const [mantle, ...others] = piles(s).deck;
    // One boost card for each activation of the villain (one per player), one more for The Hood, a villainous minion
    // that activates right after the villain; then the deal.
    const boosts = s.players.length + (opts.hood ? 1 : 0);
    s = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { ...piles(s), deck: [...others.slice(0, boosts), mantle!, ...others.slice(boosts)] },
      },
    };
    const run = endRound(s, picker(), ...s.players.map((p) => p.playerId));
    return { ...run, mantle: mantle!, hood };
  }
  const attackHood = (s: GameState, hood: InstanceId, pick: Picker, player: PlayerId = P1) => {
    const kinds: string[] = [];
    const run = driveEventsPicking(
      WAVE10_DEPS,
      s,
      (st) => {
        kinds.push(st.pendingChoice!.prompt.kind);
        return pick(st);
      },
      { type: "basicAttack", playerId: player, attackerInstanceId: identityOf(s, player), targetInstanceId: hood },
    );
    return { ...run, kinds };
  };
  const accepting =
    (pay: readonly InstanceId[]): Picker =>
    (st) => {
      const c = st.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers") {
        const take = c.options.find((o) => o.optionId.includes(MANTLE_RESPONSE));
        return take ? [take.optionId] : firstLegal(st);
      }
      if (c.prompt.kind === "payForAbility") return pay.map((id) => `hand:${id}`);
      return firstLegal(st);
    };

  it("revealed with The Hood in play it attaches to him (+1 ATK, +1 SCH: ATK 2, SCH 2)", () => {
    const r = revealed({ hood: true });
    expect(inst(r.state, r.mantle).attachedTo).toBe(r.hood);
    expect(r.events.filter((e) => e.type === "abilityResolved" && e.abilityId === "56026.boost")).toHaveLength(0);
    expect(inst(r.state, r.hood!).attachments).toContain(r.mantle);
    expect([profile(r.state, r.hood!).atk, profile(r.state, r.hood!).sch]).toEqual([2, 2]);
    expect(profile(r.state, villainOf(r.state)).atk).toBe(2);
  });

  it("revealed with no Hood in play it attaches to the villain", () => {
    const r = revealed({ hood: false });
    expect(inst(r.state, r.mantle).attachedTo).toBe(villainOf(r.state));
    expect(r.events.filter((e) => e.type === "abilityResolved" && e.abilityId === "56026.boost")).toHaveLength(0);
    expect(profile(r.state, villainOf(r.state)).atk).toBe(3);
  });

  /** The Mantle as Rhino's boost card (top of the deck), Hood in play or not. */
  function asBoost(hood: boolean) {
    let s = fillers(tigraHeroGame());
    let hoodId: InstanceId | null = null;
    if (hood) {
      const h = engagedNemesis(s, HOOD);
      s = h.state;
      hoodId = h.id;
    }
    s = stackSetAside(s, MANTLE);
    const mantle = piles(s).deck[0]!;
    const run = endRound(s, picker());
    return { ...run, mantle, hood: hoodId };
  }
  it("as a boost card with The Hood in play: it attaches to him, and is not discarded as a boost", () => {
    const r = asBoost(true);
    expect(inst(r.state, r.mantle).attachedTo).toBe(r.hood);
    expect(r.events.filter((e) => e.type === "abilityResolved" && e.abilityId === "56026.boost")).toHaveLength(1);
    expect(piles(r.state).discard).not.toContain(r.mantle);
    expect(inst(r.state, villainOf(r.state)).boostCards).not.toContain(r.mantle);
  });
  it("as a boost card with no Hood in play: it attaches to the villain", () => {
    const r = asBoost(false);
    expect(inst(r.state, r.mantle).attachedTo).toBe(villainOf(r.state));
    expect(r.events.filter((e) => e.type === "abilityResolved" && e.abilityId === "56026.boost")).toHaveLength(1);
    expect(piles(r.state).discard).not.toContain(r.mantle);
  });

  /** The Hood with the Mantle on him in the next player phase, and Tigra with an energy and a physical resource in hand. */
  function readyToStrip(players: 1 | 2 = 1) {
    const r = revealed({ hood: true, players });
    let s = withForm(r.state, { heroForm: 0 });
    s = patchInstance(s, identityOf(s), { exhausted: false });
    const pay = withResourceCards(s, P1, ["energy", "physical"]);
    return { ...r, s: pay.state, pay: pay.ids };
  }

  it("after Tigra's basic attack on the Hood it can be paid for with an energy and a physical resource: the Mantle is discarded", () => {
    const t = readyToStrip();
    expect(inst(t.s, t.mantle).attachedTo).toBe(t.hood);
    const { state, kinds } = attackHood(t.s, t.hood!, accepting(t.pay));
    expect(kinds).toContain("chooseTriggers");
    expect(kinds).toContain("payForAbility");
    expect(piles(state).discard).toContain(t.mantle);
    expect(inst(state, t.mantle).attachedTo).toBeNull();
    expect(inst(state, t.hood!).attachments).not.toContain(t.mantle);
    expect(playerOf(state, P1).hand).not.toEqual(expect.arrayContaining([...t.pay]));
    expect(damageOf(state, t.hood!)).toBe(2);
  });

  it("it is a choice: declined, the Mantle stays on the Hood", () => {
    const t = readyToStrip();
    const { state } = attackHood(t.s, t.hood!, firstLegal);
    expect(inst(state, t.mantle).attachedTo).toBe(t.hood);
  });

  it("paid with an energy resource alone it cannot be paid: the Mantle stays", () => {
    const t = readyToStrip();
    const { state } = attackHood(t.s, t.hood!, accepting(t.pay.slice(0, 1)));
    expect(inst(state, t.mantle).attachedTo).toBe(t.hood);
  });

  it("an attack on a different enemy (the villain, a Shocker) does not offer it", () => {
    const t = readyToStrip();
    const withShocker = engageMinion(t.s, SHOCKER, "shocker");
    for (const target of [villainOf(t.s), "shocker" as InstanceId]) {
      const { kinds, state } = attackHood(withShocker, target, accepting(t.pay));
      expect(kinds).not.toContain("payForAbility");
      expect(inst(state, t.mantle).attachedTo).toBe(t.hood);
    }
  });

  it("two players: the other seat's hero attacking the Hood is offered it too and strips it with their own resources", () => {
    const t = readyToStrip(2);
    let s = withForm(t.s, { heroForm: 0 }, P2);
    s = patchInstance(s, identityOf(s, P2), { exhausted: false });
    const theirs = withResourceCards(s, P2, ["energy", "physical"]);
    const { state, kinds } = attackHood(theirs.state, t.hood!, accepting(theirs.ids), P2);
    expect(kinds).toContain("payForAbility");
    expect(piles(state).discard).toContain(t.mantle);
    expect(playerOf(state, P1).hand).toEqual(playerOf(theirs.state, P1).hand);
  });
});
