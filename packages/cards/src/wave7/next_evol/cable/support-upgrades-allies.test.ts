import {
  applyCommand,
  characterProfile,
  createGame,
  statBonus,
  traitsOf,
  type CardInstance,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { cardId, trait } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  applyOk,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  resourceAbility,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, driveStepwise, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../../index.js";
import { CABLE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

const PURGE_CONSTANT = "40006.technovirus-purge-constant";
const PURGE_VICTORY = "40006.technovirus-purge-constant-2";
const GRAYMALKIN_RESPONSE = "40007.graymalkin-response";
const GRAYMALKIN_RESOURCE = "40007.graymalkin-resource";
const PROFESSOR = "40008.professor-action";
const ASKANISON = "40009.askanison-response";
const FORCED_AMNESIA = "40010.forced-amnesia-response";
const PLASMA_RIFLE = "40011.plasma-rifle-action";
const FORCE_FIELD = "40012.telekinetic-force-field-interrupt";
const TEMPORAL_LEAP = "40013.temporal-leap-interrupt";
const ALL_REFS = [
  PURGE_CONSTANT,
  PURGE_VICTORY,
  GRAYMALKIN_RESPONSE,
  GRAYMALKIN_RESOURCE,
  PROFESSOR,
  ASKANISON,
  FORCED_AMNESIA,
  PLASMA_RIFLE,
  FORCE_FIELD,
  TEMPORAL_LEAP,
];
const CABLE = { starterDeckId: "cable-leadership" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const PURGE = "40006";
const GRAYMALKIN = "40007";
const BREAKIN = "40131"; // Captive Hope: an encounter side scheme, staged (3 threat per player when revealed)
const PLAYER_SCHEMES = ["40018", "40019", "40020", "40027"];
const MORLOCK_SCHEME = "40084"; // an encounter side scheme (3 threat) of the Morlock Siege scenario
const TERRITORIAL_CONTROL = "40087"; // a Morlock Siege side scheme with a crisis icon

type Seat = typeof CABLE | typeof SPIDER_MAN;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;

const choosing =
  (code: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards") {
      const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === code);
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

/** Cable in hero form, `scheme` (default Technovirus Purge) in play through Soldier X's Setup. */
function heroGame(players: readonly Seat[] = [CABLE], scheme = PURGE, seed = 1, scenario = "juggernaut"): GameState {
  const config = wave7Scenario(scenario, { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, choosing(scheme), (s) => s.step.phase === "player", WAVE7_DEPS);
  const hero = withForm(settled, { heroForm: 0 });
  return patchInstance(hero, hero.mainScheme.instanceId, { threat: 4 });
}
const purgeOf = (s: GameState): InstanceId => instancesOf(s, PURGE)[0]!;
const cableOf = (s: GameState): InstanceId => identityOf(s, P1);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });
const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;

function toVictory(state: GameState, id: InstanceId): GameState {
  return {
    ...patchInstance(state, id, { threat: 0 }),
    villainArea: state.villainArea.filter((x) => x !== id),
    victoryDisplay: [...state.victoryDisplay, id],
    players: state.players.map((p) => ({
      ...p,
      deck: p.deck.filter((x) => x !== id),
      hand: p.hand.filter((x) => x !== id),
      discard: p.discard.filter((x) => x !== id),
    })),
  };
}
/** `n` side schemes in the victory display: Purge (from play), Captive Hope, then Cable's own. */
function withVictory(state: GameState, n: number, encounterScheme = BREAKIN): GameState {
  let s = state;
  const sources: InstanceId[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) sources.push(purgeOf(s));
    else if (i === 1) {
      const staged = encounterCardInVillainArea(s, encounterScheme, 2);
      s = staged.state;
      sources.push(staged.id);
    } else sources.push(instancesOf(s, PLAYER_SCHEMES[i - 2]!)[0]!);
  }
  for (const id of sources) s = toVictory(s, id);
  return s;
}

/** Plays `code` from hand (an upgrade attached to `attach`), paying `cost` with hand cards other than `keep`. */
function put(
  state: GameState,
  code: string,
  cost: number,
  opts: { attach?: InstanceId; keep?: readonly InstanceId[]; player?: typeof P1; pick?: Picker } = {},
): { state: GameState; id: InstanceId; before: GameState } {
  const player = opts.player ?? P1;
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const payment = payWith(given.state, player, cost, [id, ...(opts.keep ?? [])]);
  const driven = driveEventsPicking(
    WAVE7_DEPS,
    given.state,
    opts.pick ?? firstLegal,
    play(player, id, payment, opts.attach ? { attachToInstanceId: opts.attach } : {}),
  );
  return { state: driven.state, id, before: given.state };
}
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;
const basicThwart = (player: typeof P1, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const basicAttack = (player: typeof P1, attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
/** Accepts every optional response whose id contains one of `wanted`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return firstLegal(state);
  };
/** Every response id offered while `pick` drives `command`. */
function driveOffers(
  state: GameState,
  pick: Picker,
  ...commands: Command[]
): { state: GameState; offered: Set<string>; events: readonly GameEvent[] } {
  const offered = new Set<string>();
  const spy: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTriggers")
      for (const o of s.pendingChoice.options) offered.add(o.optionId);
    return pick(s);
  };
  const result = driveEventsPicking(WAVE7_DEPS, state, spy, ...commands);
  return { state: result.state, offered, events: result.events };
}
/** Whether `ability` of `card` resolved in `events`. */
const resolvedAbility = (events: readonly GameEvent[], card: InstanceId, ability: string): boolean =>
  events.some((e) => e.type === "abilityResolved" && e.instanceId === card && e.abilityId === ability);
const hasOffer = (offered: Set<string>, ref: string): boolean => [...offered].some((o) => o.includes(ref));

describe("Cable supports and upgrades registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(CABLE_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });
  it("holds exactly the ten refs of 40006-40013", () => {
    expect(Object.keys(CABLE_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...ALL_REFS].sort());
  });
});

const PSIONIC = trait("PSIONIC");
const WHIPLASH = "01172"; // a minion with Retaliate 1
const profileOf = (s: GameState, player: typeof P1 = P1) => characterProfile(s, identityOf(s, player), WAVE7_DEPS)!;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const handOf = (s: GameState, player: typeof P1 = P1) => playerOf(s, player).hand;
const discardOf = (s: GameState, player: typeof P1 = P1) => playerOf(s, player).discard;

/** A Whiplash engaged with `player` (Retaliate 1, 4 hit points), put in by surgery. */
function withWhiplash(state: GameState, player: typeof P1 = P1): { state: GameState; id: InstanceId } {
  const id = "i9000" as InstanceId;
  const instance = {
    instanceId: id,
    cardId: cardId(WHIPLASH),
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: player,
    flipped: false,
  } as unknown as CardInstance;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: instance },
    },
  };
}

