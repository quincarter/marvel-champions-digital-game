/**
 * Rules QA for the Trickster Takeover pack `tt` (55001 to 55066: the Enchantress scenario, Trickster Magic, the God of Lies
 * scenario and the four linked allies): the interactions the module tests do not assert, each tied to an RRG 1.8 section
 * (`docs/rules/mc_rulesreference_v18_compressed.pdf`), the MC55 insert (`docs/campaign-modes/markdown/mc55_trickster_takeover.md`), an
 * FFG ruling by its date heading (docs/rulings/marvel-champions-rulings-post-rrg-1-7.md) or an owner answer (docs/phase7-wave9.md
 * section 4.1). A `FINDING` comment marks a case where the game and its source disagree: the expected behavior is an
 * `it.fails`. Findings are tabled in docs/phase7-wave9-qa.md.
 */
import { CORE_CARDS, TT_CARDS, cardId, encounterSetId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  maxHitPoints,
  podOf,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
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
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { wave9Scenario } from "../setup.js";
import {
  IRON_MAN,
  SHE_HULK,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  inPlayCard,
  onlyDeck,
  schemesBy,
} from "../testing.js";
import { TT_ASPECT_BASIC } from "./aspect-basic.js";
import { ENCHANTRESS } from "./enchantress.js";
import { GOD_OF_LIES } from "./god-of-lies.js";
import { TRICKSTER_MAGIC } from "./trickster-magic.js";

vi.setConfig({ testTimeout: 300_000 });

const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE8_ABILITIES, ENCHANTRESS, GOD_OF_LIES, TRICKSTER_MAGIC, TT_ASPECT_BASIC),
};

const BLANK = "01186"; // Advance: no boost icon
const SPIDER_WOMAN = "01011"; // ally, one printed wild resource
const HELLCAT = "01020"; // ally, one printed wild resource
const ENERGY = "01088"; // Energy resource card
const GENIUS = "01089"; // Genius resource card
const AUNT_MAY = "01006"; // support, cost 1

// ---------------------------------------------------------------------------------------------------------------
// The Enchantress driver (the same shape as enchantress-encounter.test.ts, with Trickster Magic scripted)
// ---------------------------------------------------------------------------------------------------------------

interface Sim {
  state: GameState;
  events: GameEvent[];
  /** Every card of the scenario's encounter deck as the game began. */
  readonly pool: readonly InstanceId[];
}
type Seat = typeof SPIDER_MAN | typeof IRON_MAN;

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

/** The encounter deck exactly these cards, top first, taken from the scenario's own cards that are not in play. */
function stack(sim: Sim, ...codes: string[]): void {
  const inPlay = new Set(cardsInPlay(sim.state));
  const used: InstanceId[] = [];
  for (const code of codes) {
    const id = sim.pool.find((i) => !inPlay.has(i) && !used.includes(i) && codeOf(sim.state, i) === code);
    if (!id) throw new Error(`no ${code} available`);
    used.push(id);
  }
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
}

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
function run(sim: Sim, command: Command, pick: Picker = firstLegal): void {
  const first = applyOk(sim.state, command, DEPS);
  sim.state = first.state;
  sim.events.push(...first.events);
  settleChoices(sim, pick);
}
/** Every listed player ends their turn; the villain phase runs on a deck of exactly these cards, top first. */
function round(
  sim: Sim,
  deck: readonly string[],
  pick: Picker = firstLegal,
  players: readonly PlayerId[] = [P1],
): void {
  stack(sim, ...deck);
  sim.events = [];
  for (const p of players) {
    const result = applyOk(sim.state, endTurn(p), DEPS);
    sim.state = result.state;
    sim.events.push(...result.events);
  }
  settleChoices(sim, pick);
}

/** Takes the optional trigger whose id contains `ability` whenever it is offered; every other prompt as `firstLegal`. */
const taking =
  (ability: string): Picker =>
  (s) => {
    const hit = s.pendingChoice!.options.find((o) => (o.optionId as string).includes(ability));
    return hit ? [hit.optionId] : firstLegal(s);
  };

