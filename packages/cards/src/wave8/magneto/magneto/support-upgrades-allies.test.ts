import { abilityId, cardId, CORE_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  createGame,
  keywordsOf,
  statBonus,
  traitsOf,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import {
  dealDamage,
  defineAbilities,
  forcedResponse,
  mergeRegistries,
  on,
  varOf,
  yourIdentity,
} from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { MAGNETIC_PULL_MOMENT, MAGNETIC_PULL_USED_MOMENT, MAGNETO_IDENTITY } from "./identity.js";
import { MAGNETO_SUPPORT_UPGRADES_ALLIES, MAGNETO_SUPPORT_UPGRADES_ALLIES_SKIPPED } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magneto's supports and upgrades (49002 to 49007, 49011), docs/phase7-wave8.md section 7.5, 3.71, 3.76, 3.81. His real
 * starter deck (`magneto-leadership`) against Rhino (Core, standard); the deck is stacked by surgery. Printed icons of
 * the cards used in the discards: Squared Off 49017 physical, Noble Sacrifice 49018 mental, Metal Shards 49009 MAGNETIC
 * physical, Magnetic Bubble 49006 MAGNETIC energy, Asteroid M 49002 MAGNETIC wild. Old Grievances (49027) is another
 * module's card: a fixture support (99002) stands in for it (forced response on the "used" moment dealing one damage
 * per card the Pull discarded) and a second one (99003) for a source of damage.
 */
const REF = {
  asteroid: "49002.asteroid-m-action",
  helmet: "49003.magnetos-helmet-constant",
  helmetResource: "49003.magnetos-helmet-resource",
  armor: "49004.magnetos-armor-response",
  cape: "49005.magnetos-cape-constant",
  capeResponse: "49005.magnetos-cape-response",
  bubble: "49006.magnetic-bubble-constant",
  bubbleInterrupt: "49006.magnetic-bubble-forced-interrupt",
  wrapped: "49007.wrapped-in-metal-constant",
} as const;
const PULL = "49001a.magnetic-pull";
const USED_ANSWER = "99002.used-answer";
const LISTENER = "99002";

const SQUARED_OFF = "49017";
const NOBLE = "49018";
const SHARDS = "49009";
const BUBBLE = "49006";
const ASTEROID = "49002";
const HELMET = "49003";
const ARMOR = "49004";
const CAPE = "49005";
const WRAPPED = "49007";
const MASTER = "49011";

const MAGNETO = WAVE8_STARTER_DECKS.find((d) => d.id === "magneto-leadership")!;
const SEAT = {
  identityCardId: MAGNETO.identityCardId,
  aspects: MAGNETO.aspects,
  deck: MAGNETO.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};

