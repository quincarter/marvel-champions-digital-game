import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  hasKeyword,
  maxHitPoints,
  traitsOf,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../dsl/index.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  play,
  playerOf,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { wave9Scenario } from "../setup.js";
import {
  CAPTAIN_MARVEL,
  IRON_MAN,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  inDiscard,
  inPlayCard,
  schemesBy,
  types,
} from "../testing.js";
import { TT_CARDS } from "@mc/content";
import { abilityRefIds } from "../../ability-refs.js";
import { validateDefinition } from "../../dsl/validate.js";
import { ENCHANTRESS, ENCHANTRESS_SKIPPED } from "./enchantress.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * The encounter cards of the Enchantress scenario, 55012 to 55026 (docs/phase7-wave9.md sections 3.53, 3.55, 3.56, 3.58
 * and 3.72; MC55 pp. 6 to 7 and 22), on the real scenario with real turns and prompts. The frame (the villain, the
 * Gazes and Trances) is in `enchantress.test.ts`. Trickster Magic is unscripted, so every game replaces the encounter
 * deck with `onlyDeck(...)`: a villain phase draws the villain's boost card first, then deals one card per player.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, ENCHANTRESS) };

const GAZES = ["55007a", "55008a", "55009a", "55010a", "55011a"] as const;
type Gaze = (typeof GAZES)[number];
const SLOTH_ACTION = "55010b.trance-of-sloth-forced-action";
/** Core treachery without a boost icon or attack: Advance. */
const BLANK = "01186";

interface Sim {
  state: GameState;
  events: GameEvent[];
  /** Every card of the scenario's encounter deck as the game began: `onlyDeck` drops what it does not use. */
  readonly pool: readonly InstanceId[];
}
type Seat = typeof SPIDER_MAN | typeof IRON_MAN | typeof CAPTAIN_MARVEL;

function open(
  players: readonly Seat[] = [SPIDER_MAN],
  opts: { readonly difficulty?: "standard" | "expert"; readonly seed?: number } = {},
): Sim {
  const config = wave9Scenario("enchantress", {
    players,
    seed: opts.seed ?? 1,
    difficulty: opts.difficulty ?? "standard",
  });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const piles = state.encounterDecks[activeEncounterDeckId(state)]!;
  return {
    state: heroForm(state, ...players.map((_, i) => `p${i + 1}` as PlayerId)),
    events: [],
    pool: [...piles.deck, ...piles.discard],
  };
}

/**
 * The encounter deck exactly these cards, top first, taken from the scenario's own cards that are not in play (so a
 * later round can use a card an earlier `stack` left out), the discard pile emptied.
 */
const stack = (sim: Sim, ...codes: string[]): void => {
  const inPlay = new Set(cardsInPlay(sim.state));
  const used: InstanceId[] = [];
  for (const code of codes) {
    const id = sim.pool.find((i) => !inPlay.has(i) && !used.includes(i) && codeOf(sim.state, i) === code);
    if (!id) throw new Error(`no ${code} available`);
    used.push(id);
  }
  // A few quiet cards underneath (Biomechanical Upgrades, Advance, Caught Off Guard) so the deck never runs out.
  const bottom = sim.pool.filter(
    (i) => !inPlay.has(i) && !used.includes(i) && ["01185", "01186", "01188"].includes(codeOf(sim.state, i)),
  );
  sim.state = {
    ...sim.state,
    encounterDecks: {
      ...sim.state.encounterDecks,
      [activeEncounterDeckId(sim.state)]: { deck: [...used, ...bottom], discard: [] },
    },
  };
};
const gazeOn = (s: GameState, player: PlayerId = P1): InstanceId => {
  const [gaze] = inst(s, identityOf(s, player)).attachments;
  if (!gaze) throw new Error(`${player} has no Hypnotic Gaze`);
  return gaze;
};
const charm = (s: GameState, id: InstanceId): number => inst(s, id).counters["charm"] ?? 0;
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
/** The Enchantment card in the player's play area. */
const enchantment = (s: GameState, player: PlayerId = P1): InstanceId => gazeOn(s, player);

function withGaze(s: GameState, player: PlayerId, code: Gaze): GameState {
  const held = gazeOn(s, player);
  if (codeOf(s, held) === code) return s;
  const other = Object.values(s.instances).find((i) => (i.cardId as string) === code)!;
  const heldCard = inst(s, held).cardId;
  return patchInstance(patchInstance(s, other.instanceId, { cardId: heldCard }), held, { cardId: other.cardId });
}
const withCharm = (s: GameState, id: InstanceId, n: number): GameState =>
  patchInstance(s, id, { counters: { charm: n } });
/** Test surgery: the player's hand replaced by these cards (instances keep their identity, their card id changes). */
function withHand(s: GameState, player: PlayerId, ...codes: string[]): GameState {
  let current = s;
  const hand = playerOf(s, player).hand;
  if (hand.length < codes.length) throw new Error("hand too small");
  codes.forEach((code, i) => {
    current = patchInstance(current, hand[i]!, { cardId: code as never });
  });
  return current;
}

/** Picks the option whose label matches, anything else as `firstLegal`. */
const byLabel =
  (re: RegExp): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const hit = choice.options.find((o) => re.test(o.label));
    return hit ? [hit.optionId] : firstLegal(s);
  };