/** Plays a villain phase: `defend` names the defender Cable declares at the first prompt (else nobody defends). */
function villainPhase(
  state: GameState,
  opts: {
    accept?: readonly string[];
    defender?: InstanceId;
    payWith?: InstanceId;
    target?: InstanceId;
    choose?: string;
    /** Answers a prompt first; `undefined` leaves it to the defaults. */
    first?: (s: GameState) => readonly string[] | undefined;
  } = {},
): { state: GameState; offered: Set<string>; snapshots: GameState[]; events: readonly GameEvent[] } {
  const snapshots: GameState[] = [];
  const pick: Picker = (s) => {
    const c = s.pendingChoice;
    snapshots.push(s);
    const early = opts.first?.(s);
    if (early) return early;
    if (c?.prompt.kind === "declareDefender")
      return opts.defender && c.options.some((o) => o.optionId === opts.defender) ? [opts.defender] : ["decline"];
    if (c?.prompt.kind === "payForAbility") return opts.payWith ? [`hand:${opts.payWith}`] : firstLegal(s);
    if (c?.prompt.kind === "chooseCards" && opts.choose) {
      const hit = c.options.find((o) => codeOf(s, o.optionId as InstanceId) === opts.choose);
      if (hit) return [hit.optionId];
    }
    if (c?.prompt.kind === "chooseTarget" && opts.target && c.options.some((o) => o.optionId === opts.target))
      return [opts.target];
    return accepting(...(opts.accept ?? []))(s);
  };
  const result = driveOffers(state, pick, ...state.players.map((p) => endTurn(p.playerId)));
  return { ...result, snapshots };
}
/** Surgery: `player`'s hand is exactly `cards`. */
const handIs = (state: GameState, player: typeof P1, ...cards: readonly InstanceId[]): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...cards] } : p)),
});

describe("Technovirus Purge (40006)", () => {
  it("enters play with 5 threat from Soldier X's Setup, no matter the player count", () => {
    const one = heroGame();
    expect(threat(one, purgeOf(one))).toBe(5);
    const two = heroGame([CABLE, SPIDER_MAN]);
    expect(threat(two, purgeOf(two))).toBe(5);
  });

  it("played from hand (cost 0) it enters with 5 threat; with another scheme in play the limit of one discards a scheme", () => {
    const base = heroGame([CABLE], "40019");
    const lockAndLoad = instancesOf(base, "40019")[0]!;
    expect(base.villainArea).toContain(lockAndLoad);
    const given = moveToHand(base, P1, PURGE);
    const [purge] = given.ids as [InstanceId];
    // The limit prompt asks the first player which scheme to discard: Lock and Load.
    const prompts: string[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c) prompts.push(c.prompt.kind);
      return c && c.options.some((o) => o.optionId === lockAndLoad) ? [lockAndLoad] : firstLegal(s);
    };
    const { state } = driveEventsPicking(WAVE7_DEPS, given.state, pick, play(P1, purge, []));
    expect(state.villainArea).toContain(purge);
    expect(threat(state, purge)).toBe(5);
    expect(state.villainArea).not.toContain(lockAndLoad);
    expect(discardOf(state)).toContain(lockAndLoad);
    expect(handOf(state)).not.toContain(purge);
  });

  it("Cable's basic thwart removes his THW from it: 5 -> 3", () => {
    const base = heroGame();
    const { state } = driveOffers(base, firstLegal, basicThwart(P1, cableOf(base), purgeOf(base)));
    expect(threat(state, purgeOf(state))).toBe(3);
  });

  it("only Cable removes threat: his ally's basic thwart on it is refused, but works on another scheme", () => {
    const base = heroGame();
    const cable = cableOf(base);
    const { state: ally0, id: caliban } = put(base, "40014", 3, {});
    expect(inst(ally0, caliban).home).toEqual({ kind: "player" });
    expect(rejected(ally0, basicThwart(P1, caliban, purgeOf(ally0)))).toBe(true);
    expect(threat(ally0, purgeOf(ally0))).toBe(5);
    const staged = encounterCardInVillainArea(ally0, BREAKIN, 3);
    expect(rejected(staged.state, basicThwart(P1, caliban, staged.id))).toBe(false);
    // Cable himself is not refused.
    expect(rejected(ally0, basicThwart(P1, cable, purgeOf(ally0)))).toBe(false);
  });

  it("two players: another hero's basic thwart is refused on it and allowed on a different scheme", () => {
    const base = heroGame([CABLE, SPIDER_MAN]);
    const spider = identityOf(base, P2);
    // P1 ends the turn; it is P2's turn, Spider-Man in hero form.
    const turn2 = withForm(driveEventsPicking(WAVE7_DEPS, base, firstLegal, endTurn(P1)).state, { heroForm: 0 }, P2);
    const onPurge = applyCommand(turn2, basicThwart(P2, spider, purgeOf(turn2)), WAVE7_DEPS);
    expect(onPurge.ok).toBe(false);
    expect(onPurge.ok ? "" : onPurge.error.message).not.toMatch(/turn/);
    const staged = encounterCardInVillainArea(turn2, BREAKIN, 6);
    const elsewhere = applyCommand(staged.state, basicThwart(P2, spider, staged.id), WAVE7_DEPS);
    expect(elsewhere.ok ? "ok" : elsewhere.error.message).toBe("ok");
  });

  it("Cable's own events and upgrades count as Cable: Mind Scan (an event) removes threat from it", () => {
    const base = heroGame();
    const given = moveToHand(base, P1, "40003");
    const [scan] = given.ids as [InstanceId];
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(purgeOf(base))(s) : firstLegal(s)),
      play(P1, scan, payWith(given.state, P1, 2, [scan])),
    );
    expect(threat(state, purgeOf(state))).toBe(2);
  });

  it("thwarted to 0 it goes to the victory display and Cable's identity response hears it", () => {
    const base = heroGame();
    const cable = cableOf(base);
    const staged = patchInstance(patchInstance(base, purgeOf(base), { threat: 2 }), cable, { exhausted: false });
    const { state, offered } = driveOffers(
      staged,
      accepting("40001a.cable-response"),
      basicThwart(P1, cable, purgeOf(staged)),
    );
    expect(hasOffer(offered, "40001a.cable-response")).toBe(true);
    expect(state.victoryDisplay).toEqual([purgeOf(state)]);
    expect(state.villainArea).not.toContain(purgeOf(state));
    expect(threat(state, purgeOf(state))).toBe(0);
    expect(inst(state, cable).exhausted).toBe(false);
  });

  it("in the victory display both of Cable's faces gain PSIONIC and the hero face gets +1 THW, ATK and DEF", () => {
    const base = heroGame();
    expect(traitsOf(base, cableOf(base), WAVE7_DEPS)).not.toContain(PSIONIC);
    expect([profileOf(base).thw, profileOf(base).atk, profileOf(base).def]).toEqual([2, 2, 2]);
    const inDisplay = withVictory(base, 1);
    expect(traitsOf(inDisplay, cableOf(inDisplay), WAVE7_DEPS)).toContain(PSIONIC);
    expect([profileOf(inDisplay).thw, profileOf(inDisplay).atk, profileOf(inDisplay).def]).toEqual([3, 3, 3]);
    // Alter-ego form: the trait only, no stat bonus.
    const alterEgo = withForm(inDisplay, "alterEgo");
    expect(traitsOf(alterEgo, cableOf(alterEgo), WAVE7_DEPS)).toContain(PSIONIC);
    expect([0, 0, 0]).toEqual(
      ["thw", "atk", "def"].map(() => statBonus(alterEgo, WAVE7_DEPS, cableOf(alterEgo), "thw")),
    );
  });

  it("the bonus is gone as soon as it leaves the victory display, and an encounter scheme there gives none", () => {
    const base = heroGame();
    const staged = encounterCardInVillainArea(base, BREAKIN, 3);
    const withHope = toVictory(staged.state, staged.id);
    expect(profileOf(withHope).thw).toBe(2);
    expect(traitsOf(withHope, cableOf(withHope), WAVE7_DEPS)).not.toContain(PSIONIC);
    const out = { ...withVictory(base, 1) };
    const back: GameState = { ...out, victoryDisplay: [], villainArea: [...out.villainArea, purgeOf(out)] };
    expect(profileOf(back).thw).toBe(2);
  });

  it("two players: Spider-Man (the other hero) gets neither the trait nor the stats from Cable's copy", () => {
    const base = withForm(withVictory(heroGame([CABLE, SPIDER_MAN]), 1), { heroForm: 0 }, P2);
    const without = withForm(heroGame([CABLE, SPIDER_MAN]), { heroForm: 0 }, P2);
    expect(profileOf(base, P1).thw).toBe(3);
    expect(profileOf(base, P2)).toEqual(profileOf(without, P2));
    expect(traitsOf(base, identityOf(base, P2), WAVE7_DEPS)).not.toContain(PSIONIC);
  });
});