const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const threatOn = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const refused = (s: GameState, command: Command): boolean => !applyCommand(s, command, DEPS).ok;
const gazeOn = (s: GameState, player: PlayerId = P1): InstanceId => inst(s, identityOf(s, player)).attachments[0]!;
const charm = (s: GameState, id: InstanceId): number => inst(s, id).counters["charm"] ?? 0;
const attachedCodes = (s: GameState, id: InstanceId): string[] => inst(s, id).attachments.map((a) => codeOf(s, a));
const basicAttack = (s: GameState, attacker: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/** A linked ally from the set-aside area put into a player's play area (test surgery), ready. */
function allyFromAside(s: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const id = s.encounterSetAside.find((i) => codeOf(s, i) === code);
  if (!id) throw new Error(`${code} is not set aside`);
  const patched = patchInstance(s, id, { ownerId: player, controllerId: player, faceup: true, exhausted: false });
  return {
    id,
    state: {
      ...patched,
      encounterSetAside: patched.encounterSetAside.filter((i) => i !== id),
      players: patched.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    },
  };
}
/** `codes` added to `player`'s hand: spare deck cards relabeled and moved (test surgery). */
function giveHand(
  s: GameState,
  player: PlayerId,
  ...codes: readonly string[]
): { state: GameState; ids: InstanceId[] } {
  const deck = playerOf(s, player).deck;
  const ids = codes.map((_, n) => deck[deck.length - 1 - n]!);
  const relabeled = codes.reduce((acc, code, n) => patchInstance(acc, ids[n]!, { cardId: cardId(code) }), s);
  return {
    ids,
    state: {
      ...relabeled,
      players: relabeled.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => !ids.includes(i)), hand: [...p.hand, ...ids] } : p,
      ),
    },
  };
}
/** The top cards of `player`'s deck relabeled as these cards, top first (test surgery). */
function withDeckTop(s: GameState, player: PlayerId, ...codes: readonly string[]): GameState {
  const deck = playerOf(s, player).deck;
  return codes.reduce((acc, code, n) => patchInstance(acc, deck[n]!, { cardId: cardId(code) }), s);
}
/** Enchantress's current stage one hit point from falling. */
function nearDefeat(sim: Sim): void {
  const v = villainOf(sim.state);
  sim.state = patchInstance(sim.state, v, { damage: maxHitPoints(sim.state, v, DEPS)! - 1 });
}

// ---------------------------------------------------------------------------------------------------------------
// Future of Despair: "cannot take damage"
// ---------------------------------------------------------------------------------------------------------------

describe("Future of Despair 55006 (Enchantress II and III)", () => {
  // Ruling March 19, 2026 - Ruling 2; RRG "Target" (p. 42: a target that "cannot take damage" is not a valid target for
  // an ability or game function whose only effect on that target is to deal it damage). The ruling extends it to basic
  // powers, and names Whirlwind (the ally, 55065) against Enchantress.
  it("ruling March 19, 2026 (2): Whirlwind (ally) cannot basic attack Enchantress while Future of Despair is in play, so his interrupt never removes threat", () => {
    const sim = open();
    const whirlwind = allyFromAside(sim.state, "55065");
    sim.state = whirlwind.state;
    const v = villainOf(sim.state);
    // Control: before Future of Despair, the attack is legal.
    expect(refused(sim.state, basicAttack(sim.state, whirlwind.id, v))).toBe(false);
    nearDefeat(sim);
    stack(sim, BLANK, BLANK);
    run(sim, basicAttack(sim.state, identityOf(sim.state), v));
    const despair = inPlayCard(sim.state, "55006")!;
    expect(despair).toBeDefined();
    const before = threatOn(sim.state, sim.state.mainScheme.instanceId);
    const stage2 = villainOf(sim.state);
    expect(refused(sim.state, basicAttack(sim.state, whirlwind.id, stage2))).toBe(true);
    // The identity's own basic attack is refused for the same reason (RRG p. 42).
    expect(refused(sim.state, basicAttack(sim.state, identityOf(sim.state), stage2))).toBe(true);
    expect(threatOn(sim.state, sim.state.mainScheme.instanceId)).toBe(before);
  });
});