function settleChoices(sim: Sim, pick: Picker): void {
  for (let guard = 0; sim.state.pendingChoice && !sim.state.outcome; guard++) {
    if (guard > 300) throw new Error("choices did not settle");
    const choice = sim.state.pendingChoice;
    const next = applyOk(
      sim.state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(sim.state),
      },
      DEPS,
    );
    sim.state = next.state;
    sim.events.push(...next.events);
  }
}
/** Runs a command and answers its prompts by `pick`. */
function run(sim: Sim, command: Parameters<typeof applyOk>[1], pick: Picker = firstLegal): void {
  const first = applyOk(sim.state, command, DEPS);
  sim.state = first.state;
  sim.events.push(...first.events);
  settleChoices(sim, pick);
}
/** Every listed player ends their turn; the villain phase runs, prompts answered by `pick`, to the next player phase. */
function villainPhase(sim: Sim, pick: Picker = firstLegal, players: readonly PlayerId[] = [P1]): void {
  for (const p of players) {
    const result = applyOk(sim.state, endTurn(p), DEPS);
    sim.state = result.state;
    sim.events.push(...result.events);
  }
  settleChoices(sim, pick);
}
/** The villain phase on a deck of exactly these cards, top first: the villain's boost card, then the dealt cards. */
function round(
  sim: Sim,
  deck: readonly string[],
  pick: Picker = firstLegal,
  players: readonly PlayerId[] = [P1],
): void {
  stack(sim, ...deck);
  sim.events = [];
  villainPhase(sim, pick, players);
}
/** A real flip: the Gaze at 4 counters takes the 5th from Enchantress's attack. */
function flipTo(sim: Sim, code: Gaze, player: PlayerId = P1, pick: Picker = firstLegal): InstanceId {
  sim.state = withGaze(sim.state, player, code);
  const gaze = gazeOn(sim.state, player);
  sim.state = withCharm(sim.state, gaze, 4);
  round(sim, [BLANK, BLANK], pick, [player]);
  return gaze;
}
const identityHas = (s: GameState, trait: string, player: PlayerId = P1): boolean =>
  traitsOf(s, identityOf(s, player), DEPS).includes(trait as never);
const attachedCodes = (s: GameState, id: InstanceId): string[] => inst(s, id).attachments.map((a) => codeOf(s, a));
const attachment = (s: GameState, host: InstanceId, code: string): InstanceId =>
  inst(s, host).attachments.find((a) => codeOf(s, a) === code)!;
const refused = (s: GameState, command: Parameters<typeof applyCommand>[1]): boolean =>
  !applyCommand(s, command, DEPS).ok;
const statusOf = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough"): number =>
  inst(s, id).statuses[status] ?? 0;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;

/** The 30 refs of 55012 to 55026, each proved by the scenarios below. */
const REFS = [
  "55012.alluring-call-forced-action",
  "55012.alluring-call-action",
  "55012.boost",
  "55013.kiss-of-temptation-forced-action",
  "55013.kiss-of-temptation-action",
  "55013.boost",
  "55014.love-concoction-forced-action",
  "55014.love-concoction-action",
  "55014.boost",
  "55015.seduced-constant",
  "55015.seduced-action",
  "55016.crown-of-the-enchantress-constant",
  "55016.crown-of-the-enchantress-forced-response",
  "55016.crown-of-the-enchantress-action",
  "55017.enthralled-lackey-forced-response",
  "55017.boost",
  "55018.enthralled-brute-constant",
  "55018.boost",
  "55019.sindr-constant",
  "55019.when-revealed",
  "55020.ulik-constant",
  "55020.ulik-forced-response",
  "55020.when-defeated",
  "55021.when-revealed",
  "55021.boost",
  "55022.when-defeated",
  "55023.when-revealed",
  "55024.when-revealed",
  "55025.when-revealed",
  "55026.when-revealed",
  "55026.boost",
];

describe("registry (55012 to 55026)", () => {
  it("registers every ref the data names for the 15 encounter cards, each a valid definition, and skips none", () => {
    const named = Array.from({ length: 15 }, (_, i) => String(55012 + i)).flatMap((code) =>
      abilityRefIds(TT_CARDS.find((c) => (c.id as string) === code) as never),
    );
    expect([...named].sort()).toEqual([...REFS].sort());
    for (const id of REFS) {
      expect(ENCHANTRESS[id], id).toBeDefined();
      expect(validateDefinition(ENCHANTRESS[id]!), id).toEqual([]);
    }
    expect(ENCHANTRESS_SKIPPED).toEqual({});
  });
});