const byLabel =
  (label: string): Picker =>
  (s) => {
    const o = s.pendingChoice?.options.find((x) => x.label === label);
    return o ? [o.optionId] : firstLegal(s);
  };

describe("Graymalkin (40007)", () => {
  const readyAfterThwart = (state: GameState, gm: InstanceId, thwarter: typeof P1, scheme: InstanceId) => {
    const exhausted = patchInstance(state, gm, { exhausted: true });
    const who = identityOf(exhausted, thwarter);
    return driveOffers(
      exhausted,
      accepting(GRAYMALKIN_RESPONSE, "40001a.cable-response"),
      basicThwart(thwarter, who, scheme),
    );
  };

  it("costs 2; after a player side scheme is defeated (by Cable) it readies", () => {
    const base = heroGame();
    const { state, id: gm } = put(base, GRAYMALKIN, 2);
    expect(inst(state, gm).home).toEqual({ kind: "player" });
    expect(handOf(state)).toHaveLength(handOf(base).length - 2);
    const staged = patchInstance(state, purgeOf(state), { threat: 2 });
    const { state: after, offered } = readyAfterThwart(staged, gm, P1, purgeOf(staged));
    expect(hasOffer(offered, GRAYMALKIN_RESPONSE)).toBe(true);
    expect(after.victoryDisplay).toEqual([purgeOf(after)]);
    expect(inst(after, gm).exhausted).toBe(false);
  });

  it("also readies when an encounter side scheme is defeated, and not when no scheme is", () => {
    const base = heroGame();
    const { state, id: gm } = put(base, GRAYMALKIN, 2);
    const staged = encounterCardInVillainArea(state, BREAKIN, 2);
    const { state: after, offered } = readyAfterThwart(staged.state, gm, P1, staged.id);
    expect(hasOffer(offered, GRAYMALKIN_RESPONSE)).toBe(true);
    expect(inst(after, gm).exhausted).toBe(false);
    // Purge only loses 2 of 5 threat: not defeated, so no response and Graymalkin stays exhausted.
    const none = readyAfterThwart(state, gm, P1, purgeOf(state));
    expect(hasOffer(none.offered, GRAYMALKIN_RESPONSE)).toBe(false);
    expect(inst(none.state, gm).exhausted).toBe(true);
  });

  it("two players: Spider-Man defeating a scheme readies Cable's Graymalkin (any side scheme, anyone)", () => {
    const base = heroGame([CABLE, SPIDER_MAN]);
    const { state, id: gm } = put(base, GRAYMALKIN, 2);
    const turn2 = withForm(driveEventsPicking(WAVE7_DEPS, state, firstLegal, endTurn(P1)).state, { heroForm: 0 }, P2);
    const staged = encounterCardInVillainArea(turn2, BREAKIN, 1);
    const { state: after, offered } = readyAfterThwart(staged.state, gm, P2, staged.id);
    expect(hasOffer(offered, GRAYMALKIN_RESPONSE)).toBe(true);
    expect(inst(after, gm).exhausted).toBe(false);
  });

  it("Resource: exhausting it generates 1 energy toward a cost; it cannot be used again while exhausted", () => {
    const base = heroGame();
    const { state, id: gm } = put(base, GRAYMALKIN, 2);
    const given = moveToHand(state, P1, "40003");
    const [scan] = given.ids as [InstanceId];
    const paid = payWith(given.state, P1, 1, [scan]);
    const command = play(P1, scan, paid, { abilities: [resourceAbility(gm, GRAYMALKIN_RESOURCE)] });
    const { state: after } = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(purgeOf(base))(s) : firstLegal(s)),
      command,
    );
    expect(inst(after, gm).exhausted).toBe(true);
    // Mind Scan cost 2 = Graymalkin's energy + one card of the hand.
    expect(handOf(after)).toHaveLength(handOf(given.state).length - 2);
    expect(threat(after, purgeOf(after))).toBe(2);
    const again = moveToHand(after, P1, "40003");
    const [scan2] = again.ids as [InstanceId];
    const refused = play(P1, scan2, payWith(again.state, P1, 1, [scan2]), {
      abilities: [resourceAbility(gm, GRAYMALKIN_RESOURCE)],
    });
    expect(rejected(again.state, refused)).toBe(true);
  });
});