describe("Ulik 55020", () => {
  // MC55 card 55020: "Forced Response: After a player deals any amount of damage to Enchantress, Ulik attacks that
  // player." RRG "Ownership and Control" (p. 31): an ally's damage is dealt by the player who controls the ally.
  it("a second player's ally damages Enchantress: Ulik, engaged with the first player, attacks the ally's controller", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    round(sim, [BLANK, BLANK, "55020", "55022"], firstLegal, [P1, P2]);
    const ulik = inPlayCard(sim.state, "55020")!;
    expect(inst(sim.state, ulik).engagedWith).toBe(P1);
    const titania = allyFromAside(sim.state, "55064", P2);
    sim.state = titania.state;
    const active = (sim.state.step as { activePlayerId: PlayerId }).activePlayerId;
    expect(active).toBe(P2);
    stack(sim, BLANK, BLANK);
    sim.events = [];
    run(sim, basicAttack(sim.state, titania.id, villainOf(sim.state), P2));
    expect(damageOn(sim.state, villainOf(sim.state))).toBeGreaterThan(0);
    const attacks = attacksBy(sim.state, sim.events, "55020");
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.targetInstanceId).toBe(identityOf(sim.state, P2));
  });
});

describe("Seduced 55015 in a two-player game", () => {
  // MC55 card 55015: "You cannot make basic attacks or play Attack events." (attached to your identity). "You" is the
  // identity's player (RRG "You, Your", p. 49), so the other player is untouched.
  it("player 1's Seduced does not stop player 2's basic attack or Attack events", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    round(sim, [BLANK, BLANK, "55015", "55022"], firstLegal, [P1, P2]);
    expect(attachedCodes(sim.state, identityOf(sim.state, P1))).toContain("55015");
    // Player 2 acts first this round. Swinging Web Kick (01005) is an Attack event.
    expect((sim.state.step as { activePlayerId: PlayerId }).activePlayerId).toBe(P2);
    expect(refused(sim.state, basicAttack(sim.state, identityOf(sim.state, P1), villainOf(sim.state), P1))).toBe(true);
    expect(refused(sim.state, basicAttack(sim.state, identityOf(sim.state, P2), villainOf(sim.state), P2))).toBe(false);
    // Haymaker (01087, basic, cost 2) is an Attack event; two Energy resource cards pay for it.
    const mine = giveHand(sim.state, P2, "01087", ENERGY, ENERGY);
    expect(refused(mine.state, play(P2, mine.ids[0]!, [mine.ids[1]!, mine.ids[2]!]))).toBe(false);
    const theirs = giveHand(sim.state, P1, "01087", ENERGY, ENERGY);
    expect(refused(theirs.state, play(P1, theirs.ids[0]!, [theirs.ids[1]!, theirs.ids[2]!]))).toBe(true);
    // Control: the same play by player 1 without the card is legal (so the refusal is Seduced's, not the turn order's).
    const seducedCard = inst(sim.state, identityOf(sim.state, P1)).attachments.find(
      (a) => codeOf(sim.state, a) === "55015",
    )!;
    const freed = patchInstance(theirs.state, identityOf(theirs.state, P1), {
      attachments: inst(theirs.state, identityOf(theirs.state, P1)).attachments.filter((a) => a !== seducedCard),
    });
    expect(refused(freed, play(P1, theirs.ids[0]!, [theirs.ids[1]!, theirs.ids[2]!]))).toBe(false);
  });
});