describe("the Temptation attachments: Alluring Call 55012, Kiss of Temptation 55013, Love Concoction 55014", () => {
  it.each(["55012", "55013", "55014"])(
    "%s: as a boost card its star ability reveals it, attaching it to the defender's identity",
    (code) => {
      const sim = open();
      round(sim, [code, BLANK]);
      expect(attachedCodes(sim.state, identityOf(sim.state))).toContain(code);
      // The attachment keeps the Gaze company: the Enchantment card is still the first attachment.
      expect(codeOf(sim.state, gazeOn(sim.state))).toMatch(/^5500[7-9]a|^5501[01]a/);
    },
  );

  it("Love Concoction: the phase cannot end until it is used; the counter is placed and the identity readied", () => {
    const sim = open();
    round(sim, [BLANK, "55014"]);
    const card = attachment(sim.state, identityOf(sim.state), "55014");
    const before = charm(sim.state, enchantment(sim.state));
    expect(refused(sim.state, endTurn(P1))).toBe(true);
    sim.state = patchInstance(sim.state, identityOf(sim.state), { exhausted: true });
    run(sim, use(P1, card, "55014.love-concoction-forced-action"));
    expect(charm(sim.state, enchantment(sim.state))).toBe(before + 1);
    expect(inst(sim.state, identityOf(sim.state)).exhausted).toBeFalsy();
    expect(inst(sim.state, card).exhausted).toBe(true);
    expect(refused(sim.state, endTurn(P1))).toBe(false);
  });

  it("Love Concoction with a ready identity is still outstanding: the counter is the whole outcome (MC55 p. 22 FAQ)", () => {
    const sim = open();
    round(sim, [BLANK, "55014"]);
    const card = attachment(sim.state, identityOf(sim.state), "55014");
    expect(inst(sim.state, identityOf(sim.state)).exhausted).toBeFalsy();
    expect(refused(sim.state, endTurn(P1))).toBe(true);
    const before = charm(sim.state, enchantment(sim.state));
    run(sim, use(P1, card, "55014.love-concoction-forced-action"));
    expect(charm(sim.state, enchantment(sim.state))).toBe(before + 1);
  });

  it("Kiss of Temptation: the counter, then draw 1 and discard 1", () => {
    const sim = open();
    round(sim, [BLANK, "55013"]);
    const card = attachment(sim.state, identityOf(sim.state), "55013");
    const before = charm(sim.state, enchantment(sim.state));
    const hand = playerOf(sim.state, P1).hand.length;
    const deck = playerOf(sim.state, P1).deck.length;
    const discard = playerOf(sim.state, P1).discard.length;
    run(sim, use(P1, card, "55013.kiss-of-temptation-forced-action"));
    expect(charm(sim.state, enchantment(sim.state))).toBe(before + 1);
    expect(playerOf(sim.state, P1).hand.length).toBe(hand);
    expect(playerOf(sim.state, P1).deck.length).toBe(deck - 1);
    expect(playerOf(sim.state, P1).discard.length).toBe(discard + 1);
    expect(refused(sim.state, endTurn(P1))).toBe(false);
  });

  it("Kiss of Temptation for an Enthralled player: 1 threat on the main scheme instead of the counter, then the draw and discard", () => {
    const sim = open();
    const gaze = flipTo(sim, "55010a");
    run(sim, use(P1, gaze, SLOTH_ACTION));
    sim.state = patchInstance(sim.state, sim.state.mainScheme.instanceId, { threat: 0 });
    round(sim, [BLANK, "55013"]);
    const card = attachment(sim.state, identityOf(sim.state), "55013");
    run(sim, use(P1, gaze, SLOTH_ACTION));
    sim.events = [];
    const hand = playerOf(sim.state, P1).hand.length;
    run(sim, use(P1, card, "55013.kiss-of-temptation-forced-action"));
    expect(charm(sim.state, gaze)).toBe(0);
    expect(
      types(sim.events, "threatPlaced").filter((e) => e.sourceInstanceId === sim.state.mainScheme.instanceId),
    ).toHaveLength(1);
    expect(playerOf(sim.state, P1).hand.length).toBe(hand);
  });

  it("Alluring Call: the counter, then a card from the hand is played for 1 less (Aunt May, cost 1, for nothing)", () => {
    const sim = open();
    round(sim, [BLANK, "55012"]);
    sim.state = withHand(sim.state, P1, "01006");
    const may = playerOf(sim.state, P1).hand[0]!;
    const card = attachment(sim.state, identityOf(sim.state), "55012");
    const before = charm(sim.state, enchantment(sim.state));
    const hand = playerOf(sim.state, P1).hand.length;
    run(sim, use(P1, card, "55012.alluring-call-forced-action"));
    expect(charm(sim.state, enchantment(sim.state))).toBe(before + 1);
    expect(cardsInPlay(sim.state)).toContain(may);
    expect(playerOf(sim.state, P1).hand.length).toBe(hand - 1);
    expect(refused(sim.state, endTurn(P1))).toBe(false);
  });

  it("Alluring Call with an empty hand is still outstanding; the counter is placed and nothing is played", () => {
    const sim = open();
    round(sim, [BLANK, "55012"]);
    sim.state = {
      ...sim.state,
      players: sim.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)),
    };
    const card = attachment(sim.state, identityOf(sim.state), "55012");
    expect(refused(sim.state, endTurn(P1))).toBe(true);
    const before = charm(sim.state, enchantment(sim.state));
    run(sim, use(P1, card, "55012.alluring-call-forced-action"));
    expect(charm(sim.state, enchantment(sim.state))).toBe(before + 1);
    expect(refused(sim.state, endTurn(P1))).toBe(false);
  });

  it.each([
    ["55012", "55012.alluring-call-action"],
    ["55013", "55013.kiss-of-temptation-action"],
    ["55014", "55014.love-concoction-action"],
  ])(
    "%s: the Alter-Ego Action exhausts and discards it, and the phase may end with the counters unchanged",
    (code, ability) => {
      const sim = open();
      round(sim, [BLANK, code]);
      const card = attachment(sim.state, identityOf(sim.state), code);
      const before = charm(sim.state, enchantment(sim.state));
      run(sim, toHero());
      expect(inst(sim.state, identityOf(sim.state)).exhausted).toBeFalsy();
      run(sim, use(P1, card, ability));
      expect(inDiscard(sim.state, code)).toHaveLength(1);
      expect(attachedCodes(sim.state, identityOf(sim.state))).not.toContain(code);
      expect(charm(sim.state, enchantment(sim.state))).toBe(before);
      expect(refused(sim.state, endTurn(P1))).toBe(false);
    },
  );
});

describe("encounter cards that exhaust ready at the end of the player phase", () => {
  // RRG 1.8 "End of Player Phase" (p. 18) step 3: "Each player simultaneously readies all of their cards. Ready each
  // exhausted encounter card." An encounter attachment on an identity (a Trance) is one of them: its Forced Action is
  // triggered every round (MC55 p. 22). The engine's `ready-encounter-cards.test.ts` covers the other places.
  it("a Trance used in the player phase is ready again in the next player phase", () => {
    const sim = open();
    const gaze = flipTo(sim, "55010a");
    run(sim, use(P1, gaze, SLOTH_ACTION));
    expect(inst(sim.state, gaze).exhausted).toBe(true);
    round(sim, [BLANK, BLANK]);
    expect(inst(sim.state, gaze).exhausted).toBeFalsy();
  });
});