describe("Professor (40008)", () => {
  const useProfessor = (state: GameState, prof: InstanceId, pick: Picker) =>
    driveEventsPicking(WAVE7_DEPS, state, pick, use(P1, prof, PROFESSOR));

  it("costs 1; Alter-Ego Action, exhaust: draw 1 card", () => {
    const base = withForm(heroGame(), "alterEgo");
    const { state: played, id: prof } = put(base, "40008", 1);
    const before = handOf(played).length;
    const deckBefore = playerOf(played, P1).deck.length;
    const { state } = useProfessor(played, prof, byLabel("Draw 1 card"));
    expect(inst(state, prof).exhausted).toBe(true);
    expect(handOf(state)).toHaveLength(before + 1);
    expect(playerOf(state, P1).deck).toHaveLength(deckBefore - 1);
  });

  it("or searches the deck and discard pile for a player side scheme, adds it to hand and shuffles", () => {
    const base = withForm(heroGame(), "alterEgo");
    const { state: played, id: prof } = put(base, "40008", 1);
    const wanted = instancesOf(played, "40018")[0]!;
    // Put Call for Backup in the discard pile so both zones are searched.
    const inDiscard: GameState = {
      ...played,
      players: played.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((x) => x !== wanted),
              deck: p.deck.filter((x) => x !== wanted),
              discard: [...p.discard, wanted],
            }
          : p,
      ),
    };
    let offered: string[] = [];
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseCards") {
        offered = s.pendingChoice.options.map((o) => codeOf(s, o.optionId as InstanceId));
        return [wanted];
      }
      return byLabel("Search for a player side scheme")(s);
    };
    const handBefore = handOf(inDiscard).length;
    const { state, events } = useProfessor(inDiscard, prof, pick);
    expect(offered.every((c) => PLAYER_SCHEMES.includes(c))).toBe(true);
    expect(offered).toContain("40018");
    expect(handOf(state)).toContain(wanted);
    expect(handOf(state)).toHaveLength(handBefore + 1);
    expect(discardOf(state)).not.toContain(wanted);
    expect(events.some((e) => e.type === "deckShuffled")).toBe(true);
    expect(inst(state, prof).exhausted).toBe(true);
  });

  it("the search may find nothing; the deck is still shuffled", () => {
    const base = withForm(heroGame(), "alterEgo");
    const { state: played, id: prof } = put(base, "40008", 1);
    const pick: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "chooseCards" ? [] : byLabel("Search for a player side scheme")(s);
    const handBefore = handOf(played).length;
    const { state, events } = useProfessor(played, prof, pick);
    expect(handOf(state)).toHaveLength(handBefore);
    expect(events.some((e) => e.type === "deckShuffled")).toBe(true);
  });

  it("is an Alter-Ego Action: in hero form it cannot be used, and an exhausted Professor cannot be used", () => {
    const base = withForm(heroGame(), "alterEgo");
    const { state: played, id: prof } = put(base, "40008", 1);
    expect(rejected(withForm(played, { heroForm: 0 }), use(P1, prof, PROFESSOR))).toBe(true);
    expect(rejected(patchInstance(played, prof, { exhausted: true }), use(P1, prof, PROFESSOR))).toBe(true);
    expect(rejected(played, use(P1, prof, PROFESSOR))).toBe(false);
  });

  it("two players: the search is Cable's own deck; Spider-Man's deck and hand are untouched", () => {
    const base = withForm(heroGame([CABLE, SPIDER_MAN]), "alterEgo");
    const { state: played, id: prof } = put(base, "40008", 1);
    const { state } = useProfessor(played, prof, byLabel("Draw 1 card"));
    expect(handOf(state, P2)).toEqual(handOf(played, P2));
    expect(playerOf(state, P2).deck).toEqual(playerOf(played, P2).deck);
  });
});

/** Cable with Askani'son attached and Graymalkin (an energy card) in hand to pay its cost; the rest of the hand kept. */
function askanisonGame(players: readonly Seat[] = [CABLE]) {
  const base = heroGame(players);
  const { state: attached, id: askanison } = put(base, "40009", 1, { attach: cableOf(base) });
  const given = moveToHand(attached, P1, GRAYMALKIN);
  return { state: given.state, askanison, energy: given.ids[0]! as InstanceId, cable: cableOf(base) };
}