const auntMay = CORE_CARDS.find((c) => c.id === cardId("01006"));
if (auntMay?.type !== "support") throw new Error("no Aunt May");
const LISTENER_CARD: AnyCard = {
  ...auntMay,
  id: cardId(LISTENER),
  name: "Old Grievances stand-in",
  cost: 0,
  unique: false,
  aspect: "basic",
  abilities: [{ id: abilityId(USED_ANSWER) }],
} as AnyCard;
const FIXTURE = defineAbilities({
  [USED_ANSWER]: forcedResponse(
    on.moment(MAGNETIC_PULL_USED_MOMENT),
    dealDamage(varOf("moment.pulled.count"), yourIdentity),
  ),
});
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, MAGNETO_IDENTITY, MAGNETO_SUPPORT_UPGRADES_ALLIES, FIXTURE),
};

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handOf = (s: GameState): string[] => codes(s, playerOf(s, P1).hand);
const deckOf = (s: GameState): string[] => codes(s, playerOf(s, P1).deck);
const discardOf = (s: GameState): string[] => codes(s, playerOf(s, P1).discard);
const count = (list: readonly string[], code: string): number => list.filter((c) => c === code).length;
const hero = (s: GameState): InstanceId => identityOf(s);
const damageOf = (s: GameState): number => inst(s, hero(s)).damage;
const bonus = (s: GameState, stat: "atk" | "thw" | "def"): number => statBonus(s, DEPS, hero(s), stat);
const keywordNames = (s: GameState, id: InstanceId): string[] => keywordsOf(s, id, DEPS).map((k) => k.name);
const pull = (s: GameState) => use(P1, hero(s), PULL);

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...WAVE8_CARDS, LISTENER_CARD],
  } as never);
  const created = createGame(
    { ...config, players: [{ ...SEAT, deck: [...SEAT.deck.slice(0, -1), cardId(LISTENER)] }] },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const withForm = (s: GameState, form: "hero" | "alterEgo"): GameState => ({
  ...s,
  players: s.players.map((p) => ({
    ...p,
    identity: { ...p.identity, form, heroFormIndex: form === "hero" ? 0 : null, changedFormThisRound: false },
  })),
});
const heroGame = (): GameState => withForm(setupGame(), "hero");
const egoGame = (): GameState => withForm(setupGame(), "alterEgo");

/** Surgery: the top of the deck, in order, above the rest; the discard pile is emptied into the deck's bottom. */
function stackDeck(state: GameState, ...wanted: readonly string[]): GameState {
  const owner = playerOf(state, P1);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find(
      (c) => codeOf(state, c) === code && !used.includes(c),
    );
    if (!id) throw new Error(`no ${code}`);
    used.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !used.includes(id));
  const takenFromHand = owner.hand.length - strip(owner.hand).length;
  const rest = [...strip(owner.deck), ...strip(owner.discard)];
  const refill = rest.slice(rest.length - takenFromHand);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            deck: [...used, ...rest.slice(0, rest.length - takenFromHand)],
            discard: [],
            hand: [...strip(owner.hand), ...refill],
          }
        : p,
    ),
  };
}
/** Surgery: these cards are the discard pile, first = top (newest). */
function withDiscard(state: GameState, ...wanted: readonly string[]): GameState {
  const owner = playerOf(state, P1);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.hand].find((c) => codeOf(state, c) === code && !used.includes(c));
    if (!id) throw new Error(`no ${code}`);
    used.push(id);
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            deck: p.deck.filter((i) => !used.includes(i)),
            hand: p.hand.filter((i) => !used.includes(i)),
            discard: used,
          }
        : p,
    ),
  };
}