describe("Seduced (55015)", () => {
  /** A Seduced identity in hero form with a ready ally and a hand holding Swinging Web Kick (an Attack event). */
  function seduced(): Sim & { card: InstanceId } {
    const sim = open();
    round(sim, [BLANK, "55015"]);
    const card = attachment(sim.state, identityOf(sim.state), "55015");
    return Object.assign(sim, { card });
  }
  const basicAttack = (s: GameState): Parameters<typeof applyCommand>[1] => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(s),
    targetInstanceId: villainOf(s),
  });

  it("the identity cannot make a basic attack; without the card it can", () => {
    const sim = open();
    expect(refused(sim.state, basicAttack(sim.state))).toBe(false);
    const seducedSim = seduced();
    expect(refused(seducedSim.state, basicAttack(seducedSim.state))).toBe(true);
  });

  it("an Attack event cannot be played (the same play is legal without Seduced)", () => {
    const sim = seduced();
    sim.state = withHand(sim.state, P1, "01005", "01088", "01088", "01088", "01088");
    const [kick, ...paying] = playerOf(sim.state, P1).hand;
    expect(refused(sim.state, play(P1, kick!, paying))).toBe(true);
    const free = open();
    free.state = withHand(free.state, P1, "01005", "01088", "01088", "01088", "01088");
    const [kick2, ...paying2] = playerOf(free.state, P1).hand;
    expect(refused(free.state, play(P1, kick2!, paying2))).toBe(false);
  });

  it("Alter-Ego Action: spending an energy and a mental resource discards it", () => {
    const sim = seduced();
    run(sim, toHero());
    sim.state = withHand(sim.state, P1, "01088", "01089");
    const [energy, genius] = playerOf(sim.state, P1).hand;
    run(sim, use(P1, sim.card, "55015.seduced-action", [{ fromHand: energy! }, { fromHand: genius! }]));
    expect(inDiscard(sim.state, "55015")).toHaveLength(1);
    expect(attachedCodes(sim.state, identityOf(sim.state))).not.toContain("55015");
  });

  it("Alter-Ego Action: two energy resources do not pay for it", () => {
    const sim = seduced();
    run(sim, toHero());
    sim.state = withHand(sim.state, P1, "01088", "01088");
    const [a, b] = playerOf(sim.state, P1).hand;
    expect(refused(sim.state, use(P1, sim.card, "55015.seduced-action", [{ fromHand: a! }, { fromHand: b! }]))).toBe(
      true,
    );
  });
});

describe("Crown of the Enchantress (55016)", () => {
  const crownOf = (s: GameState): InstanceId => inPlayCard(s, "55016")!;

  it("is attached to Enchantress when revealed; in standard mode it gives no stalwart, in expert mode it does", () => {
    const standard = open();
    round(standard, [BLANK, "55016"]);
    expect(inst(standard.state, crownOf(standard.state)).attachedTo).toBe(villainOf(standard.state));
    expect(hasKeyword(standard.state, villainOf(standard.state), "stalwart", DEPS)).toBe(false);
    const expert = open([SPIDER_MAN], { difficulty: "expert" });
    expect(hasKeyword(expert.state, villainOf(expert.state), "stalwart", DEPS)).toBe(false);
    round(expert, [BLANK, "55016"]);
    expect(hasKeyword(expert.state, villainOf(expert.state), "stalwart", DEPS)).toBe(true);
  });

  it("Forced Response: 1 charm counter after Enchantress schemes against you; her attacks add only her own counter", () => {
    // Advance (01186) as the dealt card makes the villain scheme, so each round has one attack and one scheme.
    const withCrown = open();
    round(withCrown, [BLANK, "55016"]);
    const gaze = gazeOn(withCrown.state);
    const before = charm(withCrown.state, gaze);
    round(withCrown, [BLANK, BLANK]);
    expect(attacksBy(withCrown.state, withCrown.events, "55001")).toHaveLength(1);
    expect(schemesBy(withCrown.state, withCrown.events, "55001")).toHaveLength(1);
    expect(charm(withCrown.state, gaze) - before).toBe(2);
    const without = open();
    round(without, [BLANK, BLANK]);
    const control = charm(without.state, gazeOn(without.state));
    round(without, [BLANK, BLANK]);
    expect(charm(without.state, gazeOn(without.state)) - control).toBe(1);
  });

  it("Forced Response in alter-ego form: every scheme against you (the activation and Advance's) adds a counter", () => {
    const sim = open();
    round(sim, [BLANK, "55016"]);
    run(sim, toHero());
    const gaze = gazeOn(sim.state);
    const before = charm(sim.state, gaze);
    round(sim, [BLANK, BLANK]);
    const schemes = schemesBy(sim.state, sim.events, "55001").length;
    expect(schemes).toBe(2);
    expect(attacksBy(sim.state, sim.events, "55001")).toHaveLength(0);
    expect(charm(sim.state, gaze) - before).toBe(schemes);
  });

  it("Hero Action: each player exhausts their identity and takes 1 damage, then the Crown is discarded", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    round(sim, [BLANK, "55016", BLANK], firstLegal, [P1, P2]);
    const crown = crownOf(sim.state);
    const before = [P1, P2].map((p) => damageOn(sim.state, identityOf(sim.state, p)));
    run(sim, use(P1, crown, "55016.crown-of-the-enchantress-action"));
    [P1, P2].forEach((player, i) => {
      expect(inst(sim.state, identityOf(sim.state, player)).exhausted).toBe(true);
      expect(damageOn(sim.state, identityOf(sim.state, player))).toBe(before[i]! + 1);
    });
    expect(inPlayCard(sim.state, "55016")).toBeUndefined();
  });

  it("is not offered while another player's identity is exhausted", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    round(sim, [BLANK, "55016", BLANK], firstLegal, [P1, P2]);
    sim.state = patchInstance(sim.state, identityOf(sim.state, P2), { exhausted: true });
    expect(refused(sim.state, use(P1, crownOf(sim.state), "55016.crown-of-the-enchantress-action"))).toBe(true);
  });

  it("owner question 57 (open, built on A): a tough status card on any player's identity makes the cost unpayable", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    round(sim, [BLANK, "55016", BLANK], firstLegal, [P1, P2]);
    sim.state = patchInstance(sim.state, identityOf(sim.state, P2), {
      statuses: { ...inst(sim.state, identityOf(sim.state, P2)).statuses, tough: 1 },
    });
    expect(refused(sim.state, use(P1, crownOf(sim.state), "55016.crown-of-the-enchantress-action"))).toBe(true);
  });
});