describe("Zzzax 55059 and the Zzzax ally 55066: a printed [energy] resource", () => {
  // RRG "Wild Resource" (p. 48): "When resources are not being generated for a cost, a wild resource does not have any
  // characteristic other than 'wild resource.' In such contexts, wild resources cannot be interpreted as any of the other
  // resource types." Neither card generates a resource for a cost, so a printed [wild] icon is not an [energy] resource.
  const hurtBy = (top: readonly string[]): number => {
    const sim = open();
    sim.state = withDeckTop(sim.state, P1, ...top);
    const before = damageOn(sim.state, identityOf(sim.state));
    round(sim, [BLANK, "55059"]);
    // Enchantress's own attack (ATK 1) is the same in every run; the Zzzax indirect damage is what differs.
    return damageOn(sim.state, identityOf(sim.state)) - before;
  };

  it("When Revealed: a printed wild resource among the 4 discarded cards is no indirect damage; the Energy resource card prints two energy icons, 2 damage", () => {
    const none = hurtBy([SPIDER_WOMAN, HELLCAT, GENIUS, SPIDER_WOMAN]);
    const one = hurtBy([SPIDER_WOMAN, HELLCAT, GENIUS, ENERGY]);
    expect(one - none).toBe(2);
  });

  it("Response: a card whose only printed resource is wild is not found among the top 5 (the control with an energy card is)", () => {
    const sim = open();
    // Zzzax revealed and engaged, then defeated by a real basic attack.
    round(sim, [BLANK, "55059"]);
    const zzzax = inPlayCard(sim.state, "55059")!;
    sim.state = patchInstance(sim.state, zzzax, { damage: maxHitPoints(sim.state, zzzax, DEPS)! - 1 });
    const wildOnly = withDeckTop(sim.state, P1, SPIDER_WOMAN, HELLCAT, SPIDER_WOMAN, HELLCAT, SPIDER_WOMAN);
    const withEnergy = withDeckTop(sim.state, P1, SPIDER_WOMAN, HELLCAT, SPIDER_WOMAN, HELLCAT, ENERGY);
    const handAfter = (start: GameState): number => {
      const s2: Sim = { state: start, events: [], pool: sim.pool };
      run(s2, basicAttack(s2.state, identityOf(s2.state), zzzax), taking("55066.zzzax-response"));
      expect(playerOf(s2.state, P1).playArea.map((i) => codeOf(s2.state, i))).toContain("55066");
      return playerOf(s2.state, P1).hand.length;
    };
    expect(handAfter(withEnergy) - handAfter(wildOnly)).toBe(1);
  });
});

describe("Whirlwind 55058", () => {
  // MC55 p. 5 card 55058: "Quickstrike" and "Forced Response: After Whirlwind attacks you, take 1 indirect damage for each
  // side scheme in play". RRG "Quickstrike" (p. 36): a minion engages, and Quickstrike answers that engagement (once
  // its reveal is done; he has no When Revealed). The attack is a real attack, so the Forced Response answers it.
  it("revealed from the encounter deck, his Quickstrike attack happens at once and its Forced Response counts the side schemes in play", () => {
    const hurt = (withSideScheme: boolean): { damage: number; attacks: number } => {
      const sim = open();
      if (withSideScheme) round(sim, [BLANK, "55022"]);
      sim.state = patchInstance(sim.state, identityOf(sim.state), { damage: 0 });
      round(sim, [BLANK, "55058"]);
      const attacks = attacksBy(sim.state, sim.events, "55058");
      return { damage: damageOn(sim.state, identityOf(sim.state)), attacks: attacks.length };
    };
    const without = hurt(false);
    const withOne = hurt(true);
    expect(without.attacks).toBe(1);
    expect(withOne.attacks).toBe(1);
    // Spellbound (55022) is the one side scheme: exactly 1 more indirect damage.
    expect(withOne.damage - without.damage).toBe(1);
  });
});

describe("Crown of the Enchantress 55016 and a new villain stage", () => {
  // RRG "Villain" (the stage-change rules): when the new stage has the same title as the defeated one, "Attachments,
  // upgrades, status cards, counters, and non-damage tokens on a villain carry over to the new stage."
  it("the Crown stays on Enchantress when stage I is defeated and stage II replaces it", () => {
    const sim = open();
    round(sim, [BLANK, "55016"]);
    const crown = inPlayCard(sim.state, "55016")!;
    expect(inst(sim.state, crown).attachedTo).toBe(villainOf(sim.state));
    nearDefeat(sim);
    stack(sim, BLANK, BLANK);
    run(sim, basicAttack(sim.state, identityOf(sim.state), villainOf(sim.state)));
    expect(sim.state.villains[0]!.stageIndex).toBe(1);
    expect(inst(sim.state, crown).attachedTo).toBe(villainOf(sim.state));
    expect(inst(sim.state, villainOf(sim.state)).attachments).toContain(crown);
  });
});