describe("Askani'son (40009)", () => {
  it("costs 1 and attaches to Cable", () => {
    const base = heroGame();
    const { state, id, before } = put(base, "40009", 1, { attach: cableOf(base) });
    expect(inst(state, id).attachedTo).toBe(cableOf(base));
    expect(handOf(state)).toHaveLength(handOf(before).length - 2); // the upgrade and the 1 paid
    expect(inst(state, id).home).toEqual({ kind: "player" });
  });

  it("after Cable defends: exhausts, spends the energy card, and removes threat equal to his THW (2) from a scheme", () => {
    const { state, askanison, energy, cable } = askanisonGame();
    const main = state.mainScheme.instanceId;
    const run = villainPhase(state, { accept: [ASKANISON], defender: cable, payWith: energy, target: main });
    expect(hasOffer(run.offered, ASKANISON)).toBe(true);
    // The villain phase ends the round and readies everything, so the cost is read off the log.
    expect(run.events).toContainEqual({ type: "cardExhausted", instanceId: askanison });
    expect(discardOf(run.state)).toContain(energy);
    const without = villainPhase(state, { defender: cable });
    expect(threat(run.state, main)).toBe(threat(without.state, main) - 2);
    expect(without.events).not.toContainEqual({ type: "cardExhausted", instanceId: askanison });
  });

  it("uses his current THW: with Technovirus Purge in the victory display it removes 3", () => {
    const g = askanisonGame();
    const state = withVictory(g.state, 1);
    const main = state.mainScheme.instanceId;
    const run = villainPhase(state, { accept: [ASKANISON], defender: g.cable, payWith: g.energy, target: main });
    const without = villainPhase(state, { defender: g.cable });
    expect(threat(run.state, main)).toBe(threat(without.state, main) - 3);
  });

  it("is a thwart by Cable: defeating a scheme with it readies Cable through his identity response", () => {
    const g = askanisonGame();
    // Technovirus Purge at 2 threat: the thwart of 2 defeats it (Cable removes it as himself) and he readies.
    const state = patchInstance(g.state, purgeOf(g.state), { threat: 2 });
    const run = villainPhase(state, {
      accept: [ASKANISON, "40001a.cable-response"],
      defender: g.cable,
      payWith: g.energy,
      target: purgeOf(state),
    });
    expect(hasOffer(run.offered, "40001a.cable-response")).toBe(true);
    expect(run.state.victoryDisplay).toContain(purgeOf(run.state));
    expect(resolvedAbility(run.events, g.cable, "40001a.cable-response")).toBe(true);
  });

  it("is not offered when nobody defends, or when the hand holds no energy card", () => {
    const g = askanisonGame();
    expect(hasOffer(villainPhase(g.state, { accept: [ASKANISON] }).offered, ASKANISON)).toBe(false);
  });

  it("is not offered when the hand holds no energy card to spend (a mental card does not pay)", () => {
    const g = askanisonGame();
    const mentalOnly = instancesOf(g.state, "40010")[0]!;
    const offered = new Set<string>();
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseTriggers")
        for (const o of s.pendingChoice.options) offered.add(o.optionId);
      if (s.pendingChoice?.prompt.kind === "declareDefender") return [g.cable];
      return firstLegal(s);
    };
    // The player phase ends with a draw to hand size, so the hand is replaced as the defender prompt appears.
    const started = applyOk(g.state, endTurn(P1), WAVE7_DEPS).state;
    driveStepwise(WAVE7_DEPS, started, pick, (s) =>
      s.pendingChoice?.prompt.kind === "declareDefender" ? handIs(s, P1, mentalOnly) : s,
    );
    expect(hasOffer(offered, ASKANISON)).toBe(false);
  });

  it("may be declined: no cost is paid", () => {
    const g = askanisonGame();
    const run = villainPhase(g.state, { defender: g.cable });
    expect(hasOffer(run.offered, ASKANISON)).toBe(true);
    expect(run.events).not.toContainEqual({ type: "cardExhausted", instanceId: g.askanison });
    expect(handOf(run.state)).toContain(g.energy);
  });

  it("a Hero Response: in alter-ego form it is not offered", () => {
    const g = askanisonGame();
    const run = villainPhase(withForm(g.state, "alterEgo"), { accept: [ASKANISON], defender: g.cable });
    expect(hasOffer(run.offered, ASKANISON)).toBe(false);
  });

  it("two players: only Cable's own hand pays and only his defense counts", () => {
    const g = askanisonGame([CABLE, SPIDER_MAN]);
    const main = g.state.mainScheme.instanceId;
    const run = villainPhase(g.state, { accept: [ASKANISON], defender: g.cable, payWith: g.energy, target: main });
    expect(hasOffer(run.offered, ASKANISON)).toBe(true);
    expect(handOf(run.state, P2)).toEqual(handOf(g.state, P2));
    expect(inst(run.state, identityOf(run.state, P2)).exhausted).toBe(inst(g.state, identityOf(g.state, P2)).exhausted);
  });
});

describe("Forced Amnesia (40010)", () => {
  /** Cable with Forced Amnesia attached; Captive Hope (encounter side scheme, 1 threat) staged. */
  function amnesiaGame(players: readonly Seat[] = [CABLE]) {
    const base = heroGame(players);
    const { state: attached, id: amnesia } = put(base, "40010", 1, { attach: cableOf(base) });
    const staged = encounterCardInVillainArea(attached, BREAKIN, 1);
    return { state: staged.state, amnesia, hope: staged.id, cable: cableOf(base) };
  }

  it("costs 1; after Cable defeats an encounter side scheme, it and the scheme go to the victory display", () => {
    const g = amnesiaGame();
    const { state, offered } = driveOffers(g.state, accepting(FORCED_AMNESIA), basicThwart(P1, g.cable, g.hope));
    expect(hasOffer(offered, FORCED_AMNESIA)).toBe(true);
    expect([...state.victoryDisplay].sort()).toEqual([g.amnesia, g.hope].sort());
    expect(inst(state, g.amnesia).attachedTo).toBeNull();
    expect(discardOf(state)).not.toContain(g.hope);
    expect(state.villainArea).not.toContain(g.hope);
  });

  it("the upgrade itself is not a side scheme: only the scheme counts in the victory display", () => {
    const g = amnesiaGame();
    const { state } = driveOffers(g.state, accepting(FORCED_AMNESIA), basicThwart(P1, g.cable, g.hope));
    const scan = moveToHand(state, P1, "40003");
    // Mind Scan reads the display: 3 + 1 (Captive Hope) = 4.
    const [id] = scan.ids as [InstanceId];
    const { state: after } = driveEventsPicking(
      WAVE7_DEPS,
      scan.state,
      (s) =>
        s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(state.mainScheme.instanceId)(s) : firstLegal(s),
      play(P1, id, payWith(scan.state, P1, 2, [id])),
    );
    expect(threat(after, after.mainScheme.instanceId)).toBe(threat(state, state.mainScheme.instanceId) - 4);
  });

  it("a player side scheme Cable defeats (Victory 0, already in the display) leaves only the upgrade to move", () => {
    const base = heroGame();
    const { state: attached, id: amnesia } = put(base, "40010", 1, { attach: cableOf(base) });
    const staged = patchInstance(attached, purgeOf(attached), { threat: 2 });
    const { state } = driveOffers(staged, accepting(FORCED_AMNESIA), basicThwart(P1, cableOf(staged), purgeOf(staged)));
    expect([...state.victoryDisplay].sort()).toEqual([amnesia, purgeOf(state)].sort());
    expect(state.victoryDisplay.filter((x) => x === purgeOf(state))).toHaveLength(1);
  });

  it("may be declined: the scheme is defeated normally and the upgrade stays attached", () => {
    const g = amnesiaGame();
    const { state } = driveOffers(g.state, firstLegal, basicThwart(P1, g.cable, g.hope));
    expect(inst(state, g.amnesia).attachedTo).toBe(g.cable);
    expect(state.victoryDisplay).not.toContain(g.amnesia);
    expect(discardOf(state)).not.toContain(g.hope);
  });

  it("does not hear a scheme that is merely thwarted", () => {
    const g = amnesiaGame();
    const bigger = patchInstance(g.state, g.hope, { threat: 5 });
    const { offered } = driveOffers(bigger, accepting(FORCED_AMNESIA), basicThwart(P1, g.cable, g.hope));
    expect(hasOffer(offered, FORCED_AMNESIA)).toBe(false);
  });

  it("a Hero Response: not offered in alter-ego form", () => {
    const g = amnesiaGame();
    const { offered } = driveOffers(withForm(g.state, "alterEgo"), accepting(FORCED_AMNESIA), {
      type: "endTurn",
      playerId: P1,
    });
    expect(hasOffer(offered, FORCED_AMNESIA)).toBe(false);
  });

  it("two players: a scheme the other hero defeats also goes to the display", () => {
    const g = amnesiaGame([CABLE, SPIDER_MAN]);
    const turn2 = withForm(driveEventsPicking(WAVE7_DEPS, g.state, firstLegal, endTurn(P1)).state, { heroForm: 0 }, P2);
    const { state, offered } = driveOffers(
      turn2,
      accepting(FORCED_AMNESIA),
      basicThwart(P2, identityOf(turn2, P2), g.hope),
    );
    expect(hasOffer(offered, FORCED_AMNESIA)).toBe(true);
    expect(state.victoryDisplay).toContain(g.hope);
    expect(state.victoryDisplay).toContain(g.amnesia);
  });
});

