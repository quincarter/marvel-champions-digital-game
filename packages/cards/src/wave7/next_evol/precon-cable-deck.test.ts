import {
  applyCommand,
  createGame,
  type EngineDeps,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import type { CardInstance } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  moveToDiscard,
  withDamage,
  withForm,
} from "../../testing/staging.js";
import { characterProfile } from "@mc/engine";
import { WAVE7_CARDS } from "../cards.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { WAR_MACHINE_PACK_CARDS } from "../../wave4/warm/war-machine-pack-cards.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "./precon-cable-deck.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The aspect and basic cards printed with Cable's precon (40014-40030), docs/phase7-wave7.md §7.1 and §3.61. Cable's
 * real precon (`cable-leadership`) against Juggernaut, through `wave7Scenario` with the real registry. Cable in hero form
 * has a hand of 5, THW 2 / ATK 2 / DEF 2. Cards are put in the hand by `moveToHand` and played with real `playCard`
 * commands; the victory display and engaged minions are staged by surgery.
 */
const CALIBAN = "40014.caliban-response";
const FANTOMEX = "40015.fantomex-response";
const SUNSPOT = "40016.sunspot-response";
const MISSION_PLANNING_PLAY = "40017.mission-planning-constant";
const MISSION_PLANNING = "40017.mission-planning-action";
const CALL_FOR_BACKUP = "40018.when-defeated";
const LOCK_AND_LOAD = "40019.when-defeated";
const ESTABLISH_PERIMETER = "40020.when-defeated";
const EVA_CONSTANT = "40021.eva-constant";
const EVA_ACTION = "40021.eva-action";
const UNCANNY_X_FORCE = "40022.uncanny-x-force-constant";
const MISSION_LEADER_COST = "40023.mission-leader-constant";
const MISSION_LEADER = "40023.mission-leader-response";
const DEADPOOL = "40024.deadpool-forced-interrupt";
const DEATHLOK = "40025.deathlok-response";
const FRENEMIES = "40026.frenemies-action";
const BUILD_SUPPORT = "40027.when-defeated";
const POWER_OF_THE_MIND = "40028.the-power-of-the-mind-constant";
const PSIMITAR = "40029.psimitar-response";
const SIDEARM = "40030.sidearm-constant";
const ALL_REFS = [
  CALIBAN,
  FANTOMEX,
  SUNSPOT,
  MISSION_PLANNING_PLAY,
  MISSION_PLANNING,
  CALL_FOR_BACKUP,
  LOCK_AND_LOAD,
  ESTABLISH_PERIMETER,
  EVA_CONSTANT,
  EVA_ACTION,
  UNCANNY_X_FORCE,
  MISSION_LEADER_COST,
  MISSION_LEADER,
  DEADPOOL,
  DEATHLOK,
  FRENEMIES,
  BUILD_SUPPORT,
  POWER_OF_THE_MIND,
  PSIMITAR,
  SIDEARM,
];

const CABLE = { starterDeckId: "cable-leadership" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof CABLE | typeof SPIDER_MAN;
const PURGE = "40006";
const BREAKIN = "40131"; // Captive Hope: an encounter side scheme, staged
const CARD_TYPES = new Map(WAVE7_CARDS.map((card) => [card.id as string, card.type]));
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;

/** A prompt that offers a card with printed id `code` picks it; anything else takes the first option. */
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
/** Accepts every optional response whose id contains one of `wanted`; any other prompt takes the first option. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return firstLegal(state);
  };
/** Picks the card printed `code` when a card prompt offers it (undefined otherwise). */
const cardChoice = (code: string) => (s: GameState) => {
  const choice = s.pendingChoice;
  if (choice?.prompt.kind !== "chooseCards") return undefined;
  const hit = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === code);
  return hit ? [hit.optionId] : undefined;
};
/** `first` answers the prompts it recognizes (returns undefined for the rest), then `then` handles the remainder. */
const chain =
  (...pickers: readonly ((s: GameState) => readonly string[] | undefined)[]): Picker =>
  (state) => {
    for (const p of pickers) {
      const answer = p(state);
      if (answer) return answer;
    }
    return firstLegal(state);
  };
const accept =
  (...wanted: readonly string[]) =>
  (s: GameState) =>
    s.pendingChoice?.prompt.kind === "chooseTriggers" ? accepting(...wanted)(s) : undefined;
const onlyTargets =
  (...ids: readonly InstanceId[]) =>
  (s: GameState) =>
    s.pendingChoice?.prompt.kind === "chooseTarget"
      ? ids.filter((i) => s.pendingChoice!.options.some((o) => o.optionId === i))
      : undefined;
const byLabel = (label: string) => (s: GameState) => {
  const o = s.pendingChoice?.options.find((x) => x.label === label);
  return o ? [o.optionId] : undefined;
};

/** Cable in hero form, `scheme` (default Technovirus Purge) in play through Soldier X's Setup, the main scheme at 20. */
function heroGame(players: readonly Seat[] = [CABLE], scheme = PURGE, seed = 1): GameState {
  const config = wave7Scenario("juggernaut", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, choosing(scheme), (s) => s.step.phase === "player", WAVE7_DEPS);
  const hero = withForm(settled, { heroForm: 0 });
  return patchInstance(hero, hero.mainScheme.instanceId, { threat: 20 });
}
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const cableOf = (s: GameState): InstanceId => identityOf(s, P1);
const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const handOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).hand;
const inPlay = (s: GameState, p: PlayerId = P1) => playerOf(s, p).playArea;
const playedOf = (s: GameState, code: string, p: PlayerId = P1): InstanceId | undefined =>
  inPlay(s, p).find((id) => codeOf(s, id) === code);
const toughOf = (s: GameState, id: InstanceId): number => inst(s, id).statuses.tough ?? 0;

/** Plays `code` from hand paying `cost` with other hand cards (or exactly `payIds`), answering prompts with `pick`. */
function put(
  state: GameState,
  code: string,
  cost: number | readonly InstanceId[],
  opts: { player?: PlayerId; pick?: Picker; attach?: InstanceId; keep?: readonly InstanceId[]; deps?: EngineDeps } = {},
): { state: GameState; id: InstanceId; before: GameState } {
  const player = opts.player ?? P1;
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const payment = typeof cost === "number" ? payWith(given.state, player, cost, [id, ...(opts.keep ?? [])]) : cost;
  const driven = driveEventsPicking(
    opts.deps ?? WAVE7_DEPS,
    given.state,
    opts.pick ?? firstLegal,
    play(player, id, payment, opts.attach ? { attachToInstanceId: opts.attach } : {}),
  );
  return { state: driven.state, id, before: given.state };
}
const refused = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;
/** Whether playing `code` as `player` is refused right now. */
function playRefused(state: GameState, code: string, cost: number, player: PlayerId = P1): boolean {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  return refused(given.state, play(player, id, payWith(given.state, player, cost, [id])));
}
const basicThwart = (player: PlayerId, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});

/** A synthetic Sandman (Core 01102, 4 hit points, no text) engaged with `player`, in their play area (surgery). */
function engagedMinion(state: GameState, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const id = `synthetic-minion-${player}-${Object.keys(state.instances).length}` as InstanceId;
  const base = injectIntoHand(state, player, "01102").state;
  const source = `synthetic-01102-${player}` as InstanceId;
  const instance = {
    ...base.instances[source]!,
    instanceId: id,
    ownerId: null,
    controllerId: null,
    engagedWith: player,
  };
  const { [source]: _dropped, ...instances } = base.instances;
  return {
    id,
    state: {
      ...base,
      instances: { ...instances, [id]: instance as CardInstance },
      players: base.players.map((p) =>
        p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== source), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}
/** Moves a side scheme (wherever it is) into the victory display. */
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
const withOneInVictory = (state: GameState): GameState => {
  const staged = encounterCardInVillainArea(state, BREAKIN, 2);
  return toVictory(staged.state, staged.id);
};

describe("Cable precon cards registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(NEXT_EVOL_PRECON_CABLE_DECK[id]!)).toEqual([]);
  });
  it("holds exactly the 20 scripted refs: every ref of the 17 cards", () => {
    expect(Object.keys(NEXT_EVOL_PRECON_CABLE_DECK).sort()).toEqual([...ALL_REFS].sort());
  });
  it("Sidearm is the War Machine Sidearm definition, the same object", () => {
    expect(NEXT_EVOL_PRECON_CABLE_DECK[SIDEARM]).toBe(WAR_MACHINE_PACK_CARDS["23035.sidearm-constant"]);
  });
});