/** Takes the card out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attachFromHand(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}
/** Puts the card into the play area by surgery (a support, no cost). */
function putInPlay(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  return {
    id,
    state: {
      ...staged,
      players: staged.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}
const withArmor = (s: GameState) => attachFromHand(s, ARMOR, hero(s));
const withCape = (s: GameState) => attachFromHand(s, CAPE, hero(s));
const withBubble = (s: GameState) => attachFromHand(s, BUBBLE, hero(s));
const withListener = (s: GameState) => putInPlay(s, LISTENER).state;

/** Accepts the offered optional triggers of these cards, in the order offered; else the first legal answer. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id.endsWith(w) || state.instances[id.split(":")[0]!]?.cardId === w));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };
const declining: Picker = (state) => (state.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(state));
const run = (s: GameState, pick: Picker, ...commands: Parameters<typeof driveEventsPicking>[3][]) =>
  driveEventsPicking(DEPS, s, pick, ...commands);
const moments = (events: readonly GameEvent[], name: string) =>
  events.filter((e) => e.type === "momentRaised" && e.name === name);

const basicAttack = (attacker: InstanceId, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }) as never;
const basicThwart = (thwarter: InstanceId, scheme: InstanceId) =>
  ({ type: "basicThwart", playerId: P1, thwarterInstanceId: thwarter, schemeInstanceId: scheme }) as never;

describe("registry", () => {
  const refs = Object.values(REF);
  it("registers every ref of the group, each valid, and names the data artifacts in the skipped map", () => {
    expect(Object.keys(MAGNETO_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...refs].sort());
    for (const ref of refs) expect(validateDefinition(MAGNETO_SUPPORT_UPGRADES_ALLIES[ref]!)).toEqual([]);
    for (const id of [ASTEROID, HELMET, ARMOR, CAPE, BUBBLE, WRAPPED, MASTER]) {
      const card = WAVE8_CARDS.find((c) => c.id === cardId(id)) as never as { abilities: { id: string }[] };
      for (const a of card.abilities) {
        expect(a.id in MAGNETO_SUPPORT_UPGRADES_ALLIES || a.id in MAGNETO_SUPPORT_UPGRADES_ALLIES_SKIPPED).toBe(true);
      }
    }
    expect(Object.keys(MAGNETO_SUPPORT_UPGRADES_ALLIES_SKIPPED)).toHaveLength(0);
  });
});

describe("Asteroid M (49002)", () => {
  it("Alter-Ego Action: exhausts, shuffles the topmost MAGNETIC card of the discard pile into the deck, heals 1", () => {
    const { state: s0, id } = putInPlay(withDiscard(egoGame(), SQUARED_OFF, SHARDS, NOBLE, BUBBLE), ASTEROID);
    const hurt = withDamage(s0, hero(s0), 3);
    const { state } = run(hurt, firstLegal, use(P1, id, REF.asteroid));
    expect(inst(state, id).exhausted).toBe(true);
    // The topmost (newest) MAGNETIC card is Metal Shards, not the Bubble below it.
    expect(discardOf(state)).toEqual([SQUARED_OFF, NOBLE, BUBBLE]);
    expect(count(deckOf(state), SHARDS)).toBe(count(deckOf(hurt), SHARDS) + 1);
    expect(damageOf(state)).toBe(2);
  });

  it("heals with no MAGNETIC card in the discard pile, and shuffles one with no damage to heal", () => {
    const { state: a, id } = putInPlay(withDiscard(egoGame(), SQUARED_OFF), ASTEROID);
    const healed = run(withDamage(a, hero(a), 1), firstLegal, use(P1, id, REF.asteroid)).state;
    expect(damageOf(healed)).toBe(0);
    expect(discardOf(healed)).toEqual([SQUARED_OFF]);
    const { state: b, id: id2 } = putInPlay(withDiscard(egoGame(), SHARDS), ASTEROID);
    const shuffled = run(b, firstLegal, use(P1, id2, REF.asteroid)).state;
    expect(discardOf(shuffled)).toEqual([]);
    expect(damageOf(shuffled)).toBe(0);
  });

  it("is an alter-ego action only: refused in hero form, and refused when exhausted", () => {
    const { state: s0, id } = putInPlay(withDiscard(heroGame(), SHARDS), ASTEROID);
    expect(applyCommand(s0, use(P1, id, REF.asteroid), DEPS).ok).toBe(false);
    const { state: ego, id: id2 } = putInPlay(withDiscard(egoGame(), SHARDS), ASTEROID);
    const tired = patchInstance(ego, id2, { exhausted: true });
    expect(applyCommand(tired, use(P1, id2, REF.asteroid), DEPS).ok).toBe(false);
  });
});

describe("Magneto's Helmet (49003)", () => {
  it("Magneto gains steady in hero form only (not as Erik Lehnsherr)", () => {
    const base = heroGame();
    const { state: armed } = attachFromHand(base, HELMET, hero(base));
    expect(keywordNames(armed, hero(armed))).toContain("steady");
    expect(keywordNames(base, hero(base))).not.toContain("steady");
    const ego = egoGame();
    const { state: egoArmed } = attachFromHand(ego, HELMET, hero(ego));
    expect(keywordNames(egoArmed, hero(egoArmed))).not.toContain("steady");
  });

  it("Resource: exhausts to generate a wild resource for a MAGNETIC card only", () => {
    const base = heroGame();
    const { state: armed, id: helmet } = attachFromHand(base, HELMET, hero(base));
    // Magnetic Missile (cost 1, MAGNETIC): the Helmet alone pays it. Squared Off (cost 1, not MAGNETIC): it cannot.
    const missile = moveToHand(armed, P1, "49010");
    const squared = moveToHand(missile.state, P1, SQUARED_OFF);
    const paying = (card: InstanceId) =>
      applyCommand(
        squared.state,
        {
          type: "playCard",
          playerId: P1,
          cardInstanceId: card,
          payment: [resourceAbility(helmet, REF.helmetResource)],
          attachToInstanceId: null,
        } as never,
        DEPS,
      );
    expect(paying(missile.ids[0]!).ok).toBe(true);
    expect(paying(squared.ids[0]!).ok).toBe(false);
  });
});

describe("Magneto's Armor (49004): Response after the Pull resolves", () => {
  const pullWith = (top: readonly string[], pick: Picker = accepting(ARMOR)) => {
    const { state: s0 } = withArmor(heroGame());
    const s1 = stackDeck(s0, ...top);
    return run(s1, pick, pull(s1));
  };

  it("test 2 (Q42 = A): Noble Sacrifice (mental) and Magnetic Bubble (energy, found): THW 3 and DEF 3, ATK 2", () => {
    const { state } = pullWith([NOBLE, BUBBLE]);
    expect(2 + bonus(state, "thw")).toBe(3);
    expect(2 + bonus(state, "def")).toBe(3);
    expect(2 + bonus(state, "atk")).toBe(2);
  });

  it("a physical discard gives +1 ATK only; the bonuses last until the end of the round", () => {
    const { state } = pullWith([SQUARED_OFF, SHARDS]);
    expect(bonus(state, "atk")).toBe(1);
    expect(bonus(state, "thw")).toBe(0);
    expect(bonus(state, "def")).toBe(0);
    const next = settle(
      runWith(DEPS, state, endTurn(P1)),
      firstLegal,
      (s) => s.step.phase === "player" && s.round > state.round,
      DEPS,
    );
    expect(bonus(next, "atk")).toBe(0);
  });

  it("each line resolves at most once however many icons: two mental discards are +1 THW", () => {
    const { state } = pullWith([NOBLE, NOBLE, SHARDS]);
    // the starter deck holds more than one Noble Sacrifice only if it has two; the stack throws otherwise
    expect(bonus(state, "thw")).toBe(1);
  });

  it("test 3: the discard is Asteroid M alone (wild): no line resolves and the Response is not offered", () => {
    const { state, events } = pullWith([ASTEROID], (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseTriggers") throw new Error("the Armor was offered");
      return firstLegal(s);
    });
    expect(count(handOf(state), ASTEROID)).toBeGreaterThan(0);
    for (const stat of ["atk", "thw", "def"] as const) expect(bonus(state, stat)).toBe(0);
    expect(moments(events, MAGNETIC_PULL_MOMENT)).toHaveLength(1);
  });

  it("is optional: declined, no bonus", () => {
    const { state } = pullWith([NOBLE, SHARDS], declining);
    expect(bonus(state, "thw")).toBe(0);
  });

  it("Q41 = A: no MAGNETIC card in the deck: the discards stand, the Armor is not offered", () => {
    const { state: s0 } = withArmor(heroGame());
    const owner = playerOf(s0, P1);
    const nonMagnetic = owner.deck
      .filter(
        (id) =>
          !["49002", "49003", "49004", "49005", "49006", "49007", "49008", "49009", "49010", "49011"].includes(
            codeOf(s0, id),
          ),
      )
      .slice(0, 4);
    const s1 = { ...s0, players: s0.players.map((p) => ({ ...p, deck: nonMagnetic, discard: [] })) };
    const { state } = run(
      s1,
      (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTriggers") throw new Error("offered");
        return firstLegal(s);
      },
      pull(s1),
    );
    for (const stat of ["atk", "thw", "def"] as const) expect(bonus(state, stat)).toBe(0);
  });

  it("test 6: Old Grievances and the Armor both in play: the damage is dealt before the Armor is offered", () => {
    const { state: s0 } = withArmor(withListener(heroGame()));
    const s1 = stackDeck(s0, SQUARED_OFF, NOBLE, SHARDS);
    const before = damageOf(s1);
    let damageWhenOffered: number | null = null;
    const { state } = run(
      s1,
      (s) => {
        const c = s.pendingChoice;
        if (
          c?.prompt.kind === "chooseTriggers" &&
          c.options.some((o) => codeOf(s, o.optionId.split(":")[0] as InstanceId) === ARMOR)
        ) {
          damageWhenOffered = damageOf(s);
          return accepting(ARMOR)(s);
        }
        return firstLegal(s);
      },
      pull(s1),
    );
    expect(damageWhenOffered).toBe(before + 3);
    expect(bonus(state, "thw")).toBe(1);
  });
});

describe("Magneto's Cape (49005)", () => {
  it("Magneto gains the AERIAL trait in hero form only", () => {
    const base = heroGame();
    const { state: armed } = withCape(base);
    expect(traitsOf(armed, hero(armed), DEPS).map(String)).toContain("AERIAL");
    expect(traitsOf(base, hero(base), DEPS).map(String)).not.toContain("AERIAL");
    const ego = egoGame();
    const { state: egoArmed } = withCape(ego);
    expect(traitsOf(egoArmed, hero(egoArmed), DEPS).map(String)).not.toContain("AERIAL");
  });

  it("test 4: thwarts for 2 and exhausts, Pulls, exhausts the Cape and readies, then attacks for 2", () => {
    const { state: armed, id: cape } = withCape(heroGame());
    const scheme = armed.mainScheme.instanceId;
    const loaded = patchInstance(armed, scheme, { threat: 10 });
    const stacked = stackDeck(loaded, SQUARED_OFF, SHARDS);
    const thwarted = run(stacked, firstLegal, basicThwart(hero(stacked), scheme)).state;
    expect(mainThreat(thwarted)).toBe(8);
    expect(inst(thwarted, hero(thwarted)).exhausted).toBe(true);
    expect(applyCommand(thwarted, basicAttack(hero(thwarted), thwarted.activeVillainId!), DEPS).ok).toBe(false);
    const pulled = run(thwarted, accepting(CAPE), pull(thwarted)).state;
    expect(inst(pulled, cape).exhausted).toBe(true);
    expect(inst(pulled, hero(pulled)).exhausted).toBe(false);
    const villain = pulled.activeVillainId!;
    const hp = inst(pulled, villain).damage;
    const attacked = run(pulled, firstLegal, basicAttack(hero(pulled), villain)).state;
    expect(inst(attacked, villain).damage).toBe(hp + 2);
  });

  it("is optional, and an exhausted Cape is not offered", () => {
    const { state: armed, id: cape } = withCape(heroGame());
    const s1 = stackDeck(armed, SHARDS);
    const declined = run(s1, declining, pull(s1)).state;
    expect(inst(declined, cape).exhausted).toBe(false);
    const tired = patchInstance(s1, cape, { exhausted: true });
    const { state } = run(
      tired,
      (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTriggers") throw new Error("offered");
        return firstLegal(s);
      },
      pull(tired),
    );
    expect(inst(state, cape).exhausted).toBe(true);
  });
});

describe("Magnetic Bubble (49006)", () => {
  it("Magneto gains retaliate 1 in hero form", () => {
    const base = heroGame();
    const { state: armed } = withBubble(base);
    expect(keywordNames(armed, hero(armed))).toContain("retaliate");
    expect(keywordNames(base, hero(base))).not.toContain("retaliate");
  });

  it("test 5: Old Grievances' damage (3) is placed on the Bubble: 3 on it, Magneto stays undamaged", () => {
    const { state: s0, id: bubble } = withBubble(withListener(heroGame()));
    const s1 = stackDeck(s0, SQUARED_OFF, NOBLE, SHARDS);
    const { state } = run(s1, declining, pull(s1));
    expect(inst(state, bubble).damage).toBe(3);
    expect(damageOf(state)).toBe(0);
    expect(inst(state, bubble).attachedTo).toBe(hero(state));
  });

  it("test 5: with a tough status card the tough goes first and nothing is placed", () => {
    const { state: s0, id: bubble } = withBubble(withListener(heroGame()));
    const toughened = patchInstance(s0, hero(s0), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const s1 = stackDeck(toughened, SQUARED_OFF, NOBLE, SHARDS);
    const { state } = run(s1, declining, pull(s1));
    expect(inst(state, bubble).damage).toBe(0);
    expect(damageOf(state)).toBe(0);
    expect(inst(state, hero(state)).statuses.tough).toBe(0);
  });

  it("at 6 or more damage it is discarded after the hit: all of it is placed, past 6, and none reaches Magneto", () => {
    const { state: s0, id: bubble } = withBubble(withListener(heroGame()));
    const loaded = patchInstance(s0, bubble, { damage: 4 });
    const s1 = stackDeck(loaded, SQUARED_OFF, NOBLE, SHARDS);
    const { state } = run(s1, declining, pull(s1));
    expect(playerOf(state, P1).discard).toContain(bubble);
    expect(inst(state, bubble).attachedTo).toBeNull();
    expect(damageOf(state)).toBe(0);
  });

  it("below 6 it stays attached", () => {
    const { state: s0, id: bubble } = withBubble(withListener(heroGame()));
    const loaded = patchInstance(s0, bubble, { damage: 2 });
    const s1 = stackDeck(loaded, SQUARED_OFF, NOBLE, SHARDS);
    const { state } = run(s1, declining, pull(s1));
    expect(inst(state, bubble).damage).toBe(5);
    expect(inst(state, bubble).attachedTo).toBe(hero(state));
  });

  it("an enemy attack's damage is placed on the Bubble too (any source)", () => {
    const { state: armed, id: bubble } = withBubble(heroGame());
    const staged = armed;
    const after = settle(
      runWith(DEPS, staged, endTurn(P1)),
      (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s)),
      (s) => s.step.phase === "player" && s.round > staged.round,
      DEPS,
    );
    expect(inst(after, bubble).damage).toBeGreaterThan(0);
    expect(damageOf(after)).toBe(0);
  });
});

describe("Wrapped in Metal (49007)", () => {
  const minionGame = (code = "01101") => {
    const { state, id } = engageMinion(heroGame(), "01101", P1);
    const swapped = code === "01101" ? state : patchInstance(state, id, { cardId: cardId(code) });
    return { state: swapped, minion: id };
  };
  const activations = (events: readonly GameEvent[], minion: InstanceId) =>
    events.filter((e) => e.type === "enemyActivated" && e.enemyInstanceId === minion).length;

  it("the attached minion does not activate in the villain phase; an unwrapped one does", () => {
    const { state: base, minion } = minionGame();
    const { state: other, id: second } = engageMinion(base, "01101", P1);
    void second;
    const { state: armed } = attachFromHand(other, WRAPPED, minion);
    const wrapped = run(armed, firstLegal, endTurn(P1)).events;
    expect(activations(wrapped, minion)).toBe(0);
    expect(activations(run(other, firstLegal, endTurn(P1)).events, minion)).toBeGreaterThan(0);
  });

  it("test 1: Hellfire Pawn (guard, patrol, surge) loses its printed keywords; its traits stay", () => {
    const { state: base, minion } = minionGame("49040");
    const printed = keywordNames(base, minion);
    expect(printed).toContain("guard");
    const { state: armed } = attachFromHand(base, WRAPPED, minion);
    expect(keywordNames(armed, minion)).toEqual([]);
    expect(traitsOf(armed, minion, DEPS)).toEqual(traitsOf(base, minion, DEPS));
  });

  it("is played in hero form only, on a non-ELITE minion (card data)", () => {
    const card = WAVE8_CARDS.find((c) => c.id === cardId(WRAPPED))!;
    expect((card as never as { playRestrictions: unknown }).playRestrictions).toEqual({ form: "hero" });
    expect((card as never as { attachesTo: unknown }).attachesTo).toMatchObject({
      category: "minion",
      withoutTrait: "ELITE",
    });
  });
});

describe("Master of Magnetism (49011)", () => {
  it("prints no text and registers nothing; it is a MAGNETIC resource with an energy and a mental icon", () => {
    const card = WAVE8_CARDS.find((c) => c.id === cardId(MASTER))!;
    expect((card as never as { abilities: unknown[] }).abilities).toEqual([]);
    expect((card as never as { traits: string[] }).traits.map(String)).toContain("MAGNETIC");
  });
});