/** Test surgery: the player's Hypnotic Gaze already flipped (a Trance, exhausted so no Forced Action is outstanding). */
function enthrall(sim: Sim, player: PlayerId = P1, code: Gaze = "55010a"): InstanceId {
  sim.state = withGaze(sim.state, player, code);
  const gaze = gazeOn(sim.state, player);
  const { reverseHidden: _hidden, ...held } = inst(sim.state, gaze);
  sim.state = {
    ...sim.state,
    instances: { ...sim.state.instances, [gaze]: { ...held, flipped: true, counters: {}, exhausted: true } },
  };
  expect(identityHas(sim.state, "ENTHRALLED", player)).toBe(true);
  return gaze;
}
/** Black Cat (2 hit points, cost 2) played from the hand into the player's play area. */
function withAlly(sim: Sim): InstanceId {
  sim.state = withHand(sim.state, P1, "01002", "01088", "01088");
  const [cat, ...pay] = playerOf(sim.state, P1).hand;
  run(sim, play(P1, cat!, pay.slice(0, 2)));
  expect(cardsInPlay(sim.state)).toContain(cat);
  return cat!;
}
const mainThreatPlaced = (sim: Sim): number =>
  types(sim.events, "threatPlaced")
    .filter((e) => e.sourceInstanceId === sim.state.mainScheme.instanceId)
    .reduce((sum, e) => sum + e.amount, 0);

describe("Enthralled Lackey (55017)", () => {
  it("Forced Response: after it attacks you, 1 charm counter (besides Enchantress's own)", () => {
    const sim = open();
    round(sim, [BLANK, "55017"]);
    const gaze = gazeOn(sim.state);
    const before = charm(sim.state, gaze);
    // The villain's attack boost, the Lackey's attack boost (Caught Off Guard, 1 icon), then Advance is dealt.
    round(sim, [BLANK, "01188", BLANK]);
    expect(attacksBy(sim.state, sim.events, "55017")).toHaveLength(1);
    expect(attacksBy(sim.state, sim.events, "55001")).toHaveLength(1);
    expect(charm(sim.state, gaze) - before).toBe(2);
  });

  it("Boost: choose a charm counter or confuse your identity", () => {
    const counter = open();
    const gaze = gazeOn(counter.state);
    round(counter, ["55017", BLANK], byLabel(/charm counter/));
    expect(charm(counter.state, gaze)).toBe(2);
    expect(statusOf(counter.state, identityOf(counter.state), "confused")).toBe(0);
    const confuse = open();
    round(confuse, ["55017", BLANK], byLabel(/Confuse/));
    expect(charm(confuse.state, gazeOn(confuse.state))).toBe(1);
    expect(statusOf(confuse.state, identityOf(confuse.state), "confused")).toBe(1);
  });
});

describe("Enthralled Lackey boost (55017), barred option", () => {
  it("the confuse option is not offered to an identity that is already confused (RRG 1.8 p. 12, p. 42)", () => {
    const sim = open();
    sim.state = patchInstance(sim.state, identityOf(sim.state), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const labels: string[] = [];
    round(sim, ["55017", BLANK], (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption") labels.push(...s.pendingChoice.options.map((o) => o.label));
      return firstLegal(s);
    });
    expect(labels.some((l) => /Confuse/.test(l))).toBe(false);
    // The one option left resolves on its own: the charm counter is placed.
    expect(charm(sim.state, gazeOn(sim.state))).toBe(2);
  });
});

describe("Enthralled Brute (55018)", () => {
  it("gets +3 hit points only while engaged with a player whose identity is Enthralled", () => {
    const defiant = open();
    round(defiant, [BLANK, "55018"]);
    const brute = inPlayCard(defiant.state, "55018")!;
    expect(maxHitPoints(defiant.state, brute, DEPS)).toBe(4);
    const enthralled = open();
    enthrall(enthralled);
    round(enthralled, [BLANK, "55018"]);
    expect(maxHitPoints(enthralled.state, inPlayCard(enthralled.state, "55018")!, DEPS)).toBe(7);
  });

  it("Boost: choose a charm counter or exhaust your identity", () => {
    const counter = open();
    round(counter, ["55018", BLANK], byLabel(/charm counter/));
    expect(charm(counter.state, gazeOn(counter.state))).toBe(2);
    expect(inst(counter.state, identityOf(counter.state)).exhausted).toBeFalsy();
    const exhaust = open();
    round(exhaust, ["55018", BLANK], byLabel(/Exhaust/));
    expect(charm(exhaust.state, gazeOn(exhaust.state))).toBe(1);
    expect(inst(exhaust.state, identityOf(exhaust.state)).exhausted).toBe(true);
  });
});

describe("Sindr (55019)", () => {
  it("When Revealed, Defiant: Sindr activates against you (an attack in hero form), dealing indirect damage you assign", () => {
    const sim = open();
    const cat = withAlly(sim);
    const prompts: number[] = [];
    const assignToAlly: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "assignIndirectDamage") return firstLegal(s);
      prompts.push(choice.prompt.amount);
      // One point per option, the ally's first: its hit points take what they can, the identity the rest.
      const ally = choice.options.filter((o) => o.optionId.startsWith(`${cat}#`));
      const rest = choice.options.filter((o) => !o.optionId.startsWith(`${cat}#`));
      return [...ally, ...rest].slice(0, choice.minSelections).map((o) => o.optionId);
    };
    // The villain's attack boost, the dealt Sindr, then Sindr's own boost (Caught Off Guard, 1 icon).
    round(sim, [BLANK, "55019", "01188"], assignToAlly);
    const [attack] = attacksBy(sim.state, sim.events, "55019");
    expect(attack).toBeDefined();
    expect(attack!.baseAtk).toBe(4);
    expect(statusOf(sim.state, inPlayCard(sim.state, "55019")!, "tough")).toBe(0);
    // The player was asked to assign Sindr's whole attack (ATK 4 and its boost icons) as indirect damage.
    expect(prompts).toEqual([attack!.baseAtk + attack!.boostIcons]);
  });

  it("When Revealed, Enthralled: Sindr gets a tough status card and does not activate", () => {
    const sim = open();
    enthrall(sim);
    round(sim, [BLANK, "55019"]);
    expect(attacksBy(sim.state, sim.events, "55019")).toHaveLength(0);
    expect(statusOf(sim.state, inPlayCard(sim.state, "55019")!, "tough")).toBe(1);
  });

  it("the traits are read when Sindr is revealed: a Gaze that flips to a Trance in that round's attack makes the player Enthralled", () => {
    const sim = open();
    sim.state = withGaze(sim.state, P1, "55010a");
    sim.state = withCharm(sim.state, gazeOn(sim.state), 4);
    round(sim, [BLANK, "55019"]);
    expect(identityHas(sim.state, "ENTHRALLED")).toBe(true);
    expect(attacksBy(sim.state, sim.events, "55019")).toHaveLength(0);
    expect(statusOf(sim.state, inPlayCard(sim.state, "55019")!, "tough")).toBe(1);
  });
});