/** A card not in this deck, added to `player`'s hand (a second hero's copy of a basic card, a card from another pack). */
function injectIntoHand(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const id = `synthetic-${code}-${player}` as InstanceId;
  const instance: CardInstance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: player,
    controllerId: player,
    home: { kind: "player" },
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
    engagedWith: null,
    flipped: false,
  };
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
    },
  };
}
const declining: Picker = (s) => (s.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(s));
const characterProfileAtk = (s: GameState, id: InstanceId): number => characterProfile(s, id, WAVE7_DEPS)!.atk;
/** An ally put into `player`'s play area by surgery (no payment, no enter-play responses). */
function allyInPlay(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const given = injectIntoHand(state, player, code);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === player
          ? { ...p, hand: p.hand.filter((x) => x !== given.id), playArea: [...p.playArea, given.id] }
          : p,
      ),
    },
  };
}
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });
const pickPlayer = (id: PlayerId) => (s: GameState) =>
  s.pendingChoice?.prompt.kind === "choosePlayer" ? [id as string] : undefined;
/** Ends P1's turn so P2 may act, with `form` P2's hero form. */
const turnOfP2 = (state: GameState): GameState =>
  withForm(
    driveEventsPicking(WAVE7_DEPS, state, firstLegal, { type: "endTurn", playerId: P1 }).state,
    { heroForm: 0 },
    P2,
  );

describe("Caliban (40014)", () => {
  const stacked = () => {
    const base = heroGame();
    // From the top: Sidearm, Mission Planning (not allies), then Fantomex (an X-FORCE ally), then the rest.
    return putOnTopOfDeck(base, P1, "40030", "40017", "40015");
  };
  it("costs 3; after it enters play, discards from the top until an X-FORCE ally and adds that ally to the hand", () => {
    const top = stacked();
    const [sidearm, planning, fantomex] = top.ids as [InstanceId, InstanceId, InstanceId];
    const { state, id, before } = put(top.state, "40014", 3, { pick: accepting(CALIBAN) });
    expect(inPlay(state)).toContain(id);
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining([sidearm, planning]));
    expect(playerOf(state, P1).discard).toHaveLength(playerOf(before, P1).discard.length + 3 + 2);
    expect(handOf(state)).toContain(fantomex);
    // Hand: Caliban and 3 paid cards left it, Fantomex joined.
    expect(handOf(state)).toHaveLength(handOf(before).length - 1 - 3 + 1);
    expect(playerOf(state, P1).deck).toHaveLength(playerOf(before, P1).deck.length - 3);
  });
  it("is optional: declining leaves the deck untouched", () => {
    const top = stacked();
    const { state, before } = put(top.state, "40014", 3, { pick: declining });
    expect(playerOf(state, P1).deck).toEqual(playerOf(before, P1).deck);
    expect(handOf(state)).toHaveLength(handOf(before).length - 1 - 3);
  });
  it("with no X-FACTOR, X-FORCE or X-MEN ally in the deck it discards the whole deck and adds nothing", () => {
    const base = heroGame();
    const noAllies: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              deck: p.deck.filter((id) => CARD_TYPES.get(codeOf(base, id)) !== "ally" || codeOf(base, id) === "40014"),
            }
          : p,
      ),
    };
    const { state, before } = put(noAllies, "40014", 3, { pick: accepting(CALIBAN) });
    // RRG "Player Deck" (p. 33): the discarding emptied the deck, which was reset at once from the discard pile (the
    // three paid cards, Caliban's deck and the old discard pile), and no further card is discarded from the new deck.
    expect(playerOf(state, P1).discard).toHaveLength(0);
    expect(playerOf(state, P1).deck).toHaveLength(
      playerOf(before, P1).deck.length + playerOf(before, P1).discard.length + 3,
    );
    expect(handOf(state)).toHaveLength(handOf(before).length - 1 - 3);
  });
  it("two players: the other player's deck is not touched", () => {
    const base = heroGame([CABLE, SPIDER_MAN]);
    const top = putOnTopOfDeck(base, P1, "40015");
    const { state, before } = put(top.state, "40014", 3, { pick: accepting(CALIBAN) });
    expect(playerOf(state, P2).deck).toEqual(playerOf(before, P2).deck);
    expect(handOf(state)).toContain(top.ids[0]);
  });
});

describe("Fantomex (40015)", () => {
  const fetchEva: Picker = chain(accept(FANTOMEX), cardChoice("40021"));
  it("costs 4; after it enters play, fetches E.V.A. from the deck into play and shuffles", () => {
    const base = heroGame();
    const { state, id, before } = put(base, "40015", 4, { pick: fetchEva });
    const eva = instancesOf(state, "40021")[0]!;
    expect(inPlay(state)).toEqual(expect.arrayContaining([id, eva]));
    expect(playerOf(state, P1).deck).not.toContain(eva);
    expect(playerOf(state, P1).deck).toHaveLength(playerOf(before, P1).deck.length - 1);
    expect(handOf(state)).toHaveLength(handOf(before).length - 1 - 4);
    // E.V.A. is the support type: not ready-limited, not exhausted.
    expect(inst(state, eva).exhausted).toBe(false);
  });
  it("finds E.V.A. in the discard pile too", () => {
    const base = heroGame();
    const moved = moveToDiscard(base, P1, "40021");
    const { state } = put(moved.state, "40015", 4, { pick: fetchEva });
    expect(inPlay(state)).toContain(moved.id);
    expect(playerOf(state, P1).discard).not.toContain(moved.id);
  });
  it("searches only the deck and discard pile: E.V.A. in hand stays there", () => {
    const base = heroGame();
    const inHand = moveToHand(base, P1, "40021");
    const { state } = put(inHand.state, "40015", 4, { pick: fetchEva, keep: inHand.ids });
    expect(handOf(state)).toContain(inHand.ids[0]);
    expect(inPlay(state)).not.toContain(inHand.ids[0]);
  });
  it("may decline, and with no E.V.A. anywhere nothing is put into play", () => {
    const base = heroGame();
    const declined = put(base, "40015", 4, { pick: chain(accept(FANTOMEX), () => []) });
    expect(playedOf(declined.state, "40021")).toBeUndefined();
  });
});

describe("Sunspot (40016)", () => {
  /** Sunspot (cost 3) paid with exactly the given cards; the villain without its tough status. */
  const playSunspot = (state: GameState, payCodes: readonly string[], pick: Picker) => {
    const given = moveToHand(state, P1, "40016", ...payCodes);
    const [sunspot, ...paid] = given.ids as InstanceId[];
    const driven = driveEventsPicking(WAVE7_DEPS, given.state, pick, play(P1, sunspot!, paid));
    return { state: driven.state, before: given.state, id: sunspot! };
  };
  const answer = (player: PlayerId = P1) => chain(pickPlayer(player), accept(SUNSPOT));

  it("paid with 3 energy: 3 damage to the villain and to each minion engaged with the chosen player", () => {
    const base = withoutTough(heroGame());
    const staged = engagedMinion(base);
    const { state } = playSunspot(staged.state, ["40022", "40022", "40022"], answer());
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(inst(state, staged.id).damage).toBe(3);
  });
  it("counts only energy used: 2 energy and a mental deal 2", () => {
    const base = withoutTough(heroGame());
    const staged = engagedMinion(base);
    const { state } = playSunspot(staged.state, ["40022", "40022", "40017"], answer());
    expect(inst(state, villainOf(state)).damage).toBe(2);
    expect(inst(state, staged.id).damage).toBe(2);
  });
  it("a wild resource used counts as energy (ruling January 17, 2026, Ruling 4)", () => {
    const base = withoutTough(heroGame());
    const { state } = playSunspot(base, ["40022", "40021", "40017"], answer());
    expect(inst(state, villainOf(state)).damage).toBe(2);
  });
  it("overpaying counts too: 4 cards, 4 energy are 4 damage", () => {
    const base = withoutTough(heroGame());
    const { state } = playSunspot(base, ["40022", "40022", "40022", "40021"], answer());
    expect(inst(state, villainOf(state)).damage).toBe(4);
  });
  it("with 0 energy used (3 mental) it deals no damage", () => {
    const base = withoutTough(heroGame());
    const { state } = playSunspot(base, ["40017", "40017", "40017"], answer());
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });
  it("two players: choosing the other player hits the minions engaged with them, not with Cable", () => {
    const base = withoutTough(heroGame([CABLE, SPIDER_MAN]));
    const mine = engagedMinion(base, P1);
    const theirs = engagedMinion(mine.state, P2);
    const { state } = playSunspot(theirs.state, ["40022", "40022", "40022"], answer(P2));
    expect(inst(state, villainOf(state)).damage).toBe(3);
    expect(inst(state, theirs.id).damage).toBe(3);
    expect(inst(state, mine.id).damage).toBe(0);
  });
  it("is optional: declined, it deals no damage", () => {
    const base = withoutTough(heroGame());
    const { state } = playSunspot(
      base,
      ["40022", "40022", "40022"],
      chain(pickPlayer(P1), () => []),
    );
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });
});