describe("Spellbound 55022", () => {
  // MC55 card 55022 has two sentences: "Each player whose identity has the Defiant trait places 1 charm counter ... Each
  // player whose identity has the Enthralled trait discards a card they control." RRG "Resolving abilities" (the effects of
  // an ability resolve in the order printed). Ruling February 28, 2026 - Ruling 5 (1) reads a choosing sentence apart from
  // its resolution, which does not apply here: the first sentence has no choice, so it resolves in full (the fifth counter
  // flips the Gaze) before the second sentence reads the trait. The built reading is pinned; see the rules question in
  // docs/phase7-wave9-qa.md.
  it("a Defiant player at 4 counters: the fifth counter flips the Gaze, and the now-Enthralled player discards a card they control", () => {
    const sim = open();
    const gaze = gazeOn(sim.state);
    // The Gaze swapped for Trance of Sloth's (55010a): its When Revealed stuns, and leaves the support alone.
    const other = Object.values(sim.state.instances).find((i) => (i.cardId as string) === "55010a")!;
    const held = inst(sim.state, gaze).cardId;
    sim.state = patchInstance(patchInstance(sim.state, other.instanceId, { cardId: held }), gaze, {
      cardId: other.cardId,
    });
    sim.state = patchInstance(sim.state, gaze, { counters: { charm: 3 } });
    const may = giveHand(sim.state, P1, AUNT_MAY);
    const mayId = may.ids[0]!;
    sim.state = patchInstance(
      {
        ...may.state,
        players: may.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== mayId), playArea: [...p.playArea, mayId] } : p,
        ),
      },
      mayId,
      { controllerId: P1, faceup: true },
    );
    round(sim, [BLANK, "55022"]);
    // Enchantress's attack took the Gaze to its fourth counter; it is still Defiant and sealed.
    expect(charm(sim.state, gaze)).toBe(4);
    expect(inst(sim.state, gaze).flipped).toBeFalsy();
    const scheme = inPlayCard(sim.state, "55022")!;
    sim.state = patchInstance(sim.state, scheme, { threat: 1 });
    run(sim, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(sim.state),
      schemeInstanceId: scheme,
    });
    expect(inst(sim.state, gaze).flipped).toBe(true);
    expect(playerOf(sim.state, P1).discard).toContain(mayId);
    expect(playerOf(sim.state, P1).playArea).not.toContain(mayId);
  });
});

describe("Law of Attraction 55021 and the Trickster Magic minions", () => {
  // MC55 pp. 5 and 22: Absorbing Man, Titania, Whirlwind and Zzzax print the ENTHRALLED trait, so Law of Attraction's
  // "Discard cards ... until an Enthralled minion is discarded. Reveal that minion" finds them like Enthralled Lackey.
  it("a Trickster Magic minion (Titania, Enthralled) is the minion discarded and revealed, engaging the revealing player", () => {
    const sim = open();
    round(sim, [BLANK, "55021", "01188", "55057"]);
    const titania = inPlayCard(sim.state, "55057");
    expect(titania).toBeDefined();
    expect(inst(sim.state, titania!).engagedWith).toBe(P1);
    expect(inPlayCard(sim.state, "55021")).toBeDefined();
  });
});

describe("Puppet Master 55061 with two heroes in expert mode", () => {
  // MC55 card 55061 "In expert mode, Puppet Master gains hinder 1 per hero"; MC55 p. 2: "When a card with hinder X enters
  // play, place X additional threat on that card." Two heroes: 2 printed threat plus 2.
  it("enters with 2 + 2 threat for two heroes, and 2 + 0 in standard mode", () => {
    const entered = (difficulty: "standard" | "expert"): number => {
      const sim = open([SPIDER_MAN, IRON_MAN], { difficulty });
      round(sim, [BLANK, BLANK, "55061", "55022"], firstLegal, [P1, P2]);
      return threatOn(sim.state, inPlayCard(sim.state, "55061")!);
    };
    expect(entered("standard")).toBe(2);
    expect(entered("expert")).toBe(4);
  });
});