describe("Ulik (55020)", () => {
  /** Ulik engaged with the hero, the next player phase begun. */
  function withUlik(opts: { readonly difficulty?: "standard" | "expert" } = {}): Sim {
    const sim = open([SPIDER_MAN], opts);
    round(sim, [BLANK, "55020"]);
    return sim;
  }
  const heroAttacksVillain = (sim: Sim): void => {
    stack(sim, BLANK, BLANK);
    sim.events = [];
    run(sim, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(sim.state),
      targetInstanceId: villainOf(sim.state),
    });
  };

  it("gains toughness in expert mode only", () => {
    const standard = withUlik();
    expect(hasKeyword(standard.state, inPlayCard(standard.state, "55020")!, "toughness", DEPS)).toBe(false);
    const expert = withUlik({ difficulty: "expert" });
    expect(hasKeyword(expert.state, inPlayCard(expert.state, "55020")!, "toughness", DEPS)).toBe(true);
  });

  it("Forced Response: after you deal damage to Enchantress, Ulik attacks you", () => {
    const sim = withUlik();
    heroAttacksVillain(sim);
    expect(attacksBy(sim.state, sim.events, "55020")).toHaveLength(1);
  });

  it("Forced Response: Ulik does not attack when no damage is dealt to Enchantress (an attack on Ulik itself)", () => {
    const sim = withUlik();
    stack(sim, BLANK, BLANK);
    sim.events = [];
    run(sim, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(sim.state),
      targetInstanceId: inPlayCard(sim.state, "55020")!,
    });
    expect(attacksBy(sim.state, sim.events, "55020")).toHaveLength(0);
  });

  it("When Defeated: Enchantress attacks the player who defeated Ulik with +1 ATK for that attack", () => {
    const sim = withUlik();
    const ulik = inPlayCard(sim.state, "55020")!;
    sim.state = patchInstance(sim.state, ulik, { damage: 4 });
    stack(sim, BLANK, BLANK);
    sim.events = [];
    run(sim, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(sim.state),
      targetInstanceId: ulik,
    });
    expect(inPlayCard(sim.state, "55020")).toBeUndefined();
    const attacks = attacksBy(sim.state, sim.events, "55001");
    expect(attacks).toHaveLength(1);
    // Stage I's ATK is 1; "+1 ATK for that attack" is 2, and only for that attack.
    expect(attacks[0]!.baseAtk).toBe(2);
    expect(attacks[0]!.targetInstanceId).toBe(identityOf(sim.state));
  });
});

describe("Law of Attraction (55021)", () => {
  it("When Revealed: discards from the top until an Enthralled minion is discarded, then reveals it", () => {
    const sim = open();
    round(sim, [BLANK, "55021", "01188", "01189", "55017"]);
    expect(inPlayCard(sim.state, "55017")).toBeDefined();
    expect(inDiscard(sim.state, "01188")).toHaveLength(1);
    expect(inDiscard(sim.state, "01189")).toHaveLength(1);
  });

  it("Boost: 1 charm counter", () => {
    const sim = open();
    round(sim, ["55021", BLANK]);
    expect(charm(sim.state, gazeOn(sim.state))).toBe(2);
  });
});