describe("Mission Planning (40017)", () => {
  it("cannot be played with no side scheme in the victory display", () => {
    expect(playRefused(heroGame(), "40017", 2)).toBe(true);
  });
  it("can be played with one (player or encounter side scheme), costs 2 and goes to the discard pile", () => {
    const base = withOneInVictory(heroGame());
    expect(playRefused(base, "40017", 2)).toBe(false);
    const { state, id, before } = put(base, "40017", 2);
    expect(playerOf(state, P1).discard).toContain(id);
    expect(handOf(state)).toHaveLength(handOf(before).length - 3);
  });
  it("Cable's own Technovirus Purge in the display counts as well", () => {
    const base = heroGame();
    const inDisplay = toVictory(base, instancesOf(base, PURGE)[0]!);
    expect(playRefused(inDisplay, "40017", 2)).toBe(false);
  });
  it("until the end of the phase, allies you control take no consequential damage", () => {
    const base = withOneInVictory(heroGame());
    const ally = put(base, "40024", 3);
    const without = driveEventsPicking(
      WAVE7_DEPS,
      ally.state,
      firstLegal,
      basicThwart(P1, ally.id, mainOf(ally.state)),
    );
    expect(inst(without.state, ally.id).damage).toBe(1);
    expect(threat(without.state, mainOf(without.state))).toBe(18);

    const planned = put(ally.state, "40017", 2);
    const withPlan = driveEventsPicking(
      WAVE7_DEPS,
      planned.state,
      firstLegal,
      basicThwart(P1, ally.id, mainOf(planned.state)),
    );
    expect(inst(withPlan.state, ally.id).damage).toBe(0);
    expect(threat(withPlan.state, mainOf(withPlan.state))).toBe(18);
  });
  it("two players: only the allies you control are protected", () => {
    const base = withOneInVictory(heroGame([CABLE, SPIDER_MAN]));
    const mine = put(base, "40024", 3);
    const planned = put(mine.state, "40017", 2);
    const p2Turn = turnOfP2(planned.state);
    const injected = injectIntoHand(p2Turn, P2, "40025");
    const theirs = put(injected.state, "40025", 4, { player: P2 });
    const thwartMine = driveEventsPicking(
      WAVE7_DEPS,
      theirs.state,
      firstLegal,
      basicThwart(P2, theirs.id, mainOf(theirs.state)),
    );
    expect(inst(thwartMine.state, theirs.id).damage).toBe(1);
  });
});

// ---- player side schemes -----------------------------------------------------------------------------------
const takeFirstCard = (s: GameState) => {
  const choice = s.pendingChoice;
  return choice?.prompt.kind === "chooseCards" && choice.options.length > 0 ? [choice.options[0]!.optionId] : undefined;
};
const declineCardStep = (s: GameState) => (s.pendingChoice?.prompt.kind === "chooseCards" ? [] : undefined);
const declineCard: Picker = chain(declineCardStep);
const schemeOf = (s: GameState, code: string): InstanceId => instancesOf(s, code)[0]!;
/** Technovirus Purge (put into play by Soldier X's Setup) is discarded by surgery, leaving room under the limit. */
function withoutPurge(state: GameState): GameState {
  const purge = schemeOf(state, PURGE);
  return {
    ...state,
    villainArea: state.villainArea.filter((x) => x !== purge),
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, discard: [...p.discard, purge] } : p)),
  };
}
/** `code` played from hand (cost 1) into a game where nothing else is in play: the scheme is in the villain area. */
const inPlayScheme = (players: readonly Seat[], code: string) => {
  const base = withoutPurge(heroGame(players));
  const played = put(base, code, 1);
  return { ...played, scheme: schemeOf(played.state, code) };
};
/** Thwarts `scheme` (put at `left` threat) with Cable's basic thwart, answering prompts with `pick`. */
function defeat(state: GameState, scheme: InstanceId, pick: Picker, left = 2) {
  const staged = patchInstance(state, scheme, { threat: left });
  const driven = driveEventsPicking(WAVE7_DEPS, staged, pick, basicThwart(P1, cableOf(staged), scheme));
  return { ...driven, before: staged };
}
/** The printed ids a card prompt offers while `pick` drives `command`. */
function offeredCards(state: GameState, pick: Picker, ...commands: Command[]): string[] {
  const seen = new Set<string>();
  const spy: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseCards")
      for (const o of s.pendingChoice.options) seen.add(codeOf(s, o.optionId as InstanceId));
    return pick(s);
  };
  driveEventsPicking(WAVE7_DEPS, state, spy, ...commands);
  return [...seen].sort();
}

describe.each([
  ["Call for Backup", "40018", 3, CALL_FOR_BACKUP],
  ["Lock and Load", "40019", 2, LOCK_AND_LOAD],
  ["Establish Perimeter", "40020", 2, ESTABLISH_PERIMETER],
  ["Build Support", "40027", 3, BUILD_SUPPORT],
] as const)("%s (%s), a player side scheme", (_name, code, perPlayer, ref) => {
  it("is registered and costs 1", () => {
    expect(NEXT_EVOL_PRECON_CABLE_DECK[ref]).toBeDefined();
    const base = withoutPurge(heroGame());
    expect(playRefused(base, code, 0)).toBe(true);
    const { state, before } = put(base, code, 1);
    expect(handOf(state)).toHaveLength(handOf(before).length - 2);
  });
  it(`enters play with ${perPlayer} threat per player: ${perPlayer} for one player, ${perPlayer * 2} for two`, () => {
    const one = inPlayScheme([CABLE], code);
    expect(one.state.villainArea).toContain(one.scheme);
    expect(threat(one.state, one.scheme)).toBe(perPlayer);
    const two = inPlayScheme([CABLE, SPIDER_MAN], code);
    expect(threat(two.state, two.scheme)).toBe(perPlayer * 2);
  });
  it("is Victory 0: thwarted to 0 it goes to the victory display", () => {
    const { state: base, scheme } = inPlayScheme([CABLE], code);
    const { state } = defeat(base, scheme, chain(takeFirstCard));
    expect(state.victoryDisplay).toContain(scheme);
    expect(state.villainArea).not.toContain(scheme);
    expect(threat(state, scheme)).toBe(0);
  });
  it("at the limit (1) another player side scheme in play: the player picks one to discard, not defeated", () => {
    const base = heroGame([CABLE]); // Technovirus Purge is in play
    const purge = schemeOf(base, PURGE);
    const given = moveToHand(base, P1, code);
    const [played] = given.ids as [InstanceId];
    const discardPurge: Picker = (st) => {
      const c = st.pendingChoice;
      return c?.options.some((o) => o.optionId === purge) ? [purge] : firstLegal(st);
    };
    const { state, events } = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      discardPurge,
      play(P1, played, payWith(given.state, P1, 1, [played])),
    );
    expect(state.villainArea).toContain(played);
    expect(state.villainArea).not.toContain(purge);
    expect(playerOf(state, P1).discard).toContain(purge);
    expect(state.victoryDisplay).not.toContain(purge);
    expect(threat(state, played)).toBe(perPlayer);
    expect(events.some((e) => e.type === "schemeDefeated")).toBe(false);
  });
});