describe("Plasma Rifle (40011)", () => {
  /** Cable with the Rifle attached (cost 2) and Graymalkin (energy) in hand to pay for its attack. */
  function rifleGame(players: readonly Seat[] = [CABLE], schemesInDisplay = 0) {
    const base = withoutTough(heroGame(players));
    const { state: attached, id: rifle } = put(base, "40011", 2, { attach: cableOf(base) });
    const given = moveToHand(attached, P1, GRAYMALKIN);
    const state = withVictory(given.state, schemesInDisplay);
    return { state, rifle, energy: given.ids[0]! as InstanceId, villain: villainOf(state), cable: cableOf(state) };
  }
  const fire = (g: { state: GameState; rifle: InstanceId; energy: InstanceId }, target: InstanceId) =>
    driveEventsPicking(
      WAVE7_DEPS,
      g.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(target)(s) : firstLegal(s)),
      use(P1, g.rifle, PLASMA_RIFLE, [{ fromHand: g.energy }]),
    );

  it("costs 2 and attaches to Cable (Restricted is printed data)", () => {
    const base = heroGame();
    const { state, id, before } = put(base, "40011", 2, { attach: cableOf(base) });
    expect(inst(state, id).attachedTo).toBe(cableOf(base));
    expect(handOf(state)).toHaveLength(handOf(before).length - 3);
  });

  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 4],
  ])("with %i side schemes in the victory display it deals %i damage (1 each, at most 4)", (n, damage) => {
    const g = rifleGame([CABLE], n);
    const { state } = fire(g, g.villain);
    expect(damageOf(state, g.villain)).toBe(damage);
    expect(inst(state, g.rifle).exhausted).toBe(true);
    expect(discardOf(state)).toContain(g.energy);
  });

  it("ranged: it ignores Retaliate, which a basic attack on the same minion does not", () => {
    const g = rifleGame([CABLE], 2);
    const { state: withMinion, id: whiplash } = withWhiplash(g.state);
    const { state: shot } = fire({ ...g, state: withMinion }, whiplash);
    expect(damageOf(shot, whiplash)).toBe(2);
    expect(damageOf(shot, g.cable)).toBe(0);
    const { state: basic } = driveEventsPicking(WAVE7_DEPS, withMinion, firstLegal, basicAttack(P1, g.cable, whiplash));
    expect(damageOf(basic, g.cable)).toBe(1);
  });

  it("is an attack: Juggernaut's tough status card absorbs it", () => {
    const g = rifleGame([CABLE], 2);
    const toughened = patchInstance(g.state, g.villain, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state } = fire({ ...g, state: toughened }, g.villain);
    expect(damageOf(state, g.villain)).toBe(0);
    expect(inst(state, g.villain).statuses.tough).toBe(0);
  });

  it("needs an energy resource: a mental card does not pay, an exhausted Rifle and alter-ego form refuse", () => {
    const g = rifleGame([CABLE], 2);
    const mental = moveToHand(g.state, P1, "40010");
    expect(rejected(mental.state, use(P1, g.rifle, PLASMA_RIFLE, [{ fromHand: mental.ids[0]! as InstanceId }]))).toBe(
      true,
    );
    expect(
      rejected(
        patchInstance(g.state, g.rifle, { exhausted: true }),
        use(P1, g.rifle, PLASMA_RIFLE, [{ fromHand: g.energy }]),
      ),
    ).toBe(true);
    expect(rejected(withForm(g.state, "alterEgo"), use(P1, g.rifle, PLASMA_RIFLE, [{ fromHand: g.energy }]))).toBe(
      true,
    );
    expect(rejected(g.state, use(P1, g.rifle, PLASMA_RIFLE, [{ fromHand: g.energy }]))).toBe(false);
  });

  it("two players: another player's side schemes in the shared display count, and Spider-Man is untouched", () => {
    const g = rifleGame([CABLE, SPIDER_MAN], 3);
    const { state } = fire(g, g.villain);
    expect(damageOf(state, g.villain)).toBe(3);
    expect(handOf(state, P2)).toEqual(handOf(g.state, P2));
    expect(damageOf(state, identityOf(state, P2))).toBe(0);
  });
});