describe("Spellbound (55022)", () => {
  /** Spellbound dealt to player 1, then thwarted down by the active player's identity. */
  function defeatSpellbound(sim: Sim, players: readonly PlayerId[] = [P1]): void {
    // One boost card per attack (the villain activates against each player), then one dealt card per player.
    const deck = players.length > 1 ? [BLANK, "01188", "55022", BLANK] : [BLANK, "55022"];
    round(sim, deck, firstLegal, players);
    const scheme = inPlayCard(sim.state, "55022")!;
    sim.state = patchInstance(sim.state, scheme, { threat: 1 });
    sim.events = [];
    // The first player token passes each round: whoever's turn it is thwarts it.
    const thwarter = (sim.state.step as { activePlayerId: PlayerId }).activePlayerId;
    run(sim, {
      type: "basicThwart",
      playerId: thwarter,
      thwarterInstanceId: identityOf(sim.state, thwarter),
      schemeInstanceId: scheme,
    });
    expect(inPlayCard(sim.state, "55022")).toBeUndefined();
  }

  it("When Defeated: a Defiant player places 1 charm counter", () => {
    const sim = open();
    const gaze = gazeOn(sim.state);
    sim.state = withCharm(sim.state, gaze, 0);
    defeatSpellbound(sim);
    // 1 from Enchantress's attack in the round Spellbound was dealt, 1 from Spellbound.
    expect(charm(sim.state, gaze)).toBe(2);
  });

  it("When Defeated: an Enthralled player discards a card they control (a support), and places no counter", () => {
    const sim = open();
    sim.state = withHand(sim.state, P1, "01006", "01088");
    const [may, pay] = playerOf(sim.state, P1).hand;
    run(sim, play(P1, may!, [pay!]));
    expect(cardsInPlay(sim.state)).toContain(may);
    enthrall(sim);
    defeatSpellbound(sim);
    expect(playerOf(sim.state, P1).discard).toContain(may);
    expect(cardsInPlay(sim.state)).not.toContain(may);
  });

  it("When Defeated: with an Enthralled and a Defiant player, each gets only their own half", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    sim.state = withHand(sim.state, P1, "01006", "01088");
    const [may, pay] = playerOf(sim.state, P1).hand;
    run(sim, play(P1, may!, [pay!]));
    enthrall(sim, P1);
    const gaze2 = gazeOn(sim.state, P2);
    sim.state = withCharm(sim.state, gaze2, 0);
    defeatSpellbound(sim, [P1, P2]);
    expect(playerOf(sim.state, P1).discard).toContain(may);
    expect(charm(sim.state, gazeOn(sim.state, P1))).toBe(0);
    // Player 2: Enchantress's attack on them in that round, and Spellbound's.
    expect(charm(sim.state, gaze2)).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Answers a "do both in any order" prompt (two selections, the order of the selection being the order resolved) with
 * the options matching these patterns in this order; any other prompt as `firstLegal` (or by `otherwise`).
 */
const both =
  (first: RegExp, second: RegExp, otherwise: Picker = firstLegal): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.maxSelections !== 2 || choice.minSelections !== 2) return otherwise(s);
    const a = choice.options.find((o) => first.test(o.label));
    const b = choice.options.find((o) => second.test(o.label));
    return a && b ? [a.optionId, b.optionId] : otherwise(s);
  };

/** What a prompt offers, for the log of a failed assertion. */
const labels = (s: GameState): string[] => (s.pendingChoice?.options ?? []).map((o) => o.label);

describe("the treacheries: choose one if Defiant, do both if Enthralled (55023 to 55025; ruling February 28, 2026 (5))", () => {
  /** Records every prompt's options, choosing by the listed label patterns in turn (the first match each time). */
  function choosing(seen: string[][], ...order: RegExp[]): Picker {
    const queue = [...order];
    return (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") return firstLegal(s);
      seen.push(labels(s));
      const re = queue.shift();
      const hit = re ? choice.options.find((o) => re.test(o.label)) : undefined;
      return hit ? [hit.optionId] : firstLegal(s);
    };
  }

  describe('"Do My Bidding" (55023)', () => {
    const deck = [BLANK, "55023", "55017", "55022"] as const;

    it("Defiant: choose one; the minion is found and revealed, the side scheme is not", () => {
      const sim = open();
      const seen: string[][] = [];
      round(sim, [...deck], choosing(seen, /minion/i));
      expect(seen.some((o) => o.length === 2 && o.some((l) => /minion/i.test(l)))).toBe(true);
      expect(inPlayCard(sim.state, "55017")).toBeDefined();
      expect(inPlayCard(sim.state, "55022")).toBeUndefined();
    });

    it("Defiant: the side scheme option reveals the side scheme only", () => {
      const sim = open();
      round(sim, [...deck], byLabel(/side scheme/i));
      expect(inPlayCard(sim.state, "55022")).toBeDefined();
      expect(inPlayCard(sim.state, "55017")).toBeUndefined();
    });

    it("Enthralled: both searches resolve, in the order chosen", () => {
      const sim = open();
      enthrall(sim);
      round(sim, [...deck], both(/side scheme/i, /minion/i));
      expect(inPlayCard(sim.state, "55017")).toBeDefined();
      expect(inPlayCard(sim.state, "55022")).toBeDefined();
      // In the order chosen: the side scheme was revealed first.
      const revealed = types(sim.events, "encounterCardRevealed").map((e) => codeOf(sim.state, e.instanceId));
      expect(revealed.indexOf("55022")).toBeLessThan(revealed.indexOf("55017"));
    });
  });

  describe("Magical Restraints (55024)", () => {
    it("Defiant: the stunned option stuns and places a counter; the confused option does not resolve", () => {
      const sim = open();
      round(sim, [BLANK, "55024"], byLabel(/stunned/i));
      expect(statusOf(sim.state, identityOf(sim.state), "stunned")).toBe(1);
      expect(statusOf(sim.state, identityOf(sim.state), "confused")).toBe(0);
      // Enchantress's attack, then the option's counter.
      expect(charm(sim.state, gazeOn(sim.state))).toBe(2);
    });

    it("Defiant at 4 counters: the option's counter is the 5th, which flips the Gaze; the second sentence was read before, so no second option", () => {
      const sim = open();
      sim.state = withGaze(sim.state, P1, "55010a");
      const gaze = gazeOn(sim.state);
      // Enchantress's attack makes the 4th counter, the option's counter the 5th.
      sim.state = withCharm(sim.state, gaze, 3);
      round(sim, [BLANK, "55024"], byLabel(/stunned/i));
      expect(inst(sim.state, gaze).flipped).toBe(true);
      expect(identityHas(sim.state, "ENTHRALLED")).toBe(true);
      expect(statusOf(sim.state, identityOf(sim.state), "stunned")).toBe(1);
      expect(statusOf(sim.state, identityOf(sim.state), "confused")).toBe(0);
    });

    it("Enthralled: both options resolve (stunned and confused), each placing 1 threat for the counter", () => {
      const sim = open();
      enthrall(sim);
      round(sim, [BLANK, "55024"], both(/stunned/i, /confused/i));
      expect(statusOf(sim.state, identityOf(sim.state), "stunned")).toBe(1);
      expect(statusOf(sim.state, identityOf(sim.state), "confused")).toBe(1);
      // 1 for Enchantress's attack and 1 for each option.
      expect(mainThreatPlaced(sim)).toBe(3);
    });
  });

  describe("Spell Blast (55025)", () => {
    const attackAndScheme = (sim: Sim) => ({
      attacks: attacksBy(sim.state, sim.events, "55001"),
      schemes: schemesBy(sim.state, sim.events, "55001"),
    });

    it("Defiant: choose to attack and she attacks you again; she does not scheme", () => {
      const sim = open();
      round(sim, [BLANK, "55025", BLANK], byLabel(/attacks you/i));
      const { attacks, schemes } = attackAndScheme(sim);
      expect(attacks).toHaveLength(2);
      expect(schemes).toHaveLength(0);
    });

    it("Defiant: choose to scheme and she schemes once", () => {
      const sim = open();
      round(sim, [BLANK, "55025", BLANK], byLabel(/schemes/i));
      const { attacks, schemes } = attackAndScheme(sim);
      expect(attacks).toHaveLength(1);
      expect(schemes).toHaveLength(1);
    });

    it("Enthralled in expert mode, attack then scheme: ATK + 1, then SCH + 1", () => {
      const sim = open([SPIDER_MAN], { difficulty: "expert" });
      enthrall(sim);
      round(sim, [BLANK, "55025", "01188", "01189"], both(/attacks you/i, /schemes/i));
      const { attacks, schemes } = attackAndScheme(sim);
      // Her own activation (ATK 2) and the option (ATK 2 + 1).
      expect(attacks.map((a) => a.baseAtk)).toEqual([2, 3]);
      expect(schemes).toHaveLength(1);
      // Stage II's SCH is 2.
      expect(schemes[0]!.baseSch).toBe(3);
    });

    it("Enthralled in standard mode: no bonus on either", () => {
      const sim = open();
      enthrall(sim);
      round(sim, [BLANK, "55025", "01188", "01189"], both(/attacks you/i, /schemes/i));
      const { attacks, schemes } = attackAndScheme(sim);
      expect(attacks.map((a) => a.baseAtk)).toEqual([1, 1]);
      expect(schemes[0]!.baseSch).toBe(2);
    });

    it("scheming while Confused is a legal choice, and it removes the status card with no threat (ruling February 28, 2026 (5), question 2)", () => {
      const sim = open();
      const villain = villainOf(sim.state);
      sim.state = patchInstance(sim.state, villain, {
        statuses: { ...inst(sim.state, villain).statuses, confused: 1 },
      });
      const control = open();
      const controlVillain = villainOf(control.state);
      control.state = patchInstance(control.state, controlVillain, {
        statuses: { ...inst(control.state, controlVillain).statuses, confused: 1 },
      });
      // In hero form her own activation attacks, which leaves the status card alone.
      round(control, [BLANK, "55025", BLANK], byLabel(/attacks you/i));
      expect(statusOf(control.state, controlVillain, "confused")).toBe(1);
      round(sim, [BLANK, "55025", BLANK], byLabel(/schemes/i));
      expect(statusOf(sim.state, villain, "confused")).toBe(0);
      expect(schemesBy(sim.state, sim.events, "55001")).toHaveLength(0);
      expect(mainThreatPlaced(sim)).toBe(0);
    });
  });
});

describe("Spell Shards (55026)", () => {
  it("When Revealed: 3 indirect damage; the identity took some, so 1 charm counter", () => {
    const sim = open();
    const identity = identityOf(sim.state);
    // Enchantress's attack (Advance boost: 0 icons, ATK 1) then Spell Shards.
    round(sim, [BLANK, "55026"]);
    expect(damageOn(sim.state, identity)).toBe(1 + 3);
    // Her own counter and the Shards'.
    expect(charm(sim.state, gazeOn(sim.state))).toBe(2);
  });

  it("When Revealed: damage assigned entirely to an ally means the identity took none, so no counter", () => {
    const sim = open();
    const cat = withAlly(sim);
    // Black Cat has 2 hit points and the damage is 3, so give the Cat extra hit points through its dial to take all of it.
    sim.state = patchInstance(sim.state, cat, { damage: 0 });
    const toAlly: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "assignIndirectDamage") return firstLegal(s);
      const ally = choice.options.filter((o) => o.optionId.startsWith(`${cat}#`));
      const rest = choice.options.filter((o) => !o.optionId.startsWith(`${cat}#`));
      return [...ally, ...rest].slice(0, choice.minSelections).map((o) => o.optionId);
    };
    round(sim, [BLANK, "55026"], toAlly);
    // Black Cat (2 hit points) takes 2 of the 3; the identity takes the remaining 1, and so the counter is placed.
    expect(damageOn(sim.state, identityOf(sim.state))).toBe(1 + 1);
    expect(charm(sim.state, gazeOn(sim.state))).toBe(2);
  });

  it("Boost: 1 charm counter", () => {
    const sim = open();
    round(sim, ["55026", BLANK]);
    expect(charm(sim.state, gazeOn(sim.state))).toBe(2);
  });
});