describe("When Defeated: each player may search their deck and discard pile", () => {
  /** The ally prompts' cards, Call for Backup against Cable alone. */
  it("Call for Backup offers every ally of the deck, and the pick enters play (its own response too)", () => {
    const { state: base, scheme } = inPlayScheme([CABLE], "40018");
    const offered = offeredCards(
      patchInstance(base, scheme, { threat: 2 }),
      declineCard,
      basicThwart(P1, cableOf(base), scheme),
    );
    expect(offered).toEqual(["40014", "40015", "40016", "40024", "40025"]);
    const { state } = defeat(
      base,
      scheme,
      chain(accept("40016.sunspot-response"), cardChoice("40016"), () => []),
    );
    expect(playedOf(state, "40016")).toBeDefined();
    expect(playerOf(state, P1).deck).not.toContain(playedOf(state, "40016"));
    expect(state.victoryDisplay).toContain(scheme);
  });
  it("it is a may: declining puts nothing into play", () => {
    const { state: base, scheme } = inPlayScheme([CABLE], "40018");
    const before = inPlay(base).length;
    const { state } = defeat(base, scheme, declineCard);
    expect(inPlay(state)).toHaveLength(before);
    expect(state.victoryDisplay).toContain(scheme);
  });
  it("an ally already in the discard pile is found there too", () => {
    const { state: base, scheme } = inPlayScheme([CABLE], "40018");
    const moved = moveToDiscard(base, P1, "40024");
    const { state } = defeat(
      moved.state,
      scheme,
      chain(cardChoice("40024"), () => []),
    );
    expect(inPlay(state)).toContain(moved.id);
    expect(playerOf(state, P1).discard).not.toContain(moved.id);
  });
  it("two players: each is asked in turn, searching their own deck", () => {
    const { state: base, scheme } = inPlayScheme([CABLE, SPIDER_MAN], "40018");
    const asked: PlayerId[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "chooseCards") {
        asked.push(c.playerId);
        return c.playerId === P1
          ? [c.options.find((o) => codeOf(st, o.optionId as InstanceId) === "40015")!.optionId]
          : [];
      }
      return firstLegal(st);
    };
    const { state } = defeat(base, scheme, pick);
    expect(asked).toEqual([P1, P2]);
    expect(playedOf(state, "40015")).toBeDefined();
    expect(inPlay(state, P2).filter((id) => CARD_TYPES.get(codeOf(state, id)) === "ally")).toHaveLength(0);
  });
  it("two players: the other player puts an ally of their own deck into play under their control", () => {
    const { state: base, scheme } = inPlayScheme([CABLE, SPIDER_MAN], "40018");
    const p2Ally = playerOf(base, P2).deck.find((id) => CARD_TYPES.get(codeOf(base, id)) === "ally");
    expect(p2Ally).toBeDefined();
    const pick: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "chooseCards") return c.playerId === P2 ? [p2Ally!] : [];
      return firstLegal(st);
    };
    const { state } = defeat(base, scheme, pick);
    expect(inPlay(state, P2)).toContain(p2Ally);
    expect(inst(state, p2Ally!).controllerId).toBe(P2);
  });

  it("Build Support offers only supports costing 3 or less and the pick enters play", () => {
    const { state: base, scheme } = inPlayScheme([CABLE], "40027");
    const staged = patchInstance(base, scheme, { threat: 2 });
    const offered = offeredCards(staged, declineCard, basicThwart(P1, cableOf(staged), scheme));
    // Professor (40008) starts in the opening hand, which is not searched.
    expect(offered).toEqual(["40007", "40021", "40022"]);
    const { state } = defeat(
      base,
      scheme,
      chain(cardChoice("40007"), () => []),
    );
    expect(playedOf(state, "40007")).toBeDefined();
  });
  it("Establish Perimeter gives each identity a tough status card (two players: both)", () => {
    const one = inPlayScheme([CABLE], "40020");
    const done = defeat(one.state, one.scheme, firstLegal);
    expect(toughOf(done.state, cableOf(done.state))).toBe(1);
    const two = inPlayScheme([CABLE, SPIDER_MAN], "40020");
    const both = defeat(two.state, two.scheme, firstLegal);
    expect(toughOf(both.state, identityOf(both.state, P1))).toBe(1);
    expect(toughOf(both.state, identityOf(both.state, P2))).toBe(1);
  });
  it("Establish Perimeter: an identity already tough stays at one tough status card", () => {
    const { state: base, scheme } = inPlayScheme([CABLE], "40020");
    const tough = patchInstance(base, cableOf(base), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state } = defeat(tough, scheme, firstLegal);
    expect(toughOf(state, cableOf(state))).toBe(1);
  });
  it("the When Defeated resolves only on a defeat: a scheme at the limit's discard gives no tough status", () => {
    const base = heroGame([CABLE]);
    const purge = schemeOf(base, PURGE);
    const given = moveToHand(base, P1, "40020");
    const [id] = given.ids as [InstanceId];
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      (st) => (st.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : firstLegal(st)),
      play(P1, id, payWith(given.state, P1, 1, [id])),
    );
    expect(state.villainArea).not.toContain(id);
    expect(playerOf(state, P1).discard).toContain(id);
    expect(toughOf(state, cableOf(state))).toBe(0);
    expect(state.villainArea).toContain(purge);
  });
  it("the scheme is out of the limit once defeated: another can be played with no discard", () => {
    const { state: base, scheme } = inPlayScheme([CABLE], "40019");
    const { state: done } = defeat(base, scheme, declineCard);
    const next = put(done, "40020", 1);
    expect(next.state.villainArea).toContain(next.id);
    expect(done.victoryDisplay).toContain(scheme);
  });
});

describe("E.V.A. (40021)", () => {
  const withFantomex = (state = heroGame()) =>
    put(state, "40015", 4, { pick: chain(accept(FANTOMEX), cardChoice("40021")) });
  const labelPick = (label: string, ...rest: ((s: GameState) => readonly string[] | undefined)[]) =>
    chain(byLabel(label), ...rest);

  it("costs 0 and stays in play while Fantomex is in play", () => {
    const { state } = withFantomex();
    const eva = playedOf(state, "40021")!;
    expect(eva).toBeDefined();
    expect(inst(state, eva).exhausted).toBe(false);
  });
  // A standing condition (RRG 1.8 "Ability", p. 4: a constant ability is active as soon as its card enters play), so
  // an E.V.A. that enters play with no Fantomex is discarded once it has entered.
  it("played with no Fantomex in play, it is discarded at once", () => {
    const { state, id } = put(heroGame(), "40021", 0);
    expect(inPlay(state)).not.toContain(id);
    expect(playerOf(state, P1).discard).toContain(id);
  });
  it("Action, exhaust: remove 1 threat from a scheme (not a thwart: Technovirus Purge, which only Cable thwarts, still loses it)", () => {
    const { state } = withFantomex();
    const eva = playedOf(state, "40021")!;
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      state,
      chain(byLabel("Remove 1 threat from a scheme"), onlyTargets(mainOf(state))),
      use(P1, eva, EVA_ACTION),
    );
    expect(threat(driven.state, mainOf(driven.state))).toBe(19);
    expect(inst(driven.state, eva).exhausted).toBe(true);
  });
  it("Action: deal 1 damage to an enemy (not an attack: no Retaliate, no tough check)", () => {
    const { state } = withFantomex(withoutTough(heroGame()));
    const eva = playedOf(state, "40021")!;
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      state,
      chain(byLabel("Deal 1 damage to an enemy"), onlyTargets(villainOf(state))),
      use(P1, eva, EVA_ACTION),
    );
    expect(inst(driven.state, villainOf(driven.state)).damage).toBe(1);
  });
  it("Action: heal 1 damage from Fantomex", () => {
    const { state } = withFantomex();
    const fantomex = playedOf(state, "40015")!;
    const eva = playedOf(state, "40021")!;
    const hurt = withDamage(state, fantomex, 2);
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      hurt,
      chain(byLabel("Heal 1 damage from Fantomex")),
      use(P1, eva, EVA_ACTION),
    );
    expect(inst(driven.state, fantomex).damage).toBe(1);
  });
  it("cannot be used while exhausted", () => {
    const { state } = withFantomex();
    const eva = playedOf(state, "40021")!;
    const exhausted = patchInstance(state, eva, { exhausted: true });
    expect(refused(exhausted, use(P1, eva, EVA_ACTION))).toBe(true);
  });
  it("discarded as soon as Fantomex leaves play (defeated by his own consequential damage)", () => {
    const { state } = withFantomex();
    const fantomex = playedOf(state, "40015")!;
    const eva = playedOf(state, "40021")!;
    const doomed = withDamage(state, fantomex, 2);
    const driven = driveEventsPicking(WAVE7_DEPS, doomed, firstLegal, basicThwart(P1, fantomex, mainOf(doomed)));
    expect(inPlay(driven.state)).not.toContain(fantomex);
    expect(inPlay(driven.state)).not.toContain(eva);
    expect(playerOf(driven.state, P1).discard).toEqual(expect.arrayContaining([fantomex, eva]));
  });
  void labelPick;
});