describe("Enchantress II and III: Toughness", () => {
  // RRG "Toughness" (p. 45): a character with toughness enters play with a tough status card; ruling April 30, 2026 -
  // Ruling 3 (2): it does so when it enters play during setup. In expert mode the game begins on Enchantress II (Steady.
  // Toughness.), so she starts the game with the tough card.
  it("expert: Enchantress II begins the game with one tough status card; standard stage I (no toughness) has none", () => {
    const expert = open([SPIDER_MAN], { difficulty: "expert" });
    expect(inst(expert.state, villainOf(expert.state)).statuses.tough).toBe(1);
    const standard = open();
    expect(inst(standard.state, villainOf(standard.state)).statuses.tough).toBe(0);
  });

  // Built behavior, a rules question in docs/phase7-wave9-qa.md: the stage II that replaces a defeated stage I (RRG "Villain
  // Defeat", p. 47: "The next sequential stage of the villain deck is revealed") also receives its tough status card.
  it("standard: stage II, revealed when stage I is defeated, receives a tough status card too (built reading)", () => {
    const sim = open();
    nearDefeat(sim);
    stack(sim, BLANK, BLANK);
    run(sim, basicAttack(sim.state, identityOf(sim.state), villainOf(sim.state)));
    expect(sim.state.villains[0]!.stageIndex).toBe(1);
    expect(inst(sim.state, villainOf(sim.state)).statuses.tough).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// God of Lies
// ---------------------------------------------------------------------------------------------------------------

/** Loki, God of Lies, one player, standard; `avatar` scans seeds for that Avatar of Loki (a random draw of the seed). */
function openGod(players: readonly Seat[] = [SPIDER_MAN], avatar?: string): GameState {
  for (let seed = 1; seed < 60; seed++) {
    const config = wave9Scenario("god-of-lies", { players, seed, difficulty: "standard" });
    const created = createGame(config, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
    if (avatar === undefined || codeOf(state, state.activeVillainId) === avatar)
      return heroForm(state, ...players.map((_, i) => `p${i + 1}` as PlayerId));
  }
  throw new Error(`no seed deals ${avatar}`);
}
/** The god-of-lies state driven like a `Sim` (no pool: the encounter deck is the scenario's own). */
function godSim(state: GameState): Sim {
  return { state, events: [], pool: [] };
}
const worldsThreat = (s: GameState): number => podOf(s).shared!.schemeThreat;

describe("God of Lies: the neutral Worlds Collide and 'each scheme in play'", () => {
  // MC55 p. 18: Loki, God of Lies and Worlds Collide "cannot be affected by any ability that refers to 'the villain' or
  // 'the main scheme'"; Worlds Collide 55028a: "Cards cannot affect this scheme or Loki, God of Lies, unless they refer to
  // those cards by title." Whirlwind (ally, 55065): "remove 1 threat from each scheme in play" names no scheme by title.
  it("Whirlwind (ally) removes threat from Mischief and Mayhem but never from Worlds Collide", () => {
    let s = openGod();
    const whirlwind = allyFromAside(s, "55065");
    s = whirlwind.state;
    const main = s.mainScheme.instanceId;
    s = patchInstance(s, main, { threat: 3 });
    s = { ...s, pod: { ...podOf(s), shared: { ...podOf(s).shared!, schemeThreat: 1 } } };
    const sim = godSim(s);
    run(sim, basicAttack(sim.state, whirlwind.id, sim.state.activeVillainId, P1), taking("55065.whirlwind-interrupt"));
    expect(threatOn(sim.state, main)).toBe(2);
    expect(worldsThreat(sim.state)).toBe(1);
    // +1 ATK for the one threat removed: 0 + 1 damage to the Avatar of Loki.
    expect(damageOn(sim.state, sim.state.activeVillainId)).toBe(1);
  });
});

describe("God of Lies: Feigned Retreat 55053 against Mischief and Mayhem 55033b", () => {
  // Feigned Retreat: "Interrupt: When an identity would take any amount of damage, remove 1 synergy counter from here ->
  // prevent 4 of that damage." Mischief and Mayhem 1B: "Forced Interrupt: When an identity would be defeated, change that
  // identity's form to alter-ego, set its hit point dial to 1, and place 1 threat on Worlds Collide instead." RRG "Prevent"
  // (p. 35) and "Interrupt": the damage window precedes the defeat, so a prevented hit never reaches the defeat.
  const villainPhaseHit = (withCounter: boolean): GameState => {
    // Loki the Miscreant: his attack is the only damage; his own Forced Response (after a treachery) deals none.
    let s = onlyDeck(openGod([SPIDER_MAN], "55030a"), "01186", "01186", "01188", "01187", "01187", "01189", "01190");
    const hero = identityOf(s);
    s = patchInstance(s, hero, { damage: maxHitPoints(s, hero, DEPS)! - 1 });
    if (withCounter) {
      const retreat = cardsInPlay(s).find((i) => codeOf(s, i) === "55053")!;
      s = patchInstance(s, retreat, { counters: { synergy: 1 } });
    }
    const sim = godSim(s);
    sim.events = [];
    const result = applyOk(sim.state, endTurn(P1), DEPS);
    sim.state = result.state;
    sim.events.push(...result.events);
    settleChoices(sim, taking("55053.feigned-retreat-interrupt"));
    return sim.state;
  };

  it("with a synergy counter the hit is prevented: the identity is not defeated and Worlds Collide gets no threat", () => {
    const s = villainPhaseHit(true);
    expect(playerOf(s, P1).identity.form).toBe("hero");
    expect(worldsThreat(s)).toBe(0);
    const retreat = cardsInPlay(s).find((i) => codeOf(s, i) === "55053")!;
    expect(inst(s, retreat).counters["synergy"] ?? 0).toBe(0);
  });

  it("control, no counter: the same hit would defeat the identity, so it changes to alter-ego with 1 hit point and Worlds Collide gets 1 threat", () => {
    const s = villainPhaseHit(false);
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(worldsThreat(s)).toBe(1);
  });
});

describe("Linked allies and She-Hulk's nemesis Titania (owner question 58 = A)", () => {
  // MC55 p. 2: each linked ally "should be set aside during setup for any scenario using Trickster Magic as a modular set";
  // RRG "Linked (Card Title)" (p. 27). Owner question 58 = A: only the minion of the same set counts, so She-Hulk's nemesis
  // Titania (Core 01162, her own encounter set) does not set the Titania ally aside in a game without Trickster Magic.
  const POOL: readonly AnyCard[] = [...CORE_CARDS, ...TT_CARDS];
  const aside = (withSet: boolean): string[] => {
    const config = coreScenario("rhino", {
      players: [SHE_HULK],
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: POOL,
    });
    const copies = withSet
      ? TT_CARDS.filter(
          (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("trickster_magic")),
        ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id))
      : [];
    const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    return created.state.encounterSetAside.map((id) => codeOf(created.state, id));
  };

  it("the Titania ally is not set aside for the nemesis Titania alone, and is set aside once when Trickster Magic is in the game", () => {
    // The nemesis set is in play (She-Hulk's), the minion Titania is in the encounter deck or set aside as her nemesis.
    expect(aside(false)).not.toContain("55064");
    expect(aside(true).filter((c) => c === "55064")).toEqual(["55064"]);
  });
});

describe("Forced Actions (MC55 p. 7)", () => {
  // MC55 p. 7: "the player phase cannot end until all possible forced actions among all players have been performed. If a
  // card with a Forced Action ability is discarded, or the cost cannot otherwise be paid (such as by the card becoming
  // exhausted ...), then the action cannot be performed and the players are free to end the player phase as normal."
  const owed = (): Sim => {
    const sim = open();
    round(sim, [BLANK, "55014"]);
    return sim;
  };
  it("owed while the card is ready; free once it is exhausted by another effect", () => {
    const sim = owed();
    const card = inPlayCard(sim.state, "55014")!;
    expect(refused(sim.state, endTurn(P1))).toBe(true);
    const tired = patchInstance(sim.state, card, { exhausted: true });
    expect(refused(tired, endTurn(P1))).toBe(false);
  });

  it("free once the card is discarded (its own Alter-Ego Action, in alter-ego form)", () => {
    const sim = owed();
    const card = inPlayCard(sim.state, "55014")!;
    sim.state = {
      ...sim.state,
      players: sim.state.players.map((p) =>
        p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "alterEgo" as const } } : p,
      ),
    };
    expect(refused(sim.state, endTurn(P1))).toBe(true);
    run(sim, use(P1, card, "55014.love-concoction-action"));
    expect(inPlayCard(sim.state, "55014")).toBeUndefined();
    expect(refused(sim.state, endTurn(P1))).toBe(false);
  });
});

describe("Spell Shards 55026 and a tough identity", () => {
  // MC55 card 55026: "Take 3 indirect damage. If your identity took any amount of damage this way, place 1 charm counter".
  // RRG "Indirect Damage" (p. 24): "A character with a tough status card can be assigned indirect damage up to its remaining
  // hit points, and all damage assigned to it is prevented by its tough status card." Prevented damage is damage dealt but
  // not taken (ruling January 17, 2026 - Ruling 3 (1)), so the identity took none and no counter is placed.
  it("all 3 assigned to a tough identity is prevented: the tough card is spent, no damage taken, and no charm counter", () => {
    const sim = open();
    const identity = identityOf(sim.state);
    // Enchantress is stunned so her own attack (and its Forced Response counter) does not happen this round.
    sim.state = patchInstance(sim.state, villainOf(sim.state), {
      statuses: { ...inst(sim.state, villainOf(sim.state)).statuses, stunned: 1 },
    });
    sim.state = patchInstance(sim.state, identity, { statuses: { ...inst(sim.state, identity).statuses, tough: 1 } });
    const gaze = gazeOn(sim.state);
    const toIdentity: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "assignIndirectDamage") return firstLegal(s);
      const mine = choice.options.filter((o) => (o.optionId as string).startsWith(`${identity}#`));
      return mine.slice(0, choice.minSelections).map((o) => o.optionId);
    };
    // The stunned villain draws no boost card, so the top card is the one dealt.
    round(sim, ["55026", BLANK], toIdentity);
    expect(inst(sim.state, identity).statuses.tough).toBe(0);
    expect(damageOn(sim.state, identity)).toBe(0);
    expect(charm(sim.state, gaze)).toBe(0);
  });
});