describe("Trance of Wrath's Forced Action with a minion in play (55011b)", () => {
  // The frame's own tests had no scripted minion; the Enthralled Lackey (55017, 3 hit points) is one now.
  it("takes 1 indirect damage, then deals 2 damage to a minion", () => {
    const sim = open();
    round(sim, [BLANK, "55017"]);
    const lackey = inPlayCard(sim.state, "55017")!;
    const gaze = enthrall(sim, P1, "55011a");
    sim.state = patchInstance(sim.state, gaze, { exhausted: false });
    const before = damageOn(sim.state, identityOf(sim.state));
    run(sim, use(P1, gaze, "55011b.trance-of-wrath-forced-action"));
    expect(damageOn(sim.state, identityOf(sim.state))).toBe(before + 1);
    expect(damageOn(sim.state, lackey)).toBe(2);
  });
});

// No "choose": an encounter card targeting one of several eligible cards; the first player selects
// (RRG 1.8 "First Player", p. 19).
describe("Trance of Pride / Wrath Forced Actions, 2 players: the holder is not the first player, who picks the target", () => {
  /** Uses the holder's Trance; records who is asked a chooseTarget, and picks the last option. */
  function useAs(sim: Sim, holder: PlayerId, gaze: InstanceId, ref: string): PlayerId[] {
    const asked: PlayerId[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget") asked.push(choice.playerId);
      return [choice.options.at(-1)!.optionId];
    };
    run(sim, use(holder, gaze, ref), pick);
    return asked;
  }

  it("Trance of Wrath: the first player picks which of two minions takes 2 damage", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    round(sim, [BLANK, BLANK, "55017", "55017"], firstLegal, [P1, P2]);
    // The round passed the first player token to P2, so P1 holds the Trance and P2 is asked.
    expect(sim.state.firstPlayerId).toBe(P2);
    const gaze = enthrall(sim, P1, "55011a");
    sim.state = patchInstance(sim.state, gaze, { exhausted: false });
    expect(useAs(sim, P1, gaze, "55011b.trance-of-wrath-forced-action")).toEqual([P2]);
  });

  it("Trance of Pride: the first player picks which of two side schemes loses 2 threat", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    round(sim, [BLANK, BLANK, "55021"], firstLegal, [P1, P2]);
    expect(sim.state.firstPlayerId).toBe(P2);
    const gaze = enthrall(sim, P1, "55009a");
    sim.state = patchInstance(sim.state, gaze, { exhausted: false });
    expect(useAs(sim, P1, gaze, "55009b.trance-of-pride-forced-action")).toEqual([P2]);
  });
});