describe("Mission Leader (40023)", () => {
  it("costs 2 and, with a SOLDIER identity (Cable and Nathan Summers both), 1 less: 1 card pays for it", () => {
    const base = heroGame();
    const { state, id } = put(base, "40023", 1);
    expect(inst(state, id).attachedTo).toBe(cableOf(state));
    expect(playRefused(base, "40023", 0)).toBe(true);
    const alterEgo = withForm(base, "alterEgo");
    expect(playRefused(alterEgo, "40023", 1)).toBe(false);
  });
  it("without the SOLDIER trait it costs 2: Spider-Man cannot pay 1 card but can pay 2", () => {
    const base = turnOfP2(heroGame([CABLE, SPIDER_MAN]));
    const given = injectIntoHand(base, P2, "40023");
    expect(refused(given.state, play(P2, given.id, payWith(given.state, P2, 1, [given.id])))).toBe(true);
    expect(refused(given.state, play(P2, given.id, payWith(given.state, P2, 2, [given.id])))).toBe(false);
  });
  it("after a side scheme is defeated, exhausting it has each player draw 1 (one player)", () => {
    const leader = put(heroGame(), "40023", 1);
    const scheme = schemeOf(leader.state, PURGE);
    const staged = patchInstance(leader.state, scheme, { threat: 2 });
    const handBefore = handOf(staged).length;
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      staged,
      accepting(MISSION_LEADER),
      basicThwart(P1, cableOf(staged), scheme),
    );
    expect(driven.state.victoryDisplay).toContain(scheme);
    expect(inst(driven.state, leader.id).exhausted).toBe(true);
    expect(handOf(driven.state)).toHaveLength(handBefore + 1);
  });
  it("two players: each player draws 1, whoever defeated the scheme, encounter side schemes too", () => {
    const base = heroGame([CABLE, SPIDER_MAN]);
    const leader = put(base, "40023", 1);
    const staged = encounterCardInVillainArea(leader.state, BREAKIN, 2);
    const handsBefore = [handOf(staged.state, P1).length, handOf(staged.state, P2).length];
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      staged.state,
      accepting(MISSION_LEADER),
      basicThwart(P1, cableOf(staged.state), staged.id),
    );
    expect(handOf(driven.state, P1)).toHaveLength(handsBefore[0]! + 1);
    expect(handOf(driven.state, P2)).toHaveLength(handsBefore[1]! + 1);
  });
  it("is not offered when no scheme is defeated, nor while exhausted", () => {
    const leader = put(heroGame(), "40023", 1);
    const scheme = schemeOf(leader.state, PURGE);
    // Purge keeps 3 threat: not defeated.
    const none = driveEventsPicking(
      WAVE7_DEPS,
      leader.state,
      accepting(MISSION_LEADER),
      basicThwart(P1, cableOf(leader.state), scheme),
    );
    expect(inst(none.state, leader.id).exhausted).toBe(false);
    const tired = patchInstance(patchInstance(leader.state, leader.id, { exhausted: true }), scheme, { threat: 2 });
    const drawn = driveEventsPicking(
      WAVE7_DEPS,
      tired,
      accepting(MISSION_LEADER),
      basicThwart(P1, cableOf(tired), scheme),
    );
    expect(handOf(drawn.state)).toHaveLength(handOf(tired).length);
  });
});

describe("Deadpool (40024)", () => {
  const thwartWith = (state: GameState, id: InstanceId) =>
    driveEventsPicking(WAVE7_DEPS, state, firstLegal, basicThwart(P1, id, mainOf(state)));

  it("costs 3, with THW 2 and consequential damage 1", () => {
    const { state, id } = put(heroGame(), "40024", 3);
    expect(inPlay(state)).toContain(id);
    const done = thwartWith(state, id);
    expect(threat(done.state, mainOf(done.state))).toBe(18);
    expect(inst(done.state, id).damage).toBe(1);
  });
  it("would be defeated by consequential damage: heals 3 damage instead and adds an acceleration token", () => {
    const { state, id } = put(heroGame(), "40024", 3);
    const staged = withDamage(state, id, 2);
    const tokens = staged.mainScheme.accelerationTokens;
    const done = thwartWith(staged, id);
    expect(inPlay(done.state)).toContain(id);
    expect(inst(done.state, id).damage).toBe(0);
    expect(done.state.mainScheme.accelerationTokens).toBe(tokens + 1);
    expect(playerOf(done.state, P1).discard).not.toContain(id);
  });
  it("damage that is not consequential defeats him as usual: Frenemies' 1 damage with 2 already on him", () => {
    const { state, id } = put(heroGame(), "40024", 3);
    const doomed = withDamage(state, id, 2);
    const tokens = doomed.mainScheme.accelerationTokens;
    const frenemies = put(doomed, "40026", 1);
    expect(inPlay(frenemies.state)).not.toContain(id);
    expect(playerOf(frenemies.state, P1).discard).toContain(id);
    expect(frenemies.state.mainScheme.accelerationTokens).toBe(tokens);
  });
  it("consequential damage that does not defeat him is taken as usual (no token)", () => {
    const { state, id } = put(heroGame(), "40024", 3);
    const done = thwartWith(withDamage(state, id, 1), id);
    expect(inst(done.state, id).damage).toBe(2);
    expect(done.state.mainScheme.accelerationTokens).toBe(state.mainScheme.accelerationTokens);
  });
  it("two players: the other player's Deadpool is saved the same way and the token goes on the one main scheme", () => {
    const base = turnOfP2(heroGame([CABLE, SPIDER_MAN]));
    const given = injectIntoHand(base, P2, "40024");
    const placed = put(given.state, "40024", 3, { player: P2 });
    const staged = withDamage(placed.state, placed.id, 2);
    const done = driveEventsPicking(WAVE7_DEPS, staged, firstLegal, basicThwart(P2, placed.id, mainOf(staged)));
    expect(inst(done.state, placed.id).damage).toBe(0);
    expect(done.state.mainScheme.accelerationTokens).toBe(staged.mainScheme.accelerationTokens + 1);
  });
});