describe("Sindr 55019 against an alter-ego", () => {
  // MC55 card 55019: "If your identity has the Defiant trait, Sindr activates against you." RRG "Activation" (an enemy
  // activates by attacking a hero, or by scheming against an alter-ego): in alter-ego form the activation is a scheme, so
  // "Sindr's attacks deal indirect damage" does not come into it and no damage is dealt.
  it("Defiant, in alter-ego form: Sindr schemes (no attack, no indirect damage)", () => {
    const sim = open();
    sim.state = {
      ...sim.state,
      players: sim.state.players.map((p) =>
        p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "alterEgo" as const } } : p,
      ),
    };
    round(sim, [BLANK, "55019"]);
    expect(inPlayCard(sim.state, "55019")).toBeDefined();
    expect(schemesBy(sim.state, sim.events, "55019")).toHaveLength(1);
    expect(attacksBy(sim.state, sim.events, "55019")).toHaveLength(0);
    expect(damageOn(sim.state, identityOf(sim.state))).toBe(0);
  });
});

describe("Not stageable", () => {
  it.todo(
    "Ulik 55020 hears damage 'dealt' to Enchantress while Future of Despair is in play (the script's comment, from ruling January 17, 2026 - Ruling 3 (1): prevented damage is damage dealt but not taken): every damaging effect available in the harness targets her, and ruling March 19, 2026 - Ruling 2 makes her an invalid target, so there is no way to deal her damage to observe",
  );
  it.todo(
    "Epic Multiplayer Mode (MC55 pp. 11 to 17: per-group icons, pods, a shared Mangog and Door Between Worlds across groups): the engine plays Single Group Mode only, so the pod cases are not testable",
  );
});