describe("Telekinetic Force Field (40012)", () => {
  /** Cable with the Force Field attached; the villain phase's attack on Cable (nobody defends) is the damage. */
  function fieldGame(players: readonly Seat[] = [CABLE]) {
    const base = heroGame(players);
    const { state, id: field, before } = put(base, "40012", 2, { attach: cableOf(base) });
    return { state, field, before, cable: cableOf(base) };
  }

  it("costs 2, attaches to Cable; hero form only is play data (refused in alter-ego form)", () => {
    const base = heroGame();
    const { state, id, before } = put(base, "40012", 2, { attach: cableOf(base) });
    expect(inst(state, id).attachedTo).toBe(cableOf(base));
    expect(handOf(state)).toHaveLength(handOf(before).length - 3);
    const alterEgo = withForm(base, "alterEgo");
    const given = moveToHand(alterEgo, P1, "40012");
    const [field] = given.ids as [InstanceId];
    expect(
      rejected(
        given.state,
        play(P1, field, payWith(given.state, P1, 2, [field]), { attachToInstanceId: cableOf(alterEgo) }),
      ),
    ).toBe(true);
  });

  it("accepted: discards the upgrade and prevents all of the damage Cable would take", () => {
    const g = fieldGame();
    const taken = villainPhase(g.state, {});
    const prevented = villainPhase(g.state, { accept: [FORCE_FIELD] });
    const hits = taken.events.flatMap((e) =>
      e.type === "damageDealt" && e.targetInstanceId === g.cable ? [e.amount] : [],
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toBeGreaterThan(0);
    // The undefended attack hits Cable for `hits[0]` (and again later); the field stops the first hit whole.
    expect(damageOf(taken.state, g.cable)).toBe(hits.reduce((a, b) => a + b, 0));
    expect(hasOffer(prevented.offered, FORCE_FIELD)).toBe(true);
    expect(damageOf(prevented.state, g.cable)).toBe(damageOf(taken.state, g.cable) - hits[0]!);
    expect(prevented.events.some((e) => e.type === "damagePrevented" && e.amount === hits[0])).toBe(true);
    expect(discardOf(prevented.state)).toContain(g.field);
  });

  it("declined: the damage is taken and the upgrade stays", () => {
    const g = fieldGame();
    const run = villainPhase(g.state, {});
    expect(hasOffer(run.offered, FORCE_FIELD)).toBe(true);
    expect(inst(run.state, g.field).attachedTo).toBe(g.cable);
    expect(discardOf(run.state)).not.toContain(g.field);
  });

  it("a Hero Interrupt: in alter-ego form it is not offered", () => {
    const g = fieldGame();
    const run = villainPhase(withForm(g.state, "alterEgo"), { accept: [FORCE_FIELD] });
    expect(hasOffer(run.offered, FORCE_FIELD)).toBe(false);
  });

  it("two players: protects any friendly character, so Cable's upgrade prevents the Retaliate damage Spider-Man takes", () => {
    const g = fieldGame([CABLE, SPIDER_MAN]);
    const turn2 = withForm(driveEventsPicking(WAVE7_DEPS, g.state, firstLegal, endTurn(P1)).state, { heroForm: 0 }, P2);
    const { state: staged, id: whiplash } = withWhiplash(turn2, P2);
    const spider = identityOf(staged, P2);
    const attack = basicAttack(P2, spider, whiplash);
    const control = driveOffers(staged, firstLegal, attack);
    expect(damageOf(control.state, spider)).toBe(1);
    expect(hasOffer(control.offered, FORCE_FIELD)).toBe(true);
    const run = driveOffers(staged, accepting(FORCE_FIELD), attack);
    expect(damageOf(run.state, spider)).toBe(0);
    expect(discardOf(run.state, P1)).toContain(g.field);
  });
});

describe("Temporal Leap (40013)", () => {
  /**
   * Morlock Siege (its main scheme, Knock, Knock, has no Forced Interrupt: Juggernaut's would replace the completion
   * before Temporal Leap could answer, Forced abilities initiate first, RRG "Interrupt"), main scheme 6 to complete.
   * Threat 5 plus the villain phase's placement of 1 would complete it; Temporal Leap is attached to Cable.
   */
  function leapGame(displayed: number, players: readonly Seat[] = [CABLE], mainThreat = 5) {
    const base = heroGame(players, PURGE, 1, "morlock-siege");
    const { state: attached, id: leap } = put(base, "40013", 2, { attach: cableOf(base) });
    const state = patchInstance(withVictory(attached, displayed, MORLOCK_SCHEME), base.mainScheme.instanceId, {
      threat: mainThreat,
    });
    return { state, leap, cable: cableOf(base), main: base.mainScheme.instanceId };
  }
  /** The state when the villain phase's first defender prompt appears: after the interrupt, before anything else adds threat. */
  const afterInterrupt = (run: { snapshots: GameState[] }): GameState =>
    run.snapshots.find((s) => s.pendingChoice?.prompt.kind === "declareDefender")!;

  it("costs 2 and attaches to Cable", () => {
    const base = heroGame();
    const { state, id, before } = put(base, "40013", 2, { attach: cableOf(base) });
    expect(inst(state, id).attachedTo).toBe(cableOf(base));
    expect(handOf(state)).toHaveLength(handOf(before).length - 3);
  });

  it("when the main scheme would be completed: removes itself from the game, puts Technovirus Purge into play with 5 threat, moves 4 threat from the main scheme to it, and the stage is not completed", () => {
    const g = leapGame(1);
    const run = villainPhase(g.state, { accept: [TEMPORAL_LEAP], choose: PURGE });
    expect(hasOffer(run.offered, TEMPORAL_LEAP)).toBe(true);
    const s = afterInterrupt(run);
    expect(s.mainScheme.stageIndex).toBe(0);
    // 5 + 1 placed = 6 = the target; 4 moved leaves 2.
    expect(threat(s, g.main)).toBe(2);
    expect(s.victoryDisplay).toEqual([]);
    expect(s.villainArea).toContain(purgeOf(s));
    expect(threat(s, purgeOf(s))).toBe(9);
    expect(s.removedFromGame).toContain(g.leap);
    expect(inst(s, g.leap).attachedTo).toBeNull();
    expect(run.events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === purgeOf(s))).toBe(false);
  });

  it("an encounter side scheme from the display comes back with its starting threat (3) plus the 4, and is not revealed", () => {
    // Display: Technovirus Purge and a Morlock Siege side scheme; the player chooses a Morlock Siege side scheme.
    const g = leapGame(2);
    const run = villainPhase(g.state, { accept: [TEMPORAL_LEAP], choose: MORLOCK_SCHEME });
    const s = afterInterrupt(run);
    const inPlay = s.villainArea.find((id) => codeOf(s, id) === MORLOCK_SCHEME)!;
    expect(inPlay).toBeDefined();
    expect(threat(s, inPlay)).toBe(7);
    expect(threat(s, g.main)).toBe(2);
    expect(s.victoryDisplay.map((id) => codeOf(s, id))).toEqual([PURGE]);
    expect(run.events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === inPlay)).toBe(false);
    // Offered both schemes of the shared display.
    const offered = run.snapshots
      .filter((x) => x.pendingChoice?.prompt.kind === "chooseCards")
      .flatMap((x) => x.pendingChoice!.options.map((o) => codeOf(x, o.optionId as InstanceId)));
    expect(offered.sort()).toEqual([MORLOCK_SCHEME, PURGE].sort());
  });

  it("is not offered while the victory display holds no side scheme", () => {
    const g = leapGame(0);
    const run = villainPhase(g.state, { accept: [TEMPORAL_LEAP] });
    expect(hasOffer(run.offered, TEMPORAL_LEAP)).toBe(false);
    expect(inst(run.state, g.leap).attachedTo).not.toBeNull();
  });

  // Owner ruling 2026-10-06 (docs/phase7-wave7.md §4.1): threat moved off a scheme is removed from it (RRG "Move",
  // p. 30), and under a crisis icon a player card cannot remove threat from the main scheme (RRG "Crisis Icon", p. 14),
  // so the move has no source and the interrupt cannot be used: its cost is not paid.
  it("under a crisis icon (Territorial Control) it is not offered, a command for it is refused, and nothing is spent", () => {
    const g = leapGame(1);
    const crisis = encounterCardInVillainArea(g.state, TERRITORIAL_CONTROL, 4);
    const run = villainPhase(crisis.state, { accept: [TEMPORAL_LEAP], choose: PURGE });
    expect(hasOffer(run.offered, TEMPORAL_LEAP)).toBe(false);
    const s = afterInterrupt(run);
    expect(s.mainScheme.stageIndex).toBe(1);
    expect(inst(s, g.leap).attachedTo).toBe(g.cable);
    expect(s.removedFromGame).not.toContain(g.leap);
    expect(s.victoryDisplay.map((id) => codeOf(s, id))).toEqual([PURGE]);
    // Forced: naming the interrupt at the first prompt of the villain phase is refused.
    const [first] = run.snapshots;
    const forced = applyCommand(
      first!,
      {
        type: "resolveChoice",
        playerId: first!.pendingChoice!.playerId,
        choiceId: first!.pendingChoice!.choiceId,
        selectedOptionIds: [`${g.leap}:${TEMPORAL_LEAP}`],
      },
      WAVE7_DEPS,
    );
    expect(forced.ok).toBe(false);
  });

  it("the control for that: the same table without the crisis scheme offers it", () => {
    const g = leapGame(1);
    const plain = encounterCardInVillainArea(g.state, MORLOCK_SCHEME, 4);
    const run = villainPhase(plain.state, { accept: [TEMPORAL_LEAP], choose: PURGE });
    expect(hasOffer(run.offered, TEMPORAL_LEAP)).toBe(true);
    expect(afterInterrupt(run).removedFromGame).toContain(g.leap);
  });

  it("moves 4 even when it takes the stage under the target only just: a stage 6 or more over the target still completes", () => {
    const g = leapGame(1, [CABLE], 15);
    const run = villainPhase(g.state, { accept: [TEMPORAL_LEAP], choose: PURGE });
    expect(hasOffer(run.offered, TEMPORAL_LEAP)).toBe(true);
    const s = afterInterrupt(run);
    // 15 + 1 = 16, minus 4 = 12, still at least the target of 6: the stage advances.
    expect(s.mainScheme.stageIndex).toBe(1);
    expect(s.removedFromGame).toContain(g.leap);
  });

  it("may be declined: the stage completes and the upgrade stays", () => {
    const g = leapGame(1);
    const run = villainPhase(g.state, {});
    expect(hasOffer(run.offered, TEMPORAL_LEAP)).toBe(true);
    expect(afterInterrupt(run).mainScheme.stageIndex).toBe(1);
    expect(inst(run.state, g.leap).attachedTo).toBe(g.cable);
  });

  it("a Hero Interrupt: in alter-ego form it is not offered", () => {
    const g = leapGame(1);
    const run = villainPhase(withForm(g.state, "alterEgo"), { accept: [TEMPORAL_LEAP] });
    expect(hasOffer(run.offered, TEMPORAL_LEAP)).toBe(false);
  });

  it("a player side scheme coming back goes through the limit of one: the player discards the other", () => {
    const base = heroGame([CABLE], "40019", 1, "morlock-siege");
    const lockAndLoad = instancesOf(base, "40019")[0]!;
    const given = moveToHand(base, P1, PURGE);
    const [purge] = given.ids as [InstanceId];
    const { state: attached, id: leap } = put(toVictory(given.state, purge), "40013", 2, { attach: cableOf(base) });
    const state = patchInstance(attached, base.mainScheme.instanceId, { threat: 5 });
    const run = villainPhase(state, {
      accept: [TEMPORAL_LEAP],
      choose: PURGE,
      first: (s) => (s.pendingChoice?.options.some((o) => o.optionId === lockAndLoad) ? [lockAndLoad] : undefined),
    });
    const s = afterInterrupt(run);
    const schemes = s.villainArea.filter((id) => s.cardPool[s.instances[id]!.cardId]!.type === "player_side_scheme");
    expect(schemes).toEqual([purge]);
    expect(discardOf(s)).toContain(lockAndLoad);
    expect(threat(s, purge)).toBe(9);
    expect(s.removedFromGame).toContain(leap);
  });

  it("two players: the display is shared; Cable's player chooses, and Spider-Man's hand and deck are untouched", () => {
    const g = leapGame(2, [CABLE, SPIDER_MAN], 11);
    const run = villainPhase(g.state, { accept: [TEMPORAL_LEAP], choose: MORLOCK_SCHEME });
    expect(hasOffer(run.offered, TEMPORAL_LEAP)).toBe(true);
    const atOffer = run.snapshots.find(
      (x) =>
        x.pendingChoice?.prompt.kind === "chooseTriggers" &&
        x.pendingChoice.options.some((o) => o.optionId.includes(TEMPORAL_LEAP)),
    )!;
    expect(atOffer.pendingChoice!.playerId).toBe(P1);
    const s = afterInterrupt(run);
    expect(threat(s, g.main)).toBe(threat(atOffer, g.main) - 4);
    expect(s.mainScheme.stageIndex).toBe(0);
    expect(s.removedFromGame).toContain(g.leap);
    expect(s.villainArea.some((id) => codeOf(s, id) === MORLOCK_SCHEME)).toBe(true);
    expect(playerOf(s, P2).deck).toEqual(playerOf(atOffer, P2).deck);
  });
});