describe("Frenemies (40026)", () => {
  /** Cable and Deadpool in play (Deadpool paid for from the hand), main scheme 20, Technovirus Purge 5. */
  const withDeadpool = () => put(heroGame(), "40024", 3);
  const targetsInOrder = (...ids: InstanceId[]): Picker => {
    let next = 0;
    return (s) => {
      const c = s.pendingChoice;
      if (
        c?.prompt.kind === "chooseTarget" &&
        ids[next] !== undefined &&
        c.options.some((o) => o.optionId === ids[next])
      ) {
        return [ids[next++]!];
      }
      return firstLegal(s);
    };
  };

  it("is Team-Up (Cable and Deadpool): it cannot be played unless Deadpool is in play", () => {
    expect(playRefused(heroGame(), "40026", 1)).toBe(true);
    expect(playRefused(withDeadpool().state, "40026", 1)).toBe(false);
  });
  it("costs 1: 1 damage each to Cable and Deadpool, then 3 threat from a scheme and 3 from a different scheme", () => {
    const { state: base } = withDeadpool();
    const purge = schemeOf(base, PURGE);
    const deadpool = playedOf(base, "40024")!;
    const cableDamage = inst(base, cableOf(base)).damage;
    const { state, id } = put(base, "40026", 1, { pick: targetsInOrder(mainOf(base), purge) });
    expect(inst(state, cableOf(state)).damage).toBe(cableDamage + 1);
    expect(inst(state, deadpool).damage).toBe(inst(base, deadpool).damage + 1);
    expect(threat(state, mainOf(state))).toBe(17);
    expect(threat(state, purge)).toBe(2);
    expect(playerOf(state, P1).discard).toContain(id);
  });
  it("the second scheme must be a different one: the first choice is not offered again", () => {
    const { state: base } = withDeadpool();
    const purge = schemeOf(base, PURGE);
    const offers: InstanceId[][] = [];
    const spy: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTarget") offers.push(c.options.map((o) => o.optionId as InstanceId));
      return targetsInOrder(mainOf(base), purge)(s);
    };
    put(base, "40026", 1, { pick: spy });
    expect(offers).toHaveLength(2);
    expect(offers[0]).toEqual(expect.arrayContaining([mainOf(base), purge]));
    expect(offers[1]).not.toContain(mainOf(base));
    expect(offers[1]).toContain(purge);
  });
  it("both are thwarts by Cable: it can defeat Technovirus Purge, which only Cable removes threat from", () => {
    const { state: base } = withDeadpool();
    const purge = schemeOf(base, PURGE);
    const staged = patchInstance(base, purge, { threat: 3 });
    const { state } = put(staged, "40026", 1, { pick: targetsInOrder(mainOf(base), purge) });
    expect(state.victoryDisplay).toContain(purge);
    expect(threat(state, mainOf(state))).toBe(17);
  });
  it("with only one scheme in play only 3 threat are removed", () => {
    const { state: base } = withDeadpool();
    const alone = withoutPurge(base);
    const { state } = put(alone, "40026", 1);
    expect(threat(state, mainOf(state))).toBe(17);
  });
  it("it can defeat Deadpool by its own damage (he is not saved: not consequential)", () => {
    const { state: base } = withDeadpool();
    const deadpool = playedOf(base, "40024")!;
    const { state } = put(withDamage(base, deadpool, 2), "40026", 1);
    expect(inPlay(state)).not.toContain(deadpool);
  });
  it("two players: Deadpool under the other player's control takes the damage too", () => {
    const placed = allyInPlay(heroGame([CABLE, SPIDER_MAN]), "40024", P2);
    const { state } = put(placed.state, "40026", 1);
    expect(inst(state, placed.id).damage).toBe(1);
    expect(inst(state, cableOf(state)).damage).toBe(1);
  });
});

describe("The Power of the Mind (40028)", () => {
  it("while paying for a PSIONIC card its [mental] counts double: Caliban (3) paid with it and 1 other card", () => {
    const base = heroGame();
    const given = moveToHand(base, P1, "40014", "40028", "40017");
    const [caliban, mind, other] = given.ids as [InstanceId, InstanceId, InstanceId];
    const result = applyCommand(given.state, play(P1, caliban, [mind, other]), WAVE7_DEPS);
    expect(result.ok).toBe(true);
  });
  it("it is not doubled for a card that is not PSIONIC: Sunspot (3, AERIAL) cannot be paid with it and 1 other card", () => {
    const base = heroGame();
    const given = moveToHand(base, P1, "40016", "40028", "40017");
    const [sunspot, mind, other] = given.ids as [InstanceId, InstanceId, InstanceId];
    expect(refused(given.state, play(P1, sunspot, [mind, other]))).toBe(true);
    const three = moveToHand(given.state, P1, "40022");
    expect(refused(three.state, play(P1, sunspot, [mind, other, three.ids[0]!]))).toBe(false);
  });
  it("one copy covers 2 of Fantomex's 4: paid with it, a 4-cost PSIONIC card needs 3 cards", () => {
    const base = heroGame();
    const given = moveToHand(base, P1, "40015", "40028", "40017", "40022");
    const [fantomex, mind, a, b] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    expect(refused(given.state, play(P1, fantomex, [mind, a]))).toBe(true);
    expect(refused(given.state, play(P1, fantomex, [mind, a, b]))).toBe(false);
  });
});

describe("Psimitar (40029)", () => {
  const withPsimitar = (state = withoutTough(heroGame())) => put(state, "40029", 2);
  const answer = chain(accept(PSIMITAR), onlyTargets());

  it("costs 2, attaches to the identity and is Restricted (data)", () => {
    const { state, id, before } = withPsimitar();
    expect(inst(state, id).attachedTo).toBe(cableOf(state));
    expect(handOf(state)).toHaveLength(handOf(before).length - 3);
  });
  it("after you play another PSIONIC card (Caliban), exhaust it: 2 damage to an enemy, an attack", () => {
    const { state: base, id } = withPsimitar();
    const { state } = put(base, "40014", 3, { pick: chain(accept(PSIMITAR)) });
    expect(inst(state, id).exhausted).toBe(true);
    expect(inst(state, villainOf(state)).damage).toBe(2);
  });
  it("is an attack: Toughness blocks it (the tough status card is discarded, no damage)", () => {
    const base = heroGame();
    expect(toughOf(base, villainOf(base))).toBe(1);
    const { state: ready, id } = withPsimitar(base);
    const { state } = put(ready, "40014", 3, { pick: chain(accept(PSIMITAR)) });
    expect(inst(state, id).exhausted).toBe(true);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(toughOf(state, villainOf(state))).toBe(0);
  });
  it("is not offered for a card that is not PSIONIC, nor for Psimitar's own play", () => {
    const { state: base, id } = withPsimitar();
    const offeredIds: string[] = [];
    const spy: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseTriggers")
        offeredIds.push(...s.pendingChoice.options.map((o) => o.optionId));
      return chain(accept(PSIMITAR))(s);
    };
    const { state } = put(base, "40016", 3, { pick: spy });
    expect(offeredIds.some((o) => o.includes(PSIMITAR))).toBe(false);
    expect(inst(state, id).exhausted).toBe(false);
    // And its own play: Psimitar is the only PSIONIC card played, so no offer either.
    const own: string[] = [];
    const spy2: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseTriggers")
        own.push(...s.pendingChoice.options.map((o) => o.optionId));
      return firstLegal(s);
    };
    put(withoutTough(heroGame()), "40029", 2, { pick: spy2 });
    expect(own.some((o) => o.includes(PSIMITAR))).toBe(false);
  });
  it("needs it ready: exhausted, it is not offered", () => {
    const { state: base, id } = withPsimitar();
    const tired = patchInstance(base, id, { exhausted: true });
    const { state } = put(tired, "40014", 3, { pick: chain(accept(PSIMITAR)) });
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });
  it("is a Hero Response: in alter-ego form it is not offered", () => {
    const { state: base } = withPsimitar();
    const { state } = put(withForm(base, "alterEgo"), "40014", 3, { pick: chain(accept(PSIMITAR)) });
    expect(inst(state, villainOf(state)).damage).toBe(0);
  });
  void answer;
});

describe("Sidearm (40030)", () => {
  it("costs 1; the attached ally gets +1 ATK", () => {
    const ally = put(heroGame(), "40024", 3);
    const before = characterProfileAtk(ally.state, ally.id);
    const { state, id } = put(ally.state, "40030", 1, { attach: ally.id });
    expect(inst(state, id).attachedTo).toBe(ally.id);
    expect(characterProfileAtk(state, ally.id)).toBe(before + 1);
  });
  it("attaches to an ally only: Cable himself is refused", () => {
    const base = heroGame();
    const given = moveToHand(base, P1, "40030");
    const [id] = given.ids as [InstanceId];
    expect(
      refused(given.state, play(P1, id, payWith(given.state, P1, 1, [id]), { attachToInstanceId: cableOf(base) })),
    ).toBe(true);
  });
  it("Max 1 per ally: a second Sidearm on the same ally is refused, on another ally it is allowed", () => {
    const first = put(heroGame(), "40024", 3);
    const sidearm = put(first.state, "40030", 1, { attach: first.id });
    const second = moveToHand(sidearm.state, P1, "40030");
    const [id2] = second.ids.slice(-1) as [InstanceId];
    expect(
      refused(second.state, play(P1, id2, payWith(second.state, P1, 1, [id2]), { attachToInstanceId: first.id })),
    ).toBe(true);
    const other = allyInPlay(sidearm.state, "40016");
    const again = moveToHand(other.state, P1, "40030");
    expect(
      refused(
        again.state,
        play(P1, again.ids[0]!, payWith(again.state, P1, 1, [again.ids[0]!]), { attachToInstanceId: other.id }),
      ),
    ).toBe(false);
  });
  it("its attacks gain ranged: the same definition as War Machine's Sidearm, which pins ranged", () => {
    expect(NEXT_EVOL_PRECON_CABLE_DECK[SIDEARM]).toBe(WAR_MACHINE_PACK_CARDS["23035.sidearm-constant"]);
  });
});

// ---- Lock and Load, Uncanny X-Force, Deathlok ---------------------------------------------------------------
describe("Lock and Load (40019): When Defeated, each player may put a WEAPON upgrade costing 3 or less into play", () => {
  /** Lock and Load in play at 2 threat with nothing else in play; `stage` adds to the board before the thwart. */
  const ready = (players: readonly Seat[] = [CABLE]) => inPlayScheme(players, "40019");
  const weapons = (s: GameState, p: PlayerId = P1) =>
    [...playerOf(s, p).deck, ...playerOf(s, p).discard].filter((id) =>
      ["40011", "40029", "40030"].includes(codeOf(s, id)),
    );

  it("offers exactly the WEAPON upgrades in the deck and discard pile: Plasma Rifle, Psimitar and Sidearm", () => {
    const { state: base, scheme } = ready();
    const staged = patchInstance(base, scheme, { threat: 2 });
    const offered = offeredCards(staged, declineCard, basicThwart(P1, cableOf(staged), scheme));
    expect(offered).toEqual([...new Set(weapons(base).map((id) => codeOf(base, id)))].sort());
    expect(offered).toContain("40029");
    expect(offered.every((code) => ["40011", "40029", "40030"].includes(code))).toBe(true);
  });
  // RRG 1.8 "Play, Put into Play" (p. 32): it enters play as playing it would, on the finder's identity.
  it("Psimitar goes on the finder's identity, under their control, and was not played", () => {
    const { state: base, scheme } = ready();
    const psimitar = weapons(base).find((id) => codeOf(base, id) === "40029")!;
    const { state, events } = defeat(
      base,
      scheme,
      chain(cardChoice("40029"), () => []),
    );
    expect(inst(state, psimitar).attachedTo).toBe(cableOf(state));
    expect(inst(state, cableOf(state)).attachments).toContain(psimitar);
    expect(inst(state, psimitar).controllerId).toBe(P1);
    expect(playerOf(state, P1).deck).not.toContain(psimitar);
    expect(events.some((e) => e.type === "cardPlayed" && e.instanceId === psimitar)).toBe(false);
    expect(state.victoryDisplay).toContain(scheme);
  });
  // Hope Summers (40130) is an ally in play in this scenario, under the first player's control.
  const hopeOf = (s: GameState): InstanceId => instancesOf(s, "40130")[0]!;
  const sidearms = (s: GameState) => weapons(s).filter((id) => codeOf(s, id) === "40030");
  it("Sidearm ('attach to an ally') goes on the one ally in play (Hope Summers) with no question", () => {
    const { state: base, scheme } = ready();
    const hostPrompts: string[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTarget" && c.prompt.slot === "putIntoPlayHost") hostPrompts.push(c.prompt.slot);
      return chain(cardChoice("40030"), () => [])(s);
    };
    const { state } = defeat(base, scheme, pick);
    const attached = inst(state, hopeOf(state)).attachments;
    expect(attached.map((id) => codeOf(state, id))).toEqual(["40030"]);
    expect(inst(state, attached[0]!)).toMatchObject({ attachedTo: hopeOf(state), controllerId: P1 });
    expect(sidearms(state)).toHaveLength(sidearms(base).length - 1);
    expect(hostPrompts).toEqual([]);
  });
  it("Sidearm with two allies in play: the finder chooses which of the 2 it goes on", () => {
    const { state: base, scheme } = ready();
    const deadpool = allyInPlay(base, "40024");
    const hosts: string[][] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTarget" && c.prompt.slot === "putIntoPlayHost") {
        hosts.push(c.options.map((o) => o.optionId));
        return [deadpool.id];
      }
      return chain(cardChoice("40030"), () => [])(s);
    };
    const { state } = defeat(deadpool.state, scheme, pick);
    expect(hosts).toEqual([[hopeOf(base), deadpool.id]]);
    expect(inst(state, deadpool.id).attachments.map((id) => codeOf(state, id))).toEqual(["40030"]);
    expect(inst(state, hopeOf(state)).attachments).toEqual([]);
  });
  // RRG 1.8 "Attach To" (p. 8): with no legal host "it remains in its prior state or game area".
  it("Sidearm with no ally in play does not enter play: it stays in the deck, which is shuffled", () => {
    const { state: ready_, scheme } = ready();
    // Hope Summers out of play by surgery.
    const hope = hopeOf(ready_);
    const base: GameState = {
      ...ready_,
      players: ready_.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== hope) })),
      removedFromGame: [...ready_.removedFromGame, hope],
    };
    const { state, events } = defeat(
      base,
      scheme,
      chain(cardChoice("40030"), () => []),
    );
    expect(sidearms(state)).toHaveLength(sidearms(base).length);
    expect(sidearms(state).every((id) => inst(state, id).attachedTo === null)).toBe(true);
    expect(events.filter((e) => e.type === "putIntoPlayRefused")).toHaveLength(1);
    expect(events.filter((e) => e.type === "deckShuffled")).toHaveLength(1);
    expect(state.victoryDisplay).toContain(scheme);
  });
  it("it is a may: declining attaches nothing", () => {
    const { state: base, scheme } = ready();
    const { state } = defeat(base, scheme, declineCard);
    expect(inst(state, cableOf(state)).attachments).toEqual(inst(base, cableOf(base)).attachments);
    expect(state.victoryDisplay).toContain(scheme);
  });
  it("two players: each is asked in turn; the other player's WEAPON goes on their own identity", () => {
    const { state: base, scheme } = ready([CABLE, SPIDER_MAN]);
    // A Psimitar of the second player's own, in their discard pile.
    const given = injectIntoHand(base, P2, "40029");
    const staged: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P2 ? { ...p, hand: p.hand.filter((x) => x !== given.id), discard: [...p.discard, given.id] } : p,
      ),
    };
    const asked: PlayerId[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "chooseCards") {
        asked.push(c.playerId);
        return c.playerId === P2 ? [given.id] : [];
      }
      return firstLegal(st);
    };
    const { state } = defeat(staged, scheme, pick);
    expect(asked).toEqual([P1, P2]);
    expect(inst(state, given.id).attachedTo).toBe(identityOf(state, P2));
    expect(inst(state, given.id).controllerId).toBe(P2);
  });
});

describe("Uncanny X-Force (40022)", () => {
  /** Deadpool (X-FORCE, THW 2, 1 consequential damage) and Uncanny X-Force in play; Cable is X-FORCE. */
  const setup = () => {
    const ally = put(heroGame(), "40024", 3);
    const support = put(ally.state, "40022", 2);
    return { ally, state: support.state };
  };
  const thwartWith = (state: GameState, ally: InstanceId, scheme: InstanceId) =>
    driveEventsPicking(WAVE7_DEPS, state, firstLegal, basicThwart(P1, ally, scheme)).state;

  it("costs 2, and gives each ally you control +1 THW while every character you control is X-FORCE: 2 becomes 3", () => {
    const { ally, state } = setup();
    expect(playRefused(ally.state, "40022", 1)).toBe(true);
    expect(characterProfile(ally.state, ally.id, WAVE7_DEPS)!.thw).toBe(2);
    expect(characterProfile(state, ally.id, WAVE7_DEPS)!.thw).toBe(3);
  });
  it("after thwarting a side scheme: 3 threat removed (6 to 3) and Deadpool takes 0 consequential damage", () => {
    const { ally, state } = setup();
    const staged = encounterCardInVillainArea(state, BREAKIN, 6);
    const after = thwartWith(staged.state, ally.id, staged.id);
    expect(threat(after, staged.id)).toBe(3);
    expect(inst(after, ally.id).damage).toBe(0);
  });
  it("a side scheme the thwart defeated still counts: it has left play and Deadpool takes 0", () => {
    const { ally, state } = setup();
    const staged = encounterCardInVillainArea(state, BREAKIN, 3);
    const after = thwartWith(staged.state, ally.id, staged.id);
    expect(after.villainArea).not.toContain(staged.id);
    expect(inst(after, ally.id).damage).toBe(0);
  });
  it("after thwarting the main scheme: 3 threat removed (20 to 17) and Deadpool takes his 1 consequential damage", () => {
    const { ally, state } = setup();
    const after = thwartWith(state, ally.id, mainOf(state));
    expect(threat(after, mainOf(after))).toBe(17);
    expect(inst(after, ally.id).damage).toBe(1);
  });
  it("attacking is untouched: Deadpool takes his 1 consequential damage", () => {
    const { ally, state } = setup();
    const after = driveEventsPicking(WAVE7_DEPS, withoutTough(state), firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: ally.id,
      targetInstanceId: villainOf(state),
    }).state;
    expect(inst(after, villainOf(after)).damage).toBe(2);
    expect(inst(after, ally.id).damage).toBe(1);
  });
  it("a character you control without X-FORCE turns it off: THW 2, and 1 damage after thwarting a side scheme", () => {
    const { ally, state } = setup();
    const posse = allyInPlay(state, "40038"); // Diamondback, POSSE
    expect(characterProfile(posse.state, ally.id, WAVE7_DEPS)!.thw).toBe(2);
    const staged = encounterCardInVillainArea(posse.state, BREAKIN, 6);
    const after = thwartWith(staged.state, ally.id, staged.id);
    expect(threat(after, staged.id)).toBe(4);
    expect(inst(after, ally.id).damage).toBe(1);
  });
  it("only allies you control: another player's Deadpool gets no THW and takes his 1 damage", () => {
    const base = heroGame([CABLE, SPIDER_MAN]);
    const support = put(base, "40022", 2);
    const theirs = allyInPlay(support.state, "40024", P2);
    expect(characterProfile(theirs.state, theirs.id, WAVE7_DEPS)!.thw).toBe(2);
  });
});

describe("Deathlok (40025)", () => {
  /** `code` (a copy of P1's own, or a synthetic one for `owner`) placed in `owner`'s discard pile. */
  const inDiscard = (state: GameState, code: string, owner: PlayerId = P1) => {
    if (owner === P1) return moveToDiscard(state, P1, code);
    const given = injectIntoHand(state, owner, code);
    return {
      id: given.id,
      state: {
        ...given.state,
        players: given.state.players.map((p) =>
          p.playerId === owner
            ? { ...p, hand: p.hand.filter((x) => x !== given.id), discard: [...p.discard, given.id] }
            : p,
        ),
      } as GameState,
    };
  };
  /** Plays Deathlok (cost 4) accepting his response; records what the card prompt offered. */
  const playDeathlok = (state: GameState, choose?: InstanceId) => {
    const offered: string[][] = [];
    const prompts: string[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTriggers") {
        const mine = c.options.filter((o) => o.optionId.includes(DEATHLOK)).map((o) => o.optionId);
        prompts.push(...mine);
        return mine;
      }
      if (c?.prompt.kind === "chooseCards" && c.prompt.slot === "upgrade") {
        offered.push(c.options.map((o) => codeOf(s, o.optionId as InstanceId)));
        return [choose ?? c.options[0]!.optionId];
      }
      return firstLegal(s);
    };
    const played = put(state, "40025", 4, { pick, keep: choose ? [choose] : [] });
    return { ...played, offered, prompts };
  };

  it("costs 4: ATK 2, THW 2, 3 hit points", () => {
    const base = heroGame();
    expect(playRefused(base, "40025", 3)).toBe(true);
    const { state, id } = put(base, "40025", 4, { pick: declining });
    expect(characterProfile(state, id, WAVE7_DEPS)).toMatchObject({ atk: 2, thw: 2 });
    expect(inst(state, id).damage).toBe(0);
  });
  it("attaches a Sidearm (cost 1, 'attach to an ally') from your discard pile to himself", () => {
    const sidearm = inDiscard(heroGame(), "40030");
    const { state, id, offered, prompts } = playDeathlok(sidearm.state, sidearm.id);
    expect(prompts).toHaveLength(1);
    expect(offered).toHaveLength(1);
    expect(offered[0]).toContain("40030");
    expect(inst(state, sidearm.id).attachedTo).toBe(id);
    expect(inst(state, id).attachments).toEqual([sidearm.id]);
    expect(playerOf(state, P1).discard).not.toContain(sidearm.id);
  });
  it("offers only upgrades that can be attached to him: Askani'son (cost 1, an identity upgrade) is not offered", () => {
    const sidearm = inDiscard(heroGame(), "40030");
    const title = inDiscard(sidearm.state, "40009");
    const { offered } = playDeathlok(title.state, sidearm.id);
    expect(offered).toHaveLength(1);
    expect(offered[0]!.every((code) => code === "40030")).toBe(true);
    expect(offered[0]).not.toContain("40009");
  });
  it("with no such upgrade in any discard pile there is nothing to choose and nothing is attached", () => {
    const title = inDiscard(heroGame(), "40009");
    const clean: GameState = {
      ...title.state,
      // Every Sidearm out of the hand (a payment would discard it) and the discard pile, to the bottom of the deck.
      players: title.state.players.map((p) => ({
        ...p,
        hand: p.hand.filter((id) => codeOf(title.state, id) !== "40030"),
        discard: p.discard.filter((id) => codeOf(title.state, id) !== "40030"),
        deck: [...p.deck, ...[...p.hand, ...p.discard].filter((id) => codeOf(title.state, id) === "40030")],
      })),
    };
    const { state, id, offered, prompts } = playDeathlok(clean);
    // The response has nothing to choose, so it is not offered.
    expect(prompts).toEqual([]);
    expect(offered).toEqual([]);
    expect(inst(state, id).attachments).toEqual([]);
    expect(playerOf(state, P1).discard).toContain(title.id);
  });
  // RRG 1.8 "Ownership and Control" (p. 31): an upgrade on a card another player controls is that player's.
  it("any player's discard pile: another player's Sidearm goes on Deathlok, controlled by Deathlok's controller", () => {
    const theirs = inDiscard(heroGame([CABLE, SPIDER_MAN]), "40030", P2);
    const { state, id } = playDeathlok(theirs.state, theirs.id);
    expect(inst(state, theirs.id).attachedTo).toBe(id);
    expect(inst(state, theirs.id)).toMatchObject({ ownerId: P2, controllerId: P1 });
    expect(playerOf(state, P2).discard).not.toContain(theirs.id);
  });
  it("it is a Hero Response: in alter-ego form it is not offered", () => {
    const sidearm = inDiscard(heroGame(), "40030");
    const alterEgo = withForm(sidearm.state, "alterEgo");
    const { state, id, prompts } = playDeathlok(alterEgo, sidearm.id);
    expect(prompts).toEqual([]);
    expect(inst(state, id).attachments).toEqual([]);
  });
});
